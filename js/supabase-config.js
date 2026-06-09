/**
 * AVANTE SANTA MARIA
 * Configuração de Conexão com o Supabase
 * 
 * INSTRUÇÕES:
 * 1. Crie seu projeto no site https://supabase.com
 * 2. Vá em Settings (engrenagem) > API
 * 3. Copie a "Project URL" e cole na variável SUPABASE_URL
 * 4. Copie a "Project API keys" (anon, public) e cole na variável SUPABASE_ANON_KEY
 */

const SUPABASE_URL = 'https://lqouuvtudsfmsidiayxz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3GcYlssvagfzJOQNUvy3Fg_HFrVGOFL';

// Resolve conflict with global 'supabase' from CDN
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
