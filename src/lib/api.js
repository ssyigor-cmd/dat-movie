import { supabase } from './supabase.js';
import { cacheGet, cacheSet, appCache } from './cache.js';

// ========== CACHE DE LOGOS (via appCache) ==========
export function getLogoFromCache(tmdbId, mediaType) {
  const cacheKey = `logo_${tmdbId}_${mediaType}`;
  return cacheGet(cacheKey) || null;
}

export function setLogoInCache(tmdbId, mediaType, logoUrl) {
  const cacheKey = `logo_${tmdbId}_${mediaType}`;
  if (logoUrl) {
    cacheSet(cacheKey, logoUrl);
  } else {
    appCache.delete(cacheKey);
  }
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
 * Busca o logo do título tentando primeiramente no Fanart.tv e, caso não encontre ou falhe,
 * busca o logo oficial no próprio TMDB como fallback.
 * @param {number|string} tmdbId - ID do TMDB.
 * @param {string} mediaType - Tipo de mídia ('tv' ou 'movie').
 * @param {boolean} useCache - Se deve usar cache (padrão: true)
 * @returns {Promise<string|null>} URL do logo ou null.
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

  // 1ª tentativa: Fanart.tv
  const fanartLogo = await fetchLogoFromFanart(tmdbId, mediaType);
  if (fanartLogo) {
    setLogoInCache(tmdbId, mediaType, fanartLogo);
    return fanartLogo;
  }

  // 2ª tentativa (Fallback): API do TMDB (/images)
  const tmdbLogo = await fetchLogoFromTMDB(tmdbId, mediaType);
  if (tmdbLogo) {
    setLogoInCache(tmdbId, mediaType, tmdbLogo);
  }
  return tmdbLogo;
}

/**
 * Busca diversas imagens removida — morta (nenhum caller). Use fetchTitleLogo para logo.
 */
