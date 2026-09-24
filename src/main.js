/**
 * Ponto de entrada da aplicação Dat-Movie
 * Orquestra todos os componentes e inicializa a aplicação
 */

import { supabase } from './lib/supabase.js';
import { escapeHTML, getTierClass, filterItems, sortItems, TIER_ORDER, formatDateBR, isDuplicateInCatalog } from './lib/catalog.js';
import { callTMDB, fetchTitleLogo } from './lib/api.js';
import { getCurrentSession, getCurrentUser, loginWithPassword, signUpWithPassword } from './lib/auth.js';
import { fetchUserLists, createList, renameList, deleteList, addItemToList, removeItemFromList, updateListsOrder } from './lib/lists.js';
import { showToast as uiShowToast, showErrorToast as uiShowErrorToast, lockScreen, unlockScreen, trapFocus, releaseFocusTrap, setFieldError, clearAllFieldErrors } from './components/uiHelpers.js';
import { updateStepperValue, setupSteppers } from './lib/stepper.js';
import { renderContinueWatching, createCardElement } from './components/cards.js';
import { setupDetailModal } from './components/detailModal.js';
import { setupEpisodesModal } from './components/episodesModal.js';
import { renderHome } from './components/homePage.js';
import { setupConfirmModal, showConfirm } from './components/confirmModal.js';

// ========== ADAPTADORES PARA UI HELPERS ==========
const toast = document.getElementById('toast');
function showToast(msg, duration = 2800) {
  uiShowToast(toast, msg, duration);
}

function showErrorToast(userMessage, error, duration = 3000) {
  uiShowErrorToast(toast, userMessage, error, duration);
}

// ========== ELEMENTOS DOM ==========
const $ = (id) => document.getElementById(id);
const authContainer = $('authContainer');
const authForm = $('authForm');
const authEmail = $('authEmail');
const authPassword = $('authPassword');
const authLoginBtn = $('authLoginBtn');
const authSignupBtn = $('authSignupBtn');
const authMessage = $('authMessage');
const grid = $('grid');
const gridSection = document.getElementById('gridSection');
const searchView = document.getElementById('searchView');
const pesquisaInput = document.getElementById('pesquisaInput');
const pesquisaGrid = document.getElementById('pesquisaGrid');
const pesquisaEmpty = document.getElementById('pesquisaEmpty');
const pesquisaLoading = document.getElementById('pesquisaLoading');
const searchInput = $('searchInput');
const filterStatus = $('filterStatus');
const filterTier = $('filterTier');
const sortOrder = $('sortOrder');
const modalOverlay = $('modalOverlay');
const modalClose = $('modalClose');
const modalTitle = $('modalTitle');
const form = $('form');
const tipo = $('tipo');
const statusSelect = $('status');
const tierForm = $('tierForm');
const btnSubmit = $('btnSubmit');
const btnCancel = $('btnCancel');
const addPanelDelete = $('addPanelDelete');
const previewImg = $('previewImg');
const previewImgCard = $('previewImgCard');
const previewPlaceholder = $('previewPlaceholder');
const formLoading = $('formLoading');
const densityToggleBtn = $('densityToggleBtn');
const densityMenu = $('densityMenu');
const densityOptions = document.querySelectorAll('.density-option');
const addListToggle = $('addListToggle');
const addListCheckboxes = $('addListCheckboxes');
const addEpisodesBtn = $('addEpisodesBtn');
const detailListToggle = $('detailListToggle');
const detailListCheckboxes = $('detailListCheckboxes');
const statusWrapper = $('statusWrapper');
const statusToggleBtn = $('statusToggleBtn');
const statusMenu = $('statusMenu');
const tierWrapper = $('tierWrapper');
const tierToggleBtn = $('tierToggleBtn');
const tierMenu = $('tierMenu');
const sortWrapper = $('sortWrapper');
const sortToggleBtn = $('sortToggleBtn');
const sortMenu = $('sortMenu');
const filterMenuOptions = document.querySelectorAll('.filter-option');
const groupToggle = $('groupToggle');
const logoutBtn = $('logoutBtn');
const continueSection = $('continueSection');
const continueGrid = $('continueGrid');
const homeSection = document.getElementById('homeSection');
const profileToggle = $('profileToggle');
const profileDropdown = $('profileDropdown');
const profileEmail = $('profileEmail');
const profileEmailFull = $('profileEmailFull');

function densityLabelForValue(v) {
  const map = { '8': 'Compacto', '10': 'Padrão', '12': 'Amplo' };
  return map[String(v)] || 'Padrão';
}

setTimeout(() => {
    try {
      // density: keep icon, set accessible title instead of replacing content
      if (densityToggleBtn) {
        const label = densityLabelForValue(state.gridDensity);
        densityToggleBtn.setAttribute('title', label);
        densityToggleBtn.setAttribute('aria-label', `Densidade: ${label}`);
      }
    } catch (err) { /* ignore if DOM not ready */ }
}, 0);

// NAVBAR E ESTATÍSTICA
const navbar = document.getElementById('topNavbar');
const navbarNav = document.getElementById('navbarNav');
const headerListName = document.getElementById('headerListName');

// ADD MODAL
const addTemporadaInput = $('addTemporada');
const addEpisodioInput = $('addEpisodio');
const addTemporadaDisplay = $('addTemporadaDisplay');
const addEpisodioDisplay = $('addEpisodioDisplay');
const addTierBadge = $('addTierBadge');
const addTierDropdown = $('addTierDropdown');
const addYearDisplay = $('addYearDisplay');
const addLogoContainer = document.getElementById('addLogoContainer');
const addLogoImg = document.getElementById('addLogoImg');
const addOriginalTitle = $('addOriginalTitle');
const addSinopse = document.getElementById('addSinopse');
const addSinopseLoading = document.getElementById('addSinopseLoading');
const addBlurBg = document.getElementById('addBlurBg');
const addPosterWrap = document.getElementById('addPosterWrap');
const modalTitleText = $('modalTitleText');
const addPosterSteppersRow = $('addPosterSteppersRow');


function resetAddProgressPanel() {
  const temp = parseInt(addTemporadaInput.value) || 1;
  const ep = parseInt(addEpisodioInput.value) || 0;
  const maxTemp = state.addSeasonLimits.maxTemp || 1;
  const maxEp = state.addSeasonLimits.maxEpByTemp?.[temp] || 1;

  addTemporadaDisplay.textContent = String(temp).padStart(2, '0');
  addEpisodioDisplay.textContent = String(ep).padStart(2, '0');
  if (addSeasonMaxEl) addSeasonMaxEl.textContent = String(maxTemp).padStart(2, '0');
  if (addEpMaxEl) addEpMaxEl.textContent = String(maxEp || 1).padStart(2, '0');
  if (addSeasonNameEl) addSeasonNameEl.textContent = '';
  if (addEpTitleEl) addEpTitleEl.textContent = ep === 0 ? 'Ainda não iniciado' : `Episódio ${ep}`;
  if (addEpDateEl) addEpDateEl.textContent = '';
  if (addEpOverviewEl) addEpOverviewEl.textContent = '';
  if (addEpLoadingEl) addEpLoadingEl.style.display = 'none';
}

async function syncAddProgressPanel() {
  resetAddProgressPanel();

  const temp = parseInt(addTemporadaInput.value) || 1;
  const ep = parseInt(addEpisodioInput.value) || 0;

  if (!state.selectedTmdbId || state.selectedMediaType !== 'tv' || ep === 0) return;

  const requestId = ++state.addEpisodeInfoRequestId;

  try {
    const key = `${state.selectedTmdbId}:${temp}`;
    let seasonData = addSeasonDataCache.get(key);
    if (!seasonData) {
      seasonData = await callTMDB(`tv/${state.selectedTmdbId}/season/${temp}`, {}, 'pt-BR');
      addSeasonDataCache.set(key, seasonData);
    }
    if (requestId !== state.addEpisodeInfoRequestId) return;

    if (addSeasonNameEl && seasonData?.name) addSeasonNameEl.textContent = seasonData.name;
    if (addEpLoadingEl) addEpLoadingEl.style.display = 'flex';

    const episode = seasonData.episodes?.find(e => Number(e.episode_number) === ep);
    if (episode) {
      if (addEpTitleEl) addEpTitleEl.textContent = episode.name || `Episódio ${ep}`;
      if (addEpDateEl) addEpDateEl.textContent = episode.air_date ? formatDateBR(episode.air_date) : '';
      if (addEpOverviewEl) addEpOverviewEl.textContent = episode.overview || 'Sinopse não disponível.';
    } else if (addEpTitleEl) {
      addEpTitleEl.textContent = `Episódio ${ep}`;
    }
  } catch (e) {
    if (requestId !== state.addEpisodeInfoRequestId) return;
    console.warn('Erro ao buscar detalhes do episódio:', e);
    if (addEpTitleEl) addEpTitleEl.textContent = `Episódio ${ep}`;
  } finally {
    if (requestId === state.addEpisodeInfoRequestId && addEpLoadingEl) {
      addEpLoadingEl.style.display = 'none';
    }
  }
}

function handleStepperUpdate(btn, modalType) {
  updateStepperValue(btn, modalType, state.addSeasonLimits, detailModalAPI.getSeasonLimits(), addInputs, detailInputs);
  if (modalType === 'detail') {
    detailModalAPI.onStepperChange();
  } else if (modalType === 'add') {
    syncAddProgressPanel();
  }
}

// ========== CONFIGURAÇÃO DE COMPONENTES ==========
// Cards
const handleCardClick = (index) => {
  detailModalAPI.open(index, state.items);
};

// Detail Modal
const detailInputs = {
  tempInput: $('detailTemporada'),
  epInput: $('detailEpisodio'),
  epDisplay: $('detailEpisodioDisplay'),
  tempDisplay: $('detailTemporadaDisplay')
};

const detailModalAPI = setupDetailModal({
  detailModal: $('detailModal'),
  detailClose: $('detailClose'),
  detailTitle: $('detailTitle'),
  detailSinopse: $('detailSinopse'),
  detailLoading: $('detailLoading'),
  detailTemporadaInput: detailInputs.tempInput,
  detailEpisodioInput: detailInputs.epInput,
  detailTemporadaDisplay: detailInputs.tempDisplay,
  detailEpisodioDisplay: detailInputs.epDisplay,
  detailStatus: $('detailStatus'),
  detailTier: $('detailTier'),
  detailTipo: $('detailTipo'),
  detailTierBadge: $('detailTierBadge'),
  detailTierDropdown: $('detailTierDropdown'),
  detailAddedDate: $('detailAddedDate'),
  detailSave: $('detailSave'),
  detailDelete: $('detailDelete'),
  detailPosterImg: $('detailPosterImg'),
  detailPosterImgCard: $('detailPosterImgCard'),
  detailStartYear: $('detailStartYear'),
  detailEndYear: $('detailEndYear'),
  detailStatusLabel: $('detailStatusLabel'),
  detailOriginalTitle: $('detailOriginalTitle'),
  detailLogoContainer: $('detailLogoContainer'),
  detailLogoImg: $('detailLogoImg'),
  detailTitleText: $('detailTitleText'),
  detailWikiLink: $('detailWikiLink'),
  detailImdbLink: $('detailImdbLink'),
  detailYoutubeLink: $('detailYoutubeLink'),
  detailEpisodesBtn: $('detailEpisodesBtn'),
  detailListCheckboxes: $('detailListCheckboxes'),
  detailEpMax: $('detailEpMax'),
  detailEpTitle: $('detailEpTitle'),
  detailEpDate: $('detailEpDate'),
  detailEpOverview: $('detailEpOverview'),
  detailEpLoading: $('detailEpLoading'),
  posterSteppersRow: $('posterSteppersRow'),
  detailSeasonName: $('detailSeasonName')
}, {
  onUpdateItem: updateItemInSupabase,
  onDeleteItem: deleteItemFromSupabase,
  onOpenEpisodes: (index, curTemp, curEp) => episodesModalAPI.open(index, state.items, curTemp, curEp),
  populateDetailListCheckboxes: (itemLists) => populateDetailListCheckboxes(itemLists),
  onAddItemToList: (itemId, listId) => addItemToList(itemId, listId),
  onRemoveItemFromList: (itemId, listId) => removeItemFromList(itemId, listId),
  onGetUserLists: () => state.userLists,
  updateEpisodeLimit: (stepperType, temp, limits, modalType) => {
    const inputs = modalType === 'add' ? addInputs : detailInputs;
    const maxEp = limits.maxEpByTemp?.[temp] || 1;
    const currentEp = parseInt(inputs.epInput.value) || 0;
    if (currentEp > maxEp) {
      inputs.epInput.value = maxEp;
      if (inputs.epDisplay) inputs.epDisplay.textContent = modalType === 'add' ? maxEp : String(maxEp).padStart(2, '0');
    }
  },
  onRefreshGrid: () => render()
});

// Episodes Modal
const episodesModalAPI = setupEpisodesModal({
  episodesModal: $('episodesModal'),
  episodesClose: $('episodesClose'),
  episodesTitle: $('episodesTitle'),
  episodesLoading: $('episodesLoading'),
  episodesContent: $('episodesContent'),
  detailModal: $('detailModal')
}, {
  onUpdateItem: updateItemInSupabase,
  onToast: showToast
});

// ========== HOME HELPERS ==========
function handleHomeContinueAdd() {
  setActiveTab('pesquisa', null);
  setTimeout(() => { const inp = document.getElementById('pesquisaInput'); if (inp) inp.focus(); }, 100);
}

async function openAddModalWithTmdbResult(raw) {
  // Normaliza raw vindo de search/multi ou trending
  const tmdbId = raw.id;
  const mediaType = raw.media_type || raw.mediaType || 'tv';
  const displayTitle = raw.title || raw.name || '';
  const posterPath = raw.poster_path || raw.posterPath || '';
  const rawYear = raw.first_air_date || raw.release_date || raw.date || '';
  const year = rawYear ? String(rawYear).substring(0,4) : '';
  const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : (raw.posterUrl || '');

  if (state.editingIndex !== null) cancelEdit();
  clearAllFieldErrors(form);
  clearPreview();
  state.cachedShowDetails = null;
  statusSelect.value = 'assistindo';
  const addPosterStatusBar = document.getElementById('addPosterStatusBar');
  if (addPosterStatusBar) addPosterStatusBar.querySelectorAll('.dm-status-btn').forEach(b => b.classList.toggle('active', b.dataset.status === statusSelect.value));
  tierForm.value = '';
  const addTierBadgeEl = document.getElementById('addTierBadge');
  if (addTierBadgeEl) { addTierBadgeEl.textContent = '?'; addTierBadgeEl.className = 'tier-badge-large'; addTierBadgeEl.style.display = 'flex'; }
  const addYearDisplayEl = document.getElementById('addYearDisplay');
  if (addYearDisplayEl) addYearDisplayEl.textContent = year || '--';
  state.selectedTmdbId = tmdbId;
  state.selectedMediaType = mediaType;
  state.selectedPosterPath = posterPath;
  state.selectedAno = year || null;
  state.selectedName = displayTitle;
  const addTemporadaInputEl = document.getElementById('addTemporada');
  const addTemporadaDisplayEl = document.getElementById('addTemporadaDisplay');
  const addEpisodioInputEl = document.getElementById('addEpisodio');
  const addEpisodioDisplayEl = document.getElementById('addEpisodioDisplay');
  if (addTemporadaInputEl) addTemporadaInputEl.value = 1;
  if (addTemporadaDisplayEl) addTemporadaDisplayEl.textContent = '01';
  if (addEpisodioInputEl) addEpisodioInputEl.value = 0;
  if (addEpisodioDisplayEl) addEpisodioDisplayEl.textContent = '00';
  state.addSeasonLimits = {};
  resetAddProgressPanel();
  const existing = state.items.find(it => it.tmdb_id && String(it.tmdb_id) === String(tmdbId)) || null;
  state.existingItemForSearch = existing;
  const preselectedIds = existing ? (existing.lists || []).map(l => l.id) : [];
  populateAddListCheckboxes(preselectedIds);
  const addListCheckboxesEl = document.getElementById('addListCheckboxes');
  if (existing && preselectedIds.length > 0 && addListCheckboxesEl) {
    addListCheckboxesEl.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      cb.closest('.list-checkbox-pill')?.classList.add('list-existing');
    });
  }
  const addPosterSteppersRowEl = document.getElementById('addPosterSteppersRow');
  if (addPosterSteppersRowEl) addPosterSteppersRowEl.style.display = (mediaType === 'tv') ? 'flex' : 'none';
  const addLogoContainerEl = document.getElementById('addLogoContainer');
  const addLogoImgEl = document.getElementById('addLogoImg');
  const addOriginalTitleEl = document.getElementById('addOriginalTitle');
  const addSinopseEl = document.getElementById('addSinopse');
  const addSinopseLoadingEl = document.getElementById('addSinopseLoading');
  const addBlurBgEl = document.getElementById('addBlurBg');
  const addPosterWrapEl = document.getElementById('addPosterWrap');
  if (addLogoContainerEl) addLogoContainerEl.style.display = 'none';
  if (addLogoImgEl) addLogoImgEl.src = '';
  if (addOriginalTitleEl) { addOriginalTitleEl.style.display = 'none'; addOriginalTitleEl.textContent = ''; }
  if (addSinopseEl) addSinopseEl.textContent = '';
  if (addSinopseLoadingEl) addSinopseLoadingEl.style.display = 'flex';
  if (addBlurBgEl) addBlurBgEl.style.backgroundImage = '';
  if (addPosterWrapEl) addPosterWrapEl.classList.remove('sinopse-open');
  const modalTitleEl = document.getElementById('modalTitle');
  if (modalTitleEl) modalTitleEl.style.display = 'none';
  const previewImgEl = document.getElementById('previewImg');
  const previewImgCardEl = document.getElementById('previewImgCard');
  const previewPlaceholderEl = document.getElementById('previewPlaceholder');
  // Episódios button
  if (addEpisodesBtn) {
    if (mediaType === 'tv') {
      addEpisodesBtn.style.display = 'inline-flex';
      if (existing) {
        addEpisodesBtn.onclick = () => {
          const existingIndex = state.items.indexOf(existing);
          if (existingIndex !== -1) { closeModal(); episodesModalAPI.open(existingIndex, state.items); }
        };
      } else {
        addEpisodesBtn.onclick = () => {
          const tempItem = { id: Date.now(), nome: displayTitle || 'Série', tmdb_id: tmdbId, tipo: 'serie', temporada: parseInt(document.getElementById('addTemporada')?.value) || 1, episodio: parseInt(document.getElementById('addEpisodio')?.value) || 0 };
          try { if (typeof episodesModalAPI !== 'undefined' && episodesModalAPI.open) episodesModalAPI.open(0, [tempItem]); } catch (e) { console.error('Erro ao abrir episódios para novo item', e); }
        };
      }
    } else {
      addEpisodesBtn.style.display = 'none';
      addEpisodesBtn.onclick = null;
    }
  }
  // Fetch details
  (async () => {
    try {
      let details = null;
      if (mediaType === 'tv') {
        details = await callTMDB(`tv/${tmdbId}`, {}, 'pt-BR');
        const seasons = details.seasons || [];
        const maxTemp = seasons.filter(s => s.season_number > 0).length || 1;
        const maxEpByTemp = {};
        seasons.forEach(s => { if (s.season_number > 0) maxEpByTemp[s.season_number] = s.episode_count || 0; });
        const yr = details.first_air_date ? details.first_air_date.substring(0,4) : year;
        state.addSeasonLimits = { maxTemp, maxEpByTemp };
        if (addTemporadaInputEl) addTemporadaInputEl.value = 1;
        if (addTemporadaDisplayEl) addTemporadaDisplayEl.textContent = '01';
        if (addEpisodioInputEl) addEpisodioInputEl.value = 0;
        if (addEpisodioDisplayEl) addEpisodioDisplayEl.textContent = '00';
        if (addYearDisplayEl) addYearDisplayEl.textContent = yr || '--';
        if (yr) state.selectedAno = yr;
        if (addPosterSteppersRowEl) addPosterSteppersRowEl.style.display = 'flex';
        syncAddProgressPanel();
        const genres = details.genre_ids || (details.genres || []).map(g => g.id);
        const countries = details.origin_country || [];
        const isAnimation = genres.includes(16);
        const isJapanese = countries.includes('JP');
        let detectedTipo = 'serie';
        if (isAnimation && isJapanese) detectedTipo = 'anime';
        else if (isAnimation) detectedTipo = 'animacao';
        tipo.value = detectedTipo;
      } else {
        details = await callTMDB(`movie/${tmdbId}`, {}, 'pt-BR');
        state.addSeasonLimits = { maxTemp: 1, maxEpByTemp: { 1: 1 } };
        if (addTemporadaInputEl) addTemporadaInputEl.value = 1;
        if (addTemporadaDisplayEl) addTemporadaDisplayEl.textContent = '01';
        if (addEpisodioInputEl) addEpisodioInputEl.value = 0;
        if (addEpisodioDisplayEl) addEpisodioDisplayEl.textContent = '00';
        tipo.value = 'filme';
        if (addPosterSteppersRowEl) addPosterSteppersRowEl.style.display = 'none';
        syncAddProgressPanel();
      }
      let backdropUrl = '';
      if (details && details.backdrop_path) {
        backdropUrl = `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`;
        if (previewImgEl) { previewImgEl.src = backdropUrl; previewImgEl.style.display = 'block'; }
        if (previewPlaceholderEl) previewPlaceholderEl.style.display = 'none';
      } else if (posterPath) {
        backdropUrl = `https://image.tmdb.org/t/p/w1280${posterPath}`;
        if (previewImgEl) { previewImgEl.src = backdropUrl; previewImgEl.style.display = 'block'; }
        if (previewPlaceholderEl) previewPlaceholderEl.style.display = 'none';
      } else if (posterUrl) {
        backdropUrl = posterUrl.replace('w342','w1280');
        if (previewImgEl) { previewImgEl.src = backdropUrl; previewImgEl.style.display = 'block'; }
        if (previewPlaceholderEl) previewPlaceholderEl.style.display = 'none';
      }
      if (previewImgCardEl) {
        if (posterPath) { previewImgCardEl.src = `https://image.tmdb.org/t/p/w342${posterPath}`; previewImgCardEl.style.display = 'block'; }
        else if (posterUrl) { previewImgCardEl.src = posterUrl; previewImgCardEl.style.display = 'block'; }
        else if (backdropUrl) { previewImgCardEl.src = backdropUrl; previewImgCardEl.style.display = 'block'; }
        else { previewImgCardEl.style.display = 'none'; previewImgCardEl.src = ''; }
      }
      if (addBlurBgEl && backdropUrl) addBlurBgEl.style.backgroundImage = `url(${backdropUrl})`;
      if (addSinopseEl) addSinopseEl.textContent = details?.overview || 'Sinopse não disponível.';
      if (addSinopseLoadingEl) addSinopseLoadingEl.style.display = 'none';
      if (details) {
        const originalName = details.original_name || details.original_title || '';
        if (originalName && originalName !== displayTitle && addOriginalTitleEl) {
          addOriginalTitleEl.textContent = originalName;
          addOriginalTitleEl.style.display = '';
        }
      }
      const logoUrl = await fetchTitleLogo(tmdbId, mediaType);
      if (logoUrl && addLogoImgEl && addLogoContainerEl) {
        addLogoImgEl.src = logoUrl;
        addLogoImgEl.alt = `Logo de ${displayTitle}`;
        addLogoContainerEl.style.display = 'flex';
        if (modalTitleEl) modalTitleEl.style.display = 'none';
      } else {
        if (addLogoContainerEl) addLogoContainerEl.style.display = 'none';
        if (modalTitleEl) modalTitleEl.style.display = '';
        const modalTitleTextEl = document.getElementById('modalTitleText');
        if (modalTitleTextEl) modalTitleTextEl.textContent = displayTitle;
      }
    } catch (err) {
      console.warn('Erro ao buscar detalhes:', err);
      if (posterUrl && previewImgEl) {
        const fallbackUrl = posterUrl.replace('w342','w1280');
        previewImgEl.src = fallbackUrl; previewImgEl.style.display = 'block';
        if (previewPlaceholderEl) previewPlaceholderEl.style.display = 'none';
        if (previewImgCardEl) { previewImgCardEl.src = posterUrl; previewImgCardEl.style.display = 'block'; }
        if (addBlurBgEl) addBlurBgEl.style.backgroundImage = `url(${fallbackUrl})`;
      } else if (posterPath) {
        const fallbackUrl = `https://image.tmdb.org/t/p/w1280${posterPath}`;
        previewImgEl.src = fallbackUrl; previewImgEl.style.display = 'block';
        if (previewPlaceholderEl) previewPlaceholderEl.style.display = 'none';
        if (previewImgCardEl) { previewImgCardEl.src = `https://image.tmdb.org/t/p/w342${posterPath}`; previewImgCardEl.style.display = 'block'; }
        if (addBlurBgEl) addBlurBgEl.style.backgroundImage = `url(${fallbackUrl})`;
      }
      if (addSinopseEl) addSinopseEl.textContent = 'Erro ao carregar sinopse.';
      if (addSinopseLoadingEl) addSinopseLoadingEl.style.display = 'none';
      if (modalTitleEl) modalTitleEl.style.display = '';
    }
  })();
  openModal();
}

async function handleTrendingAdd(trendingItem) {
  const raw = {
    id: trendingItem.id,
    media_type: trendingItem.mediaType || trendingItem.media_type,
    title: trendingItem.title,
    name: trendingItem.title,
    poster_path: trendingItem.posterPath || '',
    posterUrl: trendingItem.posterUrl || '',
    first_air_date: trendingItem.date || '',
    release_date: trendingItem.date || '',
    date: trendingItem.date || ''
  };
  return openAddModalWithTmdbResult(raw);
}

// ========== RENDER ==========
function render() {
  // Pesquisa tab — show search view, hide everything else
  // Na página Pesquisar: esconder busca local e mostrar busca TMDB na mesma linha dos filtros
  const toolbarSearchLocal = document.getElementById('toolbarSearchLocal');
  const toolbarSearchTmdb = document.getElementById('toolbarSearchTmdb');
  const mainHeader = document.querySelector('.main-header');
  if (toolbarSearchLocal) toolbarSearchLocal.style.display = state.currentTab === 'pesquisa' ? 'none' : (state.currentTab === 'home' ? 'none' : '');
  if (toolbarSearchTmdb) toolbarSearchTmdb.style.display = state.currentTab === 'pesquisa' ? '' : 'none';
  if (mainHeader) mainHeader.style.display = state.currentTab === 'home' ? 'none' : '';

  // Home tab
  if (state.currentTab === 'home') {
    if (homeSection) homeSection.style.display = '';
    continueSection.style.display = 'none';
    gridSection.style.display = 'none';
    searchView.style.display = 'none';
    if (headerListName) headerListName.textContent = 'Início';
    if (homeSection) {
      renderHome(homeSection, {
        user: state.currentUser,
        items: state.items, onCardClick: handleCardClick,
        onAddFromTrending: handleTrendingAdd,
        onOpenAddModal: handleHomeContinueAdd
      });
    }
    return;
  }
  if (homeSection) homeSection.style.display = 'none';

  if (state.currentTab === 'pesquisa') {
    continueSection.style.display = 'none';
    gridSection.style.display = 'none';
    searchView.style.display = '';
    headerListName.textContent = 'Pesquisar';
    return;
  }

  // Normal tabs — hide search view, show grid
  searchView.style.display = 'none';
  gridSection.style.display = '';

  renderContinueWatching(state.items, state.currentTab, state.currentListId, continueSection, continueGrid, (item, variant) => createCardElement(item, variant, state.items, handleCardClick));

  const search = searchInput?.value || '';
  const statusFilter = filterStatus.value;
  let tierFilter = filterTier.value;
  const sortKey = sortOrder.value;

  // Ignorar filtro de Tier na aba "Próximos"
  if (state.currentTab === 'planejado') {
    tierFilter = 'todos';
  }

  const filtered = sortItems(filterItems(state.items, { currentTab: state.currentTab, search, statusFilter, tierFilter, currentListId: state.currentListId }), sortKey);

  const count = filtered.length;
  let label = '';
  
  // Determinar label baseado na aba ou lista atual
  if (state.currentTab === 'all') {
    label = 'Catálogo';
  } else if (state.currentTab === 'planejado') {
    label = 'Próximos';
  } else if (state.currentListId) {
    const currentList = state.userLists.find(l => l.id === state.currentListId);
    label = currentList ? currentList.nome : 'Lista';
  } else {
    label = 'Catálogo';
  }
  
  headerListName.textContent = label;

  if (state.currentTab === 'planejado') {
    groupToggle.style.display = 'none';
    filterTier.style.display = 'none';
  } else {
    groupToggle.style.display = '';
    filterTier.style.display = '';
  }

  grid.innerHTML = '';
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum título encontrado</p></div>`;
    grid.className = `grid grid-cols-${state.gridDensity}`;
    return;
  }
  grid.className = `grid grid-cols-${state.gridDensity}`;
  const fragment = document.createDocumentFragment();

  if (state.groupingActive && state.currentTab !== 'planejado') {
    const tiersWithItems = new Set();
    filtered.forEach(item => tiersWithItems.add(item.tier || null));
    const sortedTiers = [...tiersWithItems].sort((a, b) => {
      const idxA = a ? TIER_ORDER.indexOf(a) : 999; const idxB = b ? TIER_ORDER.indexOf(b) : 999;
      return idxA - idxB;
    });
    
    for (const tier of sortedTiers) {
      const itemsInTier = filtered.filter(item => (item.tier || null) === tier);
      
      if (itemsInTier.length === 0) continue;
      const header = document.createElement('div');
      header.className = `group-header ${tier ? getTierClass(tier) : 'tier-null'}`;
      header.innerHTML = `<h3>${escapeHTML(tier) || 'Sem tier'}</h3><span class="group-count">${itemsInTier.length}</span>`;
      fragment.appendChild(header);
      itemsInTier.forEach((item) => fragment.appendChild(createCardElement(item, null, state.items, handleCardClick)));
    }
  } else {
    filtered.forEach((item) => fragment.appendChild(createCardElement(item, null, state.items, handleCardClick)));
  }
  grid.appendChild(fragment);

  if (typeof anime !== 'undefined') {
    const cards = grid.querySelectorAll('.card');
    if (cards.length) {
      anime({
        targets: cards,
        translateY: [24, 0],
        opacity: [0, 1],
        duration: 500,
        delay: anime.stagger(60),
        easing: 'easeOutQuad'
      });
    }
  }
}

// ========== UTILS ==========
function clearPreview() {
  previewImg.style.display = 'none';
  previewImg.src = '';
  if (previewImgCard) { previewImgCard.style.display = 'none'; previewImgCard.src = ''; }
  previewPlaceholder.style.display = 'block';
}

function setLoading(show) {
  formLoading.style.display = show ? 'flex' : 'none';
  btnSubmit.disabled = show;
  btnCancel.disabled = show;
}

// ========== FORMULÁRIO ==========
let addItemInFlight = false;

async function addItem(e) {
  e.preventDefault();

  if (addItemInFlight) return;

  const nomeVal = state.selectedName.trim();
  const tempVal = parseInt(addTemporadaInput.value);
  const epVal = parseInt(addEpisodioInput.value);
  const statusVal = statusSelect.value;
  const tierVal = tierForm.value || null;

  clearAllFieldErrors(form);

  let hasError = false;
  if (!nomeVal) { hasError = true; }
  if (nomeVal.length > 150) { hasError = true; }
  if (isNaN(tempVal) || tempVal < 1) { setFieldError(addTemporadaInput, 'Temporada inválida.'); hasError = true; }
  if (isNaN(epVal) || epVal < 0) { setFieldError(addEpisodioInput, 'Episódio inválido.'); hasError = true; }
  if (hasError) { showToast('Corrija os campos destacados.'); return; }
  // Validate at least one list selected
  const selectedListCheckboxes = addListCheckboxes ? addListCheckboxes.querySelectorAll('input[type="checkbox"]:checked') : [];
  if (selectedListCheckboxes.length === 0) {
    showToast('Selecione pelo menos uma lista.');
    const addListModal = document.getElementById('addListModal');
    if (addListModal) addListModal.classList.add('active');
    return;
  }
  const tipoVal = tipo.value;

  addItemInFlight = true;
  setLoading(true);

  try {
    let totalEp = 0, seasonEpisodesMap = {};
    let ano = state.selectedAno;
    
    if (!state.cachedShowDetails || state.cachedShowDetails.totalEpisodes === 0) {
      showToast('Buscando informações do título...', 2000);
      
      if (state.selectedTmdbId && state.selectedMediaType) {
        if (state.selectedMediaType === 'tv') {
          const data = await callTMDB(`tv/${state.selectedTmdbId}`, {}, 'pt-BR');
          state.cachedShowDetails = { totalEpisodes: data.number_of_episodes || 0, seasons: data.seasons || [] };
        } else {
          state.cachedShowDetails = { totalEpisodes: 1, seasons: [{ season_number: 1, episode_count: 1 }] };
        }
      } else {
        const data = await callTMDB('search/multi', { query: nomeVal }, 'pt-BR');
        const result = data.results?.find(r => r.media_type === 'tv' || r.media_type === 'movie') || data.results?.[0];
        if (result) {
          const tvData = await callTMDB(`tv/${result.id}`, {}, 'pt-BR');
          state.cachedShowDetails = { totalEpisodes: tvData.number_of_episodes || 0, seasons: tvData.seasons || [] };
        } else {
          state.cachedShowDetails = { totalEpisodes: 1, seasons: [{ season_number: 1, episode_count: 1 }] };
        }
      }
    }
    
    if (state.cachedShowDetails && state.cachedShowDetails.totalEpisodes > 0) {
      totalEp = state.cachedShowDetails.totalEpisodes;
      state.cachedShowDetails.seasons.forEach(s => { 
        if (s.season_number !== 0) seasonEpisodesMap[s.season_number] = s.episode_count || 0; 
      });
      if (state.cachedShowDetails.first_air_date) {
        ano = parseInt(state.cachedShowDetails.first_air_date.substring(0,4));
      } else if (state.cachedShowDetails.release_date) {
        ano = parseInt(state.cachedShowDetails.release_date.substring(0,4));
      }
    } else {
      totalEp = 1;
      seasonEpisodesMap = { 1: 1 };
    }

    if (totalEp === 0) {
      showToast('Não foi possível obter o total de episódios. Tente novamente.');
      setLoading(false);
      addItemInFlight = false;
      return;
    }

    // If opened from search and item already exists, just add to new lists
    if (state.existingItemForSearch) {
      const existingItem = state.existingItemForSearch;
      const selectedListIds = Array.from(addListCheckboxes.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
      const existingListIds = (existingItem.lists || []).map(l => l.id);
      const toAdd = selectedListIds.filter(id => !existingListIds.includes(id));

      if (toAdd.length > 0) {
        const addPromises = toAdd.map(listId => addItemToList(existingItem.id, listId));
        await Promise.allSettled(addPromises);
        const addedLists = state.userLists.filter(l => toAdd.includes(l.id));
        existingItem.lists = [...(existingItem.lists || []), ...addedLists];
        showToast(`Adicionado a ${toAdd.length > 1 ? toAdd.length + ' listas' : addedLists[0]?.nome || 'nova lista'}.`);
      } else {
        showToast('Este título já pertence a todas as listas selecionadas.');
      }

      state.existingItemForSearch = null;
      render();
      closeModal();
      form.reset();
      clearPreview();
      state.cachedShowDetails = null;
      state.selectedTmdbId = null;
      state.selectedMediaType = null;
      state.selectedPosterPath = null;
      state.selectedAno = null;
      state.selectedName = '';
      addTemporadaInput.value = 1;
      addTemporadaDisplay.textContent = String(1).padStart(2, '0');
      addEpisodioInput.value = 0;
      addEpisodioDisplay.textContent = String(0).padStart(2, '0');
      state.addSeasonLimits = {};
      resetAddProgressPanel();
      return;
    }

    const duplicate = isDuplicateInCatalog({ tmdb_id: state.selectedTmdbId || null, nome: nomeVal, tipo: tipoVal, ano }, state.items, state.editingIndex);
    if (duplicate) {
      showToast('Este título já existe no seu catálogo.');
      setLoading(false);
      addItemInFlight = false;
      return;
    }

    const newItem = {
      tipo: tipoVal, nome: nomeVal, temporada: tempVal, episodio: epVal, totalEpisodios: totalEp,
      seasonEpisodesMap: seasonEpisodesMap, status: statusVal, tier: tierVal, tmdb_id: state.selectedTmdbId || null,
      ano: ano,
      imagem: null, dataCriacao: new Date().toISOString()
    };
    
    const saved = await addItemToSupabase(newItem);
    state.items.push(saved);
    
    // Adicionar às listas selecionadas no modal
    const selectedListIds = Array.from(addListCheckboxes.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const listPromises = selectedListIds.map(listId => addItemToList(saved.id, listId));
    await Promise.allSettled(listPromises);
    saved.lists = state.userLists.filter(l => selectedListIds.includes(l.id));
    
    showToast('Item adicionado!');
    
    if (state.selectedPosterPath) {
      const imagemUrl = `https://image.tmdb.org/t/p/original${state.selectedPosterPath}`;
      await updateItemInSupabase(saved.id, { imagem: imagemUrl });
      state.items[state.items.length - 1].imagem = imagemUrl;
    }
    
    render();
    closeModal();
    form.reset();
    clearPreview();
    state.cachedShowDetails = null;
    state.selectedTmdbId = null;
    state.selectedMediaType = null;
    state.selectedPosterPath = null;
    state.selectedAno = null;
    state.selectedName = '';
    state.existingItemForSearch = null;
    addTemporadaInput.value = 1;
    addTemporadaDisplay.textContent = String(1).padStart(2, '0');
    addEpisodioInput.value = 0;
    addEpisodioDisplay.textContent = String(0).padStart(2, '0');
    state.addSeasonLimits = {};
    resetAddProgressPanel();
  } catch (error) {
    showErrorToast('Não foi possível salvar o item. Tente novamente.', error);
  } finally {
    setLoading(false);
    addItemInFlight = false;
  }
}

// ========== MODAL DE ADIÇÃO ==========
function updateAddTierBadge(tier) {
  const badge = addTierBadge;
  badge.textContent = tier || '?';
  badge.className = tier ? `tier-badge-large ${getTierClass(tier)}` : 'tier-badge-large';
  badge.style.display = 'flex';
  badge.setAttribute('aria-expanded', 'false');
}

function toggleAddTierDropdown() {
  const dropdown = addTierDropdown;
  const badge = addTierBadge;
  const isVisible = dropdown.style.display === 'flex';
  dropdown.style.display = isVisible ? 'none' : 'flex';
  badge.setAttribute('aria-expanded', !isVisible);
}

function hideAddTierDropdown() {
  addTierDropdown.style.display = 'none';
  addTierBadge.setAttribute('aria-expanded', 'false');
}

function selectAddTier(tier) {
  const badge = addTierBadge;
  badge.textContent = tier || '?';
  badge.className = tier ? `tier-badge-large ${getTierClass(tier)}` : 'tier-badge-large';
  badge.style.display = 'flex';
  badge.setAttribute('aria-expanded', 'false');
  tierForm.value = tier || '';
  hideAddTierDropdown();
  if (typeof window !== 'undefined' && window.anime) {
    window.anime({ targets: badge, scale: [0.5, 1.2, 1], duration: 400, easing: 'easeOutQuad' });
  }
}

function openModal() {
  modalOverlay.classList.add('active');
  lockScreen();
  const modalElem = modalOverlay.querySelector('.modal');
  trapFocus(modalElem);
  if (typeof window !== 'undefined' && window.anime) {
    window.anime({ targets: modalElem, translateY: ['20px', '0'], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
  }
  syncAddStatusBtns();
}

function closeModal() {
  modalOverlay.classList.remove('active');
  const addListModal = document.getElementById('addListModal');
  if (addListModal) addListModal.classList.remove('active');
  if (addEpisodesBtn) { addEpisodesBtn.style.display = 'none'; addEpisodesBtn.onclick = null; }
  unlockScreen();
  releaseFocusTrap();
}

function cancelEdit() {
  state.editingIndex = null;
  btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar';
  modalTitleText.textContent = 'Adicionar título';
  modalTitle.style.display = '';
  btnCancel.style.display = 'inline-flex';
  clearAllFieldErrors(form);
  form.reset();
  clearPreview();
  state.cachedShowDetails = null;
  updateAddTierBadge('');
  hideAddTierDropdown();
  addYearDisplay.textContent = '--';
  if (addLogoContainer) addLogoContainer.style.display = 'none';
  if (addLogoImg) addLogoImg.src = '';
  if (addOriginalTitle) { addOriginalTitle.style.display = 'none'; addOriginalTitle.textContent = ''; }
  if (addSinopse) addSinopse.textContent = '';
  if (addSinopseLoading) addSinopseLoading.style.display = 'none';
  if (addBlurBg) addBlurBg.style.backgroundImage = '';
  if (addPosterWrap) addPosterWrap.classList.remove('sinopse-open');
  closeModal();
  setLoading(false);
  state.selectedTmdbId = null;
  state.selectedMediaType = null;
  state.selectedPosterPath = null;
  state.selectedAno = null;
  state.selectedName = '';
  state.existingItemForSearch = null;
  addTemporadaInput.value = 1;
  addTemporadaDisplay.textContent = String(1).padStart(2, '0');
  addEpisodioInput.value = 1;
  addEpisodioDisplay.textContent = String(1).padStart(2, '0');
  state.addSeasonLimits = {};
  resetAddProgressPanel();
}

// ========== INICIALIZAÇÃO ==========

// Configurar steppers
setupSteppers('#modalOverlay .stepper-btn', 'add', handleStepperUpdate);
setupSteppers('#detailModal .stepper-btn', 'detail', handleStepperUpdate);

// Event listeners de autenticação
authLoginBtn.addEventListener('click', (e) => { e.preventDefault(); handleLogin(); });
authSignupBtn.addEventListener('click', (e) => { e.preventDefault(); handleSignup(); });
authForm.addEventListener('submit', (e) => { e.preventDefault(); handleLogin(); });

profileToggle.addEventListener('click', (e) => {
  e.stopPropagation();

  const isOpen = profileDropdown.style.display === 'block';
  profileDropdown.style.display = isOpen ? 'none' : 'block';
  profileToggle.classList.toggle('active', !isOpen);
});
document.addEventListener('click', () => {
  profileDropdown.style.display = 'none';
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  await checkSession();
});

setupConfirmModal();
checkSession();

// Tier badge e dropdown do modal de adição
addTierBadge.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleAddTierDropdown();
});

addTierDropdown.addEventListener('click', (e) => {
  if (e.target.classList.contains('tier-option')) {
    const tier = e.target.dataset.tier;
    selectAddTier(tier);
  }
});

// Fechar dropdown ao clicar fora
document.addEventListener('click', (e) => {
  if (!addTierBadge.contains(e.target) && !addTierDropdown.contains(e.target)) {
    hideAddTierDropdown();
  }
});

modalClose.addEventListener('click', () => { cancelEdit(); closeModal(); });
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) { cancelEdit(); closeModal(); } });

let searchDebounceTimer = null;
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(render, 200);
  });
}
filterStatus.addEventListener('change', render);
filterTier.addEventListener('change', render);
sortOrder.addEventListener('change', render);

  // Initialize density dropdown control (icon + menu)
  if (densityToggleBtn && densityMenu) {
    function setDensity(value) {
      state.gridDensity = parseInt(value, 10) || state.gridDensity;
      localStorage.setItem('state.gridDensity', state.gridDensity);
      // update active state
      densityOptions.forEach(o => o.classList.toggle('active', String(o.dataset.value) === String(state.gridDensity)));
      // update accessible title for density button (keep icon)
      if (densityToggleBtn) {
        const label = densityLabelForValue(state.gridDensity);
        densityToggleBtn.setAttribute('title', label);
        densityToggleBtn.setAttribute('aria-label', `Densidade: ${label}`);
      }
      // close menu
      densityMenu.classList.remove('show');
      densityToggleBtn.setAttribute('aria-expanded', 'false');
      render();
    }

    // mark current selection
    densityOptions.forEach(o => o.classList.toggle('active', String(o.dataset.value) === String(state.gridDensity)));

    densityToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = densityMenu.classList.contains('show');
      densityMenu.classList.toggle('show', !isOpen);
      densityToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    densityOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        setDensity(opt.dataset.value);
      });
    });

    // close when clicking outside or pressing Esc
    document.addEventListener('click', () => { densityMenu.classList.remove('show'); densityToggleBtn.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { densityMenu.classList.remove('show'); densityToggleBtn.setAttribute('aria-expanded', 'false'); } });
  }
  // Initialize filter icon dropdowns (status, tier, sort)
  function closeAllFilterMenus() {
    document.querySelectorAll('.filter-menu').forEach(m => m.classList.remove('show'));
    [statusToggleBtn, tierToggleBtn, sortToggleBtn].forEach(b => { if (b) b.setAttribute('aria-expanded', 'false'); });
  }

  // helper to mark active option inside a menu based on select value
  function markMenuActive(menu, select) {
    if (!menu || !select) return;
    menu.querySelectorAll('.filter-option').forEach(opt => {
      opt.classList.toggle('active', String(opt.dataset.value) === String(select.value));
    });
  }

  // helper to mark navbar toggle active when select != default
  function updateToggleActiveState(toggleBtn, select, defaultValue = 'todos') {
    if (!toggleBtn || !select) return;
    const active = String(select.value) !== String(defaultValue);
    toggleBtn.classList.toggle('active', active);
  }

  if (statusToggleBtn && statusMenu) {
    statusToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = statusMenu.classList.contains('show');
      closeAllFilterMenus();
      statusMenu.classList.toggle('show', !isOpen);
      // mark active option when opening
      if (!isOpen) markMenuActive(statusMenu, filterStatus);
      statusToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  if (tierToggleBtn && tierMenu) {
    tierToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = tierMenu.classList.contains('show');
      closeAllFilterMenus();
      tierMenu.classList.toggle('show', !isOpen);
      if (!isOpen) markMenuActive(tierMenu, filterTier);
      tierToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  if (sortToggleBtn && sortMenu) {
    sortToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = sortMenu.classList.contains('show');
      closeAllFilterMenus();
      sortMenu.classList.toggle('show', !isOpen);
      if (!isOpen) markMenuActive(sortMenu, sortOrder);
      sortToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  // Modal list toggles — show/hide list checkboxes
  if (addListToggle && addListCheckboxes) {
    const addListModal = document.getElementById('addListModal');
    const addListModalClose = document.getElementById('addListModalClose');
    addListToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (addListModal) addListModal.classList.add('active');
    });
    if (addListModalClose) {
      addListModalClose.addEventListener('click', () => {
        addListModal.classList.remove('active');
      });
    }
    if (addListModal) {
      addListModal.addEventListener('click', (e) => {
        if (e.target === addListModal) addListModal.classList.remove('active');
      });
    }
  }
  if (detailListToggle && detailListCheckboxes) {
    const detailListModal = document.getElementById('detailListModal');
    const detailListModalClose = document.getElementById('detailListModalClose');
    detailListToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (detailListModal) detailListModal.classList.add('active');
    });
    if (detailListModalClose) {
      detailListModalClose.addEventListener('click', () => {
        detailListModal.classList.remove('active');
      });
    }
    if (detailListModal) {
      detailListModal.addEventListener('click', (e) => {
        if (e.target === detailListModal) detailListModal.classList.remove('active');
      });
    }
  }

  // Clicking an option sets the hidden select and triggers change
  filterMenuOptions.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = opt.dataset.target;
      const value = opt.dataset.value;
      const target = document.getElementById(targetId);
      if (target) {
        target.value = value;
        target.dispatchEvent(new Event('change'));
      }
      closeAllFilterMenus();
    });
  });

  // keep menus and toggles in sync when selects change
  filterStatus.addEventListener('change', () => {
    // update menu highlights and toolbar active
    markMenuActive(statusMenu, filterStatus);
    updateToggleActiveState(statusToggleBtn, filterStatus, 'todos');
  });
  filterTier.addEventListener('change', () => {
    markMenuActive(tierMenu, filterTier);
    updateToggleActiveState(tierToggleBtn, filterTier, 'todos');
  });
  sortOrder.addEventListener('change', () => {
    markMenuActive(sortMenu, sortOrder);
    updateToggleActiveState(sortToggleBtn, sortOrder, 'data-desc');
  });

  // Poster click toggles synopsis overlay
  const detailPosterWrap = document.getElementById('detailPosterWrap');
  if (detailPosterWrap) {
    const togglePosterSinopse = () => {
      detailPosterWrap.classList.toggle('sinopse-open');
    };
    detailPosterWrap.addEventListener('click', (e) => {
      if (e.target.closest('.poster-bottom-bar') || e.target.closest('.poster-steppers-row') || e.target.closest('.poster-top-links')) return;
      togglePosterSinopse();
    });
    detailPosterWrap.addEventListener('keydown', (e) => {
      if (e.target.closest('.poster-steppers-row')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePosterSinopse();
      }
    });
    // Close overlay when detail modal closes
    const detailModalEl = document.getElementById('detailModal');
    if (detailModalEl) {
      const observer = new MutationObserver(() => {
        if (!detailModalEl.classList.contains('active')) {
          detailPosterWrap.classList.remove('sinopse-open');
        }
      });
      observer.observe(detailModalEl, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // Add modal poster sinopse toggle
  if (addPosterWrap) {
    const toggleAddSinopse = () => {
      addPosterWrap.classList.toggle('sinopse-open');
    };
    addPosterWrap.addEventListener('click', (e) => {
      if (e.target.closest('.poster-bottom-bar') || e.target.closest('.poster-steppers-row') || e.target.closest('.add-poster-bar')) return;
      toggleAddSinopse();
    });
    addPosterWrap.addEventListener('keydown', (e) => {
      if (e.target.closest('.poster-steppers-row')) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAddSinopse(); }
    });
    // Auto-close sinopse when add modal closes
    const addModalEl = document.getElementById('modalOverlay');
    if (addModalEl) {
      const addModalObserver = new MutationObserver(() => {
        if (!addModalEl.classList.contains('active')) {
          addPosterWrap.classList.remove('sinopse-open');
        }
      });
      addModalObserver.observe(addModalEl, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // ensure toolbar toggles reflect current select values on init
  updateToggleActiveState(statusToggleBtn, filterStatus, 'todos');
  updateToggleActiveState(tierToggleBtn, filterTier, 'todos');
  updateToggleActiveState(sortToggleBtn, sortOrder, 'data-desc');

  // Close filter menus on outside click or Esc
  document.addEventListener('click', closeAllFilterMenus);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllFilterMenus(); });
groupToggle.innerHTML = state.groupingActive ? '<i class="fas fa-layer-group" style="color: var(--accent);"></i>' : '<i class="fas fa-layer-group"></i>';
groupToggle.addEventListener('click', () => {
  state.groupingActive = !state.groupingActive;
  localStorage.setItem('state.groupingActive', state.groupingActive);
  groupToggle.innerHTML = state.groupingActive ? '<i class="fas fa-layer-group" style="color: var(--accent);"></i>' : '<i class="fas fa-layer-group"></i>';
  render();
});

// Add modal status buttons sync
const addPosterStatusBar = document.getElementById('addPosterStatusBar');
if (addPosterStatusBar) {
  addPosterStatusBar.querySelectorAll('.dm-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.dataset.status;
      const prevStatus = statusSelect.value;
      statusSelect.value = newStatus;
      statusSelect.dispatchEvent(new Event('change'));
      syncAddStatusBtns();
      // Concluído: auto-set max temporada/episodio
      if (newStatus === 'concluido' && prevStatus !== 'concluido') {
        const maxTemp = state.addSeasonLimits.maxTemp || 1;
        if (maxTemp > 0) {
          addTemporadaInput.value = maxTemp;
          addTemporadaDisplay.textContent = String(maxTemp).padStart(2, '0');
          const maxEp = state.addSeasonLimits.maxEpByTemp?.[maxTemp] || 1;
          addEpisodioInput.value = maxEp;
          addEpisodioDisplay.textContent = String(maxEp).padStart(2, '0');
        }
      } else if (prevStatus === 'concluido' && newStatus !== 'concluido') {
        // Revert to defaults when leaving concluido
        addTemporadaInput.value = 1;
        addTemporadaDisplay.textContent = String(1).padStart(2, '0');
        addEpisodioInput.value = 0;
        addEpisodioDisplay.textContent = String(0).padStart(2, '0');
      }
    });
  });
}
function syncAddStatusBtns() {
  if (!addPosterStatusBar) return;
  addPosterStatusBar.querySelectorAll('.dm-status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === statusSelect.value);
  });
}

// Navegação por abas (removido - agora usando renderNavbar dinâmico)

// Function to update logos
function updateLogos() {
  const authLogo = document.querySelector('.auth-logo-img');
  const brandIconImg = document.querySelector('.navbar-brand-icon');
  
  if (authLogo) {
    authLogo.src = '/assets/logo/stacked-dark.svg';
    authLogo.alt = 'datmovie';
  }
  
  if (brandIconImg) {
    brandIconImg.src = '/assets/icon/icon-face.svg';
    brandIconImg.alt = 'datmovie';
  }
}

// Form submit
if (form) {
  form.addEventListener('submit', addItem);
} else {
  console.error('Elemento form não encontrado');
}
if (btnCancel) {
  btnCancel.addEventListener('click', cancelEdit);
} else {
  console.error('Elemento btnCancel não encontrado');
}
if (addPanelDelete) {
  addPanelDelete.addEventListener('click', cancelEdit);
}

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('episodesModal').classList.contains('active')) episodesModalAPI.close();
    else if ($('detailListModal')?.classList.contains('active')) $('detailListModal').classList.remove('active');
    else if ($('addListModal')?.classList.contains('active')) $('addListModal').classList.remove('active');
    else if ($('detailModal').classList.contains('active')) detailModalAPI.close();
    else if (modalOverlay.classList.contains('active')) { cancelEdit(); closeModal(); }
    else if (state.currentTab === 'pesquisa') {
      state.currentTab = 'all';
      state.currentListId = null;
      updateActiveNav();
      render();
    }
    closeListsDropdown();
  }
});

// ========== PESQUISA TMDB ==========
let pesquisaTimeout = null;

if (pesquisaInput) {
  pesquisaInput.addEventListener('input', () => {
    clearTimeout(pesquisaTimeout);
    const q = pesquisaInput.value.trim();

    if (q.length < 2) {
      pesquisaGrid.innerHTML = '';
      pesquisaEmpty.style.display = '';
      pesquisaLoading.style.display = 'none';
      pesquisaEmpty.querySelector('p').textContent = 'Digite pelo menos 2 caracteres para buscar';
      return;
    }

    pesquisaLoading.style.display = '';
    pesquisaEmpty.style.display = 'none';
    pesquisaGrid.innerHTML = '';

    pesquisaTimeout = setTimeout(async () => {
      try {
        const data = await callTMDB('search/multi', { query: q }, 'pt-BR');
        pesquisaLoading.style.display = 'none';

        const filteredResults = (data.results || []).filter(r => r.media_type === 'tv' || r.media_type === 'movie');
        if (filteredResults.length === 0) {
          pesquisaEmpty.style.display = '';
          pesquisaEmpty.querySelector('p').textContent = 'Nenhum resultado encontrado';
          return;
        }

        const fragment = document.createDocumentFragment();
        filteredResults.forEach(res => {
          const name = res.name || res.title;
          if (!name) return;
          const year = res.release_date ? res.release_date.substring(0, 4) : (res.first_air_date ? res.first_air_date.substring(0, 4) : '');
          const mediaType = res.media_type === 'movie' ? 'Filme' : 'Série';
          const poster = res.poster_path || '';
          const posterUrl = poster ? `https://image.tmdb.org/t/p/w342${poster}` : '';
          const safeName = escapeHTML(name);
          const safePoster = escapeHTML(posterUrl);

          const card = document.createElement('div');
          card.className = 'pesquisa-card';
          card.dataset.tmdbId = res.id;
          card.dataset.mediaType = res.media_type || 'tv';
          card.dataset.poster = poster;
          card.dataset.name = name;
          card.dataset.year = year;
          card.setAttribute('role', 'listitem');
          card.setAttribute('tabindex', '0');
          card.setAttribute('aria-label', `Adicionar ${name}`);
          card.innerHTML = `
            <div class="pesquisa-card-img">
              ${safePoster ? `<img src="${safePoster}" alt="${safeName}" loading="lazy" />` : `<i class="fas fa-film"></i>`}
            </div>
            <div class="pesquisa-card-body">
              <span class="badge">${mediaType}</span>
              <h3 title="${safeName}">${safeName}</h3>
              ${year ? `<span class="pesquisa-card-year">${year}</span>` : ''}
            </div>
          `;

          const openAddModal = () => openAddModalWithTmdbResult(res);

          card.addEventListener('click', openAddModal);
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAddModal(); }
          });

          fragment.appendChild(card);
        });

        pesquisaGrid.appendChild(fragment);

        if (typeof anime !== 'undefined') {
          const cards = pesquisaGrid.querySelectorAll('.pesquisa-card');
          if (cards.length) {
            anime({ targets: cards, translateY: [24, 0], opacity: [0, 1], duration: 500, delay: anime.stagger(60), easing: 'easeOutQuad' });
          }
        }
      } catch (err) {
        pesquisaLoading.style.display = 'none';
        pesquisaEmpty.style.display = '';
        pesquisaEmpty.querySelector('p').textContent = 'Erro ao buscar. Tente novamente.';
        console.warn('Erro na pesquisa TMDB:', err);
      }
    }, 400);
  });
}