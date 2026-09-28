/**
 * trendingApi - Funções para buscar tendências e novidades na TMDb via Edge Function
 * Usa callTMDB e implementa cache em memória de 5 minutos.
 */
import { callTMDB } from './api.js';
import { filterNotInCatalog as catalogFilterNotInCatalog, calcularProgresso } from './catalog.js';
import { cacheGet, cacheSet, cacheClearPrefix } from './cache.js';

/** Prefixo das chaves de cache geradas por este módulo. */
const CACHE_PREFIX = 'trending_';

function cacheKey(endpoint, params, lang) {
  return `${CACHE_PREFIX}${endpoint}|${JSON.stringify(params)}|${lang}`;
}

/**
 * Invalida apenas as entradas de tendências.
 * Antes usava cacheClear(), que derrubava o cache inteiro — incluindo logos e
 * detalhes de títulos, que são caros de refazer e nada têm a ver com isto.
 */
export function clearTrendingCache() {
  return cacheClearPrefix(CACHE_PREFIX);
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
  if (w < 640) return 10;
  if (w < 1024) return 14;
  if (w < 1440) return 18;
  if (w < 1920) return 20;
  return 20;
}

/**
 * Teto de páginas por busca. O `discover` do TMDB devolve 20 por página e
 * rejeita `page * 20` acima de 500, então 15 páginas (300 itens) é o máximo útil
 * aqui. Precisa acompanhar o fator de `poolSizeFor`: 20 exibidos × 15 = 300.
 */
const MAX_PAGES = 15;

/**
 * Pagina o endpoint até acumular `needed` itens já filtrados (ou esgotar as páginas)
 */
async function collectFiltered(endpoint, params, lang, catalogItems, needed, seedResults = []) {
  const collected = seedResults.slice();
  const seen = new Set(collected.map(r => String(r.id)));
  for (let page = 1; page <= MAX_PAGES && collected.length < needed; page++) {
    let data;
    try {
      data = await cachedCallTMDB(endpoint, { ...params, page }, lang);
    } catch (e) {
      if (page === 1) throw e;
      break;
    }
    const results = (data && data.results) || [];
    if (results.length === 0) break;
    for (const r of results) {
      const id = String(r.id);
      if (seen.has(id)) continue;
      if (catalogItems.some(c => String(c.tmdb_id) === id)) continue;
      seen.add(id);
      collected.push(r);
      if (collected.length >= needed) break;
    }
    if (data.total_pages && page >= data.total_pages) break;
  }
  return collected;
}

/**
 * PRNG determinístico (mulberry32): mesma semente, mesma ordem; semente nova,
 * outra ordem. Evita `Math.random` para manter o comportamento testável.
 * @param {number} seed - Semente inteira.
 * @returns {Function} Gerador de números em [0, 1).
 */
function seededRandom(seed) {
  let a = (Math.trunc(seed) || 0) >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Embaralha uma lista de forma determinística conforme a semente.
 * @param {Array} list - Lista de origem (não é mutada).
 * @param {number} [seed] - Semente; valores diferentes geram ordens diferentes.
 * @returns {Array} Cópia embaralhada.
 */
export function shuffleList(list, seed = 0) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const out = [...list];
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Escolhe `count` itens de um pool priorizando os que ainda não foram exibidos.
 * Quando o pool se esgota (tudo já visto), a lista de vistos é limpa e a escolha
 * reinicia a partir de todo o pool, evitando ficar preso no mesmo conjunto.
 * @param {Array} pool - Candidatos.
 * @param {Set<string>} seen - Ids já exibidos (é atualizado no lugar).
 * @param {number} count - Quantidade desejada.
 * @param {number} [seed] - Semente do embaralhamento.
 * @returns {Array} Itens escolhidos.
 */
export function pickVariety(pool, seen, count, seed = 0) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const marked = seen instanceof Set ? seen : new Set();
  const idOf = (t) => String(t?.id ?? t?.tmdb_id ?? '');
  const shuffled = shuffleList(pool, seed);
  const unseen = [];
  const repeated = [];
  for (const t of shuffled) {
    const id = idOf(t);
    if (id && marked.has(id)) repeated.push(t);
    else unseen.push(t);
  }
  const wanted = Math.max(0, Math.trunc(count));
  if (wanted === 0) return [];
  if (unseen.length < wanted) marked.clear();
  const chosen = wanted <= unseen.length
    ? unseen.slice(0, wanted)
    : [...unseen, ...repeated.slice(0, wanted - unseen.length)];
  for (const t of chosen) {
    const id = idOf(t);
    if (id) marked.add(id);
  }
  return chosen;
}

/**
 * Rotaciona uma lista a partir de um offset, agrupando o restante no fim.
 * Usado pelo botão de atualizar para mostrar outros itens sem refazer a busca.
 * @param {Array} list - Lista de origem.
 * @param {number} [offset] - Deslocamento (aceita negativo e maior que o tamanho).
 * @param {number|null} [count] - Quantidade máxima a retornar (padrão: tudo).
 * @returns {Array} Lista rotacionada.
 */
export function rotateList(list, offset = 0, count = null) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const total = list.length;
  const off = ((Math.trunc(offset) % total) + total) % total;
  const size = count == null ? total : Math.max(0, Math.min(Math.trunc(count), total));
  const rotated = [...list.slice(off), ...list.slice(0, off)];
  return size === total ? rotated : rotated.slice(0, size);
}

/**
 * Tamanho do pool usado nos carrosséis da home: dá material para o botão de
 * atualizar variar sem repetir e folga para os filtros de conteúdo descartarem
 * lixo de catálogo sem encurtar a lista.
 *
 * O fator é 15 porque o corte de idioma é uma proibição dura (nunca relaxada, ver
 * `PROHIBITED_FILTERS`), então um pool curto esvazia a lista em vez de degradar.
 *
 * E porque a repetição não se resolve estreitando a janela, e sim alargando o
 * pool. Medido em 6 categorias × 10 refreshes: com pool de 160 (141 aceitos) a
 * lista cicla o pool inteiro e repete 35% das vagas; com pool de 300 (260
 * aceitos) repete 5%, e ainda assim os títulos exibidos ficam no top 37% do pool
 * em vez do top 50%. Ampliar o pool melhora popularidade e variedade ao mesmo
 * tempo.
 * @param {number} lim - Quantidade exibida.
 * @returns {number} Pool desejado.
 */
function poolSizeFor(lim) {
  return Math.max(lim, lim * 15);
}

export async function getTrendingToSuggest(catalogItems, limit = null, opts = {}) {
  const lim = limit ?? getFullWidthCount();
  // Alterna semana/dia para trazer listas realmente diferentes a cada clique
  const window = opts.window === 'day' || opts.window === 'week' ? opts.window : 'week';
  try {
    const filtered = await collectFiltered(`trending/tv/${window}`, {}, 'pt-BR', catalogItems || [], poolSizeFor(lim));
    filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return filtered.map(normalizeTrendingItem);
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

/**
 * Quantas categorias de gosto pessoal podem entrar **além** das 6 fixas.
 *
 * Existe um teto porque cada categoria dispara uma busca de até 15 páginas, e a
 * home não pode virar 10 carrosséis de 20 itens.
 */
export const EXTRA_GENRE_LIMIT = 2;

/**
 * Monta a lista final de categorias da home: as 6 fixas sempre, mais os gêneros
 * do usuário que não estão entre elas.
 *
 * Antes a home usava só `getUserTopGenres(items, 4)`, que devolve no máximo 4 e
 * substituía as fixas. O efeito era Terror e Comédia simplesmente não existirem
 * para quem assistia ação/animação/drama, sem nenhum aviso na tela. Aqui
 * personalizar é somar, nunca trocar.
 * @param {Array<{id:number}>|null} userGenres - Gêneros vindos de `getUserTopGenres`.
 * @param {number} [extraLimit]
 * @returns {Array<{id:number,name:string,icon:string}>}
 */
export function composeCategoryList(userGenres, extraLimit = EXTRA_GENRE_LIMIT) {
  const fixedIds = new Set(CATEGORIES.map(c => c.id));
  const extras = (Array.isArray(userGenres) ? userGenres : [])
    .filter(c => c && !fixedIds.has(c.id))
    .slice(0, Math.max(0, extraLimit));
  return [...CATEGORIES, ...extras];
}

export async function getUserTopGenres(catalogItems, topN = 4) {
  if (!Array.isArray(catalogItems) || catalogItems.length === 0) return CATEGORIES.slice(0, topN);
  const candidates = catalogItems.filter(i => i.status === 'assistindo' && i.tmdb_id);
  if (candidates.length === 0) return CATEGORIES.slice(0, topN);
  const counts = new Map();
  const toFetch = candidates.slice(0, 20);
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

/**
 * Fallback por keyword para gênero que o endpoint não devolve.
 *
 * `genre/tv/list` do proxy lista só 16 gêneros e não inclui Terror (27), então
 * `discover/tv?with_genres=27` responde 200 com `total_results: 0` para sempre.
 * A keyword 315058 é a de "horror" (vinda de `search/keyword?query=horror`).
 *
 * Atenção: o fallback SUBSTITUI `with_genres`. Mandar um gênero inválido junto
 * com a keyword envenena a query e volta a retornar 0.
 */
const GENRE_KEYWORD_FALLBACK = {
  27: '315058'
};

export async function getTitlesByGenre(genreId, catalogItems = [], limit = null, opts = {}) {
  const lim = limit ?? getFullWidthCount();
  // O pool vem sempre ordenado por popularidade. Ordenar por nota ou data parecia
  // uma forma de variar, mas media mal: `discover/tv?sort_by=vote_average.desc`
  // devolve muita nota alta com pouca popularidade, que é o material "nada a
  // ver" que o usuário reclamou. A variedade é responsabilidade da seleção.
  const sort = opts.sortBy || 'popularity.desc';
  try {
    let filtered = await collectFiltered('discover/tv', { with_genres: String(genreId), sort_by: sort }, 'pt-BR', catalogItems || [], poolSizeFor(lim));

    // Gênero sem dados no endpoint: refaz a busca só por keyword.
    const keyword = GENRE_KEYWORD_FALLBACK[genreId];
    if (filtered.length === 0 && keyword) {
      filtered = await collectFiltered('discover/tv', { with_keywords: keyword, sort_by: sort }, 'pt-BR', catalogItems || [], poolSizeFor(lim));
    }

    return filtered.map(normalizeTrendingItem);
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
      const res = (data.results || []).slice(0, 20);
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

/**
 * Ordena os títulos do catálogo como possíveis bases para a seção
 * "Se você gostou de X vai gostar disso", do mais relevante para o menos.
 * Considera progresso, tier e recência de atualização; sem `assistindo`,
 * cai para os tiers mais altos e depois para o primeiro título com tmdb_id.
 * @param {Array} catalogItems - Itens do catálogo.
 * @returns {Array<Object>} Itens ordenados (sem repetição).
 */
export function rankRecommendationBases(catalogItems) {
  if (!Array.isArray(catalogItems) || catalogItems.length === 0) return [];
  const tierBonusOf = (item) => (item.tier === 'S+' ? 20 : item.tier === 'S' ? 12 : item.tier === 'A' ? 5 : 0);
  const recencyOf = (item) => Math.max(0, 10 - Math.floor((Date.now() - new Date(item.dataAtualizacao || item.dataCriacao || 0).getTime()) / (1000 * 60 * 60 * 24 * 7)));

  const assistindo = catalogItems.filter(i => i.status === 'assistindo' && i.tmdb_id);
  let ranked = assistindo;
  if (ranked.length === 0) {
    const byTier = [...catalogItems].filter(i => (i.tier === 'S+' || i.tier === 'S') && i.tmdb_id)
      .sort((a, b) => (a.tier === 'S+' && b.tier !== 'S+' ? -1 : 1));
    const rest = catalogItems.filter(i => i.tmdb_id && !byTier.includes(i));
    ranked = [...byTier, ...rest];
  }
  if (ranked.length === 0) return [];

  return ranked
    .map(item => ({ item, score: calcularProgresso(item) + tierBonusOf(item) + recencyOf(item) }))
    .sort((a, b) => b.score - a.score)
    .map(s => s.item);
}

export async function getRecommendationsForUser(catalogItems, limit = null, opts = {}) {
  const lim = limit ?? getFullWidthCount();
  const ranked = rankRecommendationBases(catalogItems);
  if (ranked.length === 0) return null;
  // `baseIndex` rotaciona a base para o botão de atualizar trocar a lista
  const start = ((opts.baseIndex || 0) % ranked.length + ranked.length) % ranked.length;

  for (let i = 0; i < ranked.length; i++) {
    const base = ranked[(start + i) % ranked.length];
    if (!base || !base.tmdb_id) continue;
    try {
      let data;
      try {
        data = await cachedCallTMDB(`tv/${base.tmdb_id}/recommendations`, { page: 1 }, 'pt-BR');
      } catch {
        data = await cachedCallTMDB(`tv/${base.tmdb_id}/similar`, { page: 1 }, 'pt-BR');
      }
      const results = data.results || [];
      const filtered = filterNotInCatalog(results, catalogItems);
      const pool = filtered.map(normalizeTrendingItem);
      if (pool.length === 0) continue;
      return { base, pool, recommendations: pool.slice(0, lim) };
    } catch (e) {
      console.warn('Erro recomendações', e);
    }
  }
  return null;
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
          // Coleta TODOS os episódios dentro da janela, não só o primeiro.
          //
          // Com `return` dentro do loop, um título que já estreou nos últimos 7 dias
          // devolvia o `last_episode_to_air` e nunca chegava ao
          // `next_episode_to_air`. Como a maioria das séries estreia em dia fixo,
          // o calendário da semana recebia só datas passadas e as descartava no
          // filtro de futuro, ou seja: quase sempre vazio.
          return episodesToCheck
            .filter(ep => ep && ep.air_date && isWithin7DaysWindow(ep.air_date, days, nowRef))
            .map(ep => ({
              item,
              episode: ep,
              details,
              airDate: ep.air_date,
              seasonNumber: ep.season_number,
              episodeNumber: ep.episode_number,
              name: ep.name || `T${ep.season_number} E${ep.episode_number}`
            }));
        } catch (e) {
          return [];
        }
      })
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) results.push(...r.value);
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

/**
 * Calendário da semana a partir dos episódios do catálogo.
 *
 * Só olhar para o futuro deixava a seção quase sempre vazia, e ela ficava
 * escondida. `getNewEpisodes` devolve o último e o próximo episódio de cada
 * título `assistindo`, mas o filtro de futuro descartava o `last_episode_to_air` —
 * que é exatamente o que a maioria dos títulos tem, já que série estreia em dia
 * fixo. Ou seja: a seção só aparecia se algum título tivesse o próximo episódio
 * caindo nos próximos 7 dias, o que é uma janela estreita demais.
 *
 * Agora, quando não há nada agendado, cai para o que foi exibido recentemente em
 * vez de esconder a seção. O terceiro elemento do par diz se a data é futura, para
 * a interface poder rotular.
 * @param {Array} catalogItems
 * @returns {Promise<Array<[string, Array, boolean]>>} [data, episódios, éFuturo]
 */
export async function getCalendarWeek(catalogItems) {
  const all = await getNewEpisodes(catalogItems, 7, new Date(), 20);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const isFuture = x => new Date(x.airDate + 'T12:00:00') >= today;
  const upcoming = all.filter(isFuture);
  const recent = all.filter(x => !isFuture(x));
  // Prioriza o que vem; sem nada agendado, mostra o que acabou de exibir.
  const isUpcoming = upcoming.length > 0;
  const chosen = isUpcoming ? upcoming : recent;
  const ordered = isUpcoming
    ? [...chosen].sort((a, b) => new Date(a.airDate) - new Date(b.airDate))
    : [...chosen].sort((a, b) => new Date(b.airDate) - new Date(a.airDate));
  // Agrupa por data
  const map = new Map();
  for (const item of ordered) {
    const d = item.airDate;
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(item);
  }
  return [...map.entries()].slice(0, 7).map(([date, eps]) => [date, eps, isUpcoming]);
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
