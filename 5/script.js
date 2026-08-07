import { supabase } from './src/lib/supabase.js';

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
const themeToggle = $('themeToggle');
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
const toast = $('toast');
const densitySelect = $('densitySelect');
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

// LINKS EXTERNOS E EPISÓDIOS
const detailWikiLink = document.getElementById('detailWikiLink');
const detailImdbLink = document.getElementById('detailImdbLink');
const detailEpisodesBtn = document.getElementById('detailEpisodesBtn');

// MODAL DE EPISÓDIOS
const episodesModal = document.getElementById('episodesModal');
const episodesClose = document.getElementById('episodesClose');
const episodesTitle = document.getElementById('episodesTitle');
const episodesLoading = document.getElementById('episodesLoading');
const episodesContent = document.getElementById('episodesContent');

// ========== SEGURANÇA ==========
function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function showErrorToast(userMessage, error, duration = 3000) {
  if (error) console.error(userMessage, error);
  showToast(userMessage, duration);
}

// ========== FORMATAÇÃO DE DATA (BRASILEIRA) ==========
function formatDateBR(dateStr) {
  if (!dateStr || dateStr === 'Data desconhecida') return dateStr;
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ========== ORB ICON ==========
function initOrb() {
  const container = document.getElementById('orbIcon');
  if (!container) return;
  const canvas = document.createElement('canvas');
  canvas.width = 28;
  canvas.height = 28;
  canvas.style.width = '28px';
  canvas.style.height = '28px';
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const palette = ['#5EEAD4', '#7FF3E3', '#FFFFFF'];
  const center = { x: 14, y: 14 };
  const radius = 12;
  const particles = [];
  const count = 40;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const dist = radius * (0.3 + Math.random() * 0.7);
    particles.push({
      angle: angle,
      dist: dist,
      speed: 0.005 + Math.random() * 0.01,
      phase: Math.random() * 2 * Math.PI,
      size: 1.5 + Math.random() * 2.5,
      color: palette[Math.floor(Math.random() * palette.length)]
    });
  }

  let time = 0;
  function draw() {
    time += 0.02;
    ctx.clearRect(0, 0, 28, 28);

    const grad = ctx.createRadialGradient(14, 14, 0, 14, 14, radius);
    grad.addColorStop(0, 'rgba(94, 234, 212, 0.25)');
    grad.addColorStop(1, 'rgba(94, 234, 212, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(14, 14, radius, 0, 2 * Math.PI);
    ctx.fill();

    particles.forEach(p => {
      const currentAngle = p.angle + time * p.speed;
      const currentDist = p.dist + Math.sin(time * 2 + p.phase) * 1.5;
      const x = center.x + Math.cos(currentAngle) * currentDist;
      const y = center.y + Math.sin(currentAngle) * currentDist;
      ctx.beginPath();
      ctx.arc(x, y, p.size * 0.6, 0, 2 * Math.PI);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const glow = ctx.createRadialGradient(14, 14, 0, 14, 14, 6);
    glow.addColorStop(0, 'rgba(255,255,255,0.6)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(14, 14, 6, 0, 2 * Math.PI);
    ctx.fill();

    requestAnimationFrame(draw);
  }
  draw();
}

initOrb();

// ========== SIDEBAR TOGGLE ==========
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

// ADD MODAL
const addTemporadaInput = $('addTemporada');
const addEpisodioInput = $('addEpisodio');
const addTemporadaDisplay = $('addTemporadaDisplay');
const addEpisodioDisplay = $('addEpisodioDisplay');
const addStepperBtns = document.querySelectorAll('#modalOverlay .stepper-btn');

// DETAIL MODAL
const detailModal = $('detailModal');
const detailClose = $('detailClose');
const detailTitle = $('detailTitle');
const detailSinopse = $('detailSinopse');
const detailLoading = $('detailLoading');
const detailTemporadaInput = $('detailTemporada');
const detailEpisodioInput = $('detailEpisodio');
const detailTemporadaDisplay = $('detailTemporadaDisplay');
const detailEpisodioDisplay = $('detailEpisodioDisplay');
const detailStatus = $('detailStatus');
const detailTier = $('detailTier');
const detailTipo = $('detailTipo');
const detailTierBadge = $('detailTierBadge');
const detailTierBlock = $('detailTierBlock');
const detailSave = $('detailSave');
const detailDelete = $('detailDelete');
const detailPosterImg = $('detailPosterImg');
const detailStartYear = $('detailStartYear');
const detailEndYear = $('detailEndYear');
const detailStatusLabel = $('detailStatusLabel');
const detailStepperBtns = document.querySelectorAll('#detailModal .stepper-btn');
const detailOriginalTitle = $('detailOriginalTitle');

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
let detailCurrentIndex = null;
let detailSeasonLimits = {};
let addSeasonLimits = {};

const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C', 'D'];
const TIER_COLORS = {
  'S+': 'tier-Splus',
  'S': 'tier-S',
  'A': 'tier-A',
  'B': 'tier-B',
  'C': 'tier-C',
  'D': 'tier-D'
};

// ========== FOCUS TRAP ==========
let activeFocusTrapHandler = null;
let lastFocusedBeforeModal = null;

function trapFocus(modalRoot) {
  releaseFocusTrap();
  lastFocusedBeforeModal = document.activeElement;

  const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  activeFocusTrapHandler = function(e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(modalRoot.querySelectorAll(focusableSelector))
      .filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', activeFocusTrapHandler);

  const firstFocusable = modalRoot.querySelector(focusableSelector);
  if (firstFocusable) setTimeout(() => firstFocusable.focus(), 50);
}

function releaseFocusTrap() {
  if (activeFocusTrapHandler) {
    document.removeEventListener('keydown', activeFocusTrapHandler);
    activeFocusTrapHandler = null;
  }
  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
    lastFocusedBeforeModal.focus();
  }
  lastFocusedBeforeModal = null;
}

// ========== TOAST ==========
let toastTimer = null;
function showToast(msg, duration = 2800) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ========== AUTENTICAÇÃO ==========
function setAuthUI(showLogin) {
  authContainer.style.display = showLogin ? 'flex' : 'none';
  document.querySelector('.sidebar').style.display = showLogin ? 'none' : 'flex';
  document.querySelector('.main-content').style.display = showLogin ? 'none' : 'block';
  themeToggle.style.display = showLogin ? 'none' : 'flex';
}

async function checkSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setAuthUI(false);
      const { data: { user } } = await supabase.auth.getUser();
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
    setAuthUI(true);
    authMessage.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setAuthLoading(false);
  if (error) {
    console.error('Erro de login:', error);
    authMessage.textContent = 'Não foi possível entrar. Verifique seu email e senha.';
  } else {
    authMessage.textContent = 'Login realizado!';
    await checkSession();
  }
}

async function handleSignup() {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) { authMessage.textContent = 'Preencha email e senha.'; return; }
  setAuthLoading(true);
  const { error } = await supabase.auth.signUp({ email, password });
  setAuthLoading(false);
  if (error) {
    console.error('Erro de cadastro:', error);
    authMessage.textContent = 'Não foi possível concluir o cadastro. Tente novamente.';
  } else {
    authMessage.textContent = 'Cadastro enviado! Confirme seu email (se ativado) ou faça login.';
  }
}

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
  profileToggle.classList.remove('active');
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  await checkSession();
});

checkSession();

// ========== SUPABASE CRUD ==========
async function fetchItemsFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('items').select('*').eq('user_id', user.id).order('data_criacao', { ascending: false });
  if (error) { console.error('Erro ao buscar itens:', error); showToast('Erro ao carregar catálogo.', 3000); return []; }
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
  const data = await fetchItemsFromSupabase();
  items = data;
  render();
}

// ========== CÁLCULO DE PROGRESSO ==========
function calcularProgresso(item) {
  let cumulativeCurrent = 0;
  let totalEp = item.totalEpisodios || 1;
  try {
    if (item.seasonEpisodesMap && typeof item.seasonEpisodesMap === 'object' && item.temporada) {
      const seasonsMap = item.seasonEpisodesMap;
      const currentSeason = String(item.temporada);
      let sumPrevious = 0;
      for (const [season, eps] of Object.entries(seasonsMap)) {
        if (Number(season) < Number(currentSeason) && typeof eps === 'number') sumPrevious += eps;
      }
      cumulativeCurrent = sumPrevious + (item.episodio || 1);
    } else {
      cumulativeCurrent = item.episodio || 1;
    }
  } catch (e) { cumulativeCurrent = item.episodio || 1; }
  if (cumulativeCurrent > totalEp) cumulativeCurrent = totalEp;
  return Math.min(100, Math.round((cumulativeCurrent / totalEp) * 100));
}

// ========== FUNÇÕES TIER ==========
function getTierClass(tier) { return TIER_COLORS[tier] || ''; }

// ========== CALL TMDB ==========
async function callTMDB(endpoint, params = {}, lang = 'pt-BR') {
  const finalParams = { ...params, language: lang };
  const { data, error } = await supabase.functions.invoke('clever-endpoint', { body: { endpoint, params: finalParams } });
  if (error) throw new Error(error.message);
  return data;
}

// ========== BENTO "CONTINUANDO" ==========
function renderContinueWatching() {
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

// ========== RENDER ==========
function render() {
  renderContinueWatching();

  let allItems = items.slice();

  let baseItems = [];
  if (currentTab === 'planejado') {
    baseItems = allItems.filter(item => item.status === 'planejado');
  } else {
    baseItems = allItems.filter(item => item.status !== 'planejado');
  }

  let filtered = baseItems.slice();
  if (currentTab !== 'planejado' && currentTab !== 'all') {
    filtered = filtered.filter(item => item.tipo === currentTab);
  }

  const search = searchInput.value.toLowerCase().trim();
  const statusFilter = filterStatus.value;
  const tierFilter = filterTier.value;
  const sortKey = sortOrder.value;

  if (search) filtered = filtered.filter(item => item.nome.toLowerCase().includes(search));
  if (statusFilter !== 'todos') filtered = filtered.filter(item => item.status === statusFilter);
  if (tierFilter !== 'todos') {
    if (tierFilter === 'null') filtered = filtered.filter(item => !item.tier);
    else filtered = filtered.filter(item => item.tier === tierFilter);
  }

  const [field, direction] = sortKey.split('-');
  const isAsc = direction === 'asc';
  filtered.sort((a, b) => {
    let valA, valB;
    switch (field) {
      case 'nome': valA = a.nome.toLowerCase(); valB = b.nome.toLowerCase(); break;
      case 'progresso': valA = calcularProgresso(a); valB = calcularProgresso(b); break;
      case 'data': valA = new Date(a.dataCriacao || 0); valB = new Date(b.dataCriacao || 0); break;
      case 'tier': {
        const idxA = TIER_ORDER.indexOf(a.tier); const idxB = TIER_ORDER.indexOf(b.tier);
        valA = idxA === -1 ? (isAsc ? 999 : -1) : idxA; valB = idxB === -1 ? (isAsc ? 999 : -1) : idxB; break;
      }
      case 'temporada': valA = a.temporada || 0; valB = b.temporada || 0; break;
      default: valA = 0; valB = 0;
    }
    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    return 0;
  });

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
    filterTier.style.display = 'none';
    groupToggle.style.display = 'none';
  } else {
    filterTier.style.display = '';
    groupToggle.style.display = '';
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
      itemsInTier.forEach((item) => fragment.appendChild(createCardElement(item)));
    }
  } else {
    filtered.forEach((item) => fragment.appendChild(createCardElement(item)));
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

// ========== CRIAR CARD ==========
function createCardElement(item, variant = null) {
  const realIndex = items.indexOf(item);
  const progress = calcularProgresso(item);
  const icon = item.tipo === 'anime' ? 'fa-tv' : item.tipo === 'animacao' ? 'fa-paint-brush' : 'fa-video';
  const tipoLabel = item.tipo === 'anime' ? 'Anime' : item.tipo === 'animacao' ? 'Animação' : 'Série';
  const card = document.createElement('div');
  card.className = variant ? `card card-${variant}` : 'card';
  card.dataset.index = realIndex;
  card.setAttribute('role', 'listitem');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Ver detalhes de ${item.nome}`);
  const tierStampHtml = item.tier ? `<div class="tier-stamp ${getTierClass(item.tier)}">${escapeHTML(item.tier)}</div>` : '';
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
  card.addEventListener('click', () => {
    const index = parseInt(card.dataset.index);
    openDetailModal(index);
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetailModal(parseInt(card.dataset.index));
    }
  });
  return card;
}

// ========== BUSCAR DETALHES ==========
async function fetchDetailsAndThen(nome, tmdbId = null, mediaType = null) {
  try {
    let data;
    if (tmdbId && mediaType === 'tv') {
      data = await callTMDB(`tv/${tmdbId}`, {}, 'pt-BR');
      cachedShowDetails = { totalEpisodes: data.number_of_episodes || 0, seasons: data.seasons || [] };
    } else {
      data = await callTMDB('search/multi', { query: nome }, 'pt-BR');
      const result = data.results?.[0];
      if (result && result.media_type === 'tv') {
        const tvData = await callTMDB(`tv/${result.id}`, {}, 'pt-BR');
        cachedShowDetails = { totalEpisodes: tvData.number_of_episodes || 0, seasons: tvData.seasons || [] };
      } else {
        cachedShowDetails = { totalEpisodes: 1, seasons: [{ season_number: 1, episode_count: 1 }] };
      }
    }
  } catch (e) {
    console.warn('Erro ao buscar detalhes:', e);
    cachedShowDetails = { totalEpisodes: 1, seasons: [{ season_number: 1, episode_count: 1 }] };
  }
}

async function fetchImageAndUpdate(nome, index, posterPath = null) {
  try {
    let imagem = null;
    if (posterPath) {
      imagem = `https://image.tmdb.org/t/p/w500${posterPath}`;
    } else {
      const data = await callTMDB('search/multi', { query: nome }, 'pt-BR');
      const result = data.results?.[0];
      if (result && result.poster_path) imagem = `https://image.tmdb.org/t/p/w500${result.poster_path}`;
    }
    items[index].imagem = imagem;
    if (items[index].id) await updateItemInSupabase(items[index].id, { imagem });
    render();
  } catch (e) { console.warn('Erro ao buscar imagem:', e); }
}

function clearPreview() {
  previewImg.style.display = 'none';
  previewImg.src = '';
  previewPlaceholder.style.display = 'block';
}
function setPreview(imagePath) {
  if (imagePath) {
    previewImg.src = `https://image.tmdb.org/t/p/w200${imagePath}`;
    previewImg.style.display = 'block';
    previewPlaceholder.style.display = 'none';
  } else clearPreview();
}
function setLoading(show) {
  formLoading.style.display = show ? 'flex' : 'none';
  btnSubmit.disabled = show;
  btnCancel.disabled = show;
}

// ========== FUNÇÕES DE STEPPER ==========
function updateStepperValue(btn, type) {
  const targetId = btn.dataset.target;
  const step = parseInt(btn.dataset.step);
  const hiddenInput = document.getElementById(targetId);
  const displaySpan = document.getElementById(targetId + 'Display');
  if (!hiddenInput || !displaySpan) return;
  let current = parseInt(hiddenInput.value) || 1;
  let newVal = current + step;
  const stepperType = btn.dataset.type;
  let limits;
  if (type === 'add') {
    limits = addSeasonLimits;
  } else {
    limits = detailSeasonLimits;
  }

  if (stepperType === 'temp') {
    const maxTemp = limits.maxTemp || 1;
    if (newVal < 1) newVal = 1;
    if (newVal > maxTemp) newVal = maxTemp;
    hiddenInput.value = newVal;
    displaySpan.textContent = newVal;
    updateEpisodeLimit(stepperType, newVal, limits, type);
    let epInput, epDisplay;
    if (type === 'add') {
      epInput = addEpisodioInput;
      epDisplay = addEpisodioDisplay;
    } else {
      epInput = detailEpisodioInput;
      epDisplay = detailEpisodioDisplay;
    }
    if (epInput && epDisplay) {
      epInput.value = 1;
      epDisplay.textContent = 1;
    }
  } else if (stepperType === 'ep') {
    let currentTemp;
    if (type === 'add') {
      currentTemp = parseInt(addTemporadaInput.value) || 1;
    } else {
      currentTemp = parseInt(detailTemporadaInput.value) || 1;
    }
    const maxEp = limits.maxEpByTemp?.[currentTemp] || 1;
    if (newVal < 1) newVal = 1;
    if (newVal > maxEp) newVal = maxEp;
    hiddenInput.value = newVal;
    displaySpan.textContent = newVal;
  }
}

function updateEpisodeLimit(stepperType, temp, limits, modalType) {
  const maxEp = limits.maxEpByTemp?.[temp] || 1;
  let epInput, epDisplay;
  if (modalType === 'add') {
    epInput = addEpisodioInput;
    epDisplay = addEpisodioDisplay;
  } else {
    epInput = detailEpisodioInput;
    epDisplay = detailEpisodioDisplay;
  }
  const currentEp = parseInt(epInput.value) || 1;
  if (currentEp > maxEp) {
    epInput.value = maxEp;
    epDisplay.textContent = maxEp;
  }
}

function setupSteppers(containerSelector, modalType) {
  const btns = document.querySelectorAll(containerSelector);
  btns.forEach(btn => {
    btn.removeEventListener('click', handleStepperClick);
    btn.removeEventListener('mousedown', startHold);
    btn.removeEventListener('mouseup', stopHold);
    btn.removeEventListener('mouseleave', stopHold);
    btn.removeEventListener('touchstart', startHoldTouch);
    btn.removeEventListener('touchend', stopHold);
    btn.addEventListener('click', handleStepperClick);
    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', stopHold);
    btn.addEventListener('mouseleave', stopHold);
    btn.addEventListener('touchstart', startHoldTouch);
    btn.addEventListener('touchend', stopHold);
    btn.dataset.modalType = modalType;
  });
}

function handleStepperClick(e) {
  const btn = e.currentTarget;
  const modalType = btn.dataset.modalType || 'detail';
  updateStepperValue(btn, modalType);
}

let holdTimeout = null;
let holdInterval = null;
let holdBtn = null;

function startHold(e) {
  const btn = e.currentTarget;
  startHoldTimer(btn);
}

function startHoldTouch(e) {
  const btn = e.currentTarget;
  e.preventDefault();
  startHoldTimer(btn);
}

function startHoldTimer(btn) {
  if (holdBtn === btn && (holdTimeout || holdInterval)) return;
  clearHold();
  holdBtn = btn;
  holdTimeout = setTimeout(() => {
    const modalType = btn.dataset.modalType || 'detail';
    updateStepperValue(btn, modalType);
    holdInterval = setInterval(() => {
      updateStepperValue(btn, modalType);
    }, 100);
    holdTimeout = null;
  }, 300);
}

function stopHold() {
  clearHold();
}

function clearHold() {
  if (holdTimeout) {
    clearTimeout(holdTimeout);
    holdTimeout = null;
  }
  if (holdInterval) {
    clearInterval(holdInterval);
    holdInterval = null;
  }
  holdBtn = null;
}

// ========== VALIDAÇÃO DE FORMULÁRIO ==========
function setFieldError(input, message) {
  input.classList.add('invalid');
  input.setAttribute('aria-invalid', 'true');
  const wrapper = input.closest('.form-group, .search-group, .auth-group, .info-block, .stepper');
  if (wrapper) {
    wrapper.classList.add('invalid');
    let errorEl = wrapper.querySelector('.field-error');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'field-error';
      errorEl.setAttribute('role', 'alert');
      wrapper.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }
}

function clearFieldError(input) {
  input.classList.remove('invalid');
  input.removeAttribute('aria-invalid');
  const wrapper = input.closest('.form-group, .search-group, .auth-group, .info-block, .stepper');
  if (wrapper) {
    wrapper.classList.remove('invalid');
    const errorEl = wrapper.querySelector('.field-error');
    if (errorEl) errorEl.remove();
  }
}

function clearAllFieldErrors(container) {
  container.querySelectorAll('.invalid').forEach(el => clearFieldError(el));
}

// ========== ADICIONAR/EDITAR ==========
let addItemRetryCount = 0;
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
  if (isNaN(epVal) || epVal < 1) { setFieldError(addEpisodioInput, 'Episódio inválido.'); hasError = true; }
  if (hasError) { showToast('Corrija os campos destacados.'); return; }
  const tipoVal = tipo.value;

  let totalEp = 0, seasonEpisodesMap = {};
  let ano = null;
  if (cachedShowDetails && cachedShowDetails.totalEpisodes > 0) {
    addItemRetryCount = 0;
    totalEp = cachedShowDetails.totalEpisodes;
    cachedShowDetails.seasons.forEach(s => { if (s.season_number !== 0) seasonEpisodesMap[s.season_number] = s.episode_count || 0; });
    if (cachedShowDetails.first_air_date) {
      ano = parseInt(cachedShowDetails.first_air_date.substring(0,4));
    } else if (cachedShowDetails.release_date) {
      ano = parseInt(cachedShowDetails.release_date.substring(0,4));
    }
  } else {
    if (addItemRetryCount >= 1) {
      addItemRetryCount = 0;
      showToast('Não foi possível obter o total de episódios deste título. Tente selecioná-lo novamente na busca.', 3500);
      setLoading(false);
      return;
    }
    addItemRetryCount++;
    showToast('Buscando informações da série...', 2000);
    setLoading(true);
    await fetchDetailsAndThen(nomeVal, selectedTmdbId, selectedMediaType);
    setLoading(false);
    selectedTmdbId = null; selectedMediaType = null;
    await addItem(e);
    return;
  }
  if (totalEp === 0) { showToast('Não foi possível obter o total de episódios. Tente novamente.'); return; }

  addItemInFlight = true;
  setLoading(true);

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
    addItemInFlight = false;
    setLoading(false);
    return;
  }

  try {
    if (editingIndex !== null) {
      const itemId = items[editingIndex].id;
      const updatedData = {
        nome: nomeVal, temporada: tempVal, episodio: epVal, totalEpisodios: totalEp, tipo: tipoVal,
        seasonEpisodesMap: seasonEpisodesMap, status: statusVal, tier: tierVal,
        ano: ano,
        dataCriacao: items[editingIndex].dataCriacao || new Date().toISOString()
      };
      if (items[editingIndex].nome !== nomeVal) { updatedData.imagem = null; updatedData.tmdb_id = selectedTmdbId; }
      const saved = await updateItemInSupabase(itemId, updatedData);
      items[editingIndex] = saved;
      showToast('Item atualizado!');
      editingIndex = null;
      btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar';
      modalTitle.innerHTML = '<i class="fas fa-pen"></i> Adicionar título';
      btnCancel.style.display = 'inline-flex';
      if (updatedData.imagem === null) await fetchImageAndUpdate(nomeVal, editingIndex);
    } else {
      const newItem = {
        tipo: tipoVal, nome: nomeVal, temporada: tempVal, episodio: epVal, totalEpisodios: totalEp,
        seasonEpisodesMap: seasonEpisodesMap, status: statusVal, tier: tierVal, tmdb_id: selectedTmdbId || null,
        ano: ano,
        imagem: null, dataCriacao: new Date().toISOString()
      };
      const saved = await addItemToSupabase(newItem);
      items.push(saved);
      showToast('Item adicionado!');
      await fetchImageAndUpdate(nomeVal, items.length - 1, selectedPosterPath);
    }
  } catch (error) {
    showErrorToast('Não foi possível salvar o item. Tente novamente.', error);
    addItemInFlight = false;
    setLoading(false);
    return;
  }

  render();
  closeModal();
  form.reset();
  clearPreview();
  cachedShowDetails = null;
  suggestions.classList.remove('active');
  setLoading(false);
  addItemInFlight = false;
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

// ========== MODAL DE DETALHES (simplificado) ==========
function openDetailModal(index) {
  detailCurrentIndex = index;
  const item = items[index];
  if (!item) return;

  clearAllFieldErrors(detailModal);

  detailTitle.textContent = item.nome;
  detailStatus.value = item.status || 'assistindo';
  detailTier.value = item.tier || '';
  detailTipo.value = item.tipo || 'anime';
  detailSinopse.textContent = 'Carregando sinopse...';
  detailLoading.style.display = 'flex';
  detailStartYear.textContent = '--';
  detailEndYear.textContent = '--';
  detailStatusLabel.textContent = '--';
  detailOriginalTitle.textContent = '--';

  // Mostra/oculta botão de episódios conforme tipo
  if (item.tipo === 'serie' || item.tipo === 'anime' || item.tipo === 'animacao') {
    detailEpisodesBtn.style.display = 'inline-flex';
  } else {
    detailEpisodesBtn.style.display = 'none';
  }

  // Links externos (fallback)
  const nome = item.nome;
  const wikiFallback = `https://pt.wikipedia.org/wiki/${encodeURIComponent(nome).replace(/%20/g, '_')}`;
  const imdbFallback = `https://www.imdb.com/find?q=${encodeURIComponent(nome)}`;
  detailWikiLink.href = wikiFallback;
  detailImdbLink.href = imdbFallback;

  // Configura temporada e episódio
  const seasonMap = item.seasonEpisodesMap || {};
  const tempKeys = Object.keys(seasonMap).map(Number).filter(k => k > 0);
  const maxTemp = tempKeys.length ? Math.max(...tempKeys) : 1;
  detailSeasonLimits = {
    maxTemp: maxTemp,
    maxEpByTemp: seasonMap
  };

  const tempVal = Math.min(item.temporada || 1, maxTemp);
  const maxEp = seasonMap[tempVal] || 1;
  const epVal = Math.min(item.episodio || 1, maxEp);

  detailTemporadaInput.value = tempVal;
  detailTemporadaDisplay.textContent = tempVal;
  detailEpisodioInput.value = epVal;
  detailEpisodioDisplay.textContent = epVal;
  updateEpisodeLimit('detail', tempVal, detailSeasonLimits, 'detail');

  // Configura a imagem do pôster (apenas uma)
  const imagemUrl = item.imagem || null;
  if (imagemUrl) {
    detailPosterImg.src = imagemUrl;
  } else {
    const tierColor = item.tier ? getComputedStyle(document.documentElement).getPropertyValue(`--tier-${item.tier.toLowerCase()}`).trim() || '#6b7280' : '#6b7280';
    const placeholder = `https://placehold.co/500x750/${tierColor.replace('#','')}/FFFFFF?text=${encodeURIComponent(item.nome)}`;
    detailPosterImg.src = placeholder;
  }

  updateTierBadge(item.tier);
  updateTierBlock(item.tier);

  detailModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  const modalElem = detailModal.querySelector('.modal');
  window.anime({ targets: modalElem, translateY: ['20px', '0'], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
  trapFocus(modalElem);

  // Configura o fundo borrado com a imagem do pôster
  const blurBg = document.getElementById('detailBlurBg');
  if (item.imagem) {
    blurBg.style.backgroundImage = `url(${item.imagem})`;
  } else {
    blurBg.style.backgroundImage = 'none';
  }

  fetchFullDetailsAndPopulate(item);

  setupSteppers('#detailModal .stepper-btn', 'detail');
}

function updateTierBadge(tier) {
  const badge = detailTierBadge;
  if (tier && TIER_COLORS[tier]) {
    badge.textContent = tier;
    badge.className = `tier-badge-large ${getTierClass(tier)}`;
    badge.style.display = 'flex';
    window.anime({ targets: badge, scale: [0.5, 1.2, 1], duration: 400, easing: 'easeOutQuad' });
  } else { badge.style.display = 'none'; }
}

function updateTierBlock(tier) {
  const block = detailTierBlock;
  block.className = 'info-block tier-block';
  if (tier && TIER_COLORS[tier]) {
    block.classList.add(getTierClass(tier));
  }
}

async function fetchFullDetailsAndPopulate(item) {
  try {
    let tmdbId = item.tmdb_id;
    let mediaType = 'tv';
    let detailsData = null;

    if (!tmdbId) {
      const searchData = await callTMDB('search/multi', { query: item.nome }, 'pt-BR');
      const result = searchData.results?.[0];
      if (result) {
        tmdbId = result.id;
        mediaType = result.media_type || 'tv';
        if (!item.tmdb_id) {
          item.tmdb_id = tmdbId;
          await updateItemInSupabase(item.id, { tmdb_id: tmdbId });
        }
      }
    }

    if (tmdbId) {
      if (mediaType === 'tv' || !mediaType) {
        detailsData = await callTMDB(`tv/${tmdbId}`, {}, 'pt-BR');
      } else if (mediaType === 'movie') {
        detailsData = await callTMDB(`movie/${tmdbId}`, {}, 'pt-BR');
      }
    }

    let overview = detailsData?.overview || 'Sinopse não disponível.';

    if (detailsData) {
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
    }

    detailSinopse.textContent = overview;
    detailLoading.style.display = 'none';
  } catch (e) {
    console.warn('Erro ao buscar detalhes:', e);
    detailSinopse.textContent = 'Erro ao carregar sinopse.';
    detailLoading.style.display = 'none';
  }
}

// ========== MODAL DE EPISÓDIOS ==========
async function openEpisodesModal(index) {
  const item = items[index];
  if (!item) return;
  if (item.tipo !== 'serie' && item.tipo !== 'anime' && item.tipo !== 'animacao') {
    showToast('Episódios disponíveis apenas para séries, animes e animações.', 2000);
    return;
  }

  episodesTitle.textContent = `Episódios - ${item.nome}`;
  episodesLoading.style.display = 'flex';
  episodesContent.style.display = 'none';
  episodesContent.innerHTML = '';
  episodesModal.classList.add('active');
  document.body.style.overflow = 'hidden';

  const modalElem = episodesModal.querySelector('.modal');
  window.anime({ targets: modalElem, translateY: ['20px', '0'], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
  trapFocus(modalElem);

  try {
    let tmdbId = item.tmdb_id;
    if (!tmdbId) {
      const searchData = await callTMDB('search/multi', { query: item.nome }, 'pt-BR');
      const result = searchData.results?.[0];
      if (result && (result.media_type === 'tv' || result.media_type === 'movie')) {
        tmdbId = result.id;
        item.tmdb_id = tmdbId;
        await updateItemInSupabase(item.id, { tmdb_id: tmdbId });
      } else {
        throw new Error('Não foi possível encontrar este título no TMDB.');
      }
    }

    const seriesDetails = await callTMDB(`tv/${tmdbId}`, {}, 'pt-BR');
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

    let html = '';
    seasonsData.forEach((seasonData, idx) => {
      const seasonNum = seasons[idx].season_number;
      const seasonName = seasons[idx].name || `${seasonNum}ª Temporada`;
      const episodeCount = seasonData.episodes ? seasonData.episodes.length : 0;
      
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
          const epNum = ep.episode_number;
          const epTitle = ep.name || `Episódio ${epNum}`;
          const epAirDate = ep.air_date ? formatDateBR(ep.air_date) : 'Data desconhecida';
          const epOverview = ep.overview || 'Sinopse não disponível.';
          const thumbUrl = ep.still_path ? `https://image.tmdb.org/t/p/w92${ep.still_path}` : null;
          
          html += `<div class="episode-item">`;
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
    showToast('Erro ao carregar episódios.', 3000);
  }
}

function closeEpisodesModal() {
  episodesModal.classList.remove('active');
  if (!detailModal.classList.contains('active')) {
    document.body.style.overflow = '';
  }
  episodesContent.innerHTML = '';
  episodesContent.style.display = 'none';
  episodesLoading.style.display = 'flex';
  releaseFocusTrap();
}

episodesClose.addEventListener('click', closeEpisodesModal);
episodesModal.addEventListener('click', (e) => {
  if (e.target === episodesModal) closeEpisodesModal();
});

// ========== SALVAR ALTERAÇÕES ==========
async function saveDetailChanges() {
  const index = detailCurrentIndex;
  if (index === null) return;
  const item = items[index];
  const newTemporada = parseInt(detailTemporadaInput.value);
  const newEpisodio = parseInt(detailEpisodioInput.value);
  const newStatus = detailStatus.value;
  const newTier = detailTier.value || null;
  const newTipo = detailTipo.value;

  clearAllFieldErrors(detailModal);

  const maxTemp = detailSeasonLimits.maxTemp || 1;
  const maxEp = detailSeasonLimits.maxEpByTemp?.[newTemporada] || 1;
  let hasError = false;
  if (newTemporada < 1 || newTemporada > maxTemp) {
    setFieldError(detailTemporadaInput, `Temporada deve estar entre 1 e ${maxTemp}.`);
    hasError = true;
  }
  if (newEpisodio < 1 || newEpisodio > maxEp) {
    setFieldError(detailEpisodioInput, `Episódio deve estar entre 1 e ${maxEp} para a temporada ${newTemporada}.`);
    hasError = true;
  }
  if (hasError) { showToast('Corrija os campos destacados.', 2500); return; }

  try {
    const updates = { temporada: newTemporada, episodio: newEpisodio, status: newStatus, tier: newTier, tipo: newTipo };
    const saved = await updateItemInSupabase(item.id, updates);
    items[index] = saved;
    render();
    showToast('Alterações salvas!', 2000);
    closeDetailModal();
  } catch (error) { showErrorToast('Não foi possível salvar as alterações.', error); }
}

async function deleteFromDetail() {
  const index = detailCurrentIndex;
  if (index === null) return;
  if (!confirm('Tem certeza que deseja remover este título?')) return;
  const item = items[index];
  try {
    await deleteItemFromSupabase(item.id);
    items.splice(index, 1);
    render();
    showToast('Item removido.', 2000);
    closeDetailModal();
  } catch (error) { showErrorToast('Não foi possível remover o item.', error); }
}

function closeDetailModal() {
  detailModal.classList.remove('active');
  if (!episodesModal.classList.contains('active')) {
    document.body.style.overflow = '';
  }
  detailCurrentIndex = null;
  detailSeasonLimits = {};
  clearHold();
  releaseFocusTrap();
  detailOriginalTitle.textContent = '--';
}

// ========== EVENTOS ==========
detailTier.addEventListener('change', function() {
  const tier = this.value;
  updateTierBadge(tier);
  updateTierBlock(tier);
});

detailClose.addEventListener('click', closeDetailModal);
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeDetailModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (episodesModal.classList.contains('active')) closeEpisodesModal();
    else if (detailModal.classList.contains('active')) closeDetailModal();
    else if (modalOverlay.classList.contains('active')) { cancelEdit(); closeModal(); }
  }
});
detailSave.addEventListener('click', saveDetailChanges);
detailDelete.addEventListener('click', deleteFromDetail);

// Botão Episódios
detailEpisodesBtn.addEventListener('click', () => {
  if (detailCurrentIndex !== null) {
    openEpisodesModal(detailCurrentIndex);
  }
});

// ========== SUGESTÕES ==========
let suggestionTimeout = null;
nome.addEventListener('input', () => {
  clearTimeout(suggestionTimeout);
  const q = nome.value.trim();
  if (q.length < 2) { suggestions.classList.remove('active'); clearPreview(); return; }
  suggestionTimeout = setTimeout(async () => {
    try {
      const data = await callTMDB('search/multi', { query: q }, 'pt-BR');
      suggestions.innerHTML = '';
      data.results?.forEach(res => {
        const name = res.name || res.title;
        if (!name) return;
        const year = res.release_date ? res.release_date.substring(0,4) : (res.first_air_date ? res.first_air_date.substring(0,4) : '');
        const mediaType = res.media_type === 'tv' ? 'Série' : res.media_type === 'movie' ? 'Filme' : 'Outro';
        const poster = res.poster_path ? `https://image.tmdb.org/t/p/w92${res.poster_path}` : '';
        const safePoster = escapeHTML(poster);
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.setAttribute('role', 'option');
        div.setAttribute('tabindex', '0');
        div.dataset.id = res.id;
        div.dataset.mediaType = res.media_type;
        div.dataset.poster = res.poster_path || '';
        const safeName = escapeHTML(name);
        div.innerHTML = `
          <img src="${safePoster || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'60\' viewBox=\'0 0 40 60\'%3E%3Crect fill=\'%23242427\' width=\'40\' height=\'60\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%236b7280\' font-size=\'10\' font-family=\'Inter\'%3E?%3C/text%3E%3C/svg%3E'}" alt="${safeName}" />
          <div class="info">
            <div class="title">${safeName}</div>
            <div class="sub">
              <span class="year">${year || '--'}</span>
              <span class="type">${mediaType}</span>
            </div>
          </div>
        `;
        function selectThisSuggestion() {
          nome.value = name;
          suggestions.classList.remove('active');
          selectedTmdbId = div.dataset.id;
          selectedMediaType = div.dataset.mediaType;
          selectedPosterPath = div.dataset.poster;
          if (div.dataset.poster) setPreview(div.dataset.poster); else clearPreview();
          setLoading(true);
          if (div.dataset.mediaType === 'tv') {
            const tvId = div.dataset.id;
            callTMDB(`tv/${tvId}`, {}, 'pt-BR').then(details => {
              cachedShowDetails = { totalEpisodes: details.number_of_episodes || 0, seasons: details.seasons || [] };
              if (details.first_air_date) {
                selectedAno = parseInt(details.first_air_date.substring(0,4));
              } else if (details.release_date) {
                selectedAno = parseInt(details.release_date.substring(0,4));
              }
              const seasonMap = {};
              details.seasons.forEach(s => { if (s.season_number !== 0) seasonMap[s.season_number] = s.episode_count || 0; });
              const tempKeys = Object.keys(seasonMap).map(Number).filter(k => k > 0);
              const maxTemp = tempKeys.length ? Math.max(...tempKeys) : 1;
              addSeasonLimits = { maxTemp, maxEpByTemp: seasonMap };
              addTemporadaInput.value = 1;
              addTemporadaDisplay.textContent = 1;
              addEpisodioInput.value = 1;
              addEpisodioDisplay.textContent = 1;
              showToast(`Total de episódios: ${cachedShowDetails.totalEpisodes}`, 2000);
              setLoading(false);
            }).catch(() => { showToast('Não foi possível buscar detalhes.', 2000); setLoading(false); });
          } else {
            cachedShowDetails = { totalEpisodes: 1, seasons: [{ season_number: 1, episode_count: 1 }] };
            selectedAno = parseInt(year) || null;
            addSeasonLimits = { maxTemp: 1, maxEpByTemp: {1: 1} };
            addTemporadaInput.value = 1;
            addTemporadaDisplay.textContent = 1;
            addEpisodioInput.value = 1;
            addEpisodioDisplay.textContent = 1;
            showToast('Filme único (1 episódio)', 1500);
            setLoading(false);
          }
          setupSteppers('#modalOverlay .stepper-btn', 'add');
        }
        div.addEventListener('click', selectThisSuggestion);
        div.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectThisSuggestion(); }
        });
        suggestions.appendChild(div);
      });
      suggestions.classList.add('active');
    } catch (e) { console.warn('Erro ao buscar sugestões:', e); }
  }, 300);
});
document.addEventListener('click', (e) => { if (!e.target.closest('.form-group')) suggestions.classList.remove('active'); });

// ========== BOTÃO CONCLUÍDO ==========
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

// ========== NAVEGAÇÃO ==========
document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const tab = item.dataset.tab;
    if (tab) { currentTab = tab; render(); }
  });
});

openFormBtn.addEventListener('click', () => {
  if (editingIndex !== null) cancelEdit();
  clearAllFieldErrors(form);
  clearPreview();
  cachedShowDetails = null;
  statusSelect.value = 'assistindo';
  tierForm.value = '';
  selectedTmdbId = null;
  selectedMediaType = null;
  selectedPosterPath = null;
  selectedAno = null;
  addTemporadaInput.value = 1;
  addTemporadaDisplay.textContent = 1;
  addEpisodioInput.value = 1;
  addEpisodioDisplay.textContent = 1;
  addSeasonLimits = {};
  setupSteppers('#modalOverlay .stepper-btn', 'add');
  openModal();
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

densitySelect.value = gridDensity;
densitySelect.addEventListener('change', function() {
  gridDensity = parseInt(this.value);
  localStorage.setItem('gridDensity', gridDensity);
  render();
});
groupToggle.innerHTML = groupingActive ? '<i class="fas fa-layer-group" style="color: var(--accent);"></i>' : '<i class="fas fa-layer-group"></i>';
groupToggle.addEventListener('click', () => {
  groupingActive = !groupingActive;
  localStorage.setItem('groupingActive', groupingActive);
  groupToggle.innerHTML = groupingActive ? '<i class="fas fa-layer-group" style="color: var(--accent);"></i>' : '<i class="fas fa-layer-group"></i>';
  render();
});

function openModal() {
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  lastFocusedBeforeModal = document.activeElement;
  trapFocus(modalOverlay.querySelector('.modal'));
  setTimeout(() => nome.focus(), 100);
}
function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  releaseFocusTrap();
}
function cancelEdit() {
  editingIndex = null;
  btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar';
  modalTitle.innerHTML = '<i class="fas fa-pen"></i> Adicionar título';
  btnCancel.style.display = 'inline-flex';
  clearAllFieldErrors(form);
  form.reset();
  clearPreview();
  cachedShowDetails = null;
  suggestions.classList.remove('active');
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

form.addEventListener('submit', addItem);
btnCancel.addEventListener('click', cancelEdit);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  const icon = themeToggle.querySelector('i');
  icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
});
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
const icon = themeToggle.querySelector('i');
icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';