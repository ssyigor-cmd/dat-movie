import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { readClaims, isAuthenticatedUser, unauthorizedResponse } from '../_shared/auth.ts';

const FANART_BASE_URL = 'https://webservice.fanart.tv/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, Content-Type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Normaliza o tmdbId para um inteiro positivo.
 *
 * O valor é interpolado na URL do Fanart, então qualquer coisa não numérica
 * (ex.: `123/../../outro/path`) viraria um caminho inesperado capaz de vazar a
 * FANART_API_KEY para fora. Validar aqui mantém a chave dentro do host.
 */
function parseTmdbId(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isInteger(raw) || raw <= 0) return null;
  return raw;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  // verify_jwt=true deixa passar a anon key, que é pública. Esta função gasta
  // cota da FANART_API_KEY, então exigimos um usuário autenticado de verdade.
  if (!isAuthenticatedUser(readClaims(req))) return unauthorizedResponse(corsHeaders);

  try {
    const { tmdbId, mediaType } = await req.json();

    const id = parseTmdbId(tmdbId);
    if (id === null) return json({ error: 'tmdbId inválido.' }, 400);

    const FANART_API_KEY = Deno.env.get('FANART_API_KEY');
    if (!FANART_API_KEY) {
      return json({ error: 'API key não configurada' }, 500);
    }

    const endpoint = mediaType === 'movie' ? 'movies' : 'tv';
    const url = `${FANART_BASE_URL}/${endpoint}/${id}?api_key=${FANART_API_KEY}`;

    const response = await fetch(url);
    // Falha do Fanart degrada para "sem logo" em vez de erro: o logo é apenas
    // um fallback opcional e não deve quebrar a exibição do título.
    if (!response.ok) {
      return json({ logoUrl: null }, 200);
    }

    const data = await response.json();

    let logoUrl = null;
    if (data.clearlogo && data.clearlogo.length > 0) {
      logoUrl = data.clearlogo[0].url;
    } else if (data.hdtvlogo && data.hdtvlogo.length > 0) {
      logoUrl = data.hdtvlogo[0].url;
    }

    return json({ logoUrl }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno.';
    return json({ error: message }, 500);
  }
});
