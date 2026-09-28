/**
 * Allow-list de endpoints do TMDb — fonte única de verdade.
 *
 * Importada tanto pela Edge Function `clever-endpoint` (runtime Deno) quanto
 * pelos testes (Vitest/Node). Por isso este módulo não pode usar nenhum global
 * do Deno: ele precisa carregar nos dois ambientes.
 *
 * Editar a regex aqui altera o proxy E os testes simultaneamente. Não copie
 * este padrão para dentro de um .test.js — foi justamente essa duplicação que
 * permitia a barreira de segurança divergir silenciosamente dos testes.
 */

/** Comprimento máximo aceito para o endpoint, antes mesmo da validação. */
export const MAX_ENDPOINT_LENGTH = 120;

/**
 * Mantém o proxy intencionalmente estreito: o navegador só pode pedir
 * recursos de TV/catálogo usados pelo aplicativo, nunca uma URL arbitrária
 * nem um endpoint fora da lista.
 */
export const ALLOWED_ENDPOINT =
  /^(?:search\/(?:tv|multi)|discover\/tv|trending\/tv\/(?:day|week)|genre\/tv\/list|tv\/\d+(?:\/(?:images|aggregate_credits|recommendations|similar|season\/\d+))?)$/;

/**
 * Valida o endpoint recebido no corpo da requisição.
 * Rejeita não-strings, strings acima do limite e qualquer padrão fora da lista.
 */
export function isAllowedEndpoint(endpoint: unknown): endpoint is string {
  return (
    typeof endpoint === 'string' &&
    endpoint.length <= MAX_ENDPOINT_LENGTH &&
    ALLOWED_ENDPOINT.test(endpoint)
  );
}
