/**
 * Ponto de entrada da aplicação Dat-Movie
 * Orquestra todos os componentes e inicializa a aplicação
 */

import { supabase } from './lib/supabase.js';
import { escapeHTML, formatDateBR, calcularProgresso, getTierClass, filterItems, sortItems, TIER_ORDER, TIER_COLORS } from './lib/catalog.js';
import { callTMDB, fetchTitleLogo, fetchTitleImages } from './lib/api.js';
import { getCurrentSession, getCurrentUser, loginWithPassword, signUpWithPassword, logoutUser } from './lib/auth.js';
import { showToast as uiShowToast, showErrorToast as uiShowErrorToast, lockScreen, unlockScreen, trapFocus, releaseFocusTrap, initOrb, setFieldError, clearFieldError, clearAllFieldErrors } from './components/uiHelpers.js';
import { updateStepperValue, setupSteppers, updateEpisodeLimit } from './lib/stepper.js';
import { renderContinueWatching, createCardElement } from './components/cards.js';
import { setupDetailModal } from './components/detailModal.js';
import { setupEpisodesModal } from './components/episodesModal.js';
import { setupSuggestions } from './components/suggestions.js';

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
const searchInput = $('searchInput');
const filterStatus = $('filterStatus');
const filterTier = $('filterTier');
const sortOrder = $('sortOrder');
const openFormBtn = $('openFormBtn');
const modalOverlay = $('modalOverlay');
const modalClose = $('modalClose');
const modalTitle = $('modalTitle');
const form = $('form');
const tipo = $('tipo');
const nome = $('nome');
const statusSelect = $('status');
const tierForm = $('tierForm');
const btnSubmit = $('btnSubmit');
const btnCancel = $('btnCancel');
const suggestions = $('suggestions');
const previewImg = $('previewImg');
const previewPlaceholder = $('previewPlaceholder');
const formLoading = $('formLoading');
const densityToggleBtn = $('densityToggleBtn');
const densityMenu = $('densityMenu');
const densityOptions = document.querySelectorAll('.density-option');
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
const profileToggle = $('profileToggle');
const profileDropdown = $('profileDropdown');
const profileEmail = $('profileEmail');
const profileEmailFull = $('profileEmailFull');

// SIDEBAR E ESTATÍSTICA
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
const statNumber = document.getElementById('statNumber');
const statLabel = document.getElementById('statLabel');

// ADD MODAL
const addTemporadaInput = $('addTemporada');
const addEpisodioInput = $('addEpisodio');
const addTemporadaDisplay = $('addTemporadaDisplay');
const addEpisodioDisplay = $('addEpisodioDisplay');
const addTierBadge = $('addTierBadge');
const addTierDropdown = $('addTierDropdown');
const addImageContainer = $('addImageContainer');
const addContent = $('addContent');
const addYearDisplay = $('addYearDisplay');
const modalTitleText = $('modalTitleText');

// ========== ESTADO GLOBAL ==========
let items = [];
let editingIndex = null;
let currentTab = 'anime';
let cachedShowDetails = null;
let selectedTmdbId = null;
let selectedMediaType = null;
let selectedPosterPath = null;
let selectedAno = null;
let gridDensity = parseInt(localStorage.getItem('gridDensity')) || 8;
let groupingActive = localStorage.getItem('groupingActive') === 'true' || false;
let addSeasonLimits = {};

// ========== AUTENTICAÇÃO ==========
function setAuthUI(showLogin) {
  authContainer.style.display = showLogin ? 'flex' : 'none';
  document.querySelector('.sidebar').style.display = showLogin ? 'none' : 'flex';
  document.querySelector('.main-content').style.display = showLogin ? 'none' : 'block';
  
  // Update logos when auth state changes
  updateLogos();
}

async function checkSession() {
  try {
    const session = await getCurrentSession();
    if (session) {
      setAuthUI(false);
      const user = await getCurrentUser();
      if (user) {
        profileEmail.textContent = user.email.split('@')[0] || user.email;
        profileEmailFull.textContent = user.email;
      }
      await loadItems();
    } else {
      setAuthUI(true);
    }
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    console.error('Detalhes do erro:', error.message, error.status, error.name);
    setAuthUI(true);
    if (error.message) {
      authMessage.textContent = `Erro: ${error.message}`;
    } else {
      authMessage.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
    }
  }
}

async function handleLogout() {
  try {
    await logoutUser();
    setAuthUI(true);
    authMessage.textContent = 'Logout realizado.';
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    authMessage.textContent = 'Erro ao fazer logout.';
  }
}

const authLoginBtnDefaultHTML = authLoginBtn.innerHTML;
const authSignupBtnDefaultHTML = authSignupBtn.innerHTML;

function setAuthLoading(show) {
  authLoginBtn.disabled = show;
  authSignupBtn.disabled = show;
  authLoginBtn.innerHTML = show ? '<i class="fas fa-spinner fa-spin"></i> Entrando...' : authLoginBtnDefaultHTML;
  authSignupBtn.innerHTML = show ? '<i class="fas fa-spinner fa-spin"></i>' : authSignupBtnDefaultHTML;
}

async function handleLogin() {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) { authMessage.textContent = 'Preencha email e senha.'; return; }
  setAuthLoading(true);
  try {
    await loginWithPassword(email, password);
    authMessage.textContent = 'Login realizado!';
    await checkSession();
  } catch (error) {
    console.error('Erro de login:', error);
    console.error('Detalhes do erro:', error.message, error.status, error.name);
    authMessage.textContent = `Erro: ${error.message || 'Não foi possível entrar. Verifique seu email e senha.'}`;
  }
  setAuthLoading(false);
}

async function handleSignup() {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) { authMessage.textContent = 'Preencha email e senha.'; return; }
  setAuthLoading(true);
  try {
    await signUpWithPassword(email, password);
    authMessage.textContent = 'Cadastro enviado! Confirme seu email (se ativado) ou faça login.';
  } catch (error) {
    console.error('Erro de cadastro:', error);
    authMessage.textContent = 'Não foi possível concluir o cadastro. Tente novamente.';
  }
  setAuthLoading(false);
}

// ========== SUPABASE CRUD ==========
async function fetchItemsFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data, error } = await supabase.from('items').select('*').eq('user_id', user.id).order('data_criacao', { ascending: false });
  
  if (error) { 
    console.error('Erro ao buscar itens:', error);
    console.error('Detalhes do erro:', error.message, error.code, error.hint);
    throw new Error(`Erro ao buscar itens: ${error.message}`); 
  }
  
  return data.map(item => ({
    id: item.id, user_id: item.user_id, nome: item.nome, tipo: item.tipo,
    temporada: item.temporada, episodio: item.episodio, totalEpisodios: item.total_episodios,
    seasonEpisodesMap: item.season_episodes_map || {}, status: item.status, nota: item.nota,
    imagem: item.imagem, dataCriacao: item.data_criacao, dataAtualizacao: item.data_atualizacao,
    tmdb_id: item.tmdb_id, tier: item.tier || null,
    ano: item.ano || null
  }));
}

async function addItemToSupabase(item) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não logado.');
  const dbItem = {
    user_id: user.id, nome: item.nome, tipo: item.tipo, temporada: item.temporada,
    episodio: item.episodio, total_episodios: item.totalEpisodios,
    season_episodes_map: item.seasonEpisodesMap || {}, status: item.status,
    tier: item.tier || null, imagem: item.imagem || null, tmdb_id: item.tmdb_id || null,
    ano: item.ano || null,
    data_criacao: item.dataCriacao || new Date().toISOString()
  };
  const { data, error } = await supabase.from('items').insert([dbItem]).select();
  if (error) throw error;
  return { ...data[0], totalEpisodios: data[0].total_episodios, seasonEpisodesMap: data[0].season_episodes_map || {}, dataCriacao: data[0].data_criacao, dataAtualizacao: data[0].data_atualizacao };
}

async function updateItemInSupabase(id, updates) {
  const dbUpdates = {};
  ['nome', 'tipo', 'temporada', 'episodio', 'status', 'tier', 'imagem', 'tmdb_id', 'ano'].forEach(key => { if (updates[key] !== undefined) dbUpdates[key] = updates[key]; });
  if (updates.totalEpisodios !== undefined) dbUpdates.total_episodios = updates.totalEpisodios;
  if (updates.seasonEpisodesMap !== undefined) dbUpdates.season_episodes_map = updates.seasonEpisodesMap;
  if (updates.dataCriacao !== undefined) dbUpdates.data_criacao = updates.dataCriacao;
  const { data, error } = await supabase.from('items').update(dbUpdates).eq('id', id).select();
  if (error) throw error;
  return { ...data[0], totalEpisodios: data[0].total_episodios, seasonEpisodesMap: data[0].season_episodes_map || {}, dataCriacao: data[0].data_criacao, dataAtualizacao: data[0].data_atualizacao };
}

async function deleteItemFromSupabase(id) {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

// ========== CARREGAR ITENS ==========
async function loadItems() {
  try {
    const data = await fetchItemsFromSupabase();
    items = data;
    render();
  } catch (error) {
    console.error('Erro ao carregar itens:', error);
    throw error;
  }
}

// ========== STEPPER ADAPTERS ==========
const addInputs = {
  tempInput: addTemporadaInput,
  epInput: addEpisodioInput,
  epDisplay: addEpisodioDisplay
};

function handleStepperUpdate(btn, modalType) {
  const limits = modalType === 'add' ? addSeasonLimits : detailModalAPI.getSeasonLimits();
  const inputs = modalType === 'add' ? addInputs : detailInputs;
  updateStepperValue(btn, modalType, addSeasonLimits, detailModalAPI.getSeasonLimits(), addInputs, detailInputs);
}

// ========== CONFIGURAÇÃO DE COMPONENTES ==========
// Cards
const handleCardClick = (index) => {
  detailModalAPI.open(index, items);
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
  detailEpisodesBtn: $('detailEpisodesBtn')
}, {
  onUpdateItem: updateItemInSupabase,
  onDeleteItem: deleteItemFromSupabase,
  onOpenEpisodes: (index) => episodesModalAPI.open(index, items),
  updateEpisodeLimit: (stepperType, temp, limits, modalType) => {
    const inputs = modalType === 'add' ? addInputs : detailInputs;
    const maxEp = limits.maxEpByTemp?.[temp] || 1;
    const currentEp = parseInt(inputs.epInput.value) || 1;
    if (currentEp > maxEp) {
      inputs.epInput.value = maxEp;
      inputs.epDisplay.textContent = maxEp;
    }
  },
  updateSeasonLimits: (limits) => {
    if (limits) addSeasonLimits = limits;
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

// Suggestions
const suggestionsAPI = setupSuggestions(nome, suggestions, {
  onSelect: (data) => {
    selectedTmdbId = data.tmdbId;
    selectedMediaType = data.mediaType;
    selectedPosterPath = data.posterPath;
  },
  onSetPreview: (poster) => {
    previewImg.src = poster.startsWith('http') ? poster : `https://image.tmdb.org/t/p/original${poster}`;
    previewImg.style.display = 'block';
    previewPlaceholder.style.display = 'none';
  },
  onClearPreview: () => {
    previewImg.style.display = 'none';
    previewImg.src = '';
    previewPlaceholder.style.display = 'block';
  },
  onSetLoading: (show) => {
    formLoading.style.display = show ? 'flex' : 'none';
    btnSubmit.disabled = show;
    btnCancel.disabled = show;
  },
  onToast: showToast,
  onSetupSteppers: (maxTemp, maxEpByTemp, year) => {
    addSeasonLimits = { maxTemp, maxEpByTemp };
    if (year) selectedAno = year;
    setupSteppers('#modalOverlay .stepper-btn', 'add', handleStepperUpdate);
  },
  onSetYear: (year) => {
    addYearDisplay.textContent = year || '--';
  }
});

// ========== RENDER ==========
function render() {
  renderContinueWatching(items, currentTab, continueSection, continueGrid, (item, variant) => createCardElement(item, variant, items, handleCardClick));

  const search = searchInput.value;
  const statusFilter = filterStatus.value;
  let tierFilter = filterTier.value;
  const sortKey = sortOrder.value;

  // Ignorar filtro de Tier na aba "Lista de Desejos"
  if (currentTab === 'planejado') {
    tierFilter = 'todos';
  }

  const filtered = sortItems(filterItems(items, { currentTab, search, statusFilter, tierFilter }), sortKey);

  const count = filtered.length;
  let label = '';
  switch (currentTab) {
    case 'anime': label = 'Animes'; break;
    case 'animacao': label = 'Animações'; break;
    case 'serie': label = 'Séries'; break;
    case 'planejado': label = 'Lista de Desejos'; break;
    default: label = 'Total';
  }
  statNumber.textContent = count;
  statLabel.textContent = label;

  if (currentTab === 'planejado') {
    groupToggle.style.display = 'none';
    filterTier.style.display = 'none';
  } else {
    groupToggle.style.display = '';
    filterTier.style.display = '';
  }

  grid.innerHTML = '';
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum título encontrado</p></div>`;
    grid.className = `grid grid-cols-${gridDensity}`;
    return;
  }
  grid.className = `grid grid-cols-${gridDensity}`;
  const fragment = document.createDocumentFragment();

  if (groupingActive && currentTab !== 'planejado') {
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
      itemsInTier.forEach((item) => fragment.appendChild(createCardElement(item, null, items, handleCardClick)));
    }
  } else {
    filtered.forEach((item) => fragment.appendChild(createCardElement(item, null, items, handleCardClick)));
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

  const nomeVal = nome.value.trim();
  const tempVal = parseInt(addTemporadaInput.value);
  const epVal = parseInt(addEpisodioInput.value);
  const statusVal = statusSelect.value;
  const tierVal = tierForm.value || null;

  clearAllFieldErrors(form);

  let hasError = false;
  if (!nomeVal) { setFieldError(nome, 'Digite o nome.'); hasError = true; }
  if (nomeVal.length > 150) { setFieldError(nome, 'Nome muito longo (máx. 150 caracteres).'); hasError = true; }
  if (isNaN(tempVal) || tempVal < 1) { setFieldError(addTemporadaInput, 'Temporada inválida.'); hasError = true; }
  if (isNaN(epVal) || epVal < 0) { setFieldError(addEpisodioInput, 'Episódio inválido.'); hasError = true; }
  if (hasError) { showToast('Corrija os campos destacados.'); return; }
  const tipoVal = tipo.value;

  addItemInFlight = true;
  setLoading(true);

  try {
    let totalEp = 0, seasonEpisodesMap = {};
    let ano = null;
    
    if (!cachedShowDetails || cachedShowDetails.totalEpisodes === 0) {
      showToast('Buscando informações do título...', 2000);
      
      if (selectedTmdbId && selectedMediaType) {
        if (selectedMediaType === 'tv') {
          const data = await callTMDB(`tv/${selectedTmdbId}`, {}, 'pt-BR');
          cachedShowDetails = { totalEpisodes: data.number_of_episodes || 0, seasons: data.seasons || [] };
        } else {
          cachedShowDetails = { totalEpisodes: 1, seasons: [{ season_number: 1, episode_count: 1 }] };
        }
      } else {
        const data = await callTMDB('search/multi', { query: nomeVal }, 'pt-BR');
        const result = data.results?.[0];
        if (result && result.media_type === 'tv') {
          const tvData = await callTMDB(`tv/${result.id}`, {}, 'pt-BR');
          cachedShowDetails = { totalEpisodes: tvData.number_of_episodes || 0, seasons: tvData.seasons || [] };
        } else {
          cachedShowDetails = { totalEpisodes: 1, seasons: [{ season_number: 1, episode_count: 1 }] };
        }
      }
    }
    
    if (cachedShowDetails && cachedShowDetails.totalEpisodes > 0) {
      totalEp = cachedShowDetails.totalEpisodes;
      cachedShowDetails.seasons.forEach(s => { 
        if (s.season_number !== 0) seasonEpisodesMap[s.season_number] = s.episode_count || 0; 
      });
      if (cachedShowDetails.first_air_date) {
        ano = parseInt(cachedShowDetails.first_air_date.substring(0,4));
      } else if (cachedShowDetails.release_date) {
        ano = parseInt(cachedShowDetails.release_date.substring(0,4));
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

    const duplicate = items.some((it, i) => {
      if (i === editingIndex) return false;
      const sameName = it.nome.toLowerCase() === nomeVal.toLowerCase();
      const sameType = it.tipo === tipoVal;
      if (it.tmdb_id && selectedTmdbId) {
        return sameName && sameType && it.tmdb_id === selectedTmdbId;
      }
      if (it.ano && ano) {
        return sameName && sameType && it.ano === ano;
      }
      return sameName && sameType;
    });
    if (duplicate) {
      showToast('Este título já existe no seu catálogo.');
      setLoading(false);
      addItemInFlight = false;
      return;
    }

    const newItem = {
      tipo: tipoVal, nome: nomeVal, temporada: tempVal, episodio: epVal, totalEpisodios: totalEp,
      seasonEpisodesMap: seasonEpisodesMap, status: statusVal, tier: tierVal, tmdb_id: selectedTmdbId || null,
      ano: ano,
      imagem: null, dataCriacao: new Date().toISOString()
    };
    
    const saved = await addItemToSupabase(newItem);
    items.push(saved);
    
    showToast('Item adicionado!');
    
    if (selectedPosterPath) {
      const imagemUrl = `https://image.tmdb.org/t/p/original${selectedPosterPath}`;
      await updateItemInSupabase(saved.id, { imagem: imagemUrl });
      items[items.length - 1].imagem = imagemUrl;
    }
    
    render();
    closeModal();
    form.reset();
    clearPreview();
    cachedShowDetails = null;
    suggestionsAPI.clearSuggestions();
    selectedTmdbId = null;
    selectedMediaType = null;
    selectedPosterPath = null;
    selectedAno = null;
    addTemporadaInput.value = 1;
    addTemporadaDisplay.textContent = 1;
    addEpisodioInput.value = 0;
    addEpisodioDisplay.textContent = 0;
    addSeasonLimits = {};
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
  setTimeout(() => nome.focus(), 100);
}

function closeModal() {
  modalOverlay.classList.remove('active');
  unlockScreen();
  releaseFocusTrap();
}

function cancelEdit() {
  editingIndex = null;
  btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar';
  modalTitleText.textContent = 'Adicionar título';
  btnCancel.style.display = 'inline-flex';
  clearAllFieldErrors(form);
  form.reset();
  clearPreview();
  cachedShowDetails = null;
  suggestionsAPI.clearSuggestions();
  updateAddTierBadge('');
  addYearDisplay.textContent = '--';
  closeModal();
  setLoading(false);
  selectedTmdbId = null;
  selectedMediaType = null;
  selectedPosterPath = null;
  selectedAno = null;
  addTemporadaInput.value = 1;
  addTemporadaDisplay.textContent = 1;
  addEpisodioInput.value = 1;
  addEpisodioDisplay.textContent = 1;
  addSeasonLimits = {};
}

// ========== INICIALIZAÇÃO ==========
initOrb();

// Sidebar
const mobileLayoutQuery = window.matchMedia('(max-width: 700px)');

function toggleSidebar() {
  if (mobileLayoutQuery.matches) return;
  const collapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('sidebarCollapsed', collapsed);
  sidebarToggleIcon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
}
sidebarToggle.addEventListener('click', toggleSidebar);

function applySidebarCollapseForViewport() {
  const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (mobileLayoutQuery.matches) {
    sidebar.classList.remove('collapsed');
  } else if (savedCollapsed) {
    sidebar.classList.add('collapsed');
    sidebarToggleIcon.className = 'fas fa-chevron-right';
  } else {
    sidebar.classList.remove('collapsed');
    sidebarToggleIcon.className = 'fas fa-chevron-left';
  }
}
applySidebarCollapseForViewport();
mobileLayoutQuery.addEventListener('change', applySidebarCollapseForViewport);

// Configurar steppers
setupSteppers('#modalOverlay .stepper-btn', 'add', handleStepperUpdate);
setupSteppers('#detailModal .stepper-btn', 'detail', handleStepperUpdate);

// Event listeners de autenticação
authLoginBtn.addEventListener('click', (e) => { e.preventDefault(); handleLogin(); });
authSignupBtn.addEventListener('click', (e) => { e.preventDefault(); handleSignup(); });
authForm.addEventListener('submit', (e) => { e.preventDefault(); handleLogin(); });

profileToggle.addEventListener('click', (e) => {
  e.stopPropagation();

  // If desktop and sidebar is collapsed, expand it first, then open dropdown
  if (!mobileLayoutQuery.matches && sidebar.classList.contains('collapsed')) {
    sidebar.classList.remove('collapsed');
    localStorage.setItem('sidebarCollapsed', 'false');
    sidebarToggleIcon.className = 'fas fa-chevron-left';

    // Small delay to allow layout/animation to settle before showing dropdown
    setTimeout(() => {
      const isOpen = profileDropdown.style.display === 'block';
      profileDropdown.style.display = isOpen ? 'none' : 'block';
      profileToggle.classList.toggle('active', !isOpen);
    }, 120);

    return;
  }

  // Normal behavior: toggle dropdown
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

checkSession();

// Event listeners de navegação
openFormBtn.addEventListener('click', (e) => {
  // Prevent clicks from propagating to elements behind the floating button
  e.stopPropagation();
  e.preventDefault();
  if (editingIndex !== null) cancelEdit();
  clearAllFieldErrors(form);
  clearPreview();
  cachedShowDetails = null;
  statusSelect.value = 'assistindo';
  tierForm.value = '';
  updateAddTierBadge('');
  addYearDisplay.textContent = '--';
  selectedTmdbId = null;
  selectedMediaType = null;
  selectedPosterPath = null;
  selectedAno = null;
  addTemporadaInput.value = 1;
  addTemporadaDisplay.textContent = 1;
  addEpisodioInput.value = 0;
  addEpisodioDisplay.textContent = 0;
  addSeasonLimits = {};
  openModal();
});

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
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 200);
});
filterStatus.addEventListener('change', render);
filterTier.addEventListener('change', render);
sortOrder.addEventListener('change', render);

  // Initialize density dropdown control (icon + menu)
  if (densityToggleBtn && densityMenu) {
    function setDensity(value) {
      gridDensity = parseInt(value, 10) || gridDensity;
      localStorage.setItem('gridDensity', gridDensity);
      // update active state
      densityOptions.forEach(o => o.classList.toggle('active', String(o.dataset.value) === String(gridDensity)));
      // close menu
      densityMenu.classList.remove('show');
      densityToggleBtn.setAttribute('aria-expanded', 'false');
      render();
    }

    // mark current selection
    densityOptions.forEach(o => o.classList.toggle('active', String(o.dataset.value) === String(gridDensity)));

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

  if (statusToggleBtn && statusMenu) {
    statusToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = statusMenu.classList.contains('show');
      closeAllFilterMenus();
      statusMenu.classList.toggle('show', !isOpen);
      statusToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  if (tierToggleBtn && tierMenu) {
    tierToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = tierMenu.classList.contains('show');
      closeAllFilterMenus();
      tierMenu.classList.toggle('show', !isOpen);
      tierToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  if (sortToggleBtn && sortMenu) {
    sortToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = sortMenu.classList.contains('show');
      closeAllFilterMenus();
      sortMenu.classList.toggle('show', !isOpen);
      sortToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    });
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

  // Close filter menus on outside click or Esc
  document.addEventListener('click', closeAllFilterMenus);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllFilterMenus(); });
groupToggle.innerHTML = groupingActive ? '<i class="fas fa-layer-group" style="color: var(--accent);"></i>' : '<i class="fas fa-layer-group"></i>';
groupToggle.addEventListener('click', () => {
  groupingActive = !groupingActive;
  localStorage.setItem('groupingActive', groupingActive);
  groupToggle.innerHTML = groupingActive ? '<i class="fas fa-layer-group" style="color: var(--accent);"></i>' : '<i class="fas fa-layer-group"></i>';
  render();
});

// Botão concluído
document.getElementById('btnConcluido').addEventListener('click', function() {
  const maxTemp = addSeasonLimits.maxTemp || 1;
  if (maxTemp === 0) { showToast('Selecione um título primeiro.', 2000); return; }
  const maxEp = addSeasonLimits.maxEpByTemp?.[maxTemp] || 1;
  addTemporadaInput.value = maxTemp;
  addTemporadaDisplay.textContent = maxTemp;
  addEpisodioInput.value = maxEp;
  addEpisodioDisplay.textContent = maxEp;
  statusSelect.value = 'concluido';
  btnSubmit.focus();
  showToast(`Concluído! T${maxTemp} • Ep ${maxEp}`, 2500);
});

// Navegação por abas
document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const tab = item.dataset.tab;
    if (tab) { 
      currentTab = tab; 
      // Ocultar filtros na aba Lista de Desejos
      if (tab === 'planejado') {
        filterStatus.style.display = 'none';
        filterTier.style.display = 'none';
        if (statusWrapper) statusWrapper.style.display = 'none';
        if (tierWrapper) tierWrapper.style.display = 'none';
      } else {
        filterStatus.style.display = '';
        filterTier.style.display = '';
        if (statusWrapper) statusWrapper.style.display = '';
        if (tierWrapper) tierWrapper.style.display = '';
      }
      render(); 
    }
  });
});

// Function to update logos
function updateLogos() {
  const brandLogo = document.querySelector('.brand-logo');
  const authLogo = document.querySelector('.auth-logo-img');
  const brandIconImg = document.querySelector('.brand-icon-img');
  
  if (brandLogo) {
    brandLogo.src = 'assets/logo/logotype-text-dark.svg';
    brandLogo.alt = 'datmovie';
  }
  
  if (authLogo) {
    authLogo.src = 'assets/logo/stacked-dark.svg';
    authLogo.alt = 'datmovie';
  }
  
  if (brandIconImg) {
    brandIconImg.src = 'assets/icon/icon-face.svg';
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

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (episodesModal.classList.contains('active')) episodesModalAPI.close();
    else if (detailModal.classList.contains('active')) detailModalAPI.close();
    else if (modalOverlay.classList.contains('active')) { cancelEdit(); closeModal(); }
  }
});