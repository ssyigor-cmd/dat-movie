/**
 * Componente de Sugestões - Autocompletar de títulos do TMDB
 */

import { callTMDB } from '../lib/api.js';
import { escapeHTML } from '../lib/catalog.js';

/**
 * Configura o sistema de sugestões para o campo de nome
 * @param {HTMLElement} nomeInput - Campo de input do nome
 * @param {HTMLElement} suggestionsContainer - Container das sugestões
 * @param {Object} callbacks - Callbacks para eventos de seleção
 * @param {Function} callbacks.onSelect - Callback quando uma sugestão é selecionada
 * @param {Function} callbacks.onSetPreview - Callback para definir preview da imagem
 * @param {Function} callbacks.onClearPreview - Callback para limpar preview
 * @param {Function} callbacks.onSetLoading - Callback para definir estado de loading
 * @param {Function} callbacks.onToast - Callback para mostrar toast
 * @param {Function} callbacks.onSetupSteppers - Callback para configurar steppers
 * @param {Function} callbacks.onSetYear - Callback para definir ano
 */
export function setupSuggestions(nomeInput, suggestionsContainer, callbacks) {
  let suggestionTimeout = null;
  
  const {
    onSelect,
    onSetPreview,
    onClearPreview,
    onSetLoading,
    onToast,
    onSetupSteppers,
    onSetYear,
    onSetTipo
  } = callbacks;

  nomeInput.addEventListener('input', () => {
    clearTimeout(suggestionTimeout);
    const q = nomeInput.value.trim();
    
    if (q.length < 2) { 
      suggestionsContainer.classList.remove('active'); 
      onClearPreview(); 
      return; 
    }
    
    suggestionTimeout = setTimeout(async () => {
      try {
        const data = await callTMDB('search/multi', { query: q }, 'pt-BR');
        
        suggestionsContainer.innerHTML = '';
        
        if (!data.results || data.results.length === 0) {
          return;
        }
        
        data.results?.forEach(res => {
          const name = res.name || res.title;
          if (!name) return;
          
          const year = res.release_date ? res.release_date.substring(0,4) : (res.first_air_date ? res.first_air_date.substring(0,4) : '');
          const mediaType = res.media_type === 'tv' ? 'Série' : res.media_type === 'movie' ? 'Filme' : 'Outro';
          const poster = res.poster_path || '';
          const posterUrl = poster ? `https://image.tmdb.org/t/p/w92${poster}` : '';
          const safePoster = escapeHTML(posterUrl);
          const safeName = escapeHTML(name);
          
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          div.setAttribute('role', 'option');
          div.dataset.id = res.id;
          div.dataset.mediaType = res.media_type;
          div.dataset.poster = poster;
          div.dataset.name = name;
          
          div.innerHTML = `
            ${safePoster ? `<img src="${safePoster}" alt="${safeName}" loading="lazy" />` : `<i class="fas fa-film"></i>`}
            <div class="info">
              <div class="title">${safeName}</div>
              <div class="sub">
                <span class="year">${year || '--'}</span>
                <span class="type">${mediaType}</span>
              </div>
            </div>
          `;
          
          const selectThisSuggestion = () => {
            nomeInput.value = name;
            suggestionsContainer.classList.remove('active');
            
            onSelect({
              tmdbId: res.id,
              mediaType: res.media_type,
              posterPath: poster,
              name: name
            });
            
            if (poster) onSetPreview(poster); else onClearPreview();
            onSetLoading(true);
            
            // Buscar imagem de alta qualidade
            const fetchHighQualityImage = async () => {
              try {
                let highQualityPoster = null;
                if (res.media_type === 'tv') {
                  const tvId = res.id;
                  const details = await callTMDB(`tv/${tvId}`, {}, 'pt-BR');
                  highQualityPoster = details.poster_path || poster;
                  
                  const cachedShowDetails = { 
                    totalEpisodes: details.number_of_episodes || 0, 
                    seasons: details.seasons || [] 
                  };
                  
                  const seasonEpisodesMap = {};
                  const seasons = details.seasons || [];
                  const maxTemp = seasons.filter(s => s.season_number > 0).length || 1;
                  const maxEpByTemp = {};
                  seasons.forEach(s => {
                    if (s.season_number > 0) maxEpByTemp[s.season_number] = s.episode_count || 0;
                  });
                  
                  const year = details.first_air_date ? details.first_air_date.substring(0,4) : '';
                  
                  // Detectar tipo automaticamente pelo gênero e país de origem
                  if (onSetTipo) {
                    const genres = details.genre_ids || (details.genres || []).map(g => g.id);
                    const countries = details.origin_country || [];
                    const isAnimation = genres.includes(16);
                    const isJapanese = countries.includes('JP');
                    let detectedTipo = 'serie';
                    if (isAnimation && isJapanese) detectedTipo = 'anime';
                    else if (isAnimation) detectedTipo = 'animacao';
                    onSetTipo(detectedTipo);
                  }
                  
                  onToast(`Série encontrada: ${maxTemp} temporadas`, 2000);
                  
                  onSetupSteppers(maxTemp, maxEpByTemp, year);
                  if (year && onSetYear) onSetYear(year);
                } else if (res.media_type === 'movie') {
                  const movieId = res.id;
                  const details = await callTMDB(`movie/${movieId}`, {}, 'pt-BR');
                  highQualityPoster = details.poster_path || poster;
                  
                  onToast('Filme único (1 episódio)', 1500);
                }
                
                // Atualizar o posterPath com a imagem de alta qualidade
                if (highQualityPoster) {
                  onSelect({
                    tmdbId: res.id,
                    mediaType: res.media_type,
                    posterPath: highQualityPoster,
                    name: name
                  });
                  // Atualizar preview com imagem de alta qualidade
                  onSetPreview(highQualityPoster);
                }
                
                onSetLoading(false);
              } catch (error) {
                console.warn('Erro ao buscar imagem de alta qualidade:', error);
                onSetLoading(false);
              }
            };
            
            fetchHighQualityImage();
            
            onSetupSteppers(1, { 1: 1 }, '');
          };
          
          div.addEventListener('click', selectThisSuggestion);
          div.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { 
              e.preventDefault(); 
              selectThisSuggestion(); 
            }
          });
          
          suggestionsContainer.appendChild(div);
        });
        
        suggestionsContainer.classList.add('active');
      } catch (e) { 
        console.warn('Erro ao buscar sugestões:', e); 
      }
    }, 300);
  });
  
  // Fechar sugestões ao clicar fora
  document.addEventListener('click', (e) => { 
    if (!e.target.closest('.form-group')) suggestionsContainer.classList.remove('active'); 
  });
  
  // Função para limpar sugestões
  const clearSuggestions = () => {
    suggestionsContainer.classList.remove('active');
  };
  
  return { clearSuggestions };
}