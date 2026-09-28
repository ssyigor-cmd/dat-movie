/**
 * titleRelations - Relações entre títulos (série principal x continuação/temporada)
 * Usado na busca para evitar vincular o item ao id do arco em vez da série.
 */

/**
 * Normaliza um nome para comparação (sem acentos, só letras/números)
 * @param {string} name
 * @returns {string}
 */
export function normalizeTitleName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Retorna o nome-base antes dos dois-pontos
 * Ex.: "Bleach: Sennen Kessen-hen" -> "Bleach"
 * @param {string} name
 * @returns {string}
 */
export function getBaseTitle(name) {
  const s = String(name || '');
  const idx = s.indexOf(':');
  return (idx > 1 ? s.slice(0, idx) : s).trim();
}

/**
 * O título parece uma continuação/temporada (possui ":")
 * @param {string} name
 * @returns {boolean}
 */
export function isContinuationTitle(name) {
  return String(name || '').includes(':');
}

const PART_WORDS = /\b(temporada|season|part|parte|cours|segunda|terceira|quarta|2nd|3rd|4th|2a|3a)\b/i;

/**
 * Classifica a continuação: temporada ou parte
 * @param {string} name
 * @returns {string|null} 'temporada' | 'parte' | null
 */
export function getContinuationTag(name) {
  if (!isContinuationTitle(name)) return null;
  const suffix = String(name).slice(String(name).indexOf(':') + 1);
  if (/\b(temporada|season)\b/i.test(suffix)) return 'temporada';
  if (PART_WORDS.test(suffix)) return 'parte';
  return 'continuação';
}

function resultName(r) {
  return (r && (r.name || r.title)) || '';
}

function resultYear(r) {
  const d = r && (r.first_air_date || r.release_date || r.date);
  return d ? Number(String(d).slice(0, 4)) : Infinity;
}

/**
 * Ordena resultados da busca: nome exato primeiro, depois popularidade
 * @param {Array} results
 * @param {string} [query] - termo digitado pelo usuário
 * @returns {Array} nova lista ordenada
 */
export function sortSearchResults(results, query = '') {
  const q = normalizeTitleName(query);
  return [...(results || [])].sort((a, b) => {
    if (q) {
      const na = normalizeTitleName(resultName(a));
      const nb = normalizeTitleName(resultName(b));
      const aExact = na === q ? 0 : 1;
      const bExact = nb === q ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
    }
    return (b.popularity || 0) - (a.popularity || 0);
  });
}

/**
 * Procura, entre os resultados, a série principal de um título que é continuação
 * @param {Object} chosen - resultado escolhido
 * @param {Array} allResults - todos os resultados da busca
 * @returns {Object|null} o resultado pai ou null
 */
export function findParentCandidate(chosen, allResults) {
  if (!chosen || !Array.isArray(allResults) || allResults.length === 0) return null;
  const chosenName = resultName(chosen);
  if (!isContinuationTitle(chosenName)) return null;

  const base = normalizeTitleName(getBaseTitle(chosenName));
  const chosenNorm = normalizeTitleName(chosenName);
  const others = allResults.filter(r => r && String(r.id) !== String(chosen.id) && resultName(r));

  const exact = others
    .filter(r => normalizeTitleName(resultName(r)) === base)
    .sort((a, b) => resultYear(a) - resultYear(b));
  if (exact.length) return exact[0];

  const prefix = others
    .filter(r => {
      const n = normalizeTitleName(resultName(r));
      return n.length >= 3 && chosenNorm.startsWith(n);
    })
    .sort((a, b) => resultYear(a) - resultYear(b));
  return prefix.length ? prefix[0] : null;
}
