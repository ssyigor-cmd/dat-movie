/**
 * Componente DetailModal - Controle e exibição do modal de detalhes
 */

import { callTMDB, fetchTitleLogo } from '../lib/api.js';
import { getTierClass, escapeHTML, formatDateBR } from '../lib/catalog.js';
import { lockScreen, unlockScreen, trapFocus, releaseFocusTrap } from './uiHelpers.js';

/**
 * Configura e controla o modal de detalhes
 * @param {Object} elements - Elementos DOM do modal
 * @param {Object} callbacks - Callbacks para eventos
 * @returns {Object} API do modal com funções de controle
 */
export function setupDetailModal(elements, callbacks) {
  const {
    detailModal,
    detailClose,
    detailTitle,
    detailSinopse,
    detailLoading,
    detailTemporadaInput,
    detailEpisodioInput,
    detailTemporadaDisplay,
    detailEpisodioDisplay,
    detailStatus,
    detailTier,
    detailTipo,
    detailTierBadge,
    detailTierDropdown,
    detailSave,
    detailDelete,
    detailPosterImg,
    detailStartYear,
    detailEndYear,
    detailStatusLabel,
    detailOriginalTitle,
    detailLogoContainer,
    detailLogoImg,
    detailTitleText,
    detailWikiLink,
    detailImdbLink,
    detailYoutubeLink,
    detailEpisodesBtn,
    detailAddedDate,
    detailListCheckboxes
  } = elements;

  const {
    onUpdateItem,
    onDeleteItem,
    onOpenEpisodes,
    updateEpisodeLimit,
    onRefreshGrid,
    populateDetailListCheckboxes,
    onAddItemToList,
    onRemoveItemFromList,
    onGetUserLists
  } = callbacks;

  let detailCurrentIndex = null;
  let detailSeasonLimits = {};
  let currentItems = [];

  function updateTierBadge(tier) {
    const badge = detailTierBadge;
    badge.textContent = tier || '?';
    badge.className = tier ? `tier-badge-large ${getTierClass(tier)}` : 'tier-badge-large';
    badge.style.display = 'flex';
    badge.setAttribute('aria-expanded', 'false');
    if (tier && typeof window !== 'undefined' && window.anime) {
      window.anime({ targets: badge, scale: [0.5, 1.2, 1], duration: 400, easing: 'easeOutQuad' });
    }
  }

  function toggleTierDropdown() {
    const dropdown = detailTierDropdown;
    const badge = detailTierBadge;
    const isVisible = dropdown.style.display === 'flex';
    dropdown.style.display = isVisible ? 'none' : 'flex';
    badge.setAttribute('aria-expanded', !isVisible);
  }

  function hideTierDropdown() {
    detailTierDropdown.style.display = 'none';
    detailTierBadge.setAttribute('aria-expanded', 'false');
  }

  function selectTier(tier) {
    const badge = detailTierBadge;
    badge.textContent = tier || '?';
    badge.className = tier ? `tier-badge-large ${getTierClass(tier)}` : 'tier-badge-large';
    badge.style.display = 'flex';
    badge.setAttribute('aria-expanded', 'false');
    detailTier.value = tier || '';
    hideTierDropdown();
    if (tier && typeof window !== 'undefined' && window.anime) {
      window.anime({ targets: badge, scale: [0.5, 1.2, 1], duration: 400, easing: 'easeOutQuad' });
    }
  }

  async function fetchFullDetailsAndPopulate(item) {
    try {
      let tmdbId = item.tmdb_id;
      let mediaType = item.tipo === 'filme' ? 'movie' : 'tv';
      let detailsData = null;

      if (!tmdbId) {
        const searchData = await callTMDB('search/multi', { query: item.nome }, 'pt-BR');
        const result = searchData.results?.[0];
        if (result) {
          tmdbId = result.id;
          mediaType = result.media_type || (item.tipo === 'filme' ? 'movie' : 'tv');
          if (!item.tmdb_id) {
            item.tmdb_id = tmdbId;
            await onUpdateItem(item.id, { tmdb_id: tmdbId });
          }
        }
      }

      if (tmdbId) {
        if (mediaType === 'tv' || !mediaType) {
          try {
            detailsData = await callTMDB(`tv/${tmdbId}`, {}, 'pt-BR');
          } catch (tvError) {
            console.warn('Falha ao buscar como TV, tentando como filme:', tvError);
            detailsData = await callTMDB(`movie/${tmdbId}`, {}, 'pt-BR');
            mediaType = 'movie';
          }
        } else if (mediaType === 'movie') {
          try {
            detailsData = await callTMDB(`movie/${tmdbId}`, {}, 'pt-BR');
          } catch (movieError) {
            console.warn('Falha ao buscar como filme, tentando como TV:', movieError);
            detailsData = await callTMDB(`tv/${tmdbId}`, {}, 'pt-BR');
            mediaType = 'tv';
          }
        }
      }

      let overview = detailsData?.overview || 'Sinopse não disponível.';

      if (detailsData) {
        // Usar o backdrop (formato 16:9) em alta qualidade para não cortar a imagem no pôster horizontal
        if (detailsData.backdrop_path) {
          const backdropUrl = `https://image.tmdb.org/t/p/w1280${detailsData.backdrop_path}`;
          detailPosterImg.src = backdropUrl;
          const blurBg = document.getElementById('detailBlurBg');
          if (blurBg) {
            blurBg.style.backgroundImage = `url(${backdropUrl})`;
          }
        } else if (item.imagem) {
          // Fallback: sem backdrop, usar a imagem do card
          detailPosterImg.src = item.imagem;
          const blurBg = document.getElementById('detailBlurBg');
          if (blurBg) {
            blurBg.style.backgroundImage = `url(${item.imagem})`;
          }
        }

        const start = detailsData.first_air_date
          ? detailsData.first_air_date.substring(0, 4)
          : detailsData.release_date
            ? detailsData.release_date.substring(0, 4)
            : '--';

        let end = '--';
        if (detailsData.status === 'Ended') {
          if (detailsData.last_air_date) {
            end = detailsData.last_air_date.substring(0, 4);
          } else {
            end = start;
          }
        }
        detailStartYear.textContent = start;
        detailEndYear.textContent = end;

        const statusMap = {
          'Returning Series': 'Em exibição',
          'Ended': 'Finalizada',
          'In Production': 'Em produção',
          'Planned': 'Planejada',
          'Canceled': 'Cancelada'
        };
        detailStatusLabel.textContent = statusMap[detailsData.status] || detailsData.status || '--';

        const originalName = detailsData.original_name || detailsData.original_title || '';
        detailOriginalTitle.textContent = originalName ? `Título original: ${originalName}` : '--';

        let wikiLink = `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.nome).replace(/%20/g, '_')}`;
        let imdbLink = `https://www.imdb.com/find?q=${encodeURIComponent(item.nome)}`;
        if (detailsData.imdb_id) {
          imdbLink = `https://www.imdb.com/title/${detailsData.imdb_id}/`;
        }
          detailWikiLink.href = wikiLink;
          detailImdbLink.href = imdbLink;
          if (detailYoutubeLink) {
            detailYoutubeLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.nome + ' trailer')}`;
          }
      } else if (item.imagem) {
        // Sem dados do TMDB: usar a imagem do card
        detailPosterImg.src = item.imagem;
        const blurBg = document.getElementById('detailBlurBg');
        if (blurBg) {
          blurBg.style.backgroundImage = `url(${item.imagem})`;
        }
      }

      let logoUrl = null;
      if (tmdbId) {
        logoUrl = await fetchTitleLogo(tmdbId, mediaType);
      }

      if (logoUrl) {
        detailLogoImg.src = logoUrl;
        detailLogoImg.alt = `Logo de ${item.nome}`;
        detailLogoContainer.style.display = 'flex';
        detailTitle.style.display = 'none';
      } else {
        detailLogoContainer.style.display = 'none';
        detailTitle.style.display = 'block';
        detailTitleText.textContent = item.nome;
      }

      detailSinopse.textContent = overview;
      detailLoading.style.display = 'none';
    } catch (e) {
      console.warn('Erro ao buscar detalhes:', e);
      detailSinopse.textContent = 'Erro ao carregar sinopse.';
      detailLoading.style.display = 'none';
      // Fallback: exibir a imagem do card caso a busca falhe
      if (item.imagem && !detailPosterImg.src) {
        detailPosterImg.src = item.imagem;
        const blurBg = document.getElementById('detailBlurBg');
        if (blurBg) {
          blurBg.style.backgroundImage = `url(${item.imagem})`;
        }
      }
    }
  }

  function openDetailModal(index, items) {
    detailCurrentIndex = index;
    currentItems = items;
    const item = items[index];
    if (!item) return;

    detailLogoContainer.style.display = 'none';
    detailTitle.style.display = 'block';
    detailTitleText.textContent = item.nome;

    detailStatus.value = item.status || 'assistindo';
    document.querySelectorAll('.dm-status-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === detailStatus.value);
    });
    detailTipo.value = item.tipo || 'anime';
    if (detailTier) {
      detailTier.value = item.tier || '';
      if (item.tier) {
        updateTierBadge(item.tier);
      }
    }
    detailSinopse.textContent = 'Carregando sinopse...';
    detailLoading.style.display = 'flex';
    detailStartYear.textContent = '--';
    detailEndYear.textContent = '--';
    detailStatusLabel.textContent = '--';
    detailOriginalTitle.textContent = '--';

    if (item.tipo === 'serie' || item.tipo === 'anime' || item.tipo === 'animacao') {
      detailEpisodesBtn.style.display = 'inline-flex';
    } else {
      detailEpisodesBtn.style.display = 'none';
    }

    const nome = item.nome;
    const wikiFallback = `https://pt.wikipedia.org/wiki/${encodeURIComponent(nome).replace(/%20/g, '_')}`;
    const imdbFallback = `https://www.imdb.com/find?q=${encodeURIComponent(nome)}`;
    detailWikiLink.href = wikiFallback;
    detailImdbLink.href = imdbFallback;
    if (detailYoutubeLink) {
      detailYoutubeLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(nome + ' trailer')}`;
    }

    const seasonMap = item.seasonEpisodesMap || {};
    const tempKeys = Object.keys(seasonMap).map(Number).filter(k => k > 0);
    const maxTemp = tempKeys.length ? Math.max(...tempKeys) : 1;
    detailSeasonLimits = {
      maxTemp: maxTemp,
      maxEpByTemp: seasonMap
    };

    const tempVal = Math.min(item.temporada || 1, maxTemp);
    const maxEp = seasonMap[tempVal] || 1;
    const epVal = Math.min(item.episodio || 0, maxEp);

    detailTemporadaInput.value = tempVal;
    detailTemporadaDisplay.textContent = tempVal;
    detailEpisodioInput.value = epVal;
    detailEpisodioDisplay.textContent = epVal;
    updateEpisodeLimit('detail', tempVal, detailSeasonLimits, 'detail');

    // Popular checkboxes de listas
    if (callbacks.populateDetailListCheckboxes) {
      callbacks.populateDetailListCheckboxes(item.lists || []);
    }

    const imagemUrl = item.imagem || null;
    // Não exibir a imagem do card: aguardar o backdrop de alta qualidade do TMDB
    detailPosterImg.src = '';
    const blurBg = document.getElementById('detailBlurBg');
    if (blurBg) {
      blurBg.style.backgroundImage = 'none';
    }

    updateTierBadge(item.tier);

    // Mostrar data de adição, se disponível
    if (detailAddedDate) {
      try {
        const iso = item.dataCriacao || item.dataCriacao === 0 ? item.dataCriacao : null;
        const datePart = iso ? String(iso).split('T')[0] : null;
        const formatted = datePart ? formatDateBR(datePart) : 'Data desconhecida';
        detailAddedDate.textContent = `Adicionado: ${formatted}`;
      } catch (e) {
        detailAddedDate.textContent = 'Adicionado: Data desconhecida';
      }
    }

    detailModal.classList.add('active');
    lockScreen();
    const modalElem = detailModal.querySelector('.modal');
    if (typeof window !== 'undefined' && window.anime) {
      window.anime({ targets: modalElem, translateY: ['20px', '0'], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
    }
    trapFocus(modalElem);

    fetchFullDetailsAndPopulate(item);
  }

  function closeDetailModal() {
    detailModal.classList.remove('active');
    const listModal = document.getElementById('detailListModal');
    if (listModal) listModal.classList.remove('active');
    unlockScreen();
    detailCurrentIndex = null;
    detailSeasonLimits = {};
    releaseFocusTrap();
    detailOriginalTitle.textContent = '--';
  }

  async function saveDetailChanges(items) {
    const index = detailCurrentIndex;
    if (index === null) return;
    const item = items[index];
    const newTemporada = parseInt(detailTemporadaInput.value);
    const newEpisodio = parseInt(detailEpisodioInput.value);
    const newStatus = detailStatus.value;
    const newTier = detailTier?.value || null;

    const maxTemp = detailSeasonLimits.maxTemp || 1;
    const maxEp = detailSeasonLimits.maxEpByTemp?.[newTemporada] || 1;
    let hasError = false;
    if (newTemporada < 1 || newTemporada > maxTemp) {
      hasError = true;
    }
    if (newEpisodio < 0 || newEpisodio > maxEp) {
      hasError = true;
    }
    if (hasError) { return false; }

    try {
      const updates = { temporada: newTemporada, episodio: newEpisodio, status: newStatus, tier: newTier };
      const saved = await onUpdateItem(item.id, updates);
      items[index] = saved;
      updateTierBadge(newTier);

      // Salvar mudanças nas listas
      if (detailListCheckboxes) {
        const userLists = onGetUserLists ? onGetUserLists() : [];
        const selectedIds = Array.from(detailListCheckboxes.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        const currentListIds = (item.lists || []).map(l => l.id);
        
        const toAdd = selectedIds.filter(id => !currentListIds.includes(id));
        const toRemove = currentListIds.filter(id => !selectedIds.includes(id));
        
        const addPromises = toAdd.map(listId => onAddItemToList(item.id, listId));
        const removePromises = toRemove.map(listId => onRemoveItemFromList(item.id, listId));
        
        await Promise.allSettled([...addPromises, ...removePromises]);
        saved.lists = userLists.filter(l => selectedIds.includes(l.id));
      }

      closeDetailModal();
      if (onRefreshGrid) onRefreshGrid();
      return true;
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      return false;
    }
  }

  async function deleteFromDetail(items) {
    const index = detailCurrentIndex;
    if (index === null) return false;
    if (!confirm('Tem certeza que deseja remover este título?')) return false;
    const item = items[index];
    try {
      await onDeleteItem(item.id);
      items.splice(index, 1);
      closeDetailModal();
      if (onRefreshGrid) onRefreshGrid();
      return true;
    } catch (error) {
      console.error('Erro ao remover item:', error);
      return false;
    }
  }

  // Event listeners
  detailClose.addEventListener('click', closeDetailModal);
  detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeDetailModal(); });
  
  // Tier badge e dropdown
  detailTierBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTierDropdown();
  });
  
  detailTierDropdown.addEventListener('click', (e) => {
    if (e.target.classList.contains('tier-option')) {
      const tier = e.target.dataset.tier;
      selectTier(tier);
    }
  });
  
  // Fechar dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    if (!detailTierBadge.contains(e.target) && !detailTierDropdown.contains(e.target)) {
      hideTierDropdown();
    }
  });
  
  detailSave.addEventListener('click', () => saveDetailChanges(currentItems));
  detailDelete.addEventListener('click', () => deleteFromDetail(currentItems));
  detailEpisodesBtn.addEventListener('click', () => {
    if (detailCurrentIndex !== null) {
      const curTemp = parseInt(detailTemporadaInput.value) || 1;
      const curEp = parseInt(detailEpisodioInput.value) || 0;
      onOpenEpisodes(detailCurrentIndex, curTemp, curEp);
    }
  });

  return {
    open: (index, items) => openDetailModal(index, items),
    close: closeDetailModal,
    save: (items) => saveDetailChanges(items),
    delete: (items) => deleteFromDetail(items),
    getSeasonLimits: () => detailSeasonLimits
  };
}