/**
 * Helpers puros para escolher a arte da temporada que o usuário está acompanhando.
 *
 * Motivation: para séries longas, o TMDB atualiza a arte principal da série
 * (pôster, backdrop e logo) para o branding do arco/temporada mais recente.
 * Ex.: `tv/30984` (Bleach, 2004) passou a usar a arte de "Thousand-Year Blood War".
 * Como o app acompanha o progresso por temporada, a arte exibida deve ser a da
 * temporada em acompanhamento, não a arte "vigente" da série.
 */

/**
 * Retorna a temporada acompanhada pelo item, normalizada.
 * @param {Object} item - Item do catálogo (usa `temporada`).
 * @returns {number|null} Número da temporada (>= 1) ou null se inválido.
 */
export function getTrackedSeason(item) {
  if (!item) return null;
  const raw = item.temporada;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/**
 * Decide se a arte da temporada deve substituir a arte da série.
 * Regra: só vale para séries com mais de 1 temporada (as que o TMDB rebranda
 * para o arco atual) e apenas para itens que não estão concluídos.
 * @param {Object} item - Item do catálogo.
 * @param {number} numberOfSeasons - Total de temporadas da série no TMDB.
 * @returns {boolean} true se deve usar a arte da temporada.
 */
export function shouldUseSeasonArt(item, numberOfSeasons) {
  if (!item || !item.tmdb_id) return false;
  if (item.status === 'concluido') return false;
  const seasons = Number(numberOfSeasons);
  if (!Number.isFinite(seasons) || seasons <= 1) return false;
  return getTrackedSeason(item) !== null;
}

/**
 * Extrai o `poster_path` da temporada acompanhada a partir do payload de
 * `tv/{id}` (que já traz `seasons[]` com `poster_path`).
 * @param {Object} details - Payload de `tv/{id}`.
 * @param {number|null} seasonNumber - Temporada a usar.
 * @returns {string|null} `file_path` do pôster da temporada ou null.
 */
export function seasonPosterPath(details, seasonNumber) {
  if (!details || !Array.isArray(details.seasons)) return null;
  const n = Number(seasonNumber);
  if (!Number.isFinite(n) || n < 1) return null;
  const season = details.seasons.find(s => Number(s?.season_number) === n);
  return season?.poster_path || null;
}

/**
 * Monta a URL do pôster da temporada acompanhada, com fallback no pôster da série.
 * @param {Object} details - Payload de `tv/{id}`.
 * @param {Object} item - Item do catálogo.
 * @param {Object} [opts] - { size } para o tamanho da imagem.
 * @returns {string|null} URL absoluta ou null.
 */
export function resolveSeasonPosterUrl(details, item, opts = {}) {
  const size = opts.size || 'w500';
  const base = `https://image.tmdb.org/t/p/${size}`;
  const seasonPath = seasonPosterPath(details, getTrackedSeason(item));
  if (seasonPath) return `${base}${seasonPath}`;
  if (details?.poster_path) return `${base}${details.poster_path}`;
  return null;
}

/**
 * Monta a URL do pôster de uma temporada a partir de `tv/{id}/season/{n}`
 * (usado nos cards, onde só temos o id e a temporada, sem o payload da série).
 * @param {Object} season - Payload de `tv/{id}/season/{n}`.
 * @param {Object} [opts] - { size } para o tamanho da imagem.
 * @returns {string|null} URL absoluta ou null.
 */
export function seasonPosterUrlFromSeason(season, opts = {}) {
  if (!season?.poster_path) return null;
  const size = opts.size || 'w500';
  return `https://image.tmdb.org/t/p/${size}${season.poster_path}`;
}
