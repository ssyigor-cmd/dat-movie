/**
 * discoverSearch - Filtros avançados de descoberta da aba Pesquisar.
 *
 * A busca por nome do TMDB (`search/tv`) não combina com filtros: o endpoint
 * não tem `with_genres`, `with_origin_country`, etc. Quando há filtro ativo a
 * tela troca para o `discover/tv`, que aceita essas facetas — e o texto vira um
 * filtro de nome local sobre a página carregada (decisão do usuário: aplicar
 * filtro e texto juntos, sem descartar um dos dois).
 *
 * A ordenação é deliberadamente sem nota: o produto não expõe `vote_average`
 * (nem `vote_count`, que é a mesma coisa por outro ângulo). O espectador entra
 * na obra sem julgamento prévio.
 */
import { callTMDB } from './api.js';
import { cacheGet, cacheSet } from './cache.js';
import { cachedCallTMDB, normalizeTrendingItem } from './trendingApi.js';
import { isBlockedProduction } from './titleFilters.js';
import { matchScore, sortByRelevance, buildFallbackQueries } from './fuzzySearch.js';
import { sortSearchResults } from './titleRelations.js';

/** Chave de cache da lista de gêneros de TV (muda raríssimo). */
const GENRES_CACHE_KEY = 'search_tv_genres_pt';

/**
 * Gêneros de TV, em pt-BR. Fonte de fallback quando `genre/tv/list` falha.
 * Os ids são os do TMDB; os nomes acompanham a resposta pt-BR do endpoint.
 */
export const TV_GENRES_FALLBACK = [
  { id: 10759, name: 'Ação & Aventura' },
  { id: 16, name: 'Animação' },
  { id: 35, name: 'Comédia' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentário' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Família' },
  { id: 10762, name: 'Infantil' },
  { id: 9648, name: 'Mistério' },
  { id: 10763, name: 'Notícias' },
  { id: 10764, name: 'Reality Show' },
  { id: 10765, name: 'Ficção científica & Fantasia' },
  { id: 10766, name: 'Novela' },
  { id: 10767, name: 'Talk Show' },
  { id: 10768, name: 'Guerra & Política' },
  { id: 37, name: 'Faroeste' }
];

/**
 * Países de origem. Lista curada (o endpoint `/configuration/countries` não está
 * na allow-list do proxy) com os mercados que fazem sentido para o catálogo.
 */
export const COUNTRY_OPTIONS = [
  { code: 'US', name: 'Estados Unidos' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'CA', name: 'Canadá' },
  { code: 'AU', name: 'Austrália' },
  { code: 'IE', name: 'Irlanda' },
  { code: 'NZ', name: 'Nova Zelândia' },
  { code: 'BR', name: 'Brasil' },
  { code: 'PT', name: 'Portugal' },
  { code: 'ES', name: 'Espanha' },
  { code: 'MX', name: 'México' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colômbia' },
  { code: 'FR', name: 'França' },
  { code: 'DE', name: 'Alemanha' },
  { code: 'IT', name: 'Itália' },
  { code: 'NL', name: 'Holanda' },
  { code: 'BE', name: 'Bélgica' },
  { code: 'SE', name: 'Suécia' },
  { code: 'NO', name: 'Noruega' },
  { code: 'DK', name: 'Dinamarca' },
  { code: 'PL', name: 'Polônia' },
  { code: 'RU', name: 'Rússia' },
  { code: 'TR', name: 'Turquia' },
  { code: 'JP', name: 'Japão' },
  { code: 'KR', name: 'Coreia do Sul' },
  { code: 'CN', name: 'China' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'IN', name: 'Índia' },
  { code: 'TH', name: 'Tailândia' },
  { code: 'PH', name: 'Filipinas' },
  { code: 'ID', name: 'Indonésia' },
  { code: 'IL', name: 'Israel' },
  { code: 'SA', name: 'Arábia Saudita' },
  { code: 'AE', name: 'Emirados Árabes' },
  { code: 'EG', name: 'Egito' },
  { code: 'ZA', name: 'África do Sul' }
];

/**
 * Classificações de idade do sistema americano de TV.
 *
 * O `discover/tv` não documenta mais `certification` (pode ser ignorado em
 * silêncio), mas é a única via barata — o TMDB só expõe `content_ratings` fora
 * da allow-list. O país é fixado em `US` porque é onde o TMDB tem a cobertura
 * mais completa de classificação para TV.
 */
export const AGE_RATING_OPTIONS = [
  { value: 'TV-Y', name: 'TV-Y — livre para todos' },
  { value: 'TV-Y7', name: 'TV-Y7 — acima de 7 anos' },
  { value: 'TV-G', name: 'TV-G — livre' },
  { value: 'TV-PG', name: 'TV-PG — supervisão dos pais' },
  { value: 'TV-14', name: 'TV-14 — acima de 14 anos' },
  { value: 'TV-MA', name: 'TV-MA — adultos' }
];

/** País usado no filtro de classificação de idade. */
export const AGE_RATING_COUNTRY = 'US';

/**
 * Faixas de duração de episódio (`with_runtime`, em minutos). Cada preset vira
 * `with_runtime.gte` e/ou `with_runtime.lte`.
 */
export const EPISODE_RUNTIME_OPTIONS = [
  { value: 'short', name: 'Até 30 min', gte: null, lte: 30 },
  { value: 'standard', name: '30 a 60 min', gte: 30, lte: 60 },
  { value: 'long', name: 'Mais de 60 min', gte: 60, lte: null }
];

/**
 * Ordenações permitidas — sem nota, por decisão de produto.
 *
 * O valor vazio é o neutro (a opção "Mais relevantes"): sozinho não dispara o
 * discover, só faz sentido quando há texto (a busca do TMDB ordena por
 * relevância). Qualquer valor concreto já lista o catálogo ordenado.
 */
export const SEARCH_SORT_OPTIONS = [
  { value: 'popularity.desc', name: 'Mais populares' },
  { value: 'popularity.asc', name: 'Menos populares' },
  { value: 'first_air_date.desc', name: 'Estreia mais recente' },
  { value: 'first_air_date.asc', name: 'Estreia mais antiga' },
  { value: 'name.asc', name: 'Nome (A–Z)' },
  { value: 'name.desc', name: 'Nome (Z–A)' }
];

/** Situação da série (`with_status`). */
export const STATUS_OPTIONS = [
  { value: '0', name: 'Em exibição' },
  { value: '1', name: 'Planejada' },
  { value: '2', name: 'Em produção' },
  { value: '3', name: 'Finalizada' },
  { value: '4', name: 'Cancelada' },
  { value: '5', name: 'Piloto' }
];

/** Formato (`with_type`). */
export const TYPE_OPTIONS = [
  { value: '0', name: 'Documentário' },
  { value: '1', name: 'Notícias' },
  { value: '2', name: 'Minissérie' },
  { value: '3', name: 'Reality Show' },
  { value: '4', name: 'Ficção' },
  { value: '5', name: 'Talk Show' },
  { value: '6', name: 'Vídeo' }
];

/**
 * Idiomas originais oferecidos. Só o subconjunto que faz sentido para o
 * público do app; a lista completa do TMDB é grande demais para um seletor.
 */
export const LANGUAGE_OPTIONS = [
  { value: 'en', name: 'Inglês' },
  { value: 'ja', name: 'Japonês' },
  { value: 'ko', name: 'Coreano' },
  { value: 'pt', name: 'Português' },
  { value: 'es', name: 'Espanhol' },
  { value: 'fr', name: 'Francês' },
  { value: 'de', name: 'Alemão' },
  { value: 'it', name: 'Italiano' },
  { value: 'zh', name: 'Chinês' },
  { value: 'hi', name: 'Hindu' },
  { value: 'tr', name: 'Turco' },
  { value: 'th', name: 'Tailandês' }
];

/** Estado inicial de um conjunto de filtros (nada aplicado). */
export function emptySearchFilters() {
  return {
    genres: [],
    excludeGenres: [],
    certification: '',
    runtime: '',
    yearFrom: '',
    yearTo: '',
    countries: [],
    excludeCountries: [],
    status: '',
    type: '',
    language: '',
    sort: ''
  };
}

/**
 * Existe algum filtro que dispare o `discover/tv`?
 *
 * A ordenação fica de fora de propósito: ela não é um recorte de catálogo, é
 * como apresentar o resultado. Sozinha, não deve tirar a tela do modo busca.
 * @param {Object} filters - Filtros atuais.
 * @returns {boolean}
 */
export function hasActiveFilters(filters) {
  if (!filters) return false;
  return Boolean(
    (Array.isArray(filters.genres) && filters.genres.length) ||
    (Array.isArray(filters.excludeGenres) && filters.excludeGenres.length) ||
    filters.certification ||
    filters.runtime ||
    filters.yearFrom ||
    filters.yearTo ||
    (Array.isArray(filters.countries) && filters.countries.length) ||
    (Array.isArray(filters.excludeCountries) && filters.excludeCountries.length) ||
    filters.status !== '' && filters.status != null ||
    filters.type !== '' && filters.type != null ||
    filters.language
  );
}

/** Ano de 4 dígitos válido, ou string vazia. */
function validYear(value) {
  const s = String(value ?? '').trim();
  return /^\d{4}$/.test(s) ? s : '';
}

/** Procura um preset de duração pelo valor. */
function runtimePreset(value) {
  return EPISODE_RUNTIME_OPTIONS.find(o => o.value === value) || null;
}

/**
 * Traduz os filtros da interface para os parâmetros do `discover/tv`.
 *
 * Vários gêneros usam `,` (E do TMDB): marcar Crime e Animação traz só obras
 * que são as duas coisas. Já os países usam `|` (OU): basta vir de um deles.
 * Gêneros negados viram `without_genres` com `|` (tira quem tem qualquer um
 * deles). O ano vira `first_air_date_year` quando é exato, senão uma faixa
 * `.gte`/`.lte`. Nenhum parâmetro de nota é emitido.
 *
 * O TMDB não tem `without_origin_country`; países negados são removidos na
 * tela, em `filterExcludedCountries`.
 * @param {Object} filters - Filtros da tela.
 * @returns {Object} Query string do discover (sem `page`).
 */
export function buildDiscoverParams(filters = {}) {
  const params = {};

  if (Array.isArray(filters.genres) && filters.genres.length) {
    params.with_genres = filters.genres.map(String).join(',');
  }
  if (filters.excludeGenres?.length) {
    params.without_genres = filters.excludeGenres.map(String).join('|');
  }
  if (Array.isArray(filters.countries) && filters.countries.length) {
    params.with_origin_country = filters.countries.map(String).join('|');
  }
  if (filters.certification) {
    params.certification = String(filters.certification);
    params.certification_country = AGE_RATING_COUNTRY;
  }

  const runtime = runtimePreset(filters.runtime);
  if (runtime) {
    if (runtime.gte != null) params['with_runtime.gte'] = runtime.gte;
    if (runtime.lte != null) params['with_runtime.lte'] = runtime.lte;
  }

  const from = validYear(filters.yearFrom);
  const to = validYear(filters.yearTo);
  if (from && to && from === to) {
    params.first_air_date_year = from;
  } else {
    if (from) params['first_air_date.gte'] = `${from}-01-01`;
    if (to) params['first_air_date.lte'] = `${to}-12-31`;
  }

  if (filters.status !== '' && filters.status != null) params.with_status = String(filters.status);
  if (filters.type !== '' && filters.type != null) params.with_type = String(filters.type);
  if (filters.language) params.with_original_language = String(filters.language);

  const sort = SEARCH_SORT_OPTIONS.some(o => o.value === filters.sort) ? filters.sort : 'popularity.desc';
  params.sort_by = sort;

  return params;
}

/**
 * Busca a lista de gêneros de TV em pt-BR, com cache. Falha aberta: devolve a
 * lista local e a tela continua funcionando.
 * @returns {Promise<Array<{id:number,name:string}>>}
 */
export async function fetchTvGenres() {
  const cached = cacheGet(GENRES_CACHE_KEY);
  if (Array.isArray(cached) && cached.length) return cached;
  try {
    const data = await callTMDB('genre/tv/list', {}, 'pt-BR');
    const list = (data?.genres || []).filter(g => g && g.id && g.name);
    if (list.length) {
      cacheSet(GENRES_CACHE_KEY, list);
      return list;
    }
  } catch (e) {
    console.warn('Erro ao buscar gêneros de TV:', e);
  }
  return TV_GENRES_FALLBACK;
}

/** Remove produções proibidas (YouTube/vlog) da lista de resultados. */
function removeBlocked(results) {
  return (Array.isArray(results) ? results : []).filter(r => !isBlockedProduction(r));
}

/**
 * Remove títulos repetidos por `id`, preservando a ordem. O TMDB às vezes
 * repete itens entre páginas em certas ordenações; como cada carregamento
 * junta duas páginas, a deduplicação é obrigatória.
 */
export function dedupeById(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const id = item?.id == null ? '' : String(item.id);
    if (!id) { out.push(item); continue; }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

/** Itens por carregamento (o TMDB serve 20 por página, então juntamos duas). */
export const SEARCH_PAGE_SIZE = 40;
const TMDB_PAGE_SIZE = 20;
const PAGES_PER_LOAD = Math.max(1, Math.round(SEARCH_PAGE_SIZE / TMDB_PAGE_SIZE));

/** Converte o total de páginas do TMDB no total de páginas lógicas (blocos de 40). */
function logicalTotalPages(responses) {
  const tmdbTotal = responses.reduce((max, r) => Math.max(max, Number(r?.total_pages) || 0), 0);
  return Math.max(1, Math.ceil(tmdbTotal / PAGES_PER_LOAD));
}

/** Nome de exibição de um resultado cru do TMDB. */
function resultName(r) {
  return r?.name || r?.title || '';
}

/**
 * Aplica o texto digitado como filtro local, ordenando por relevância.
 * Só roda no modo discover, onde o servidor não conhece a consulta.
 * @param {Array} results - Resultados crus.
 * @param {string} query - Texto digitado.
 * @returns {Array} Resultados filtrados e reordenados.
 */
export function filterResultsByQuery(results, query) {
  const q = String(query ?? '').trim();
  if (q.length < 2) return Array.isArray(results) ? results : [];
  return sortByRelevance(q, results, resultName)
    .filter(r => matchScore(q, resultName(r)) > 0);
}

/**
 * Remove resultados de países negados. O `discover/tv` não tem
 * `without_origin_country`, então a negação de país é aplicada aqui, sobre o
 * lote já carregado.
 * @param {Array} results - Resultados crus.
 * @param {string[]} codes - Códigos ISO negados.
 * @returns {Array} Resultados sem os países negados.
 */
export function filterExcludedCountries(results, codes) {
  const set = new Set((Array.isArray(codes) ? codes : []).map(String));
  if (!set.size) return Array.isArray(results) ? results : [];
  return (Array.isArray(results) ? results : []).filter((r) => {
    const origem = Array.isArray(r?.origin_country) ? r.origin_country.map(String) : [];
    return !origem.some((c) => set.has(c));
  });
}

/**
 * Executa uma busca/descoberta e devolve uma página pronta para render.
 *
 * Cada carregamento junta `PAGES_PER_LOAD` páginas do TMDB (40 itens) e remove
 * repetidos por `id`. A `page` de entrada/saída é a página lógica (blocos de 40).
 *
 * Modos:
 *  - `discover`: há filtro ativo. Usa `discover/tv` e aplica o texto localmente.
 *  - `search`: sem filtro e com texto. Usa `search/tv` (com fallback fuzzy).
 *  - `idle`: sem filtro e sem texto. Nada é pedido.
 *
 * @param {Object} o
 * @param {string} [o.query] - Texto digitado.
 * @param {Object} [o.filters] - Filtros da tela.
 * @param {number} [o.page] - Página lógica (1-based, blocos de 40).
 * @returns {Promise<{items:Array, mode:string, page:number, totalPages:number, totalResults:number}>}
 */
export async function searchTitles({ query = '', filters = null, page = 1 } = {}) {
  const q = String(query ?? '').trim();
  const pg = Math.max(1, Math.trunc(page) || 1);
  const firstTmdbPage = (pg - 1) * PAGES_PER_LOAD + 1;
  const tmdbPages = Array.from({ length: PAGES_PER_LOAD }, (_, i) => firstTmdbPage + i);

  // Precedência: filtros (discover) > texto (busca por relevância) > ordenação.
  // Escolher uma ordenação já lista o catálogo; mas se houver texto, a
  // relevância do TMDB manda (o `search/tv` não aceita `sort_by`).
  const wantDiscover = hasActiveFilters(filters);
  const wantSearch = !wantDiscover && q.length >= 2;
  const wantBrowse = !wantDiscover && !wantSearch && Boolean(filters?.sort);

  if (wantDiscover || wantBrowse) {
    const params = buildDiscoverParams(filters);
    const responses = await Promise.all(
      tmdbPages.map((p) => cachedCallTMDB('discover/tv', { ...params, page: p }, 'pt-BR'))
    );
    const raw = dedupeById(responses.flatMap(r => removeBlocked(r?.results)));
    const semPaisesNegados = filterExcludedCountries(raw, filters?.excludeCountries);
    const results = filterResultsByQuery(semPaisesNegados, q);
    return {
      items: results.map(normalizeTrendingItem),
      mode: 'discover',
      page: pg,
      totalPages: logicalTotalPages(responses),
      totalResults: Number(responses[0]?.total_results) || 0
    };
  }

  if (wantSearch) {
    const responses = await Promise.all(
      tmdbPages.map((p) => callTMDB('search/tv', { query: q, page: p }, 'pt-BR'))
    );
    let results = sortSearchResults(dedupeById(responses.flatMap(r => removeBlocked(r?.results))), q);

    // Só a primeira página tenta grafias alternativas; se a página 2 voltar
    // vazia, é porque a busca acabou, não porque a query estava errada.
    if (results.length === 0 && pg === 1) {
      for (const alt of buildFallbackQueries(q)) {
        try {
          const retry = await callTMDB('search/tv', { query: alt }, 'pt-BR');
          if (!retry?.results?.length) continue;
          results = sortByRelevance(q, removeBlocked(retry.results), resultName);
          break;
        } catch {
          // alternativa falhou; segue para a próxima
        }
      }
    }

    return {
      items: results.map(normalizeTrendingItem),
      mode: 'search',
      page: pg,
      totalPages: logicalTotalPages(responses),
      totalResults: Number(responses[0]?.total_results) || 0
    };
  }

  return { items: [], mode: 'idle', page: 1, totalPages: 0, totalResults: 0 };
}
