/**
 * Componente EpisodesModal - Controle e acordeão do modal de episódios
 */

import { callTMDB } from '../lib/api.js';
import { escapeHTML, formatDateBR } from '../lib/catalog.js';
import { lockScreen, unlockScreen, trapFocus, releaseFocusTrap } from './uiHelpers.js';

/**
 * Configura e controla o modal de episódios
 * @param {Object} elements - Elementos DOM do modal
 * @param {Object} callbacks - Callbacks para eventos
 * @returns {Object} API do modal com funções de controle
 */
export function setupEpisodesModal(elements, callbacks) {
  const {
    episodesModal,
    episodesClose,
    episodesTitle,
    episodesLoading,
    episodesContent,
    detailModal
  } = elements;

  const {
    onUpdateItem,
    onToast
  } = callbacks;

  function closeEpisodesModal() {
    episodesModal.classList.remove('active');
    if (!detailModal.classList.contains('active')) {
      unlockScreen();
    }
    episodesContent.innerHTML = '';
    episodesContent.style.display = 'none';
    episodesLoading.style.display = 'flex';
    releaseFocusTrap();
    if (detailModal.classList.contains('active')) {
      trapFocus(detailModal.querySelector('.modal'));
    }
  }

  async function openEpisodesModal(index, items, curTemp, curEp) {
    const item = items[index];
    if (!item) return;
    if (item.tipo !== 'serie' && item.tipo !== 'anime' && item.tipo !== 'animacao') {
      onToast('Episódios disponíveis apenas para séries, animes e animações.', 2000);
      return;
    }

    episodesTitle.textContent = `Episódios - ${item.nome}`;
    episodesLoading.style.display = 'flex';
    episodesContent.style.display = 'none';
    episodesContent.innerHTML = '';
    episodesModal.classList.add('active');
    lockScreen();

    const modalElem = episodesModal.querySelector('.modal');
    if (typeof window !== 'undefined' && window.anime) {
      window.anime({ targets: modalElem, translateY: ['20px', '0'], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
    }
    trapFocus(modalElem);

    try {
      let tmdbId = item.tmdb_id;
      if (!tmdbId) {
        const searchData = await callTMDB('search/multi', { query: item.nome }, 'pt-BR');
        const result = searchData.results?.[0];
        if (result && (result.media_type === 'tv' || result.media_type === 'movie')) {
          tmdbId = result.id;
          item.tmdb_id = tmdbId;
          await onUpdateItem(item.id, { tmdb_id: tmdbId });
        } else {
          throw new Error('Não foi possível encontrar este título no TMDB.');
        }
      }

      let seriesDetails;
      let mediaType = item.tipo === 'filme' ? 'movie' : 'tv';
      
      try {
        if (mediaType === 'tv' || !mediaType) {
          try {
            seriesDetails = await callTMDB(`tv/${tmdbId}`, {}, 'pt-BR');
          } catch (tvError) {
            console.warn('Falha ao buscar como TV, tentando como filme:', tvError);
            const movieDetails = await callTMDB(`movie/${tmdbId}`, {}, 'pt-BR');
            if (movieDetails) {
              episodesContent.innerHTML = `<div class="no-episodes"><i class="fas fa-film" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5; color: var(--text-muted);"></i><p>Este título é um filme único e não possui episódios ou temporadas.</p></div>`;
              episodesLoading.style.display = 'none';
              episodesContent.style.display = 'block';
              return;
            }
            throw tvError;
          }
        } else if (mediaType === 'movie') {
          const movieDetails = await callTMDB(`movie/${tmdbId}`, {}, 'pt-BR');
          if (movieDetails) {
            episodesContent.innerHTML = `<div class="no-episodes"><i class="fas fa-film" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5; color: var(--text-muted);"></i><p>Este título é um filme único e não possui episódios ou temporadas.</p></div>`;
            episodesLoading.style.display = 'none';
            episodesContent.style.display = 'block';
            return;
          }
          throw new Error('Não foi possível encontrar este filme no TMDB.');
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes:', err);
        episodesContent.innerHTML = `<div class="no-episodes"><p>Erro ao carregar episódios. Este título pode ser um filme único.</p></div>`;
        episodesLoading.style.display = 'none';
        episodesContent.style.display = 'block';
        return;
      }
      if (!seriesDetails || !seriesDetails.seasons) {
        throw new Error('Dados da série não encontrados.');
      }

      const seasons = seriesDetails.seasons.filter(s => s.season_number > 0);
      if (seasons.length === 0) {
        episodesContent.innerHTML = `<div class="no-episodes">Nenhuma temporada encontrada.</div>`;
        episodesLoading.style.display = 'none';
        episodesContent.style.display = 'block';
        return;
      }

      const seasonPromises = seasons.map(season =>
        callTMDB(`tv/${tmdbId}/season/${season.season_number}`, {}, 'pt-BR')
      );
      const seasonsData = await Promise.all(seasonPromises);

      const currentSeason = Number(curTemp) || Number(item.temporada) || 1;
      const currentEpisode = Number(curEp) || Number(item.episodio) || 0;

      let html = '';
      let currentSeasonFound = false;
      seasonsData.forEach((seasonData, idx) => {
        const seasonNum = Number(seasons[idx].season_number);
        const seasonName = seasons[idx].name || `${seasonNum}ª Temporada`;
        const episodeCount = seasonData.episodes ? seasonData.episodes.length : 0;
        const isCurrentSeason = seasonNum === currentSeason;
        if (isCurrentSeason) currentSeasonFound = true;
        
        html += `<div class="season-container">`;
        html += `<div class="season-header" data-season="${seasonNum}" tabindex="0" role="button" aria-expanded="false" aria-label="Expandir/recolher ${escapeHTML(seasonName)}">`;
        html += `<button class="season-toggle collapsed" data-season="${seasonNum}" tabindex="-1" aria-hidden="true"><i class="fas fa-chevron-down"></i></button>`;
        html += `<h3><i class="fas fa-tag"></i> ${escapeHTML(seasonName)} <span style="font-size:0.7rem;color:var(--text-muted);">${episodeCount} episódios</span></h3>`;
        html += `</div>`;
        html += `<div class="season-episodes collapsed" data-season="${seasonNum}">`;
        if (seasonData.overview) {
          html += `<div class="season-overview">${escapeHTML(seasonData.overview)}</div>`;
        }
        if (seasonData.episodes && seasonData.episodes.length > 0) {
          seasonData.episodes.forEach(ep => {
            const epNum = Number(ep.episode_number);
            const epTitle = ep.name || `Episódio ${epNum}`;
            const epAirDate = ep.air_date ? formatDateBR(ep.air_date) : 'Data desconhecida';
            const epOverview = ep.overview || 'Sinopse não disponível.';
            const thumbUrl = ep.still_path ? `https://image.tmdb.org/t/p/w92${ep.still_path}` : null;
            const isCurrent = isCurrentSeason && epNum === currentEpisode;
            
            html += `<div class="episode-item${isCurrent ? ' episode-current' : ''}"${isCurrent ? ' id="currentEpisode"' : ''}>`;
            html += `<div class="episode-number">E${epNum}</div>`;
            html += `<div class="episode-thumb">`;
            if (thumbUrl) {
              html += `<img src="${thumbUrl}" alt="Ep ${epNum}" loading="lazy" />`;
            } else {
              html += `<i class="fas fa-film"></i>`;
            }
            html += `</div>`;
            html += `<div class="episode-info">`;
            html += `<span class="episode-title">${escapeHTML(epTitle)} <span class="episode-airdate">${escapeHTML(epAirDate)}</span></span>`;
            html += `<div class="episode-overview">${escapeHTML(epOverview)}</div>`;
            html += `</div></div>`;
          });
        } else {
          html += `<div class="no-episodes">Sem episódios listados.</div>`;
        }
        html += `</div>`;
        html += `</div>`;
      });

      episodesContent.innerHTML = html;
      episodesLoading.style.display = 'none';
      episodesContent.style.display = 'block';

      // Auto-expand current season and scroll to current episode
      if (currentSeasonFound) {
        const currentSeasonHeader = document.querySelector(`.season-header[data-season="${String(currentSeason)}"]`);
        if (currentSeasonHeader) toggleSeason(currentSeasonHeader);
        setTimeout(() => {
          const currentEpEl = document.getElementById('currentEpisode');
          if (currentEpEl) {
            currentEpEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);
      }

      function toggleSeason(header) {
        const seasonNum = header.dataset.season;
        const toggle = header.querySelector('.season-toggle');
        const episodes = document.querySelector(`.season-episodes[data-season="${seasonNum}"]`);
        if (!episodes) return;
        const isCurrentlyExpanded = episodes.classList.contains('expanded');

        if (isCurrentlyExpanded) {
          episodes.style.maxHeight = episodes.scrollHeight + 'px';
          episodes.offsetHeight;
          episodes.style.maxHeight = '0px';
          episodes.classList.remove('expanded');
          episodes.classList.add('collapsed');
          toggle.classList.add('collapsed');
          header.setAttribute('aria-expanded', 'false');
        } else {
          episodes.classList.remove('collapsed');
          episodes.classList.add('expanded');
          episodes.style.maxHeight = episodes.scrollHeight + 'px';
          toggle.classList.remove('collapsed');
          header.setAttribute('aria-expanded', 'true');
          episodes.addEventListener('transitionend', function onEnd(e) {
            if (e.propertyName === 'max-height' && episodes.classList.contains('expanded')) {
              episodes.style.maxHeight = 'none';
            }
            episodes.removeEventListener('transitionend', onEnd);
          });
        }
      }

      document.querySelectorAll('.season-header').forEach(header => {
        header.addEventListener('click', function() { toggleSeason(this); });
        header.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSeason(this);
          }
        });
      });

    } catch (error) {
      console.error('Erro ao carregar episódios:', error);
      episodesContent.innerHTML = `<div class="no-episodes">Erro ao carregar episódios: ${escapeHTML(error.message)}</div>`;
      episodesLoading.style.display = 'none';
      episodesContent.style.display = 'block';
      onToast('Erro ao carregar episódios.', 3000);
    }
  }

  // Event listeners
  episodesClose.addEventListener('click', closeEpisodesModal);
  episodesModal.addEventListener('click', (e) => {
    if (e.target === episodesModal) closeEpisodesModal();
  });

  return {
    open: (index, items, curTemp, curEp) => openEpisodesModal(index, items, curTemp, curEp),
    close: closeEpisodesModal
  };
}