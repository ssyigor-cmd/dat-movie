/**
 * Escolha do logo de um título.
 *
 * Problema: o TMDB devolve os logos da série em ordem de upload, e a série pode
 * ter variantes por país/idioma. Dois casos reais:
 *   - Bleach (30984): o primeiro logo é o do arco atual (Guerra Sangrenta de Mil Anos).
 *   - MobLand (247718): tem 1 logo pt-BR ("Terra da Máfia") e 1 pt-PT ("Terra de Bandidos").
 * Como o app exibe os nomes em pt-BR, o logo precisa ser o da variante pt-BR, e
 * entre os candidatos vence o mais canônico (maior votação), não o mais novo.
 */

/**
 * Idiomas/países preferidos, na ordem de prioridade. `country: '*'` = qualquer
 * país. Logo sem informação de país (`iso_3166_1` ausente) é tratado como do
 * país preferido, já que pt/en sem país costuma ser a arte do mercado principal.
 */
const DEFAULT_PREFERENCES = [
  { lang: 'pt', country: 'BR' },
  { lang: 'en', country: 'US' },
  { lang: 'pt', country: '*' },
  { lang: 'en', country: '*' },
  { lang: null, country: '*' }
];

/**
 * Constrói a URL absoluta de um logo, aceitando tanto `file_path` do TMDB
 * quanto uma URL completa (ex.: quando o logo veio do Fanart.tv).
 * @param {Object} logo - Objeto de logo.
 * @param {string} size - Tamanho do TMDB ('w500').
 * @returns {string|null} URL absoluta ou null.
 */
function logoUrl(logo, size) {
  if (!logo?.file_path) return null;
  if (/^https?:\/\//i.test(logo.file_path)) return logo.file_path;
  return `https://image.tmdb.org/t/p/${size}${logo.file_path}`;
}

/**
 * Ordena candidatos do mais canônico para o menos: mais votado, depois mais
 * votos, depois maior resolução.
 * @param {Array} list - Lista de logos.
 * @returns {Array} Nova lista ordenada.
 */
function byCanonical(a, b) {
  return (b.vote_average ?? 0) - (a.vote_average ?? 0) ||
    (b.vote_count ?? 0) - (a.vote_count ?? 0) ||
    (b.width ?? 0) - (a.width ?? 0);
}

/**
 * Escolhe o logo mais adequado: variante do idioma/país preferido primeiro e,
 * dentro de cada grupo, o mais votado.
 * @param {Array} logos - Lista de logos (`file_path` do TMDB ou URL completa).
 * @param {Object} [opts] - { size, preferences }.
 * @returns {string|null} URL absoluta do logo ou null.
 */
export function pickCanonicalLogo(logos, opts = {}) {
  if (!Array.isArray(logos) || !logos.length) return null;
  const size = opts.size || 'w500';
  const preferences = opts.preferences || DEFAULT_PREFERENCES;
  const valid = logos.filter(l => l && l.file_path);
  if (!valid.length) return null;

  for (const pref of preferences) {
    const group = valid.filter(l => {
      if ((l.iso_639_1 ?? null) !== pref.lang) return false;
      if (pref.country === '*') return true;
      const country = l.iso_3166_1 ?? null;
      return country === null || country === pref.country;
    });
    if (group.length) return logoUrl([...group].sort(byCanonical)[0], size);
  }

  return logoUrl([...valid].sort(byCanonical)[0], size);
}
