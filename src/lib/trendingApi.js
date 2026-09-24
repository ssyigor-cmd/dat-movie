/**
 * trendingApi - Funções para buscar tendências e novidades na TMDb via Edge Function
 * Usa callTMDB e implementa cache em memória de 5 minutos.
 */
import { callTMDB } from './api.js';
import { filterNotInCatalog as catalogFilterNotInCatalog, calcularProgresso } from './catalog.js';
import { cacheGet, cacheSet, cacheClear } from './cache.js';

function cacheKey(endpoint, params, lang) {
  return `trending_${endpoint}|${JSON.stringify(params)}|${lang}`;
}

export function clearTrendingCache() {
  cacheClear();
}

export function _getCacheEntry(key) {
  return cacheGet(key) ? { data: cacheGet(key), expiresAt: Date.now() + 300000 } : null;
}

export function _setCacheEntry(key, data) {
  cacheSet(key, data);
}

async function cachedCallTMDB(endpoint, params = {}, lang = 'pt-BR') {
  const key = cacheKey(endpoint, params, lang);
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const data = await callTMDB(endpoint, params, lang);
  cacheSet(key, data);
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
 * Busca séries em alta na semana (apenas tv - sistema é só para mídias seriadas), filtra os que não estão no catálogo
 * @param {Array} catalogItems
 * @param {number} limit - máximo de itens
 * @returns {Promise<Array>} lista de até limit itens com poster, título, etc
 */
export function getFullWidthCount() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  if (w < 640) return 6;
  if (w < 1024) return 8;
  if (w < 1440) return 10;
  if (w < 1920) return 12;
  return 14;
}

export async function getTrendingToSuggest(catalogItems, limit = null) {
  const lim = limit ?? getFullWidthCount();
  try {
    const tvData = await cachedCallTMDB('trending/tv/week', {}, 'pt-BR');
    const combined = [...(tvData.results || [])];
    combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const filtered = filterNotInCatalog(combined, catalogItems);
    return filtered.slice(0, lim).map(normalizeTrendingItem);
  } catch (e) {
    console.warn('Erro ao buscar trending:', e);
    throw e;
  }
}

export const CATEGORIES = [
  { id: 10759, name: 'Ação', icon: 'fa-bolt' },
  { id: 16, name: 'Animação', icon: 'fa-palette' },
  { id: 35, name: 'Comédia', icon: 'fa-laugh' },
  { id: 18, name: 'Drama', icon: 'fa-theater-masks' },
  { id: 27, name: 'Terror', icon: 'fa-ghost' },
  { id: 10765, name: 'Ficção Científica', icon: 'fa-rocket' },
];

const GENRE_MAP = {
  10759: { name: 'Ação', icon: 'fa-bolt' },
  16: { name: 'Animação', icon: 'fa-palette' },
  35: { name: 'Comédia', icon: 'fa-laugh' },
  18: { name: 'Drama', icon: 'fa-theater-masks' },
  27: { name: 'Terror', icon: 'fa-ghost' },
  10765: { name: 'Ficção Científica', icon: 'fa-rocket' },
  10762: { name: 'Infantil', icon: 'fa-child' },
  9648: { name: 'Mistério', icon: 'fa-search' },
  80: { name: 'Crime', icon: 'fa-user-secret' },
  99: { name: 'Documentário', icon: 'fa-film' },
  10768: { name: 'Guerra', icon: 'fa-fighter-jet' },
};

export async function getUserTopGenres(catalogItems, topN = 4) {
  if (!Array.isArray(catalogItems) || catalogItems.length === 0) return CATEGORIES.slice(0, topN);
  const candidates = catalogItems.filter(i => i.status === 'assistindo' && i.tmdb_id);
  if (candidates.length === 0) return CATEGORIES.slice(0, topN);
  const counts = new Map();
  const toFetch = candidates.slice(0, 12);
  const results = await Promise.allSettled(toFetch.map(async (item) => {
    try {
      const details = await cachedCallTMDB(`tv/${item.tmdb_id}`, {}, 'pt-BR');
      return (details.genres || []).map(g => g.id);
    } catch { return []; }
  }));
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const gid of r.value) counts.set(gid, (counts.get(gid) || 0) + 1);
    }
  }
  if (counts.size === 0) return CATEGORIES.slice(0, topN);
  const sorted = [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0, topN).map(([id]) => ({ id, name: GENRE_MAP[id]?.name || `Gênero ${id}`, icon: GENRE_MAP[id]?.icon || 'fa-tag' }));
  // Completa com categorias fixas se faltar
  const existingIds = new Set(sorted.map(c => c.id));
  for (const cat of CATEGORIES) {
    if (sorted.length >= topN) break;
    if (!existingIds.has(cat.id)) sorted.push(cat);
  }
  return sorted.slice(0, topN);
}

export async function getTitlesByGenre(genreId, catalogItems = [], limit = null) {
  const lim = limit ?? getFullWidthCount();
  try {
    const data = await cachedCallTMDB('discover/tv', { with_genres: String(genreId), sort_by: 'popularity.desc', page: 1 }, 'pt-BR');
    const results = data.results || [];
    const filtered = filterNotInCatalog(results, catalogItems);
    const slice = filtered.slice(0, lim);
    return slice.map(normalizeTrendingItem);
  } catch (e) {
    console.warn('Erro ao buscar categoria', genreId, e);
    throw e;
  }
}

export async function getAffinityRecommendations(selectedTmdbIds, catalogItems, limit = null) {
  const lim = limit ?? getFullWidthCount();
  if (!Array.isArray(selectedTmdbIds) || selectedTmdbIds.length === 0 || selectedTmdbIds.length > 4) return null;
  // Busca gêneros dos bases para ponderação
  const baseGenresList = await Promise.all(selectedTmdbIds.map(async (id) => {
    try { const d = await cachedCallTMDB(`tv/${id}`, {}, 'pt-BR'); return (d.genres || []).map(g => g.id); } catch { return []; }
  }));
  const baseGenreSet = new Set(baseGenresList.flat());
  // Busca recommendations/similar para cada base
  const allRecs = [];
  for (const tmdbId of selectedTmdbIds) {
    try {
      let data;
      try { data = await cachedCallTMDB(`tv/${tmdbId}/recommendations`, { page: 1 }, 'pt-BR'); } catch { data = await cachedCallTMDB(`tv/${tmdbId}/similar`, { page: 1 }, 'pt-BR'); }
      const res = (data.results || []).slice(0, 12);
      for (const r of res) allRecs.push({ raw: r, sourceId: tmdbId });
    } catch {}
  }
  if (allRecs.length === 0) return null;
  // Pontua por frequência + gênero + popularidade
  const freq = new Map();
  const byId = new Map();
  for (const { raw } of allRecs) {
    const id = String(raw.id);
    freq.set(id, (freq.get(id) || 0) + 1);
    if (!byId.has(id)) byId.set(id, raw);
  }
  const scored = [];
  for (const [id, raw] of byId.entries()) {
    if (selectedTmdbIds.map(String).includes(id)) continue;
    if (catalogItems.some(c => String(c.tmdb_id) === id)) continue;
    const f = freq.get(id) || 1;
    const genreOverlap = (raw.genre_ids || []).filter(g => baseGenreSet.has(g)).length;
    const pop = Number(raw.popularity || 0) / 100;
    const vote = Number(raw.vote_average || 0);
    const score = f * 15 + genreOverlap * 8 + pop + vote;
    scored.push({ raw, score });
  }
  scored.sort((a,b) => b.score - a.score);
  const recs = scored.slice(0, lim).map(s => normalizeTrendingItem(s.raw));
  if (recs.length === 0) return null;
  return recs;
}

export async function getRecommendationsForUser(catalogItems, limit = null) {
  const lim = limit ?? getFullWidthCount();
  if (!Array.isArray(catalogItems) || catalogItems.length === 0) return null;
  // Pondera por tier + progresso + recência
  const assistindo = catalogItems.filter(i => i.status === 'assistindo' && i.tmdb_id);
  let base = null;
  if (assistindo.length > 0) {
    const scored = assistindo.map(item => {
      const prog = calcularProgresso(item);
      const tierBonus = item.tier === 'S+' ? 20 : item.tier === 'S' ? 12 : item.tier === 'A' ? 5 : 0;
      const recency = Math.max(0, 10 - Math.floor((Date.now() - new Date(item.dataAtualizacao || item.dataCriacao || 0).getTime()) / (1000*60*60*24*7)));
      return { item, score: prog + tierBonus + recency };
    });
    scored.sort((a,b) => b.score - a.score);
    base = scored[0].item;
  }
  if (!base) {
    base = [...catalogItems].filter(i => (i.tier === 'S+' || i.tier === 'S') && i.tmdb_id).sort((a,b) => (a.tier === 'S+' && b.tier !== 'S+' ? -1 : 1))[0] || assistindo[0] || catalogItems.find(i => i.tmdb_id) || catalogItems[0];
  }
  if (!base || !base.tmdb_id) return null;
  try {
    let data;
    try {
      data = await cachedCallTMDB(`tv/${base.tmdb_id}/recommendations`, { page: 1 }, 'pt-BR');
    } catch {
      data = await cachedCallTMDB(`tv/${base.tmdb_id}/similar`, { page: 1 }, 'pt-BR');
    }
    const results = data.results || [];
    const filtered = filterNotInCatalog(results, catalogItems);
    const recs = filtered.slice(0, lim).map(normalizeTrendingItem);
    if (recs.length === 0) return null;
    return { base, recommendations: recs };
  } catch (e) {
    console.warn('Erro recomendações', e);
    return null;
  }
}

/**
 * Normaliza um item de trending para uso no card da Home (apenas tv)
 */
export function normalizeTrendingItem(raw) {
  const title = raw.name || raw.title || 'Sem título';
  const posterPath = raw.poster_path || null;
  const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : '';
  const date = raw.first_air_date || raw.release_date || '';
  return {
    id: raw.id,
    title,
    mediaType: 'tv',
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
/**
 * Verifica se air_date está dentro da janela de 7 dias no fuso do usuário (passado 7 ou futuro 7)
 * @param {string} dateStr
 * @param {number} days
 * @param {Date} nowRef
 * @returns {boolean}
 */
export function isWithin7DaysWindow(dateStr, days = 7, nowRef = new Date()) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const now = nowRef instanceof Date ? nowRef : new Date(nowRef);
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const diffMs = d.getTime() - nowMid.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= -days && diffDays <= days;
}

export async function getNewEpisodes(catalogItems, days = 7, nowRef = new Date(), limit = null) {
  const lim = limit ?? getFullWidthCount();
  const candidates = (catalogItems || []).filter((i) => i.tmdb_id && i.status === 'assistindo' && (i.tipo === 'serie' || i.tipo === 'anime' || i.tipo === 'animacao' || !i.tipo));
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
          // Verifica se algum episódio está na janela de 7 dias (passado ou futuro)
          for (const ep of episodesToCheck) {
            if (ep && ep.air_date && isWithin7DaysWindow(ep.air_date, days, nowRef)) {
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
      if (results.length >= lim) break;
    }
    if (results.length >= lim) break;
  }
  // Ordena por air_date mais recente primeiro
  results.sort((a, b) => new Date(b.airDate) - new Date(a.airDate));
  return results.slice(0, lim);
}

/**
 * Retorna favoritos (tier S+ ou S)
 * @param {Array} catalogItems
 * @param {number} limit
 * @returns {Array}
 */
export function getFavorites(catalogItems, limit = null) {
  const lim = limit ?? getFullWidthCount();
  if (!Array.isArray(catalogItems)) return [];
  const favs = catalogItems.filter((i) => i.tier === 'S+' || i.tier === 'S');
  favs.sort((a, b) => {
    const tierRank = { 'S+': 0, 'S': 1 };
    const ra = tierRank[a.tier] ?? 2;
    const rb = tierRank[b.tier] ?? 2;
    if (ra !== rb) return ra - rb;
    const da = new Date(a.dataAtualizacao || a.dataCriacao || 0).getTime();
    const db = new Date(b.dataAtualizacao || b.dataCriacao || 0).getTime();
    return db - da;
  });
  return favs.slice(0, lim);
}

/**
 * Calcula estatísticas úteis do catálogo em único passe
 * @param {Array} catalogItems
 * @returns {{total:number, assistindo:number, concluidos:number, planejados:number, totalEpisodiosAssistidos:number, horasAssistidas:number, progressoMedio:number, taxaConclusao:number}}
 */
export function getCatalogStats(catalogItems) {
  if (!Array.isArray(catalogItems) || catalogItems.length === 0) return { total: 0, assistindo: 0, concluidos: 0, planejados: 0, totalEpisodiosAssistidos: 0, horasAssistidas: 0, progressoMedio: 0, taxaConclusao: 0 };
  let assistindo = 0, concluidos = 0, planejados = 0, totalEpisodiosAssistidos = 0, somaProgresso = 0;
  for (const it of catalogItems) {
    if (it.status === 'assistindo') assistindo++;
    else if (it.status === 'concluido') concluidos++;
    else if (it.status === 'planejado') planejados++;
    totalEpisodiosAssistidos += Number(it.episodio) || 0;
    somaProgresso += calcularProgresso(it);
  }
  const total = catalogItems.length;
  const horasAssistidas = Math.round((totalEpisodiosAssistidos * 24) / 60);
  const progressoMedio = total ? Math.round(somaProgresso / total) : 0;
  const taxaConclusao = total ? Math.round((concluidos / total) * 100) : 0;
  return { total, assistindo, concluidos, planejados, totalEpisodiosAssistidos, horasAssistidas, progressoMedio, taxaConclusao };
}

export async function getCalendarWeek(catalogItems) {
  const all = await getNewEpisodes(catalogItems, 7, new Date(), 20);
  // Filtra só próximos 7 dias futuros
  const now = new Date();
  const future = all.filter(x => new Date(x.airDate + 'T12:00:00') >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12,0,0));
  // Agrupa por data
  const map = new Map();
  for (const item of future) {
    const d = item.airDate;
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(item);
  }
  return [...map.entries()].sort((a,b) => new Date(a[0]) - new Date(b[0])).slice(0,7);
}

export function getAbandoned(catalogItems, limit = null) {
  const lim = limit ?? getFullWidthCount();
  if (!Array.isArray(catalogItems)) return [];
  const pausados = catalogItems.filter(i => i.status === 'pausado');
  pausados.sort((a,b) => new Date(a.dataAtualizacao || a.dataCriacao || 0) - new Date(b.dataAtualizacao || b.dataCriacao || 0));
  return pausados.slice(0, lim);
}

export function getTimeline(catalogItems, limit = 10) {
  if (!Array.isArray(catalogItems)) return [];
  return [...catalogItems].sort((a,b) => new Date(b.dataAtualizacao || b.dataCriacao || 0) - new Date(a.dataAtualizacao || a.dataCriacao || 0)).slice(0, limit);
}

export function getChallenge(catalogItems, goal = 5) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const concluidosMes = catalogItems.filter(i => i.status === 'concluido' && new Date(i.dataAtualizacao || i.dataCriacao || 0) >= start).length;
  const pct = goal ? Math.min(100, Math.round((concluidosMes / goal)*100)) : 0;
  return { concluidosMes, goal, pct };
}

export function pickRandomByTime(catalogItems, minutes = 60) {
  const pool = catalogItems.filter(i => i.status === 'planejado' || i.status === 'pausado');
  if (pool.length === 0) return null;
  const filtered = pool.filter(i => {
    const total = Number(i.totalEpisodios || 1);
    const remaining = Math.max(0, total - (Number(i.episodio)||0));
    const est = remaining * 24;
    return est <= minutes || est <= 60;
  });
  const list = filtered.length > 0 ? filtered : pool;
  return list[Math.floor(Math.random()*list.length)];
}
