/**
 * Equivalência de classificações etárias e escolha da nota a exibir.
 *
 * Único lugar com essas regras: o detalhe do título (titleInfoModal), os
 * filtros do catálogo (main.js no desktop, mobile.js no mobile) e o selo dos
 * cards consomem daqui. Sem duplicar por produto.
 */

/**
 * Classificações de idade do sistema americano de TV.
 *
 * O `discover/tv` não documenta mais `certification` (pode ser ignorado em
 * silêncio), mas é a única via barata - o TMDB só expõe `content_ratings` fora
 * da allow-list. O país é fixado em `US` porque é onde o TMDB tem a cobertura
 * mais completa de classificação para TV.
 *
 * O `value` é o código US (é o que a API entende); o nome é brasileiro.
 * `US_RATING_BR` é a equivalência código US → código BR, usada pelo selo dos
 * Detalhes para exibir tudo no padrão brasileiro.
 */
export const US_RATING_BR = {
  'TV-Y': 'L',
  'TV-Y7': '10',
  'TV-G': 'L',
  'TV-PG': '12',
  'TV-14': '14',
  'TV-MA': '16'
};

/**
 * Escolhe a classificação etária a exibir.
 *
 * O `content_ratings` traz uma lista por país. O app é pt-BR, então a nota
 * brasileira vem primeiro ("16", "14", "L"); sem ela, cai para a americana
 * ("TV-MA") - a mesma faixa usada nos filtros da Pesquisar. Entradas sem
 * `rating` (que significam "não classificada") são ignoradas.
 * @param {Object} contentRatings - Bloco `content_ratings` do TMDB.
 * @param {string[]} [preferidos] - Países em ordem de prioridade.
 * @returns {Object|null} `{ iso_3166_1, rating, descriptors }` ou null.
 */
export function pickContentRating(contentRatings, preferidos = ['BR', 'US']) {
  const results = Array.isArray(contentRatings?.results) ? contentRatings.results : [];
  const comNota = results.filter(r => r && r.rating);
  for (const code of preferidos) {
    const hit = comNota.find(r => r.iso_3166_1 === code);
    if (hit) return hit;
  }
  return comNota[0] || null;
}
