/**
 * Verificação de sessão de usuário nas Edge Functions.
 *
 * POR QUE ISTO EXISTE
 * --------------------
 * `verify_jwt = true` no config.toml valida a ASSINATURA do JWT, e isso já é
 * suficiente para barrar tráfego anônimo da internet (retorna 401). Mas a
 * `anon key` também é um JWT assinado pelo Supabase — com `role: "anon"` e
 * sem `sub`. E a anon key é pública: ela é embarcada no bundle do navegador
 * (é assim que uma SPA fala com o backend). Logo, `verify_jwt` sozinho NÃO
 * impede que alguém leia a chave do bundle e chame a função, gastando a cota
 * da FANART_API_KEY / TMDB_API_KEY.
 *
 * COMO ESTE CHECK É SEGURO
 * ------------------------
 * Decodificamos o token SEM validar a assinatura de novo. Isso seria inseguro
 * se confiássemos nisso, mas o gateway já validou antes do código rodar: nós
 * só lemos claims que o próprio SupabaseLiberou. Quem chama a função nunca
 * consegue forjar `role`/`sub`, porque qualquer token forjado é rejeitado no
 * gateway.
 */

/** Lê os claims do JWT do header `Authorization`. Retorna null se não houver. */
export function readClaims(req: Request): Record<string, unknown> | null {
  const header = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!header) return null;
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) return null;
  const segments = parts[1].split('.');
  if (segments.length !== 3) return null;
  try {
    const claims = JSON.parse(atob(segments[1].replace(/-/g, '+').replace(/_/g, '/')));
    return claims && typeof claims === 'object' ? claims : null;
  } catch {
    return null;
  }
}

/** Verdadeiro só para um usuário de verdade — nunca para a anon key. */
export function isAuthenticatedUser(claims: Record<string, unknown> | null): boolean {
  if (!claims) return false;
  if (claims.role !== 'authenticated') return false;
  return typeof claims.sub === 'string' && claims.sub.length > 0;
}

/** Resposta 401 padronizada para sessão ausente ou inválida. */
export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'Sessão inválida ou ausente.' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
