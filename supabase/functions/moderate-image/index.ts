import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * AVANTE SANTA MARIA - EDGE FUNCTION
 * AI Image Moderation (Mock)
 * 
 * Esta função é acionada antes que uma denúncia seja salva no banco de dados.
 * O objetivo é impedir que conteúdo impróprio (nudez, fotos totalmente pretas, etc.)
 * suje o banco de dados e chegue ao mapa público.
 */

serve(async (req) => {
  // CORS configuration
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Intercepta a requisição OPTIONS para CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Pega os dados da requisição (A imagem vem codificada em base64 ou como URL)
    const { imageBase64, imageUrl } = await req.json()

    if (!imageBase64 && !imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma imagem foi enviada para moderação.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // =========================================================================
    // 2. LÓGICA DE MODERAÇÃO POR IA (MOCK)
    // =========================================================================
    // Aqui você integraria a API do Google Cloud Vision ou OpenAI Vision.
    // Exemplo: await fetch('https://vision.googleapis.com/v1/images:annotate', ...)
    
    // Para efeito de protótipo, vamos aprovar a imagem na maioria das vezes,
    // mas simular uma reprovação em cerca de 5% das tentativas para validar o fluxo do Frontend.
    
    const isApproved = Math.random() > 0.05; // 95% de chance de aprovação
    
    if (!isApproved) {
      // 3. Se a IA reprovar, retorna HTTP 400 (Bad Request)
      return new Response(
        JSON.stringify({ 
          approved: false, 
          reason: 'Conteúdo classificado como impróprio pela moderação automática.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    // 4. Se aprovado, retorna HTTP 200 (OK)
    return new Response(
      JSON.stringify({ approved: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
