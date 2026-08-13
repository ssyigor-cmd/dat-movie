import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, Content-Type, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tmdbId, mediaType } = await req.json();
    const FANART_API_KEY = Deno.env.get('FANART_API_KEY');
    
    if (!FANART_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key não configurada' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const endpoint = mediaType === 'movie' ? 'movies' : 'tv';
    const url = `https://webservice.fanart.tv/v3/${endpoint}/${tmdbId}?api_key=${FANART_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ logoUrl: null }),
        { status: 200, headers: corsHeaders }
      );
    }

    const data = await response.json();

    let logoUrl = null;
    if (data.clearlogo && data.clearlogo.length > 0) {
      logoUrl = data.clearlogo[0].url;
    } else if (data.hdtvlogo && data.hdtvlogo.length > 0) {
      logoUrl = data.hdtvlogo[0].url;
    }

    return new Response(
      JSON.stringify({ logoUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});