/**
 * trendingApi - Funções para buscar tendências e novidades na TMDb via Edge Function
 * Usa callTMDB e implementa cache em memória de 5 minutos.
 */
import { callTMDB } from './api.js';
import { filterNotInCatalog as catalogFilterNotInCatalog } from './catalog.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const cache = new Map(); // key -> { data, expiresAt }

/**
 * Gera chave de cache a partir do endpoint e params
 */
function cacheKey(endpoint, params, lang) {
  return `${endpoint}|${JSON.stringify(params)}|${lang}`;
}

export function clearTrendingCache() {
  cache.clear();
}

export function _getCacheEntry(key) {
  return cache.get(key) || null;
}

export function _setCacheEntry(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function cachedCallTMDB(endpoint, params = {}, lang = 'pt-BR') {
  const key = cacheKey(endpoint, params, lang);
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }
  const data = await callTMDB(endpoint, params, lang);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

/**
 * Verifica se uma data ISO (YYYY-MM-DD) está dentro dos últimos N dias (padrão 7)
 * @param {string} dateStr - data ISO
 * @param {number} days - janela em dias
 * @param {Date} nowRef - referência de "hoje" (injetável para testes)
 * @returns {boolean}
 */
export function isRecentDate(dateStr, days = 7, nowRef = new Date()) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = nowRef instanceof Date ? nowRef : new Date(nowRef);
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return false; // data futura
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

/**
 * Verifica se um episódio (objeto com air_date) é recente (últimos 7 dias)
 * @param {Object} episode - { air_date: string }
 * @param {number} days
 * @param {Date} nowRef
 */
export function isRecentEpisode(episode, days = 7, nowRef = new Date()) {
  if (!episode || !episode.air_date) return false;
  return isRecentDate(episode.air_date, days, nowRef);
}

/**
 * Filtra resultados da TMDb removendo os que já estão no catálogo do usuário (por tmdb_id)
 * @param {Array} tmdbResults - array de objetos com id
 * @param {Array} catalogItems - array de itens do usuário com tmdb_id
 * @returns {Array} filtrados
 */
export function filterNotInCatalog(tmdbResults, catalogItems) {
  return catalogFilterNotInCatalog(tmdbResults, catalogItems);
}

/**
 * Formata data ISO para data curta BR sem ano se necessário? Mantém DD/MM/AAAA
 * @param {string} dateStr
 * @returns {string}
 */
export function formatAirDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Busca títulos em alta na semana (tv + movie), filtra os que não estão no catálogo
 * @param {Array} catalogItems
 * @param {number} limit - máximo de itens
 * @returns {Promise<Array>} lista de até limit itens com poster, título, etc
 */
export async function getTrendingToSuggest(catalogItems, limit = 6) {
  try {
    const [tvData, movieData] = await Promise.all([
      cachedCallTMDB('trending/tv/week', {}, 'pt-BR'),
      cachedCallTMDB('trending/movie/week', {}, 'pt-BR')
    ]);
    const combined = [...(tvData.results || []), ...(movieData.results || [])];
    // Ordena por popularity decrescente (se existir) ou mantém ordem
    combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const filtered = filterNotInCatalog(combined, catalogItems);
    return filtered.slice(0, limit).map(normalizeTrendingItem);
  } catch (e) {
    console.warn('Erro ao buscar trending:', e);
    throw e;
  }
}

/**
 * Normaliza um item de trending para uso no card da Home
 */
export function normalizeTrendingItem(raw) {
  const isMovie = raw.media_type === 'movie' || !!raw.title;
  const title = raw.name || raw.title || 'Sem título';
  const posterPath = raw.poster_path || null;
  const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : '';
  const date = raw.first_air_date || raw.release_date || '';
  return {
    id: raw.id,
    title,
    mediaType: isMovie ? 'movie' : 'tv',
    posterUrl,
    posterPath,
    voteAverage: raw.vote_average || 0,
    overview: raw.overview || '',
    date,
    raw
  };
}

/**
 * Para cada item do catálogo com tmdb_id, busca detalhes da série e verifica se teve episódio recente (últimos 7 dias)
 * @param {Array} catalogItems
 * @param {number} days - janela de dias
 * @param {Date} nowRef - referência de data
 * @param {number} limit
 * @returns {Promise<Array>} itens com novidade { item, episode, season, airDate }
 */
export async function getNewEpisodes(catalogItems, days = 7, nowRef = new Date(), limit = 6) {
  const candidates = (catalogItems || []).filter((i) => i.tmdb_id && (i.tipo === 'serie' || i.tipo === 'anime' || i.tipo === 'animacao' || !i.tipo));
  if (candidates.length === 0) return [];

  const concurrency = 5;
  const results = [];
  // Processa em lotes para não sobrecarregar
  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const details = await cachedCallTMDB(`tv/${item.tmdb_id}`, {}, 'pt-BR');
          const episodesToCheck = [];
          if (details.last_episode_to_air) episodesToCheck.push(details.last_episode_to_air);
          if (details.next_episode_to_air) episodesToCheck.push(details.next_episode_to_air);
          // Verifica se algum episódio é recente
          for (const ep of episodesToCheck) {
            if (ep && ep.air_date && isRecentDate(ep.air_date, days, nowRef)) {
              return {
                item,
                episode: ep,
                details,
                airDate: ep.air_date,
                seasonNumber: ep.season_number,
                episodeNumber: ep.episode_number,
                name: ep.name || `T${ep.season_number} E${ep.episode_number}`
              };
            }
          }
          return null;
        } catch (e) {
          return null;
        }
      })
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
      if (results.length >= limit) break;
    }
    if (results.length >= limit) break;
  }
  // Ordena por air_date mais recente primeiro
  results.sort((a, b) => new Date(b.airDate) - new Date(a.airDate));
  return results.slice(0, limit);
}

/**
 * Retorna favoritos (tier S+ ou S)
 * @param {Array} catalogItems
 * @param {number} limit
 * @returns {Array}
 */
export function getFavorites(catalogItems, limit = 6) {
  if (!Array.isArray(catalogItems)) return [];
  return catalogItems.filter((i) => i.tier === 'S+' || i.tier === 'S').slice(0, limit);
}

/**
 * Calcula estatísticas rápidas do catálogo
 * @param {Array} catalogItems
 * @returns {{total:number, assistindo:number, concluidos:number, planejados:number}}
 */
export function getCatalogStats(catalogItems) {
  if (!Array.isArray(catalogItems)) return { total: 0, assistindo: 0, concluidos: 0, planejados: 0 };
  return {
    total: catalogItems.length,
    assistindo: catalogItems.filter((i) => i.status === 'assistindo').length,
    concluidos: catalogItems.filter((i) => i.status === 'concluido').length,
    planejados: catalogItems.filter((i) => i.status === 'planejado').length
  };
}
