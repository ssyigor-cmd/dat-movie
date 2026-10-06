/**
 * Ponto de entrada da aplicação Dat-Movie
 * Orquestra todos os componentes e inicializa a aplicação
 */

import { supabase } from './lib/supabase.js';
import { escapeHTML, getTierClass, filterItems, sortItems, TIER_ORDER, formatDateBR, isDuplicateInCatalog } from './lib/catalog.js';
import { callTMDB, fetchTitleLogo } from './lib/api.js';
import { getCurrentSession, getCurrentUser, loginWithPassword, signUpWithPassword, updateDisplayName } from './lib/auth.js';
import { fetchUserLists, createList, renameList, deleteList, addItemToList, removeItemFromList, updateListsOrder } from './lib/lists.js';
import { showToast as uiShowToast, showErrorToast as uiShowErrorToast, lockScreen, unlockScreen, trapFocus, releaseFocusTrap, setFieldError, clearFieldError, clearAllFieldErrors } from './components/uiHelpers.js';
import { updateStepperValue, setupSteppers } from './lib/stepper.js';
import { createCardElement } from './components/cards.js';
import { setupDetailModal } from './components/detailModal.js';
import { setupEpisodesModal } from './components/episodesModal.js';
import { setupTitleInfoModal, flagEmoji } from './components/titleInfoModal.js';
import { renderHome } from './components/homePage.js';
import { setupConfirmModal, showConfirm } from './components/confirmModal.js';
import { setupTitlePage, showTitlePage, hideTitlePage } from './pages/titlePage.js';
import { findParentCandidate, getContinuationTag, sortSearchResults } from './lib/titleRelations.js';
import { buildFallbackQueries, sortByRelevance } from './lib/fuzzySearch.js';
import anime from 'animejs';
import { cacheGet, cacheSet, cacheClear } from './lib/cache.js';
import { state, persistNavState, STORAGE_KEYS } from './lib/state.js';
import dom from './lib/dom.js';
if (typeof window !== 'undefined') window.anime = anime;

const $ = (id) => {
  const found = dom[id];
  if (found !== undefined) return found;
  return document.getElementById(id);
};
const titlePageEl = $('titlePage');
const toast = document.getElementById('toast');

function setActiveTab(tab, listId = null) {
  if (typeof hideTitlePage === 'function' && titlePageEl && titlePageEl.style.display !== 'none') {
    if (location.hash.startsWith('#/titulo/')) history.pushState(null, '', location.pathname + location.search);
    hideTitlePage(titlePageEl);
  }
  if (titleInfoModal && titleInfoModal.classList.contains('active')) titleInfoModalAPI.close();
  if ($('relinkModal').classList.contains('active')) closeRelinkModal();
  state.currentTab = tab;
  state.currentListId = listId;
  persistNavState();
  if (typeof updateActiveNav === 'function') updateActiveNav();
  if (typeof render === 'function') render();
}

function showToast(msg, duration = 2800) {
  uiShowToast(toast, msg, duration);
}

function showErrorToast(userMessage, error, duration = 3000) {
  uiShowErrorToast(toast, userMessage, error, duration);
}

// ========== ELEMENTOS DOM ==========
const densityToggleBtn = dom.densityToggleBtn;
const densityMenu = dom.densityMenu;
const densityOptions = dom.densityOptions;
const addListToggle = dom.addListToggle;
const addListCheckboxes = dom.addListCheckboxes;
const addEpisodesBtn = dom.addEpisodesBtn;
const detailListToggle = dom.detailListToggle;
const detailListCheckboxes = dom.detailListCheckboxes;
const addTemporadaInput = dom.addTemporadaInput;
const addEpisodioInput = dom.addEpisodioInput;
const addTemporadaDisplay = dom.addTemporadaDisplay;
const addEpisodioDisplay = dom.addEpisodioDisplay;
const addTierBadge = dom.addTierBadge;
const addTierDropdown = dom.addTierDropdown;
const addYearDisplay = dom.addYearDisplay;
const addLogoContainer = dom.addLogoContainer;
const addLogoImg = dom.addLogoImg;
const addOriginalTitle = dom.addOriginalTitle;
const addSinopse = dom.addSinopse;
const addSinopseLoading = dom.addSinopseLoading;
const addBlurBg = dom.addBlurBg;
const addPosterWrap = dom.addPosterWrap;
const modalTitleText = dom.modalTitleText;
const addPosterSteppersRow = dom.addPosterSteppersRow;
const addSeasonMaxEl = dom.addSeasonMax;
const addSeasonNameEl = dom.addSeasonName;
const addEpMaxEl = dom.addEpMax;
const addEpTitleEl = dom.addEpTitle;
const addEpDateEl = dom.addEpDate;
const addEpOverviewEl = dom.addEpOverview;
const addEpLoadingEl = dom.addEpLoading;
const detailSeasonName = dom.detailSeasonName;

// Filtros da barra de ferramentas (selects ocultos + menus + opções)
const filterStatus = dom.filterStatus;
const statusToggleBtn = dom.statusToggleBtn;
const statusMenu = dom.statusMenu;
const filterTier = dom.filterTier;
const tierToggleBtn = dom.tierToggleBtn;
const tierMenu = dom.tierMenu;
const sortOrder = dom.sortOrder;
const sortToggleBtn = dom.sortToggleBtn;
const sortDirectionBtn = dom.sortDirectionBtn;
const sortMenu = dom.sortMenu;
const filterMenuOptions = dom.filterMenuOptions;

// Demais elementos usados no módulo (bug pré-existente: o bloco acima só
// extraía parte das chaves de dom.js, então tudo abaixo era ReferenceError).
const authContainer = dom.authContainer;
const authForm = dom.authForm;
const authEmail = dom.authEmail;
const authPassword = dom.authPassword;
const authMessage = dom.authMessage;
const authSubmitBtn = dom.authSubmitBtn;
const authSwitchBtn = dom.authSwitchBtn;
const authSwitchText = dom.authSwitchText;
const authTitle = dom.authTitle;
const authSubtitle = dom.authSubtitle;
const authName = dom.authName;
const authPasswordConfirm = dom.authPasswordConfirm;
const authRevealBtn = dom.authRevealBtn;
const authStrength = dom.authStrength;
const logoutBtn = dom.logoutBtn;
const profileToggle = dom.profileToggle;
const profileDropdown = dom.profileDropdown;
const profileName = dom.profileName;
const profileHeadName = dom.profileHeadName;
const profileEmailFull = dom.profileEmailFull;
const profileAvatar = dom.profileAvatar;
const profileNameView = dom.profileNameView;
const profileNameViewText = dom.profileNameViewText;
const profileNameEdit = dom.profileNameEdit;
const profileNameRow = dom.profileNameRow;
const profileNameInput = dom.profileNameInput;
const profileNameSave = dom.profileNameSave;
const profileNameCancel = dom.profileNameCancel;
const profileNameError = dom.profileNameError;
const showProgressBar = dom.showProgressBar;
const profileSince = dom.profileSince;
const gridSection = dom.gridSection;
const searchView = dom.searchView;
const statusWrapper = dom.statusWrapper;
const tierWrapper = dom.tierWrapper;
const groupToggle = dom.groupToggle;
const statusSelect = dom.statusSelect;
const tierForm = dom.tierForm;
const tipo = dom.tipo;
const pesquisaGrid = dom.pesquisaGrid;
const pesquisaEmpty = dom.pesquisaEmpty;
const pesquisaLoading = dom.pesquisaLoading;
const previewImg = dom.previewImg;
const previewPlaceholder = dom.previewPlaceholder;
const previewImgCard = dom.previewImgCard;
const form = dom.form;
const grid = dom.grid;
const homeSection = dom.homeSection;
const modalOverlay = dom.modalOverlay;
const searchInput = dom.searchInput;
const btnCancel = dom.btnCancel;
const pesquisaInput = dom.pesquisaInput;
const formLoading = dom.formLoading;
const modalTitle = dom.modalTitle;
const modalClose = dom.modalClose;
const btnSubmit = dom.btnSubmit;
const titleInfoModal = dom.titleInfoModal;
// Não existe no index.html (só há addPanelSave): resolve para null e o
// guard `if (addPanelDelete)` abaixo trata isso.
const addPanelDelete = dom.addPanelDelete;

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

/**
 * Aplica a preferência de exibição da barra de progresso.
 *
 * A chave fica no `<body>` em vez de ser passada para cada card: assim o
 * toggle vale para o que já está renderizado na tela, sem re-renderizar
 * catálogo nem Home. Um card isolado não decide o que é clutter — o card não
 * sabe que existe uma preferência.
 */
function applyProgressBarVisibility() {
  const mostrar = state.showProgressBar;
  document.body.classList.toggle('is-progress-bar-hidden', !mostrar);
  if (showProgressBar) showProgressBar.checked = mostrar;
}

applyProgressBarVisibility();

if (showProgressBar) {
  showProgressBar.addEventListener('change', () => {
    state.showProgressBar = showProgressBar.checked;
    // Sem binding no `catch`: a falha de escrita em localStorage (modo privado,
    // cota cheia) não vale interromper o toggle, e o aviso já vem no console do
    // navegador.
    try {
      localStorage.setItem(STORAGE_KEYS.SHOW_PROGRESS_BAR, String(state.showProgressBar));
    } catch { /* preferência não persistida: vale só nesta sessão */ }
    applyProgressBarVisibility();
    // O menu cobre justamente os cards que a preferência muda, então ficar
    // aberto deixaria o clique sem resultado visível. Fecha para a tela
    // responder na hora.
    closeProfileDropdown();
  });
}

// NAVBAR E ESTATÍSTICA
const navbar = document.getElementById('topNavbar');
const navbarNav = document.getElementById('navbarNav');
const headerListName = document.getElementById('headerListName');

// ========== AUTENTICAÇÃO ==========

// O formulário é um só e alterna entre login e cadastro. `data-auth-only="signup"`
// marca o que só existe no cadastro — o CSS não controla isso, quem controla é
// `setAuthMode`.
let authMode = 'login';

const AUTH_MODE_COPY = {
  login: {
    title: 'Entrar',
    subtitle: 'Acesse sua biblioteca para continuar de onde parou.',
    submit: 'Entrar',
    switchText: 'Ainda não tem conta?',
    switchAction: 'Cadastrar',
  },
  signup: {
    title: 'Criar conta',
    subtitle: 'Leva menos de um minuto. Você confere o email depois.',
    submit: 'Criar conta',
    switchText: 'Já tem conta?',
    switchAction: 'Entrar',
  },
};

function setAuthMessage(text, kind) {
  authMessage.textContent = text || '';
  authMessage.classList.toggle('is-error', kind === 'error');
  authMessage.classList.toggle('is-success', kind === 'success');
}

// Erros por campo: `setFieldError`/`clearFieldError` são as do `uiHelpers.js` e
// já procuram `.field-error` dentro de `.auth-group`, que é onde o formulário de
// login mora. Aqui só existe a lista de quais campos participam.
const AUTH_FIELDS = [
  { input: () => authName, errorId: 'authNameError' },
  { input: () => authEmail, errorId: 'authEmailError' },
  { input: () => authPassword, errorId: 'authPasswordError' },
  { input: () => authPasswordConfirm, errorId: 'authPasswordConfirmError' },
];

function clearAuthFieldErrors() {
  for (const field of AUTH_FIELDS) {
    const input = field.input();
    if (input) clearFieldError(input);
  }
}

/** Força da senha de 0 a 4, só usada como feedback visual do cadastro. */
function passwordStrength(value) {
  if (!value) return { level: 0, label: '' };
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  // Senha longa e só com letras não deve passar por forte.
  const level = score >= 5 ? 4 : score >= 4 ? 3 : score >= 3 ? 2 : 1;
  const labels = { 1: 'Fraca', 2: 'Razoável', 3: 'Boa', 4: 'Forte' };
  return { level, label: labels[level] };
}

function renderPasswordStrength() {
  if (!authStrength) return;
  const { level, label } = passwordStrength(authPassword.value);
  authStrength.dataset.level = String(level);
  const labelEl = authStrength.querySelector('.auth-strength-label');
  if (labelEl) labelEl.textContent = label;
}

/** Validação local do cadastro, antes de chamar o Supabase. */
function validateSignup() {
  clearAuthFieldErrors();
  let firstInvalid = null;

  const name = authName.value.trim();
  if (name.length < 2) {
    setFieldError(authName, 'Diga como quer ser chamado (mínimo 2 letras).');
    firstInvalid = firstInvalid || authName;
  }

  const email = authEmail.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError(authEmail, 'Email inválido.');
    firstInvalid = firstInvalid || authEmail;
  }

  const password = authPassword.value;
  if (password.length < 8) {
    setFieldError(authPassword, 'A senha precisa de pelo menos 8 caracteres.');
    firstInvalid = firstInvalid || authPassword;
  }

  if (authPasswordConfirm.value !== password) {
    setFieldError(authPasswordConfirm, 'As senhas não são iguais.');
    firstInvalid = firstInvalid || authPasswordConfirm;
  }

  if (firstInvalid) {
    setAuthMessage('Confira os campos destacados.', 'error');
    firstInvalid.focus();
    return null;
  }
  return { name, email, password };
}

function setAuthMode(mode) {
  authMode = mode === 'signup' ? 'signup' : 'login';
  const copy = AUTH_MODE_COPY[authMode];
  const isSignup = authMode === 'signup';

  authTitle.textContent = copy.title;
  authSubtitle.textContent = copy.subtitle;
  authSubmitBtn.textContent = copy.submit;
  authSwitchText.textContent = copy.switchText;
  authSwitchBtn.textContent = copy.switchAction;

  for (const el of authForm.querySelectorAll('[data-auth-only="signup"]')) {
    el.hidden = !isSignup;
  }
  authStrength.hidden = !isSignup;
  // No login a senha já vem preenchida pelo gerenciador; no cadastro o atributo
  // certo é o de criação, senão o navegador sugere uma senha já salva.
  authPassword.autocomplete = isSignup ? 'new-password' : 'current-password';
  authName.required = isSignup;
  authPassword.required = true;
  authPasswordConfirm.required = isSignup;
  authEmail.required = true;

  clearAuthFieldErrors();
  setAuthMessage('');
  if (!isSignup) renderPasswordStrength();
}

function setAuthUI(showLogin) {
  authContainer.style.display = showLogin ? 'flex' : 'none';
  if (navbar) navbar.style.display = showLogin ? 'none' : 'flex';
  document.querySelector('.main-content').style.display = showLogin ? 'none' : 'block';

  // Update logos when auth state changes
  updateLogos();
}

/** Nome de exibição: `full_name` do metadata, com queda para o email. */
function displayNameFor(user) {
  const name = user?.user_metadata?.full_name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return user?.email?.split('@')[0] || 'Usuário';
}

function initialsFor(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '--';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

function renderProfileMenu(user) {
  if (!user) return;
  const displayName = displayNameFor(user);
  const initials = initialsFor(displayName);
  const savedName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name.trim()
    : '';

  profileName.textContent = displayName;
  profileHeadName.textContent = displayName;
  profileAvatar.textContent = initials;
  profileEmailFull.textContent = user.email || '---';

  // O estado travado mostra o que está salvo. O campo de edição existe no DOM
  // desde o início, mas escondido; quem olha o menu vê um nome, não um
  // formulário.
  if (profileNameViewText) {
    profileNameViewText.textContent = savedName || 'Sem nome de exibição';
    profileNameViewText.classList.toggle('is-empty', !savedName);
  }
  // Repreenche o input, mas só se a pessoa não estiver no meio da digitação:
  // sobrescrever enquanto ela escreve é o jeito mais rápido de perder o que
  // ela digitou. Se ela estiver editando, marcar o campo como sujo é mais
  // honesto do que fingir que o valor salvo é o que está na tela.
  if (profileNameInput && document.activeElement !== profileNameInput) {
    profileNameInput.value = savedName;
  }
  syncProfileNameEditState(savedName);
  if (profileNameError) profileNameError.textContent = '';

  if (user.created_at) {
    const since = new Date(user.created_at);
    const label = Number.isNaN(since.getTime())
      ? '---'
      : since.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    profileSince.textContent = `Membro desde ${label}`;
  }
}

/* ── Edição do nome de exibição ───────────────────────────────
   Três estados, e só um caminho para sair de cada um:

     travado  → o nome aparece como texto; nada é editável
     edição  → input aberto, com Salvar e Cancelar
     sujo    → edição com texto diferente do que está salvo

   O ponto do desenho é que abrir o menu não abre um formulário. Antes o input
   ficava sempre visível e editável, então quem só ia sair do perfil já
   entendia ter algo a preencher, e fechar o dropdown com o campo alterado
   perdia a digitação sem aviso. Aqui a edição precisa ser pedida, e sair com
   alteração pendente pergunta antes de descartar. */

/** Estado da edição do nome. Vive fora do DOM porque é decisão de interface. */
let profileNameEditing = false;

/** O que está salvo agora, para saber se o campo está sujo. */
let profileNameSaved = '';

/** Erro de validação visível, para não sumir sozinho ao mexer no campo. */
let profileNameErrorText = '';

const NOME_MIN = 2;
const NOME_MAX = 40;

/** Normaliza o que a pessoa digitou: sem espaço nas pontas, sem repetição. */
function normalizeProfileName(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Confere o nome digitado.
 * @returns {string} mensagem de erro, ou '' se estiver válido
 */
function validateProfileName(value) {
  if (!value) return 'Informe um nome.';
  if (value.length < NOME_MIN) return `Mínimo ${NOME_MIN} letras.`;
  if (value.length > NOME_MAX) return `Máximo ${NOME_MAX} letras.`;
  return '';
}

/** O que está no campo difere do que está salvo? */
function isProfileNameDirty() {
  if (!profileNameInput) return false;
  return normalizeProfileName(profileNameInput.value) !== profileNameSaved;
}

/**
 * Um único lugar que decide o estado visual do editor, para os dois lados não
 * divergirem: Salvar e Cancelar na mão, ou a re-renderização depois de salvar.
 */
function syncProfileNameEditState(saved = profileNameSaved) {
  profileNameSaved = saved;

  if (profileNameRow) profileNameRow.hidden = !profileNameEditing;
  if (profileNameView) profileNameView.hidden = profileNameEditing;

  const dirty = profileNameEditing && isProfileNameDirty();
  if (profileNameRow) profileNameRow.classList.toggle('is-dirty', dirty);

  // Salvar só habilita com alteração válida e pendente: sem isso o botão
  // aceitaria clique para reenviar o mesmo nome.
  if (profileNameSave) {
    profileNameSave.disabled = !dirty || Boolean(validateProfileName(normalizeProfileName(profileNameInput?.value)));
  }
}

/** Abre a edição com o valor salvo, e foca o campo inteiro. */
function startProfileNameEdit() {
  if (profileNameEditing) return;
  profileNameEditing = true;
  profileNameErrorText = '';
  if (profileNameInput) profileNameInput.value = profileNameSaved;
  if (profileNameError) profileNameError.textContent = '';
  syncProfileNameEditState();
  if (profileNameInput) {
    profileNameInput.focus();
    profileNameInput.select();
  }
}

/** Fecha a edição e devolve o valor salvo. `foco` decide onde a atenção vai. */
function stopProfileNameEdit(foco = false) {
  if (!profileNameEditing) return;
  profileNameEditing = false;
  profileNameErrorText = '';
  if (profileNameInput) {
    profileNameInput.value = profileNameSaved;
    profileNameInput.classList.remove('invalid');
  }
  if (profileNameError) profileNameError.textContent = '';
  syncProfileNameEditState();
  if (foco && profileNameEdit) profileNameEdit.focus();
}

async function checkSession() {
  try {
    const session = await getCurrentSession();
    if (session) {
      setAuthUI(false);
      const user = await getCurrentUser();
      state.currentUser = user || null;
      if (user) renderProfileMenu(user);
      // Default to home on fresh login if no persisted tab
      if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)) {
        state.currentTab = 'home';
        state.currentListId = null;
        persistNavState();
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

function setAuthLoading(show) {
  authSubmitBtn.disabled = show;
  authSwitchBtn.disabled = show;
  if (show) {
    const label = authMode === 'signup' ? 'Criando conta...' : 'Entrando...';
    authSubmitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${label}`;
  } else {
    // Só o texto: o botão não tem ícone fora do loading, e passar por
    // `innerHTML` aqui apagaria o label que `setAuthMode` acabou de escrever.
    authSubmitBtn.textContent = AUTH_MODE_COPY[authMode].submit;
  }
}

async function handleLogin() {
  clearAuthFieldErrors();
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    if (!email) setFieldError(authEmail, 'Preencha o email.');
    if (!password) setFieldError(authPassword, 'Preencha a senha.');
    setAuthMessage('Preencha email e senha.', 'error');
    return;
  }

  setAuthLoading(true);
  try {
    await loginWithPassword(email, password);
    await checkSession();
  } catch (error) {
    console.error('Erro de login:', error);
    console.error('Detalhes do erro:', error.message, error.status, error.name);
    // "Credenciais inválidas" é o caso comum; o resto provavelmente é rede.
    const invalid = /invalid login credentials/i.test(error.message || '');
    setAuthMessage(
      invalid
        ? 'Email ou senha incorretos.'
        : `Erro: ${error.message || 'Não foi possível entrar. Tente novamente.'}`,
      'error'
    );
  }
  setAuthLoading(false);
}

async function handleSignup() {
  const data = validateSignup();
  if (!data) return;

  setAuthLoading(true);
  try {
    const result = await signUpWithPassword(data.email, data.password, data.name);
    // Com confirmação de email ligada, `session` vem nulo e o login não acontece
    // aqui: o usuário precisa confirmar antes. Sem isso, entra direto.
    if (result.session) {
      await checkSession();
    } else {
      setAuthMessage('Conta criada! Confira seu email para confirmar e depois entre.', 'success');
      setAuthMode('login');
      authEmail.value = data.email;
    }
  } catch (error) {
    console.error('Erro de cadastro:', error);
    console.error('Detalhes do erro:', error.message, error.status, error.name);
    const already = /already registered|already exists/i.test(error.message || '');
    if (already) {
      setFieldError(authEmail, 'Esse email já tem conta.');
      setAuthMessage('Esse email já está cadastrado.', 'error');
    } else {
      setAuthMessage(`Erro: ${error.message || 'Não foi possível concluir o cadastro.'}`, 'error');
    }
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
  if (error) {
    // 23505 = unique_violation. Com idx_items_user_tmdb_unique o banco vira a
    // última linha de defesa contra títulos duplicados: o check client-side
    // não cobre dois dispositivos inserindo o mesmo tmdb_id ao mesmo tempo.
    if (error.code === '23505') {
      const dup = new Error('Este título já existe no seu catálogo.');
      dup.code = '23505';
      throw dup;
    }
    throw error;
  }
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
    state.items = data;
    await loadUserLists();
    render();
    if (location.hash.startsWith('#/titulo/')) {
      const id = location.hash.replace('#/titulo/', '');
      const item = state.items.find(i => String(i.id) === String(id));
      if (item) {
        document.getElementById('homeSection').style.display = 'none';
        document.getElementById('gridSection').style.display = 'none';
        document.getElementById('searchView').style.display = 'none';
        const mh = document.querySelector('.main-header');
        if (mh) mh.style.display = 'none';
        showTitlePage(item, titlePageEl);
      }
    }
  } catch (error) {
    console.error('Erro ao carregar itens:', error);
    throw error;
  }
}

async function loadUserLists() {
  try {
    state.userLists = await fetchUserLists();
    renderNavbar();
  } catch (error) {
    console.error('Erro ao carregar listas:', error);
    throw error;
  }
}

// ========== RENDER NAVBAR ==========

function buildListNavItem(list) {
  const listBtn = document.createElement('button');
  listBtn.className = `nav-item ${state.currentListId === list.id ? 'active' : ''}`;
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
    closeListsDropdown();
    setActiveTab('list', list.id);
  });

  return listBtn;
}

function buildListsButton() {
  const toggle = document.createElement('button');
  toggle.className = 'nav-item';
  toggle.id = 'listsToggle';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  if (state.currentTab === 'list' && state.currentListId) toggle.classList.add('active');
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

  const userListsOnly = state.userLists.filter(l => !l.is_system);

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

  // --- Início (Home) ---
  const homeBtn = document.createElement('button');
  homeBtn.className = `nav-item ${state.currentTab === 'home' ? 'active' : ''}`;
  homeBtn.dataset.tab = 'home';
  homeBtn.innerHTML = '<i class="fas fa-home"></i> <span>Início</span>';
  homeBtn.addEventListener('click', () => setActiveTab('home', null));
  fragment.appendChild(homeBtn);

  // --- Navegação principal (colada ao ícone da marca) ---
  const todosBtn = document.createElement('button');
  todosBtn.className = `nav-item ${state.currentTab === 'all' && !state.currentListId ? 'active' : ''}`;
  todosBtn.dataset.tab = 'all';
  todosBtn.innerHTML = '<i class="fas fa-th"></i> <span>Catálogo</span>';
  todosBtn.addEventListener('click', () => setActiveTab('all', null));
  fragment.appendChild(todosBtn);

  const systemLists = state.userLists.filter(l => l.is_system);
  const wishlist = systemLists.find(l => l.nome === 'Próximos' || l.nome === 'Lista de Desejos') || systemLists[0];

  const wishlistBtn = document.createElement('button');
  wishlistBtn.className = `nav-item nav-item-system ${state.currentTab === 'planejado' && !state.currentListId ? 'active' : ''}`;
  wishlistBtn.dataset.tab = 'planejado';
  wishlistBtn.dataset.system = 'true';
  if (wishlist) { wishlistBtn.dataset.listId = wishlist.id; }
  wishlistBtn.innerHTML = '<i class="fas fa-calendar-alt"></i> <span>Próximos</span>';
  wishlistBtn.addEventListener('click', () => setActiveTab('planejado', null));
  fragment.appendChild(wishlistBtn);

  const pesquisaBtn = document.createElement('button');
  pesquisaBtn.className = `nav-item ${state.currentTab === 'pesquisa' ? 'active' : ''}`;
  pesquisaBtn.dataset.tab = 'pesquisa';
  pesquisaBtn.innerHTML = '<i class="fas fa-search"></i> <span>Pesquisar</span>';
  pesquisaBtn.addEventListener('click', () => setActiveTab('pesquisa', null));
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
      if (state.listsSortable) { try { state.listsSortable.destroy(); state.listsSortable = null; } catch(e){} }
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
  if (state.listsSortable) { try { state.listsSortable.destroy(); state.listsSortable = null; } catch(e){} }
  const handleExists = dropdown.querySelector('.nav-drag-handle');
  if (!handleExists) return;
  state.listsSortable = new window.Sortable(dropdown, {
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
        // Reordena state.userLists localmente conforme novo ordem
        const byId = new Map(state.userLists.map(l => [l.id, l]));
        const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean);
        const rest = state.userLists.filter(l => !orderedIds.includes(l.id));
        state.userLists = [...reordered, ...rest];
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
    
    if ((tab === state.currentTab && !state.currentListId) || (listId === state.currentListId)) {
      btn.classList.add('active');
    }
  });

  const listsToggle = document.getElementById('listsToggle');
  if (listsToggle) {
    listsToggle.classList.toggle('active', state.currentTab === 'list' && Boolean(state.currentListId));
  }
  
  // Gerenciar filtros baseado na aba atual
  if (state.currentTab === 'home') {
    filterStatus.style.display = 'none';
    filterTier.style.display = 'none';
    if (statusWrapper) statusWrapper.style.display = 'none';
    if (tierWrapper) tierWrapper.style.display = 'none';
    document.querySelectorAll('[data-wishlist-hidden]').forEach(el => el.style.display = 'none');
  } else if (state.currentTab === 'planejado') {
    filterStatus.style.display = 'none';
    filterTier.style.display = 'none';
    if (statusWrapper) statusWrapper.style.display = 'none';
    if (tierWrapper) tierWrapper.style.display = 'none';
    // Esconder opções de ordenação sem sentido para Próximos
    document.querySelectorAll('[data-wishlist-hidden]').forEach(el => el.style.display = 'none');
    // Se o campo do sort não faz sentido para a wishlist, cair para "Data" —
    // preservando o sentido, que agora é escolha de quem está filtrando e não
    // vem atrelado ao campo. Antes a lista era de valores inteiros
    // ("tier-asc", "ano-desc"…); com o sentido separado, o corte é pelo campo,
    // e os dois lados precisam entrar para o botão do menu não sumir junto.
    //
    // O valor é escrito direto, sem `setSort`: o `render` desta função já vem
    // no fim, e despachar `change` aqui renderizaria a grade duas vezes.
    const hiddenFields = ['tier', 'progresso', 'ano'];
    if (hiddenFields.includes(sortField())) {
      sortOrder.value = `data-${sortDirection()}`;
      syncSortUi();
    }
  } else if (state.currentTab === 'pesquisa') {
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
    const ok = await showConfirm(`Tem certeza que deseja excluir a lista "${list.nome}"?`, 'Excluir lista');
    if (!ok) return;
    try {
      await deleteList(list.id);
      if (state.currentListId === list.id) {
        state.currentTab = 'all';
        state.currentListId = null;
        persistNavState();
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
    const list = state.userLists.find(l => l.id === listBtn.dataset.listId);
    if (list) startInlineEdit(listBtn, list, contentSpan, actionsWrap);
  });
  actionsWrap.appendChild(renameIcon);
  
  listBtn.classList.remove('editing');
  activeInlineEdit = null;
}

// ========== SELEÇÃO DE LISTAS NOS MODAIS ==========
function populateListCheckboxes(container, selectedIdSet) {
  if (!container) return;
  container.innerHTML = '';
  const sorted = [...state.userLists].filter(l => l.nome !== 'Próximos' && l.nome !== 'Lista de Desejos').sort((a, b) => (b.is_system ? 1 : 0) - (a.is_system ? 1 : 0));
  sorted.forEach(list => {
    const label = document.createElement('label');
    label.className = 'list-checkbox-pill';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = list.id;
    checkbox.checked = selectedIdSet.has(list.id);
    const icon = document.createElement('i');
    icon.className = `fas ${list.is_system ? 'fa-heart' : 'fa-list'}`;
    const text = document.createTextNode(` ${list.nome}`);
    label.appendChild(checkbox);
    label.appendChild(icon);
    label.appendChild(text);
    container.appendChild(label);
  });
}
function populateAddListCheckboxes(preselectedIds = []) {
  populateListCheckboxes(addListCheckboxes, new Set(preselectedIds));
}

function populateDetailListCheckboxes(itemLists = []) {
  populateListCheckboxes(detailListCheckboxes, new Set(itemLists.map(l => l.id)));
}
// ========== STEPPER ADAPTERS ==========
const addInputs = {
  tempInput: addTemporadaInput,
  epInput: addEpisodioInput,
  epDisplay: addEpisodioDisplay,
  tempDisplay: addTemporadaDisplay
};

let addEpisodeInfoRequestId = 0;

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
    const key = `season_${state.selectedTmdbId}:${temp}`;
    let seasonData = cacheGet(key);
    if (!seasonData) {
      seasonData = await callTMDB(`tv/${state.selectedTmdbId}/season/${temp}`, {}, 'pt-BR');
      cacheSet(key, seasonData);
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
// Cards - agora abre página em vez de modal
const handleCardClick = (index) => {
  const item = state.items[index];
  if (!item) return;
  // Navega para página do título
  history.pushState({ titleId: item.id }, '', `#/titulo/${item.id}`);
  showTitlePage(item, titlePageEl);
  // Esconde seções principais
  if (typeof render === 'function') {
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('gridSection').style.display = 'none';
    document.getElementById('searchView').style.display = 'none';
    document.querySelector('.main-header').style.display = 'none';
  }
};

// Detail Modal
const detailInputs = {
  tempInput: dom.detailTemporadaInput,
  epInput: dom.detailEpisodioInput,
  epDisplay: dom.detailEpisodioDisplay,
  tempDisplay: dom.detailTemporadaDisplay
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
  detailSeasonName: $('detailSeasonName'),
  detailCountryFlag: $('detailCountryFlag')
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

// Modal de informações do título
const titleInfoModalAPI = setupTitleInfoModal({
  titleInfoModal: $('titleInfoModal'),
  titleInfoClose: $('titleInfoClose'),
  titleInfoTitle: $('titleInfoTitle'),
  titleInfoLoading: $('titleInfoLoading'),
  titleInfoContent: $('titleInfoContent'),
  titleInfoLogoWrap: $('titleInfoLogoWrap'),
  titleInfoLogoImg: $('titleInfoLogoImg')
}, {
  onToast: showToast,
  onResolveTmdbId: async (item) => {
    try {
      const searchData = await callTMDB('search/tv', { query: item.nome }, 'pt-BR');
      const result = searchData.results?.[0];
      if (result && item.id && !item._isPreview) {
        item.tmdb_id = result.id;
        await updateItemInSupabase(item.id, { tmdb_id: result.id });
      }
      return result ? result.id : null;
    } catch {
      return null;
    }
  }
});

setupTitlePage({
  onUpdateItem: updateItemInSupabase,
  onDeleteItem: deleteItemFromSupabase,
  onGetUserLists: () => state.userLists,
  onAddItemToList: (itemId, listId) => addItemToList(itemId, listId),
  onRemoveItemFromList: (itemId, listId) => removeItemFromList(itemId, listId),
  onOpenEpisodes: (...args) => {
    if (Array.isArray(args[1])) {
      return episodesModalAPI.open(args[0], args[1], args[2], args[3]);
    }
    if (args[1] && typeof args[1] === 'object' && args[1].id) {
      return episodesModalAPI.open(0, [args[1]], args[2], args[3]);
    }
    return episodesModalAPI.open(0, [args[1]].filter(Boolean), args[2], args[3]);
  },
  onOpenDetails: (item) => titleInfoModalAPI.open(item),
  onOpenParent: (candidate, allResults) => openTitlePageForSearch(candidate, allResults),
  onRelinkTitle: (item) => openRelinkModal(item),
  onCreateItem: async (payload) => {
    const created = await addItemToSupabase({
      nome: payload.nome,
      tipo: payload.tipo,
      temporada: payload.temporada,
      episodio: payload.episodio,
      totalEpisodios: payload.totalEpisodios,
      seasonEpisodesMap: payload.seasonEpisodesMap,
      status: payload.status,
      tier: payload.tier,
      imagem: payload.imagem,
      tmdb_id: payload.tmdb_id,
      ano: payload.ano
    });
    const fullItem = { ...created, totalEpisodios: created.total_episodios, seasonEpisodesMap: created.season_episodes_map || {}, dataCriacao: created.data_criacao, dataAtualizacao: created.data_atualizacao, lists: [] };
    if (payload.lists && payload.lists.length) {
      const results = await Promise.allSettled(payload.lists.map(id => addItemToList(fullItem.id, id)));
      const okIds = new Set(payload.lists.filter((_,i)=> results[i]?.status==='fulfilled'));
      fullItem.lists = state.userLists.filter(l => okIds.has(l.id));
    }
    state.items.unshift(fullItem);
    await loadUserLists();
    render();
    showToast('Título adicionado!');
    return fullItem;
  },
  onBack: () => {
    history.pushState(null, '', location.pathname + location.search);
    hideTitlePage(titlePageEl);
    render();
  }
});

// Roteamento: voltar do título
window.addEventListener('popstate', () => {
  if (location.hash.startsWith('#/titulo/')) {
    const id = location.hash.replace('#/titulo/', '');
    const item = state.items.find(i => String(i.id) === String(id));
    if (item) showTitlePage(item, titlePageEl);
  } else {
    hideTitlePage(titlePageEl);
    render();
  }
});
// Abrir direto se URL já tem hash
if (location.hash.startsWith('#/titulo/')) {
  setTimeout(() => {
    const id = location.hash.replace('#/titulo/', '');
    const item = state.items.find(i => String(i.id) === String(id));
    if (item) handleCardClick(state.items.indexOf(item));
  }, 500);
}

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
  const addCountryFlagEl = document.getElementById('addCountryFlag');
  if (addCountryFlagEl) addCountryFlagEl.style.display = 'none';
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
        // Sistema é apenas para mídias seriadas - fallback trata como tv
        details = await callTMDB(`tv/${tmdbId}`, {}, 'pt-BR');
        const seasons = details.seasons || [];
        const maxTemp = seasons.filter(s => s.season_number > 0).length || 1;
        const maxEpByTemp = {};
        seasons.forEach(s => { if (s.season_number > 0) maxEpByTemp[s.season_number] = s.episode_count || 0; });
        state.addSeasonLimits = { maxTemp, maxEpByTemp };
        if (addTemporadaInputEl) addTemporadaInputEl.value = 1;
        if (addTemporadaDisplayEl) addTemporadaDisplayEl.textContent = '01';
        if (addEpisodioInputEl) addEpisodioInputEl.value = 0;
        if (addEpisodioDisplayEl) addEpisodioDisplayEl.textContent = '00';
        tipo.value = 'serie';
        if (addPosterSteppersRowEl) addPosterSteppersRowEl.style.display = 'flex';
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

        // País de origem com bandeira
        const addCountryFlagEl = document.getElementById('addCountryFlag');
        const originCountry = details.origin_country?.[0] || details.production_countries?.[0]?.iso_3166_1;
        if (originCountry && addCountryFlagEl) {
          const countryName = details.production_countries?.[0]?.name || originCountry;
          const flagImg = document.createElement('img');
          flagImg.src = `https://flagcdn.com/${originCountry.toLowerCase()}.svg`;
          flagImg.alt = originCountry;
          flagImg.className = 'country-flag-img';
          flagImg.style.width = '24px';
          flagImg.style.height = '16px';
          flagImg.style.objectFit = 'contain';
          flagImg.onerror = () => {
            flagImg.textContent = flagEmoji(originCountry);
            flagImg.style.fontSize = '1.2em';
          };
          addCountryFlagEl.innerHTML = '';
          addCountryFlagEl.appendChild(flagImg);
          const countrySpan = document.createElement('span');
          countrySpan.textContent = countryName;
          addCountryFlagEl.appendChild(countrySpan);
          addCountryFlagEl.style.display = 'flex';
        } else if (addCountryFlagEl) {
          addCountryFlagEl.style.display = 'none';
        }
      }
      // O logo nunca era buscado aqui: restou a referência `logoUrlParallel`
      // de um refactor anterior e fetchTitleLogo (importado) não era chamado.
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
  return openTitlePageForSearch(raw);
}

// — Padrão único: pesquisa e catálogo usam a mesma TitlePage
function openTitlePageForSearch(raw, allResults = null) {
  const tmdbId = raw.id;
  const existing = state.items.find(it => String(it.tmdb_id) === String(tmdbId));
  if (existing) {
    history.pushState({ titleId: existing.id }, '', `#/titulo/${existing.id}`);
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('gridSection').style.display = 'none';
    document.getElementById('searchView').style.display = 'none';
    const mh = document.querySelector('.main-header');
    if (mh) mh.style.display = 'none';
    showTitlePage(existing, titlePageEl);
    return;
  }
  const preview = {
    id: `preview-${tmdbId}`,
    _isPreview: true,
    nome: raw.title || raw.name || raw.title || 'Título',
    tipo: 'serie',
    temporada: 1,
    episodio: 0,
    totalEpisodios: 1,
    seasonEpisodesMap: {},
    status: 'assistindo',
    tier: null,
    imagem: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : (raw.posterUrl || ''),
    tmdb_id: tmdbId,
    ano: (raw.first_air_date || raw.release_date || raw.date || '').slice(0,4) || null,
    lists: [],
    _parentCandidate: findParentCandidate(raw, allResults) || null,
    _parentResults: allResults
  };
  history.pushState({ titleId: preview.id }, '', `#/titulo/preview-${tmdbId}`);
  document.getElementById('homeSection').style.display = 'none';
  document.getElementById('gridSection').style.display = 'none';
  document.getElementById('searchView').style.display = 'none';
  const mh2 = document.querySelector('.main-header');
  if (mh2) mh2.style.display = 'none';
  showTitlePage(preview, titlePageEl);
}

// ========== CORRIGIR VÍNCULO DO TÍTULO ==========
let relinkTimeout = null;
let relinkItem = null;

function closeRelinkModal() {
  $('relinkModal').classList.remove('active');
  unlockScreen();
  $('relinkResults').innerHTML = '';
  $('relinkLoading').style.display = 'none';
  relinkItem = null;
}

async function relinkSearch(query) {
  const results = $('relinkResults');
  const loading = $('relinkLoading');
  results.innerHTML = '';
  loading.style.display = 'flex';
  try {
    const data = await callTMDB('search/tv', { query }, 'pt-BR');
    loading.style.display = 'none';
    const list = sortSearchResults(data.results || [], query);
    if (!list.length) {
      results.innerHTML = '<p class="relink-empty">Nenhum resultado encontrado.</p>';
      return;
    }
    const currentId = String(relinkItem?.tmdb_id || '');
    const frag = document.createDocumentFragment();
    list.slice(0, 12).forEach(res => {
      const name = res.name || res.title || '';
      if (!name) return;
      const year = (res.first_air_date || res.release_date || '').slice(0, 4);
      const poster = res.poster_path ? `https://image.tmdb.org/t/p/w92${res.poster_path}` : '';
      const contTag = getContinuationTag(name);
      const isCurrent = String(res.id) === currentId;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `relink-item${isCurrent ? ' relink-item--current' : ''}`;
      row.disabled = isCurrent;
      row.innerHTML = `
        <span class="relink-thumb">${poster ? `<img src="${escapeHTML(poster)}" alt="" loading="lazy" />` : '<i class="fas fa-film"></i>'}</span>
        <span class="relink-text">
          <span class="relink-name">${escapeHTML(name)}</span>
          <span class="relink-sub">${year ? `<span>${year}</span>` : ''}${contTag ? `<span class="relink-tag">${escapeHTML(contTag)}</span>` : ''}${isCurrent ? '<span class="relink-tag relink-tag--now">atual</span>' : ''}</span>
        </span>`;
      row.addEventListener('click', () => applyRelink(res, name));
      frag.appendChild(row);
    });
    results.appendChild(frag);
  } catch (e) {
    loading.style.display = 'none';
    results.innerHTML = '<p class="relink-empty">Erro ao buscar no TMDB.</p>';
  }
}

async function applyRelink(res, name) {
  if (!relinkItem) return;
  const item = relinkItem;
  const target = res;
  const ano = (target.first_air_date || target.release_date || '').slice(0, 4) || item.ano || null;
  const imagem = target.poster_path ? `https://image.tmdb.org/t/p/w500${target.poster_path}` : item.imagem;
  let details = null;
  try { details = await callTMDB(`tv/${target.id}`, {}, 'pt-BR'); } catch {}
  const seasonEpisodesMap = {};
  (details?.seasons || []).forEach(s => { if (s.season_number > 0) seasonEpisodesMap[s.season_number] = s.episode_count || 0; });
  try {
    const saved = await updateItemInSupabase(item.id, {
      nome: name,
      tmdb_id: target.id,
      imagem,
      ano,
      totalEpisodios: details?.number_of_episodes || item.totalEpisodios,
      seasonEpisodesMap: Object.keys(seasonEpisodesMap).length ? seasonEpisodesMap : item.seasonEpisodesMap
    });
    const idx = state.items.findIndex(i => String(i.id) === String(item.id));
    if (idx !== -1) state.items[idx] = saved;
    Object.assign(item, saved);
    closeRelinkModal();
    showTitlePage(item, titlePageEl);
    showToast('Título corrigido!');
  } catch (e) {
    console.error(e);
    showToast('Não foi possível corrigir o título.', 3000);
  }
}

function openRelinkModal(item) {
  relinkItem = item;
  const modal = $('relinkModal');
  const input = $('relinkSearch');
  modal.classList.add('active');
  lockScreen();
  $('relinkResults').innerHTML = '';
  input.value = item.nome || '';
  setTimeout(() => input.focus(), 60);
  relinkSearch(item.nome || '');
}

function initRelinkModal() {
  const modal = $('relinkModal');
  $('relinkClose').addEventListener('click', closeRelinkModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeRelinkModal(); });
  $('relinkSearch').addEventListener('input', (e) => {
    clearTimeout(relinkTimeout);
    const q = e.target.value.trim();
    if (q.length < 2) { $('relinkResults').innerHTML = ''; $('relinkLoading').style.display = 'none'; return; }
    relinkTimeout = setTimeout(() => relinkSearch(q), 400);
  });
}

initRelinkModal();

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
    gridSection.style.display = 'none';
    searchView.style.display = 'none';
    if (headerListName) headerListName.textContent = 'Início';
    if (homeSection) {
      renderHome(homeSection, {
        user: state.currentUser,
        items: state.items,
        onCardClick: handleCardClick,
        onAddFromTrending: handleTrendingAdd,
        onOpenAddModal: handleHomeContinueAdd
      });
    }
    return;
  }
  if (homeSection) homeSection.style.display = 'none';

  if (state.currentTab === 'pesquisa') {
    gridSection.style.display = 'none';
    searchView.style.display = '';
    headerListName.textContent = 'Pesquisar';
    const headerSubtitlePesquisa = document.getElementById('headerSubtitle');
    if (headerSubtitlePesquisa) headerSubtitlePesquisa.textContent = 'Explore e garimpe novidades';
    return;
  }

  // Normal tabs — hide search view, show grid (Continuar removido do catálogo - só na Home)
  searchView.style.display = 'none';
  gridSection.style.display = '';

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
  const headerSubtitle = document.getElementById('headerSubtitle');
  if (headerSubtitle) {
    const subtitles = {
      'all': 'Seu acervo completo, do assistindo ao concluído',
      'planejado': 'Sua fila de espera',
      'pesquisa': 'Explore e garimpe novidades',
      'list': 'Curadoria sem ruído'
    };
    let sub = '';
    if (state.currentListId) {
      const lst = state.userLists.find(l => l.id === state.currentListId);
      sub = lst ? `Coleção "${lst.nome}"` : subtitles['list'];
    } else {
      sub = subtitles[state.currentTab] || '';
    }
    headerSubtitle.textContent = sub;
  }

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
      itemsInTier.forEach((item) => fragment.appendChild(createCardElement(item, state.items, handleCardClick)));
    }
  } else {
    filtered.forEach((item) => fragment.appendChild(createCardElement(item, state.items, handleCardClick)));
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
        const data = await callTMDB('search/tv', { query: nomeVal }, 'pt-BR');
        const result = data.results?.find(r => r.media_type === 'tv') || data.results?.[0];
        if (result) {
          const tvData = await callTMDB(`tv/${result.id}`, {}, 'pt-BR');
          state.cachedShowDetails = { totalEpisodes: tvData.number_of_episodes || 0, seasons: tvData.seasons || [] };
        } else {
          // NÃO usar 1 aqui. Salvar total 1 faz calcularProgresso devolver
          // 100% para qualquer episodio, sem nenhum aviso. Deixa 0 para o
          // guard abaixo recusar a gravacao com mensagem clara.
          state.cachedShowDetails = { totalEpisodes: 0, seasons: [] };
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
      // Mantém totalEp em 0 de propósito. Antes aqui virava 1, e o guard
      // logo abaixo (que existe exatamente para isso) nunca disparava —
      // resultado: título salvo com 1 episódio e barra em 100%.
      totalEp = 0;
      seasonEpisodesMap = {};
    }

    if (totalEp === 0) {
      showToast('Não foi possível obter o total de episódios. Verifique a conexão e tente de novo.', 4000);
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
    // Corrida entre dispositivos estourou o índice único: o título já existe.
    if (error?.code === '23505') showToast(error.message);
    else showErrorToast('Não foi possível salvar o item. Tente novamente.', error);
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
authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (authMode === 'signup') handleSignup();
  else handleLogin();
});

authSwitchBtn.addEventListener('click', () => {
  setAuthMode(authMode === 'signup' ? 'login' : 'signup');
});

authRevealBtn.addEventListener('click', () => {
  const showing = authPassword.type === 'text';
  authPassword.type = showing ? 'password' : 'text';
  authRevealBtn.setAttribute('aria-pressed', String(!showing));
  authRevealBtn.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
  authRevealBtn.innerHTML = showing
    ? '<i class="fas fa-eye"></i>'
    : '<i class="fas fa-eye-slash"></i>';
});

authPassword.addEventListener('input', () => {
  if (authMode === 'signup') renderPasswordStrength();
  // Mexer no campo é o sinal de que a pessoa corrigiu: some com o erro.
  if (authPassword.classList.contains('invalid')) clearFieldError(authPassword);
});

for (const field of AUTH_FIELDS) {
  const input = field.input();
  if (!input) continue;
  input.addEventListener('input', () => {
    if (input.classList.contains('invalid')) clearFieldError(input);
  });
}

if (profileNameEdit) profileNameEdit.addEventListener('click', startProfileNameEdit);

if (profileNameCancel) profileNameCancel.addEventListener('click', () => stopProfileNameEdit(true));

profileNameSave.addEventListener('click', async () => {
  const next = normalizeProfileName(profileNameInput.value);
  const erro = validateProfileName(next);

  profileNameError.textContent = erro;
  profileNameErrorText = erro;
  profileNameInput.classList.toggle('invalid', Boolean(erro));

  if (erro) {
    profileNameInput.focus();
    syncProfileNameEditState();
    return;
  }
  // Salvar o que já está salvo é ruído: devolve o campo ao estado travado.
  if (next === profileNameSaved) {
    stopProfileNameEdit(true);
    return;
  }

  profileNameSave.disabled = true;
  profileNameSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    const user = await updateDisplayName(next);
    if (user) {
      state.currentUser = user;
      // Sai da edição antes de re-renderizar: `renderProfileMenu` lê o estado
      // para decidir o que mostrar, e o nome novo já é o salvo. O foco vai para
      // o lápis porque o botão de salvar some com a linha — sem isso, quem
      // salvou pelo teclado perde o lugar na página.
      stopProfileNameEdit(true);
      renderProfileMenu(user);
    }
  } catch (error) {
    console.error('Erro ao salvar nome:', error);
    profileNameErrorText = 'Não foi possível salvar. Tente novamente.';
    profileNameError.textContent = profileNameErrorText;
    profileNameInput.focus();
  } finally {
    profileNameSave.innerHTML = '<i class="fas fa-check"></i>';
    syncProfileNameEditState();
  }
});

profileNameInput.addEventListener('input', () => {
  const normalizado = normalizeProfileName(profileNameInput.value);
  const erro = validateProfileName(normalizado);

  if (profileNameErrorText && !erro) {
    profileNameErrorText = '';
    profileNameError.textContent = '';
  }

  // "Falta uma letra" não pode ser julgado a cada tecla: no segundo caractere
  // de "Bruno" o campo ainda parece incompleto, e marcar ali é bronca no meio
  // da digitação. O mínimo só é cobrado quando a pessoa tenta salvar. Durante a
  // digitação, o campo só fica marcado se passar do limite ou se o erro já
  // estiver na tela por causa de uma tentativa anterior.
  const excedeu = normalizado.length > NOME_MAX;
  const jaAvisado = Boolean(profileNameErrorText) && Boolean(erro);
  profileNameInput.classList.toggle('invalid', excedeu || jaAvisado);
  syncProfileNameEditState();
});

// Enter salva, porque o campo é de uma linha só; Escape desfaz e devolve o
// foco ao botão que abriu a edição.
profileNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!profileNameSave.disabled) profileNameSave.click();
    return;
  }
  // Escape desfaz e devolve o foco ao botão que abriu a edição.
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    stopProfileNameEdit(true);
  }
});

profileToggle.addEventListener('click', async (e) => {
  e.stopPropagation();

  if (profileDropdown.style.display === 'block') {
    // Fechar pelo toggle passa pela mesma checagem do clique fora: se o botão
    // de saída pulasse a confirmação, ele seria a rota de fuga da alteração
    // pendente, e a guarda perderia o sentido.
    await closeProfileDropdown();
    return;
  }

  profileDropdown.style.display = 'block';
  profileToggle.classList.add('active');
  profileToggle.setAttribute('aria-expanded', 'true');
});
/**
 * Fecha o dropdown do perfil.
 *
 * É o único caminho de saída: clique fora e clique no toggle passam por aqui.
 * Com alteração pendente, pergunta antes de descartar, e devolver `false`
 * mantém o menu aberto — fechar depois de a pessoa dizer "não" seria jogar
 * fora justamente o que ela tentou escrever.
 *
 * @returns {Promise<boolean>} true se o menu foi fechado
 */
async function closeProfileDropdown() {
  if (profileNameEditing) {
    // Editando sem alteração: fechar é o mesmo que cancelar, sem perguntar.
    if (isProfileNameDirty()) {
      const descartar = await showConfirm(
        'Há uma alteração no nome que não foi salva. Sair descarta o que você digitou.',
        'Descartar alteração?'
      );
      if (!descartar) return false;
    }
    stopProfileNameEdit();
  }
  profileDropdown.style.display = 'none';
  profileToggle.classList.remove('active');
  profileToggle.setAttribute('aria-expanded', 'false');
  // O modal de confirmação devolve o foco para o elemento que estava ativo
  // antes dele — que pode ser o input que esta função acabou de esconder. Só
  // se recupera quando o foco não está em lugar nenhum, para não puxar a
  // atenção de quem só estava clicando com o mouse.
  const foco = document.activeElement;
  if (!foco || foco === document.body) profileToggle.focus();
  return true;
}

document.addEventListener('click', (e) => {
  // O clique no toggle não deve fechar o menu junto — só fecha o que é de fora.
  if (profileDropdown.contains(e.target)) return;
  closeProfileDropdown();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (profileDropdown.style.display !== 'block') return;
  // Escape desfaz a edição primeiro e só depois fecha o menu: são dois níveis
  // de estado, e um Escape não deveria desfazer os dois de uma vez. Como o
  // descarte por aqui é explícito, não há o que perguntar.
  if (profileNameEditing) {
    stopProfileNameEdit(true);
    return;
  }
  closeProfileDropdown();
  // O caminho do Escape é determinístico: a atenção volta para o toggle, sem
  // depender de para onde o foco tinha ido.
  profileToggle.focus();
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  cacheClear();
  setAuthMode('login');
  await checkSession();
});

setupConfirmModal();
// O formulário começa no modo login; `hidden` no HTML só esconde os campos de
// cadastro, o texto e os atributos precisam ser montados por `setAuthMode`.
setAuthMode('login');
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

  // — Ordenar: um campo e um sentido
  //
  // O sentido morava colado na opção ("nome-asc", "nome-desc"), e o menu
  // carregava dez itens para cinco campos: metade das opções repetia o mesmo
  // campo só para trocar a seta. Agora o menu escolhe o campo e a seta ao lado
  // escolhe o sentido.
  //
  // O sentido é único, não um por campo, e é compartilhado: trocar de campo
  // preserva a seta que a pessoa escolheu, em vez de voltar ao padrão daquele
  // campo. Por isso o `data-value` de cada opção é reescrito com o sentido
  // vigente — o handler genérico de `.filter-option` continua sendo o único
  // caminho para mexer no select.

  /** Campo da ordenação atual ('nome', 'data', 'tier', 'progresso', 'ano'). */
  function sortField() {
    return String(sortOrder.value).split('-')[0];
  }

  /** Sentido da ordenação atual. */
  function sortDirection() {
    return String(sortOrder.value).split('-')[1] === 'asc' ? 'asc' : 'desc';
  }

  /** Reescreve o `data-value` das opções para o sentido vigente. */
  function syncSortMenuValues() {
    if (!sortMenu) return;
    const dir = sortDirection();
    sortMenu.querySelectorAll('.filter-option[data-field]').forEach(opt => {
      opt.dataset.value = `${opt.dataset.field}-${dir}`;
    });
  }

  /**
   * A seta é o que diz o sentido, então ela é a única coisa que precisa mudar:
   * ícone para cima quando crescente, para baixo quando decrescente, e o
   * rótulo do botão acompanhando — uma seta sozinha não diz o que o clique
   * faz, só onde a lista está.
   */
  function syncSortDirectionBtn() {
    if (!sortDirectionBtn) return;
    const asc = sortDirection() === 'asc';
    const label = asc ? 'Ordem crescente' : 'Ordem decrescente';
    const icon = sortDirectionBtn.querySelector('i');
    if (icon) icon.className = asc ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
    sortDirectionBtn.setAttribute('aria-label', label);
    sortDirectionBtn.title = label;
  }

  /** Aplica uma chave de ordenação pelo mesmo caminho de um clique no menu. */
  function setSort(key) {
    sortOrder.value = key;
    sortOrder.dispatchEvent(new Event('change'));
  }

  /**
   * Menu, seta e destaque do botão, todos derivados do valor do select.
   *
   * A ordem importa: as opções carregam o sentido vigente no `data-value`, e
   * comparar esse valor antes de reescrevê-lo deixaria o campo selecionado sem
   * destaque logo depois de inverter a seta.
   */
  function syncSortUi() {
    syncSortMenuValues();
    syncSortDirectionBtn();
    markMenuActive(sortMenu, sortOrder);
    updateToggleActiveState(sortToggleBtn, sortOrder, 'data-desc');
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
    // O `change` é o único caminho que muda a ordenação, então é aqui que as
    // três peças se acertam — venha de um clique no menu, da seta ou do reset
    // da aba "Próximos".
    syncSortUi();
  });

  if (sortDirectionBtn) {
    sortDirectionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const proximo = sortDirection() === 'asc' ? 'desc' : 'asc';
      setSort(`${sortField()}-${proximo}`);
      // Fecha o menu junto: quem inverteu a seta quer ver a grade reordenada, e
      // o dropdown aberto fica por cima de exatamente o que veio para ver.
      closeAllFilterMenus();
    });
  }

  // O `selected` do <select> manda: o sentido do menu e o ícone da seta saem
  // dele, e não do que estiver escrito no HTML. Sem isso, trocar o `selected`
  // exigiria acertar as duas metades na mão, e a seta passaria a mentir sobre
  // a ordem em uso.
  syncSortUi();

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
    else if ($('titleInfoModal').classList.contains('active')) titleInfoModalAPI.close();
    else if ($('relinkModal').classList.contains('active')) closeRelinkModal();
    else if ($('detailListModal')?.classList.contains('active')) $('detailListModal').classList.remove('active');
    else if ($('addListModal')?.classList.contains('active')) $('addListModal').classList.remove('active');
    else if ($('detailModal').classList.contains('active')) detailModalAPI.close();
    else if (modalOverlay.classList.contains('active')) { cancelEdit(); closeModal(); }
    else if (state.currentTab === 'pesquisa') {
      setActiveTab('all', null);
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
        let filteredResults = sortSearchResults(data.results || [], q);

        // A busca do TMDb tem índice próprio e não tolera muito erro de
        // digitação. Se vier vazio, tenta grafias alternativas (sem acento,
        // sem artigo, só a palavra mais longa) antes de desistir.
        if (filteredResults.length === 0) {
          for (const alt of buildFallbackQueries(q)) {
            const retry = await callTMDB('search/tv', { query: alt }, 'pt-BR');
            if (!retry.results || retry.results.length === 0) continue;
            // Reordena pela query ORIGINAL (com o erro de digitação), não
            // pela alternativa. Buscando "banks" o TMDb devolve vários
            // títulos; sem isso, o que o usuário queria não viria primeiro.
            filteredResults = sortByRelevance(q, retry.results, (r) => r.name || r.title || '');
            break;
          }
        }

        pesquisaLoading.style.display = 'none';

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
          const poster = res.poster_path || '';
          const posterUrl = poster ? `https://image.tmdb.org/t/p/w342${poster}` : '';
          const safeName = escapeHTML(name);
          const safePoster = escapeHTML(posterUrl);
          const contTag = getContinuationTag(name);

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
              ${contTag ? `<span class="pesquisa-card-tag">${escapeHTML(contTag)}</span>` : ''}
            </div>
            <div class="pesquisa-card-body">
              <h3 title="${safeName}">${safeName}</h3>
              ${year ? `<span class="pesquisa-card-year">${year}</span>` : ''}
            </div>
          `;

          const openPreview = () => openTitlePageForSearch(res, filteredResults);

          card.addEventListener('click', openPreview);
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPreview(); }
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