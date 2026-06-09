-- ==============================================================================
-- AVANTE SANTA MARIA - SUPABASE DATABASE SCHEMA
-- ==============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
-- Ativa a extensão PostGIS para cálculos precisos de geolocalização e distâncias.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ==============================================================================
-- 2. TABELAS
-- ==============================================================================

-- Tabela Profiles (Perfis dos Usuários)
-- Mantém a identidade pública (anônima para os cidadãos) dissociada dos dados sensíveis do auth.users.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'citizen',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela Reports (Denúncias/Ocorrências)
-- Armazena os dados das denúncias com o ponto geográfico exato.
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    location geography(POINT) NOT NULL, -- Uso da extensão PostGIS
    address TEXT,
    status TEXT NOT NULL DEFAULT 'analise',
    image_url TEXT,
    is_critical BOOLEAN DEFAULT false,
    supporters_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. GERAÇÃO AUTOMÁTICA DE NICKNAME (TRIGGERS)
-- ==============================================================================

-- Função engatilhada toda vez que um usuário se cadastra no Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    random_num INTEGER;
    new_nickname TEXT;
BEGIN
    -- Gera um número aleatório entre 1000 e 9999
    random_num := floor(random() * 9000 + 1000);
    new_nickname := 'Cidadão_' || random_num::TEXT;

    -- Insere o perfil automaticamente com a role padrão "citizen"
    INSERT INTO public.profiles (id, nickname, role)
    VALUES (NEW.id, new_nickname, 'citizen');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o Trigger na tabela escondida do Supabase (auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==============================================================================
-- 4. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

-- Ativa o RLS nas tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Políticas para Profiles
-- 1. Qualquer pessoa (logada ou anônima) pode ler os nicknames para ver os autores das denúncias
CREATE POLICY "Profiles são públicos para visualização" 
    ON public.profiles FOR SELECT 
    USING (true);

-- 2. Usuários só podem alterar o próprio perfil
CREATE POLICY "Usuários podem atualizar o próprio perfil" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Políticas para Reports
-- 1. Qualquer pessoa pode ver as denúncias no mapa/feed
CREATE POLICY "Denúncias são públicas para visualização" 
    ON public.reports FOR SELECT 
    USING (true);

-- 2. Apenas usuários logados podem inserir novas denúncias, e apenas no próprio nome
CREATE POLICY "Cidadãos autenticados podem inserir denúncias" 
    ON public.reports FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- 3. Apenas administradores ou instituições podem alterar o status de uma denúncia
CREATE POLICY "Instituições podem atualizar o status das denúncias" 
    ON public.reports FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('institution', 'admin')
        )
    );

-- ==============================================================================
-- 5. STORAGE BUCKET (FOTOS)
-- ==============================================================================

-- O código abaixo insere a configuração do Bucket de Imagens, se ainda não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('report_images', 'report_images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage
-- 1. Visualização pública das fotos
CREATE POLICY "Imagens públicas" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'report_images');

-- 2. Inserção permitida para usuários autenticados
CREATE POLICY "Cidadãos podem subir fotos" 
    ON storage.objects FOR INSERT 
    WITH CHECK (
        bucket_id = 'report_images' 
        AND auth.role() = 'authenticated'
    );
