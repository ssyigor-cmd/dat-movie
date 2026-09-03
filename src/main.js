/**
 * Ponto de entrada da aplicação Dat-Movie
 * Orquestra todos os componentes e inicializa a aplicação
 */

import { supabase } from './lib/supabase.js';
import { escapeHTML, getTierClass, filterItems, sortItems, TIER_ORDER, formatDateBR } from './lib/catalog.js';
import { callTMDB, fetchTitleLogo } from './lib/api.js';
import { getCurrentSession, getCurrentUser, loginWithPassword, signUpWithPassword } from './lib/auth.js';
import { fetchUserLists, createList, renameList, deleteList, addItemToList, removeItemFromList, updateListsOrder } from './lib/lists.js';
import { showToast as uiShowToast, showErrorToast as uiShowErrorToast, lockScreen, unlockScreen, trapFocus, releaseFocusTrap, setFieldError, clearAllFieldErrors } from './components/uiHelpers.js';
import { updateStepperValue, setupSteppers } from './lib/stepper.js';
import { renderContinueWatching, createCardElement } from './components/cards.js';
import { setupDetailModal } from './components/detailModal.js';
import { setupEpisodesModal } from './components/episodesModal.js';

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
        const label = densityLabelForValue(gridDensity);
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

// ========== ESTADO GLOBAL ==========
let items = [];
let editingIndex = null;
let currentTab = 'all';
let currentListId = null;
let userLists = [];
let listsSortable = null;
let cachedShowDetails = null;
let selectedTmdbId = null;
let selectedMediaType = null;
let selectedPosterPath = null;
let selectedAno = null;
let selectedName = '';
let existingItemForSearch = null;
let gridDensity = parseInt(localStorage.getItem('gridDensity')) || 8;
let groupingActive = localStorage.getItem('groupingActive') === 'true' || false;
let addSeasonLimits = {};

// ========== AUTENTICAÇÃO ==========
function setAuthUI(showLogin) {
  authContainer.style.display = showLogin ? 'flex' : 'none';
  if (navbar) navbar.style.display = showLogin ? 'none' : 'flex';
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
  
  // Buscar itens com suas listas relacionadas
  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      item_lists (
        list_id,
        user_lists (
          id, nome, is_system
        )
      )
    `)
    .eq('user_id', user.id)
    .order('data_criacao', { ascending: false });
  
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
    ano: item.ano || null,
    lists: item.item_lists?.map(il => il.user_lists).filter(Boolean) || []
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
    await loadUserLists();
    render();
  } catch (error) {
    console.error('Erro ao carregar itens:', error);
    throw error;
  }
}

async function loadUserLists() {
  try {
    userLists = await fetchUserLists();
    renderNavbar();
  } catch (error) {
    console.error('Erro ao carregar listas:', error);
    throw error;
  }
}

// ========== RENDER NAVBAR ==========

function buildListNavItem(list) {
  const listBtn = document.createElement('button');
  listBtn.className = `nav-item ${currentListId === list.id ? 'active' : ''}`;
  listBtn.dataset.listId = list.id;

  const dragHandle = document.createElement('i');
  dragHandle.className = 'fas fa-grip-vertical nav-drag-handle';
  dragHandle.title = 'Arrastar para reordenar';
  listBtn.appendChild(dragHandle);

  const contentSpan = document.createElement('span');
  contentSpan.className = 'nav-item-label';
  contentSpan.textContent = list.nome;
  listBtn.appendChild(contentSpan);

  const actionsWrap = document.createElement('span');
  actionsWrap.className = 'nav-item-actions';

  const renameIcon = document.createElement('i');
  renameIcon.className = 'fas fa-pencil-alt nav-action-icon';
  renameIcon.title = 'Editar';
  renameIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    startInlineEdit(listBtn, list, contentSpan, actionsWrap);
  });
  actionsWrap.appendChild(renameIcon);

  listBtn.appendChild(actionsWrap);

  listBtn.addEventListener('click', () => {
    if (listBtn.classList.contains('editing')) return;
    currentTab = 'list';
    currentListId = list.id;
    closeListsDropdown();
    updateActiveNav();
    render();
  });

  return listBtn;
}

function buildListsButton() {
  const toggle = document.createElement('button');
  toggle.className = 'nav-item';
  toggle.id = 'listsToggle';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  if (currentTab === 'list' && currentListId) toggle.classList.add('active');
  toggle.innerHTML = '<i class="fas fa-layer-group"></i> <span>Listas</span> <i class="fas fa-chevron-down lists-chevron"></i>';
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleListsDropdown();
  });
  return toggle;
}

function buildListsDropdown() {
  const dropdown = document.createElement('div');
  dropdown.className = 'nav-dropdown';
  dropdown.id = 'listsDropdown';

  const label = document.createElement('div');
  label.className = 'nav-section-label';
  label.textContent = 'Minhas Listas';
  dropdown.appendChild(label);

  const sep = document.createElement('div');
  sep.className = 'nav-separator';
  dropdown.appendChild(sep);

  const userListsOnly = userLists.filter(l => !l.is_system);

  if (userListsOnly.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'nav-empty-hint';
    empty.textContent = 'Nenhuma lista criada ainda';
    dropdown.appendChild(empty);
  } else {
    userListsOnly.forEach(list => {
      dropdown.appendChild(buildListNavItem(list));
    });
  }

  const sep2 = document.createElement('div');
  sep2.className = 'nav-separator';
  dropdown.appendChild(sep2);

  const addBtn = document.createElement('button');
  addBtn.className = 'nav-item add-list-btn';
  addBtn.innerHTML = '<i class="fas fa-plus"></i> <span>Nova Lista</span>';
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeListsDropdown();
    promptCreateList();
  });
  dropdown.appendChild(addBtn);

  return dropdown;
}

function renderNavbar() {
  if (!navbarNav) return;

  const fragment = document.createDocumentFragment();

  // --- Navegação principal (colada ao ícone da marca) ---
  const todosBtn = document.createElement('button');
  todosBtn.className = `nav-item ${currentTab === 'all' && !currentListId ? 'active' : ''}`;
  todosBtn.dataset.tab = 'all';
  todosBtn.innerHTML = '<i class="fas fa-th"></i> <span>Todos</span>';
  todosBtn.addEventListener('click', () => {
    currentTab = 'all';
    currentListId = null;
    updateActiveNav();
    render();
  });
  fragment.appendChild(todosBtn);

  const systemLists = userLists.filter(l => l.is_system);
  const wishlist = systemLists.find(l => l.nome === 'Próximos' || l.nome === 'Lista de Desejos') || systemLists[0];

  const wishlistBtn = document.createElement('button');
  wishlistBtn.className = `nav-item nav-item-system ${currentTab === 'planejado' && !currentListId ? 'active' : ''}`;
  wishlistBtn.dataset.tab = 'planejado';
  wishlistBtn.dataset.system = 'true';
  if (wishlist) { wishlistBtn.dataset.listId = wishlist.id; }
  wishlistBtn.innerHTML = '<i class="fas fa-calendar-alt"></i> <span>Próximos</span>';
  wishlistBtn.addEventListener('click', () => {
    currentTab = 'planejado';
    currentListId = null;
    updateActiveNav();
    render();
  });
  fragment.appendChild(wishlistBtn);

  const pesquisaBtn = document.createElement('button');
  pesquisaBtn.className = `nav-item ${currentTab === 'pesquisa' ? 'active' : ''}`;
  pesquisaBtn.dataset.tab = 'pesquisa';
  pesquisaBtn.innerHTML = '<i class="fas fa-search"></i> <span>Pesquisar</span>';
  pesquisaBtn.addEventListener('click', () => {
    currentTab = 'pesquisa';
    currentListId = null;
    updateActiveNav();
    render();
  });
  fragment.appendChild(pesquisaBtn);

  // --- Botão "Listas" (integrado na navegação centralizada) ---
  fragment.appendChild(buildListsButton());

  navbarNav.innerHTML = '';
  navbarNav.appendChild(fragment);

  // --- Dropdown "Listas" (fora do container com overflow, anexado ao top-navbar) ---
  const topNavbar = document.getElementById('topNavbar');
  if (topNavbar) {
    // Remove dropdown anterior se existir
    const oldDropdown = document.getElementById('listsDropdown');
    if (oldDropdown) {
      if (listsSortable) { try { listsSortable.destroy(); listsSortable = null; } catch(e){} }
      oldDropdown.remove();
    }
    
    const dropdown = buildListsDropdown();
    topNavbar.appendChild(dropdown);
    initListsSortable();
  }
}

function initListsSortable() {
  const dropdown = document.getElementById('listsDropdown');
  if (!dropdown || !window.Sortable) return;
  if (listsSortable) { try { listsSortable.destroy(); } catch(e){} listsSortable = null; }
  const handleExists = dropdown.querySelector('.nav-drag-handle');
  if (!handleExists) return;
  listsSortable = new window.Sortable(dropdown, {
    handle: '.nav-drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    filter: '.nav-section-label, .nav-separator, .nav-empty-hint, .add-list-btn',
    preventOnFilter: true,
    onEnd: async () => {
      const orderedIds = [...dropdown.querySelectorAll('.nav-item[data-list-id]')].map(el => el.dataset.listId);
      if (orderedIds.length === 0) return;
      const ordered = orderedIds.map((id, idx) => ({ id, ordem: idx }));
      try {
        await updateListsOrder(ordered);
        // Reordena userLists localmente conforme novo ordem
        const byId = new Map(userLists.map(l => [l.id, l]));
        const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean);
        const rest = userLists.filter(l => !orderedIds.includes(l.id));
        userLists = [...reordered, ...rest];
      } catch (err) {
        showErrorToast('Erro ao salvar ordem', err);
        await loadUserLists();
      }
    }
  });
}

function toggleListsDropdown() {
  const dropdown = document.getElementById('listsDropdown');
  const btn = document.getElementById('listsToggle');
  if (!dropdown || !btn) return;
  const isOpen = dropdown.classList.contains('show');
  
  if (!isOpen) {
    // Position dropdown under the button
    const btnRect = btn.getBoundingClientRect();
    const navbarRect = document.getElementById('topNavbar').getBoundingClientRect();
    dropdown.style.left = (btnRect.left - navbarRect.left) + 'px';
    dropdown.style.top = (btnRect.bottom - navbarRect.top + 8) + 'px';
  }
  
  dropdown.classList.toggle('show', !isOpen);
  btn.setAttribute('aria-expanded', String(!isOpen));
  btn.classList.toggle('open', !isOpen);
}

function closeListsDropdown() {
  const dropdown = document.getElementById('listsDropdown');
  const btn = document.getElementById('listsToggle');
  if (dropdown) dropdown.classList.remove('show');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('open');
  }
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('listsDropdown');
  const btn = document.getElementById('listsToggle');
  if (!dropdown || !btn) return;
  if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
    closeListsDropdown();
  }
});

function updateActiveNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
    
    const tab = btn.dataset.tab;
    const listId = btn.dataset.listId;
    
    if ((tab === currentTab && !currentListId) || (listId === currentListId)) {
      btn.classList.add('active');
    }
  });

  const listsToggle = document.getElementById('listsToggle');
  if (listsToggle) {
    listsToggle.classList.toggle('active', currentTab === 'list' && Boolean(currentListId));
  }
  
  // Gerenciar filtros baseado na aba atual
  if (currentTab === 'planejado') {
    filterStatus.style.display = 'none';
    filterTier.style.display = 'none';
    if (statusWrapper) statusWrapper.style.display = 'none';
    if (tierWrapper) tierWrapper.style.display = 'none';
    // Esconder opções de ordenação sem sentido para Próximos
    document.querySelectorAll('[data-wishlist-hidden]').forEach(el => el.style.display = 'none');
    // Se o sort atual for inválido para a wishlist, resetar para "Mais recente"
    const hiddenValues = ['progresso-asc','progresso-desc','tier-asc','tier-desc','temporada-asc','temporada-desc'];
    if (hiddenValues.includes(sortOrder.value)) {
      sortOrder.value = 'data-desc';
      markMenuActive(sortMenu, sortOrder);
    }
  } else if (currentTab === 'pesquisa') {
    filterStatus.style.display = 'none';
    filterTier.style.display = 'none';
    if (statusWrapper) statusWrapper.style.display = 'none';
    if (tierWrapper) tierWrapper.style.display = 'none';
    document.querySelectorAll('[data-wishlist-hidden]').forEach(el => el.style.display = 'none');
  } else {
    filterStatus.style.display = '';
    filterTier.style.display = '';
    if (statusWrapper) statusWrapper.style.display = '';
    if (tierWrapper) tierWrapper.style.display = '';
    // Restaurar todas as opções de ordenação
    document.querySelectorAll('[data-wishlist-hidden]').forEach(el => el.style.display = '');
  }
}

async function promptCreateList() {
  const nome = prompt('Nome da nova lista:');
  if (!nome || nome.trim() === '') return;
  
  try {
    await createList(nome.trim());
    await loadUserLists();
    showToast('Lista criada com sucesso!');
  } catch (error) {
    showErrorToast('Erro ao criar lista', error);
  }
}

let activeInlineEdit = null;

function startInlineEdit(listBtn, list, contentSpan, actionsWrap) {
  if (activeInlineEdit) cancelInlineEdit();
  
  listBtn.classList.add('editing');
  listBtn.style.pointerEvents = 'auto';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'nav-inline-input';
  input.value = list.nome;
  input.maxLength = 100;
  
  contentSpan.style.display = 'none';
  actionsWrap.innerHTML = '';
  
  const confirmIcon = document.createElement('i');
  confirmIcon.className = 'fas fa-check nav-action-icon nav-action-confirm';
  confirmIcon.title = 'Salvar';
  
  const deleteIcon = document.createElement('i');
  deleteIcon.className = 'fas fa-trash nav-action-icon nav-action-delete';
  deleteIcon.title = 'Excluir lista';
  
  actionsWrap.appendChild(confirmIcon);
  actionsWrap.appendChild(deleteIcon);
  
  listBtn.insertBefore(input, actionsWrap);
  input.focus();
  input.select();
  
  const save = async () => {
    const novoNome = input.value.trim();
    if (!novoNome || novoNome === list.nome) {
      cancelInlineEdit();
      return;
    }
    try {
      await renameList(list.id, novoNome);
      await loadUserLists();
      showToast('Lista renomeada!');
    } catch (error) {
      showErrorToast('Erro ao renomear', error);
    }
  };
  
  const remove = async () => {
    if (!confirm(`Tem certeza que deseja excluir a lista "${list.nome}"?`)) return;
    try {
      await deleteList(list.id);
      if (currentListId === list.id) {
        currentTab = 'all';
        currentListId = null;
      }
      await loadItems();
      showToast('Lista excluída!');
    } catch (error) {
      showErrorToast('Erro ao excluir lista', error);
    }
  };
  
  confirmIcon.addEventListener('click', (e) => { e.stopPropagation(); save(); });
  deleteIcon.addEventListener('click', (e) => { e.stopPropagation(); remove(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancelInlineEdit();
  });
  input.addEventListener('blur', () => { setTimeout(cancelInlineEdit, 150); });
  
  activeInlineEdit = { listBtn, contentSpan, actionsWrap, input };
}

function cancelInlineEdit() {
  if (!activeInlineEdit) return;
  const { listBtn, contentSpan, actionsWrap, input } = activeInlineEdit;
  
  if (input && input.parentNode) input.remove();
  contentSpan.style.display = '';
  actionsWrap.innerHTML = '';
  
  const renameIcon = document.createElement('i');
  renameIcon.className = 'fas fa-pencil-alt nav-action-icon';
  renameIcon.title = 'Editar';
  renameIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    const list = userLists.find(l => l.id === listBtn.dataset.listId);
    if (list) startInlineEdit(listBtn, list, contentSpan, actionsWrap);
  });
  actionsWrap.appendChild(renameIcon);
  
  listBtn.classList.remove('editing');
  activeInlineEdit = null;
}

// ========== SELEÇÃO DE LISTAS NOS MODAIS ==========
function populateAddListCheckboxes(preselectedIds = []) {
  if (!addListCheckboxes) return;
  addListCheckboxes.innerHTML = '';

  const sorted = [...userLists].filter(l => l.nome !== 'Próximos' && l.nome !== 'Lista de Desejos').sort((a, b) => (b.is_system ? 1 : 0) - (a.is_system ? 1 : 0));
  sorted.forEach(list => {
    const label = document.createElement('label');
    label.className = 'list-checkbox-pill';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = list.id;
    checkbox.checked = preselectedIds.includes(list.id);
    
    const icon = document.createElement('i');
    icon.className = `fas ${list.is_system ? 'fa-heart' : 'fa-list'}`;
    
    const text = document.createTextNode(` ${list.nome}`);
    
    label.appendChild(checkbox);
    label.appendChild(icon);
    label.appendChild(text);
    addListCheckboxes.appendChild(label);
  });
}

function populateDetailListCheckboxes(itemLists = []) {
  if (!detailListCheckboxes) return;
  detailListCheckboxes.innerHTML = '';

  const sorted = [...userLists].filter(l => l.nome !== 'Próximos' && l.nome !== 'Lista de Desejos').sort((a, b) => (b.is_system ? 1 : 0) - (a.is_system ? 1 : 0));
  sorted.forEach(list => {
    const label = document.createElement('label');
    label.className = 'list-checkbox-pill';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = list.id;
    checkbox.checked = itemLists.some(l => l.id === list.id);
    
    const icon = document.createElement('i');
    icon.className = `fas ${list.is_system ? 'fa-heart' : 'fa-list'}`;
    
    const text = document.createTextNode(` ${list.nome}`);
    
    label.appendChild(checkbox);
    label.appendChild(icon);
    label.appendChild(text);
    detailListCheckboxes.appendChild(label);
  });
}

// ========== STEPPER ADAPTERS ==========
const addInputs = {
  tempInput: addTemporadaInput,
  epInput: addEpisodioInput,
  epDisplay: addEpisodioDisplay,
  tempDisplay: addTemporadaDisplay
};

// ========== ADD MODAL EPISODE PROGRESS PANEL ==========
const addSeasonMaxEl = $('addSeasonMax');
const addSeasonNameEl = $('addSeasonName');
const addEpMaxEl = $('addEpMax');
const addEpTitleEl = $('addEpTitle');
const addEpDateEl = $('addEpDate');
const addEpOverviewEl = $('addEpOverview');
const addEpLoadingEl = $('addEpLoading');

let addEpisodeInfoRequestId = 0;
const addSeasonDataCache = new Map();

function resetAddProgressPanel() {
  const temp = parseInt(addTemporadaInput.value) || 1;
  const ep = parseInt(addEpisodioInput.value) || 0;
  const maxTemp = addSeasonLimits.maxTemp || 1;
  const maxEp = addSeasonLimits.maxEpByTemp?.[temp] || 1;

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

  if (!selectedTmdbId || selectedMediaType !== 'tv' || ep === 0) return;

  const requestId = ++addEpisodeInfoRequestId;

  try {
    const key = `${selectedTmdbId}:${temp}`;
    let seasonData = addSeasonDataCache.get(key);
    if (!seasonData) {
      seasonData = await callTMDB(`tv/${selectedTmdbId}/season/${temp}`, {}, 'pt-BR');
      addSeasonDataCache.set(key, seasonData);
    }
    if (requestId !== addEpisodeInfoRequestId) return;

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
    if (requestId !== addEpisodeInfoRequestId) return;
    console.warn('Erro ao buscar detalhes do episódio:', e);
    if (addEpTitleEl) addEpTitleEl.textContent = `Episódio ${ep}`;
  } finally {
    if (requestId === addEpisodeInfoRequestId && addEpLoadingEl) {
      addEpLoadingEl.style.display = 'none';
    }
  }
}

function handleStepperUpdate(btn, modalType) {
  updateStepperValue(btn, modalType, addSeasonLimits, detailModalAPI.getSeasonLimits(), addInputs, detailInputs);
  if (modalType === 'detail') {
    detailModalAPI.onStepperChange();
  } else if (modalType === 'add') {
    syncAddProgressPanel();
  }
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
  onOpenEpisodes: (index, curTemp, curEp) => episodesModalAPI.open(index, items, curTemp, curEp),
  populateDetailListCheckboxes: (itemLists) => populateDetailListCheckboxes(itemLists),
  onAddItemToList: (itemId, listId) => addItemToList(itemId, listId),
  onRemoveItemFromList: (itemId, listId) => removeItemFromList(itemId, listId),
  onGetUserLists: () => userLists,
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

// ========== RENDER ==========
function render() {
  // Pesquisa tab — show search view, hide everything else
  // Na página Pesquisar: esconder busca local e mostrar busca TMDB na mesma linha dos filtros
  const toolbarSearchLocal = document.getElementById('toolbarSearchLocal');
  const toolbarSearchTmdb = document.getElementById('toolbarSearchTmdb');
  if (toolbarSearchLocal) toolbarSearchLocal.style.display = currentTab === 'pesquisa' ? 'none' : '';
  if (toolbarSearchTmdb) toolbarSearchTmdb.style.display = currentTab === 'pesquisa' ? '' : 'none';

  if (currentTab === 'pesquisa') {
    continueSection.style.display = 'none';
    gridSection.style.display = 'none';
    searchView.style.display = '';
    headerListName.textContent = 'Pesquisar';
    return;
  }

  // Normal tabs — hide search view, show grid
  searchView.style.display = 'none';
  gridSection.style.display = '';

  renderContinueWatching(items, currentTab, currentListId, continueSection, continueGrid, (item, variant) => createCardElement(item, variant, items, handleCardClick));

  const search = searchInput?.value || '';
  const statusFilter = filterStatus.value;
  let tierFilter = filterTier.value;
  const sortKey = sortOrder.value;

  // Ignorar filtro de Tier na aba "Próximos"
  if (currentTab === 'planejado') {
    tierFilter = 'todos';
  }

  const filtered = sortItems(filterItems(items, { currentTab, search, statusFilter, tierFilter, currentListId }), sortKey);

  const count = filtered.length;
  let label = '';
  
  // Determinar label baseado na aba ou lista atual
  if (currentTab === 'all') {
    label = 'Total';
  } else if (currentTab === 'planejado') {
    label = 'Próximos';
  } else if (currentListId) {
    const currentList = userLists.find(l => l.id === currentListId);
    label = currentList ? currentList.nome : 'Lista';
  } else {
    label = 'Total';
  }
  
  headerListName.textContent = label;

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

  const nomeVal = selectedName.trim();
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
    let ano = selectedAno;
    
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
        const data = await callTMDB('search/tv', { query: nomeVal }, 'pt-BR');
        const result = data.results?.[0];
        if (result) {
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

    // If opened from search and item already exists, just add to new lists
    if (existingItemForSearch) {
      const existingItem = existingItemForSearch;
      const selectedListIds = Array.from(addListCheckboxes.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
      const existingListIds = (existingItem.lists || []).map(l => l.id);
      const toAdd = selectedListIds.filter(id => !existingListIds.includes(id));

      if (toAdd.length > 0) {
        const addPromises = toAdd.map(listId => addItemToList(existingItem.id, listId));
        await Promise.allSettled(addPromises);
        const addedLists = userLists.filter(l => toAdd.includes(l.id));
        existingItem.lists = [...(existingItem.lists || []), ...addedLists];
        showToast(`Adicionado a ${toAdd.length > 1 ? toAdd.length + ' listas' : addedLists[0]?.nome || 'nova lista'}.`);
      } else {
        showToast('Este título já pertence a todas as listas selecionadas.');
      }

      existingItemForSearch = null;
      render();
      closeModal();
      form.reset();
      clearPreview();
      cachedShowDetails = null;
      selectedTmdbId = null;
      selectedMediaType = null;
      selectedPosterPath = null;
      selectedAno = null;
      selectedName = '';
      addTemporadaInput.value = 1;
      addTemporadaDisplay.textContent = String(1).padStart(2, '0');
      addEpisodioInput.value = 0;
      addEpisodioDisplay.textContent = String(0).padStart(2, '0');
      addSeasonLimits = {};
      resetAddProgressPanel();
      return;
    }

    const duplicate = items.some((it, i) => {
      if (i === editingIndex) return false;
      if (it.tmdb_id && selectedTmdbId) {
        return String(it.tmdb_id) === String(selectedTmdbId);
      }
      const sameName = it.nome.toLowerCase() === nomeVal.toLowerCase();
      const sameType = it.tipo === tipoVal;
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
    
    // Adicionar às listas selecionadas no modal
    const selectedListIds = Array.from(addListCheckboxes.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const listPromises = selectedListIds.map(listId => addItemToList(saved.id, listId));
    await Promise.allSettled(listPromises);
    saved.lists = userLists.filter(l => selectedListIds.includes(l.id));
    
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
    selectedTmdbId = null;
    selectedMediaType = null;
    selectedPosterPath = null;
    selectedAno = null;
    selectedName = '';
    existingItemForSearch = null;
    addTemporadaInput.value = 1;
    addTemporadaDisplay.textContent = String(1).padStart(2, '0');
    addEpisodioInput.value = 0;
    addEpisodioDisplay.textContent = String(0).padStart(2, '0');
    addSeasonLimits = {};
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
  editingIndex = null;
  btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar';
  modalTitleText.textContent = 'Adicionar título';
  modalTitle.style.display = '';
  btnCancel.style.display = 'inline-flex';
  clearAllFieldErrors(form);
  form.reset();
  clearPreview();
  cachedShowDetails = null;
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
  selectedTmdbId = null;
  selectedMediaType = null;
  selectedPosterPath = null;
  selectedAno = null;
  selectedName = '';
  existingItemForSearch = null;
  addTemporadaInput.value = 1;
  addTemporadaDisplay.textContent = String(1).padStart(2, '0');
  addEpisodioInput.value = 1;
  addEpisodioDisplay.textContent = String(1).padStart(2, '0');
  addSeasonLimits = {};
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
      gridDensity = parseInt(value, 10) || gridDensity;
      localStorage.setItem('gridDensity', gridDensity);
      // update active state
      densityOptions.forEach(o => o.classList.toggle('active', String(o.dataset.value) === String(gridDensity)));
      // update accessible title for density button (keep icon)
      if (densityToggleBtn) {
        const label = densityLabelForValue(gridDensity);
        densityToggleBtn.setAttribute('title', label);
        densityToggleBtn.setAttribute('aria-label', `Densidade: ${label}`);
      }
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
groupToggle.innerHTML = groupingActive ? '<i class="fas fa-layer-group" style="color: var(--accent);"></i>' : '<i class="fas fa-layer-group"></i>';
groupToggle.addEventListener('click', () => {
  groupingActive = !groupingActive;
  localStorage.setItem('groupingActive', groupingActive);
  groupToggle.innerHTML = groupingActive ? '<i class="fas fa-layer-group" style="color: var(--accent);"></i>' : '<i class="fas fa-layer-group"></i>';
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
        const maxTemp = addSeasonLimits.maxTemp || 1;
        if (maxTemp > 0) {
          addTemporadaInput.value = maxTemp;
          addTemporadaDisplay.textContent = String(maxTemp).padStart(2, '0');
          const maxEp = addSeasonLimits.maxEpByTemp?.[maxTemp] || 1;
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
    else if (currentTab === 'pesquisa') {
      currentTab = 'all';
      currentListId = null;
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
        const data = await callTMDB('search/tv', { query: q }, 'pt-BR');
        pesquisaLoading.style.display = 'none';

        if (!data.results || data.results.length === 0) {
          pesquisaEmpty.style.display = '';
          pesquisaEmpty.querySelector('p').textContent = 'Nenhum resultado encontrado';
          return;
        }

        const fragment = document.createDocumentFragment();
        data.results.forEach(res => {
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

          const openAddModal = () => {
            if (editingIndex !== null) cancelEdit();
            clearAllFieldErrors(form);
            clearPreview();
            cachedShowDetails = null;
            statusSelect.value = 'assistindo';
            syncAddStatusBtns();
            tierForm.value = '';
            updateAddTierBadge('');
            addYearDisplay.textContent = year || '--';
            selectedTmdbId = res.id;
            selectedMediaType = res.media_type || 'tv';
            if (addPosterSteppersRow) addPosterSteppersRow.style.display = (!res.media_type || res.media_type === 'tv') ? 'flex' : 'none';
            selectedPosterPath = poster;
            selectedAno = year || null;
            selectedName = name;
            addTemporadaInput.value = 1;
            addTemporadaDisplay.textContent = String(1).padStart(2, '0');
            addEpisodioInput.value = 0;
            addEpisodioDisplay.textContent = String(0).padStart(2, '0');
            addSeasonLimits = {};
            resetAddProgressPanel();
            // Reset logo and original title
            if (addLogoContainer) addLogoContainer.style.display = 'none';
            if (addLogoImg) addLogoImg.src = '';
            if (addOriginalTitle) { addOriginalTitle.style.display = 'none'; addOriginalTitle.textContent = ''; }
            // Reset sinopse
            if (addSinopse) addSinopse.textContent = '';
            if (addSinopseLoading) addSinopseLoading.style.display = 'flex';
            if (addBlurBg) addBlurBg.style.backgroundImage = '';
            if (addPosterWrap) addPosterWrap.classList.remove('sinopse-open');
            // Hide title text, will show logo if available
            modalTitle.style.display = 'none';
            // Check if this title already exists in catalog
            existingItemForSearch = items.find(it => it.tmdb_id && String(it.tmdb_id) === String(res.id)) || null;
            const preselectedIds = existingItemForSearch
              ? (existingItemForSearch.lists || []).map(l => l.id)
              : [];
            populateAddListCheckboxes(preselectedIds);
            // Highlight pre-existing list checkboxes
            if (existingItemForSearch && preselectedIds.length > 0 && addListCheckboxes) {
              addListCheckboxes.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                cb.closest('.list-checkbox-pill')?.classList.add('list-existing');
              });
            }
            // Show episodes button for series (tv) — visible mesmo para novos
            if (addEpisodesBtn) {
              if (!res.media_type || res.media_type === 'tv') {
                addEpisodesBtn.style.display = 'inline-flex';
                if (existingItemForSearch) {
                  addEpisodesBtn.onclick = () => {
                    const existingIndex = items.indexOf(existingItemForSearch);
                    if (existingIndex !== -1) {
                      closeModal();
                      episodesModalAPI.open(existingIndex, items);
                    }
                  };
                } else {
                  addEpisodesBtn.onclick = () => {
                    // Para novos, abre modal com todos os episódios via TMDB (sem precisar salvar)
                    const tempItem = {
                      id: Date.now(),
                      nome: res.title || res.name || 'Série',
                      tmdb_id: res.id,
                      tipo: 'serie',
                      temporada: parseInt(document.getElementById('addTemporada')?.value) || 1,
                      episodio: parseInt(document.getElementById('addEpisodio')?.value) || 0
                    };
                    try {
                      if (typeof episodesModalAPI !== 'undefined' && episodesModalAPI.open) {
                        episodesModalAPI.open(0, [tempItem]);
                      } else {
                        // fallback: destaca bloco de episódio
                        const target = document.getElementById('addStepperEpisodio');
                        if (target) {
                          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          target.style.boxShadow = '0 0 0 2px var(--accent) inset';
                          setTimeout(() => { target.style.boxShadow = ''; }, 1500);
                        }
                      }
                    } catch (e) {
                      console.error('Erro ao abrir episódios para novo item', e);
                    }
                  };
                }
              } else {
                addEpisodesBtn.style.display = 'none';
                addEpisodesBtn.onclick = null;
              }
            }

            // Fetch full details: backdrop, logo, original title, steppers
            (async () => {
              try {
                let details = null;
                if (!res.media_type || res.media_type === 'tv') {
                  details = await callTMDB(`tv/${res.id}`, {}, 'pt-BR');
                  const seasons = details.seasons || [];
                  const maxTemp = seasons.filter(s => s.season_number > 0).length || 1;
                  const maxEpByTemp = {};
                  seasons.forEach(s => {
                    if (s.season_number > 0) maxEpByTemp[s.season_number] = s.episode_count || 0;
                  });
                  const yr = details.first_air_date ? details.first_air_date.substring(0, 4) : year;
                  addSeasonLimits = { maxTemp, maxEpByTemp };
                  addTemporadaInput.value = 1;
                  addTemporadaDisplay.textContent = String(1).padStart(2, '0');
                  addEpisodioInput.value = 0;
                  addEpisodioDisplay.textContent = String(0).padStart(2, '0');
                  addYearDisplay.textContent = yr || '--';
                  if (yr) selectedAno = yr;
                  if (addPosterSteppersRow) addPosterSteppersRow.style.display = 'flex';
                  syncAddProgressPanel();
                  // Detect type
                  const genres = details.genre_ids || (details.genres || []).map(g => g.id);
                  const countries = details.origin_country || [];
                  const isAnimation = genres.includes(16);
                  const isJapanese = countries.includes('JP');
                  let detectedTipo = 'serie';
                  if (isAnimation && isJapanese) detectedTipo = 'anime';
                  else if (isAnimation) detectedTipo = 'animacao';
                  tipo.value = detectedTipo;
                } else if (res.media_type === 'movie') {
                  details = await callTMDB(`movie/${res.id}`, {}, 'pt-BR');
                  addSeasonLimits = { maxTemp: 1, maxEpByTemp: { 1: 1 } };
                  addTemporadaInput.value = 1;
                  addTemporadaDisplay.textContent = String(1).padStart(2, '0');
                  addEpisodioInput.value = 0;
                  addEpisodioDisplay.textContent = String(0).padStart(2, '0');
                  tipo.value = 'filme';
                  if (addPosterSteppersRow) addPosterSteppersRow.style.display = 'none';
                  syncAddProgressPanel();
                }

                // Backdrop image (16:9) + card poster left
                let backdropUrl = '';
                if (details && details.backdrop_path) {
                  backdropUrl = `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`;
                  previewImg.src = backdropUrl;
                  previewImg.style.display = 'block';
                  previewPlaceholder.style.display = 'none';
                } else if (poster) {
                  backdropUrl = `https://image.tmdb.org/t/p/w1280${poster}`;
                  previewImg.src = backdropUrl;
                  previewImg.style.display = 'block';
                  previewPlaceholder.style.display = 'none';
                }
                if (previewImgCard) {
                  if (poster) {
                    previewImgCard.src = `https://image.tmdb.org/t/p/w342${poster}`;
                    previewImgCard.style.display = 'block';
                  } else if (backdropUrl) {
                    previewImgCard.src = backdropUrl;
                    previewImgCard.style.display = 'block';
                  } else {
                    previewImgCard.style.display = 'none';
                    previewImgCard.src = '';
                  }
                }

                // Blur background for sinopse
                if (addBlurBg && backdropUrl) {
                  addBlurBg.style.backgroundImage = `url(${backdropUrl})`;
                }

                // Sinopse
                if (addSinopse) {
                  addSinopse.textContent = details?.overview || 'Sinopse não disponível.';
                }
                if (addSinopseLoading) addSinopseLoading.style.display = 'none';

                // Original title
                if (details) {
                  const originalName = details.original_name || details.original_title || '';
                  if (originalName && originalName !== name) {
                    addOriginalTitle.textContent = originalName;
                    addOriginalTitle.style.display = '';
                  }
                }

                // Logo
                const logoUrl = await fetchTitleLogo(res.id, res.media_type);
                if (logoUrl) {
                  addLogoImg.src = logoUrl;
                  addLogoImg.alt = `Logo de ${name}`;
                  addLogoContainer.style.display = 'flex';
                  modalTitle.style.display = 'none';
                } else {
                  addLogoContainer.style.display = 'none';
                  modalTitle.style.display = '';
                }
              } catch (err) {
                console.warn('Erro ao buscar detalhes:', err);
                // Fallback: show poster as backdrop
                if (poster) {
                  const fallbackUrl = `https://image.tmdb.org/t/p/w1280${poster}`;
                  previewImg.src = fallbackUrl;
                  previewImg.style.display = 'block';
                  previewPlaceholder.style.display = 'none';
                  if (previewImgCard) {
                    previewImgCard.src = `https://image.tmdb.org/t/p/w342${poster}`;
                    previewImgCard.style.display = 'block';
                  }
                  if (addBlurBg) addBlurBg.style.backgroundImage = `url(${fallbackUrl})`;
                }
                if (addSinopse) addSinopse.textContent = 'Erro ao carregar sinopse.';
                if (addSinopseLoading) addSinopseLoading.style.display = 'none';
                modalTitle.style.display = '';
              }
            })();

            openModal();
          };

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