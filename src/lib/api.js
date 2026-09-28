import { supabase } from './supabase.js';
import { cacheGet, cacheSet, appCache } from './cache.js';
import { resolveSeasonPosterUrl, shouldUseSeasonArt } from './seasonArt.js';
import { pickCanonicalLogo } from './logoPicker.js';

// ========== CACHE DE LOGOS (via appCache) ==========
// Chave v2: invalida os logos em cache antes da escolha por idioma/país
export function getLogoFromCache(tmdbId, mediaType) {
  const cacheKey = `logoV2_${tmdbId}_${mediaType}`;
  return cacheGet(cacheKey) || null;
}

export function setLogoInCache(tmdbId, mediaType, logoUrl) {
  const cacheKey = `logoV2_${tmdbId}_${mediaType}`;
  if (logoUrl) {
    cacheSet(cacheKey, logoUrl);
  } else {
    appCache.delete(cacheKey);
  }
}

// ========== DETALHES DE SÉRIE COM DEDUPE E LIMITE (appCache) ==========
const TV_DETAILS_CONCURRENCY = 4;
const tvDetailsInflight = new Map();
const tvDetailsQueue = [];

function withConcurrencyLimit(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      task().then(resolve, reject).finally(() => {
        const next = tvDetailsQueue.shift();
        if (next) next();
      });
    };
    if (tvDetailsInflight.size < TV_DETAILS_CONCURRENCY) run();
    else tvDetailsQueue.push(run);
  });
}

/**
 * Busca os detalhes de uma série (`tv/{id}`) reaproveitando o cache do appCache.
 * Requisições simultâneas do mesmo id são deduplicadas e o tráfego é limitado
 * a ${TV_DETAILS_CONCURRENCY} chamadas em paralelo.
 * @param {number|string} tmdbId - ID do TMDB.
 * @param {string} [lang] - Idioma da resposta.
 * @returns {Promise<Object|null>} Payload da série ou null em caso de erro.
 */
export async function fetchTvDetailsCached(tmdbId, lang = 'pt-BR') {
  if (!tmdbId) return null;
  const cacheKey = `tvcache_${tmdbId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  if (tvDetailsInflight.has(tmdbId)) return tvDetailsInflight.get(tmdbId);

  const request = withConcurrencyLimit(() => callTMDB(`tv/${tmdbId}`, {}, lang))
    .then(data => {
      if (data) cacheSet(cacheKey, data);
      return data || null;
    })
    .catch(error => {
      console.warn('Erro ao buscar detalhes da série:', error);
      return null;
    })
    .finally(() => tvDetailsInflight.delete(tmdbId));

  tvDetailsInflight.set(tmdbId, request);
  return request;
}

/**
 * Resolve a arte a exibir para um item do catálogo, aplicando a regra de arte
 * por temporada: só substitui a arte da série quando a série tem mais de 1
 * temporada e o item não está concluído.
 * @param {Object} item - Item do catálogo.
 * @param {string} [size] - Tamanho da imagem ('w500').
 * @returns {Promise<string|null>} URL do pôster ou null para manter a arte atual.
 */
export async function resolveItemPosterUrl(item, size = 'w500') {
  if (!item?.tmdb_id || item.status === 'concluido') return null;
  const details = await fetchTvDetailsCached(item.tmdb_id);
  if (!shouldUseSeasonArt(item, details?.number_of_seasons)) return null;
  return resolveSeasonPosterUrl(details, item, { size });
}

/**
 * Busca o logo localizado/canônico da série no TMDB (`tv/{id}/images`).
 * Filtra por pt-BR e en-US; se o TMDB não devolver nada com locale, repete com
 * `pt,en,null`. A escolha final é feita por `pickCanonicalLogo`, que também
 * considera a variante de país de cada logo.
 * @param {number|string} tmdbId - ID do TMDB.
 * @param {string} [size] - Tamanho da imagem ('w500').
 * @returns {Promise<string|null>} URL do logo ou null.
 */
export async function fetchLocalizedSeriesLogo(tmdbId, size = 'w500') {
  if (!tmdbId) return null;
  const cacheKey = `logoLoc_${tmdbId}_${size}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const tries = ['pt-BR,en-US,null', 'pt,en,null'];
  for (const include of tries) {
    try {
      const data = await callTMDB(`tv/${tmdbId}/images`, { include_image_language: include }, null);
      const url = pickCanonicalLogo(data?.logos, { size });
      if (url) {
        cacheSet(cacheKey, url);
        return url;
      }
    } catch (error) {
      console.warn('Erro ao buscar logo no TMDB:', error);
    }
  }
  return null;
}

/**
 * Escolhe o logo exibindo o título: variante pt-BR (ou en-US) do TMDB quando
 * existir, senão o logo do Fanart.tv. O logo do Fanart entra como candidato
 * sem idioma para competir na ordenação por votação.
 * @param {number|string} tmdbId - ID do TMDB.
 * @param {string} mediaType - Tipo de mídia ('tv' ou 'movie').
 * @returns {Promise<string|null>} URL do logo ou null.
 */
export async function pickTitleLogo(tmdbId, mediaType = 'tv') {
  if (!tmdbId) return null;
  if (mediaType !== 'tv') return fetchLogoFromFanart(tmdbId, mediaType);

  const [localized, fanart] = await Promise.all([
    fetchLocalizedSeriesLogo(tmdbId),
    fetchLogoFromFanart(tmdbId, mediaType)
  ]);
  if (localized) return localized;
  return fanart;
}

/**
 * Invoca a Edge Function 'clever-endpoint' para consultar a API do TMDB.
 * @param {string} endpoint - Endpoint do TMDB (ex: 'tv/12345' ou 'search/multi').
 * @param {Object} params - Parâmetros de query da requisição.
 * @param {string} lang - Idioma padrão da resposta (pt-BR).
 * @returns {Promise<Object>} Dados retornados do TMDB.
 */
export async function callTMDB(endpoint, params = {}, lang = 'pt-BR') {
  const finalParams = { ...params, language: lang };
  const { data, error } = await supabase.functions.invoke('clever-endpoint', {
    body: { endpoint, params: finalParams }
  });
  if (error) {
    throw new Error(error.message || 'Erro ao conectar à API do TMDB.');
  }
  return data;
}

/**
 * Invoca a Edge Function 'fanart-logo' para buscar o logo transparente do título no Fanart.tv.
 * @param {number|string} tmdbId - ID do TMDB.
 * @param {string} mediaType - Tipo de mídia ('tv' ou 'movie').
 * @returns {Promise<string|null>} URL da imagem do logo ou null.
 */
async function fetchLogoFromFanart(tmdbId, mediaType = 'tv') {
  try {
    const { data, error } = await supabase.functions.invoke('fanart-logo', {
      body: { tmdbId, mediaType }
    });
    if (error) throw error;
    return data?.logoUrl || null;
  } catch (error) {
    console.warn('Erro ao buscar logo no Fanart.tv:', error);
    return null;
  }
}

/**
 * Busca a imagem de logo transparente do título diretamente via API do TMDB (/images).
 * @param {number|string} tmdbId - ID do TMDB.
 * @param {string} mediaType - Tipo de mídia ('tv' ou 'movie').
 * @returns {Promise<string|null>} URL da imagem do logo ou null.
 */
async function fetchLogoFromTMDB(tmdbId, mediaType = 'tv') {
  try {
    const endpoint = mediaType === 'movie' ? `movie/${tmdbId}/images` : `tv/${tmdbId}/images`;
    const data = await callTMDB(endpoint, { include_image_language: 'pt,en,null' });
    if (data && Array.isArray(data.logos) && data.logos.length > 0) {
      // Prioridade de idioma: pt -> en -> sem idioma (null) -> primeiro disponível
      const ptLogo = data.logos.find(l => l.iso_639_1 === 'pt');
      const enLogo = data.logos.find(l => l.iso_639_1 === 'en');
      const nullLogo = data.logos.find(l => !l.iso_639_1);
      const chosen = ptLogo || enLogo || nullLogo || data.logos[0];
      if (chosen && chosen.file_path) {
        return `https://image.tmdb.org/t/p/w500${chosen.file_path}`;
      }
    }
    return null;
  } catch (error) {
    console.warn('Erro ao buscar logo no TMDB:', error);
    return null;
  }
}

/**
 * Busca o logo do título priorizando a variante pt-BR do TMDB (mesma região dos
 * nomes exibidos pelo app) e, dentro dela, o logo mais votado. Usa o Fanart.tv
 * como fallback e, por último, qualquer logo do TMDB.
 * @param {number|string} tmdbId - ID do TMDB.
 * @param {string} mediaType - Tipo de mídia (tv ou movie).
 * @param {boolean} useCache - Se deve usar cache (padrão: true)
 * @returns {Promise<string|null>} URL da imagem do logo ou null.
 */
export async function fetchTitleLogo(tmdbId, mediaType = 'tv', useCache = true) {
  if (!tmdbId) return null;

  // Verificar cache primeiro
  if (useCache) {
    const cachedLogo = getLogoFromCache(tmdbId, mediaType);
    if (cachedLogo) {
      return cachedLogo;
    }
  }

  // 1ª tentativa: logo pt-BR do TMDB, com Fanart.tv como fallback
  const preferredLogo = await pickTitleLogo(tmdbId, mediaType);
  if (preferredLogo) {
    setLogoInCache(tmdbId, mediaType, preferredLogo);
    return preferredLogo;
  }


  // 3ª tentativa (fallback): qualquer logo do TMDB (/images)
  const tmdbLogo = await fetchLogoFromTMDB(tmdbId, mediaType);
  if (tmdbLogo) {
    setLogoInCache(tmdbId, mediaType, tmdbLogo);
  }
  return tmdbLogo;
}

/**
 * Busca diversas imagens removida — morta (nenhum caller). Use fetchTitleLogo para logo.
 */
