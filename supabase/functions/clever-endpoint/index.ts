import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { isAllowedEndpoint } from '../_shared/allowedEndpoint.ts';
import { readClaims, isAuthenticatedUser, unauthorizedResponse } from '../_shared/auth.ts';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, Content-Type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// A allow-list e o limite de comprimento vivem em ../_shared/allowedEndpoint.ts,
// compartilhados com os testes para que a barreira de segurança nunca divirja
// da suíte sem que os testes falhem.

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  // verify_jwt=true já barrou token inválido/ausente, mas a anon key é um JWT
  // válido e é pública (fica no bundle do navegador). Exigimos usuário real.
  if (!isAuthenticatedUser(readClaims(req))) return unauthorizedResponse(corsHeaders);

  const apiKey = Deno.env.get('TMDB_API_KEY');
  if (!apiKey) return json({ error: 'TMDB_API_KEY não configurada.' }, 500);

  try {
    const body = await req.json();
    const endpoint = body?.endpoint;
    const params = body?.params && typeof body.params === 'object' ? body.params : {};

    if (!isAllowedEndpoint(endpoint)) {
      return json({ error: 'Endpoint TMDb não permitido.' }, 400);
    }

    const query = new URLSearchParams();
    query.set('api_key', apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (key === 'api_key' || value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) query.set(key, value.join(','));
      else query.set(key, String(value));
    }

    const response = await fetch(`${TMDB_BASE_URL}/${endpoint}?${query.toString()}`);
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: 'Resposta inválida do TMDb.' };
    }

    if (!response.ok) {
      return json({ error: 'TMDb rejeitou a requisição.', details: payload }, response.status);
    }
    return json(payload, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno.';
    return json({ error: message }, 500);
  }
});
