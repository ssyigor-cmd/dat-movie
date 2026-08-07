/**
 * Funções puras de navegação e processamento de imagens do modal de detalhes.
 * Isoladas em módulo para permitir testes unitários sem dependência de DOM.
 */

/**
 * Retorna o próximo índice com wrap-around circular.
 * @param {number} currentIndex - Índice atual.
 * @param {number} listLength - Tamanho da lista de imagens.
 * @returns {number} Próximo índice (circular).
 */
export function nextImage(currentIndex, listLength) {
  if (listLength <= 1) return 0;
  return (currentIndex + 1) % listLength;
}

/**
 * Retorna o índice anterior com wrap-around circular.
 * @param {number} currentIndex - Índice atual.
 * @param {number} listLength - Tamanho da lista de imagens.
 * @returns {number} Índice anterior (circular).
 */
export function prevImage(currentIndex, listLength) {
  if (listLength <= 1) return 0;
  return (currentIndex - 1 + listLength) % listLength;
}

/**
 * Reseta o índice para 0 (usado ao abrir/fechar o modal).
 * @returns {number} Sempre 0.
 */
export function resetImageIndex() {
  return 0;
}

/**
 * Filtra imagens por idioma (null, 'en' ou 'pt').
 * @param {Array} images - Lista de imagens do TMDB.
 * @returns {Array} Imagens filtradas.
 */
export function filterImagesByLanguage(images) {
  if (!Array.isArray(images)) return [];
  return images.filter(img => img && (img.iso_639_1 === null || img.iso_639_1 === 'en' || img.iso_639_1 === 'pt'));
}

/**
 * Deduplica uma lista de imagens por file_path usando Map.
 * @param {Array} images - Lista de imagens (posters + backdrops já combinados).
 * @returns {Array} Lista deduplicada.
 */
export function dedupeImages(images) {
  const seen = new Map();
  for (const img of images || []) {
    if (!img || !img.file_path) continue;
    if (!seen.has(img.file_path)) {
      seen.set(img.file_path, img);
    }
  }
  return Array.from(seen.values());
}

/**
 * Ordena imagens por largura (width) decrescente (maiores primeiro).
 * @param {Array} images - Lista de imagens.
 * @returns {Array} Lista ordenada por largura decrescente.
 */
export function sortImagesByWidth(images) {
  return [...(images || [])].sort((a, b) => (b.width || 0) - (a.width || 0));
}

/**
 * Combina posters e backdrops, filtra por idioma,
 * deduplica por file_path e ordena por largura.
 * @param {Object} imagesData - Resposta do endpoint /images (posters + backdrops).
 * @returns {Array} Lista final de imagens processadas.
 */
export function processImages(imagesData) {
  const posters = filterImagesByLanguage(imagesData?.posters || []);
  const backdrops = filterImagesByLanguage(imagesData?.backdrops || []);
  const combined = [...posters, ...backdrops];
  return sortImagesByWidth(dedupeImages(combined));
}