/**
 * Componente de Cards - Renderização dos cards da grade e bento "Continuando"
 */

import { calcularProgresso, getTierClass, escapeHTML } from '../lib/catalog.js';
import { fetchTitleLogo, setLogoInCache } from '../lib/api.js';

/**
 * Renderiza o bento "Continuando" com os 3 títulos mais recentes em andamento
 * @param {Array} items - Lista completa de itens
 * @param {string} currentTab - Aba atual
 * @param {HTMLElement} continueSection - Elemento do container do bento
 * @param {HTMLElement} continueGrid - Elemento da grade do bento
 * @param {Function} createCardElement - Função para criar cards
 */
export function renderContinueWatching(items, currentTab, continueSection, continueGrid, createCardElement) {
  let pool = items.slice();
  if (currentTab === 'planejado') {
    pool = pool.filter(i => i.status === 'planejado');
  } else {
    pool = pool.filter(i => i.status !== 'planejado');
    if (currentTab !== 'all') pool = pool.filter(i => i.tipo === currentTab);
  }
  pool = pool.filter(i => i.status === 'assistindo');
  pool.sort((a, b) => new Date(b.dataAtualizacao || b.dataCriacao || 0) - new Date(a.dataAtualizacao || a.dataCriacao || 0));
  const top = pool.slice(0, 3);

  continueGrid.innerHTML = '';
  if (!top.length) { continueSection.style.display = 'none'; return; }
  continueSection.style.display = '';

  const fragment = document.createDocumentFragment();
  top.forEach((item, i) => {
    let variant;
    if (top.length === 1) variant = 'hero-full';
    else if (top.length === 2) variant = 'hero';
    else variant = i === 0 ? 'hero' : 'tall';
    fragment.appendChild(createCardElement(item, variant));
  });
  continueGrid.appendChild(fragment);
}

/**
 * Cria o elemento DOM de um card
 * @param {Object} item - Dados do item
 * @param {string|null} variant - Variante do card (hero, tall, hero-full, etc)
 * @param {Array} items - Lista completa de itens (para buscar índice)
 * @param {Function} onCardClick - Callback quando card é clicado
 * @returns {HTMLElement} Elemento do card
 */
export function createCardElement(item, variant = null, items, onCardClick) {
  const realIndex = items.indexOf(item);
  const progress = calcularProgresso(item);
  const icon = item.tipo === 'anime' ? 'fa-tv' : item.tipo === 'animacao' ? 'fa-paint-brush' : 'fa-video';
  const tipoLabel = item.tipo === 'anime' ? 'Anime' : item.tipo === 'animacao' ? 'Animação' : 'Série';
  const card = document.createElement('div');
  card.className = variant ? `card card-${variant}` : 'card';
  card.dataset.index = realIndex;
  card.dataset.itemId = item.id;
  card.dataset.tmdbId = item.tmdb_id || '';
  card.dataset.mediaType = item.tipo === 'filme' ? 'movie' : 'tv';
  card.setAttribute('role', 'listitem');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Ver detalhes de ${item.nome}`);
  const tierClass = item.tier ? getTierClass(item.tier) : '';
  const tierText = item.tier ? escapeHTML(item.tier) : '?';
  const tierStampHtml = `<div class="tier-stamp ${tierClass}">${tierText}</div>`;
  const anoDisplay = item.ano ? ` (${item.ano})` : '';
  const safeNome = escapeHTML(item.nome);
  const safeImagem = item.imagem ? escapeHTML(item.imagem) : '';
  card.innerHTML = `
    <div class="card-img" data-index="${realIndex}">
      ${safeImagem ? `<img src="${safeImagem}" alt="${safeNome}" loading="lazy" />` : `<i class="fas ${icon}" style="font-size:1.8rem; opacity:0.3;"></i>`}
      ${tierStampHtml}
    </div>
    <div class="card-body">
      <span class="badge">${tipoLabel}</span>
      <h3 title="${safeNome}${anoDisplay}">${safeNome}${anoDisplay}</h3>
      <div class="info">
        <span>T${item.temporada} <i class="fas fa-circle" style="font-size: 0.2rem; vertical-align: middle; margin: 0 4px; color: var(--text-muted);"></i> Ep ${item.episodio}/${item.totalEpisodios}</span>
        <span>${progress}%</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${progress}%;"></div></div>
    </div>
  `;
  
  // Pré-carregar logo no hover
  let logoPreloadTimeout = null;
  card.addEventListener('mouseenter', () => {
    const tmdbId = card.dataset.tmdbId;
    const mediaType = card.dataset.mediaType;
    
    if (tmdbId && mediaType) {
      clearTimeout(logoPreloadTimeout);
      logoPreloadTimeout = setTimeout(async () => {
        await fetchTitleLogo(tmdbId, mediaType, true);
      }, 300); // Delay de 300ms para não carregar em todos os hovers rápidos
    }
  });
  
  card.addEventListener('mouseleave', () => {
    clearTimeout(logoPreloadTimeout);
  });
  
  const handleCardClick = () => {
    const index = parseInt(card.dataset.index);
    const itemId = card.dataset.itemId;
    
    if (items[index] && items[index].id === itemId) {
      onCardClick(index);
    } else {
      const  foundIndex = items.findIndex(i => i.id === itemId);
      if (foundIndex !== -1) {
        onCardClick(foundIndex);
      } else {
        console.error('Item não encontrado:', itemId);
      }
    }
  };
  
  card.addEventListener('click', handleCardClick);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  });
  
  return card;
}