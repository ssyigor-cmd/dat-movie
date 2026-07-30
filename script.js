import { supabase } from './src/lib/supabase.js';

// ========== ELEMENTOS DOM ==========
const $ = (id) => document.getElementById(id);
const authContainer = $('authContainer');
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
const totalCount = $('totalCount');
const animeCount = $('animeCount');
const animacaoCount = $('animacaoCount');
const serieCount = $('serieCount');
const themeToggle = $('themeToggle');
const openFormBtn = $('openFormBtn');
const modalOverlay = $('modalOverlay');
const modalClose = $('modalClose');
const modalTitle = $('modalTitle');
const form = $('form');
const tipo = $('tipo');
const nome = $('nome');
const temporada = $('temporada');
const episodio = $('episodio');
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

// DETAIL MODAL
const detailModal = $('detailModal');
const detailClose = $('detailClose');
const detailTitle = $('detailTitle');
const detailSinopse = $('detailSinopse');
const detailLoading = $('detailLoading');
const detailTemporada = $('detailTemporada');
const detailEpisodio = $('detailEpisodio');
const detailStatus = $('detailStatus');
const detailTier = $('detailTier');
const detailTipo = $('detailTipo');
const detailTierBadge = $('detailTierBadge');
const detailSave = $('detailSave');
const detailDelete = $('detailDelete');
const detailPosterImg = $('detailPosterImg');
const detailBackdropBlur = $('detailBackdropBlur');
const detailStartYear = $('detailStartYear');
const detailEndYear = $('detailEndYear');
const detailStatusLabel = $('detailStatusLabel');

// ========== ESTADO GLOBAL ==========
let items = [];
let editingIndex = null;
let currentTab = 'anime';
let cachedShowDetails = null;
let selectedTmdbId = null;
let selectedMediaType = null;
let selectedPosterPath = null;
let selectedAno = null; // para desambiguação
let gridDensity = parseInt(localStorage.getItem('gridDensity')) || 8;
let groupingActive = localStorage.getItem('groupingActive') === 'true' || false;
let detailCurrentIndex = null;
let detailCachedShowDetails = null;

const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C', 'D'];
const TIER_COLORS = {
  'S+': 'tier-Splus',
  'S': 'tier-S',
  'A': 'tier-A',
  'B': 'tier-B',
  'C': 'tier-C',
  'D': 'tier-D'
};

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
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    setAuthUI(false);
    console.log('Usuário logado:', session.user.email);
    await loadItems();
  } else {
    setAuthUI(true);
  }
}

authLoginBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();
  if (!email || !password) { authMessage.textContent = 'Preencha email e senha.'; return; }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { authMessage.textContent = 'Erro: ' + error.message; } else { authMessage.textContent = 'Login realizado!'; await checkSession(); }
});

authSignupBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();
  if (!email || !password) { authMessage.textContent = 'Preencha email e senha.'; return; }
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) { authMessage.textContent = 'Erro: ' + error.message; } else { authMessage.textContent = 'Cadastro enviado! Confirme seu email (se ativado) ou faça login.'; }
});

const logoutBtn = document.createElement('button');
logoutBtn.className = 'nav-item';
logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Sair</span>';
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  await checkSession();
});
document.querySelector('.sidebar-footer').appendChild(logoutBtn);

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
    ano: item.ano || null // campo para desambiguação
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

// ========== POPULAR EPISÓDIOS (SELECT) ==========
function populateEpisodeSelect(seasonNumber, targetSelect) {
  targetSelect.innerHTML = '';
  if (!cachedShowDetails) return;
  const season = cachedShowDetails.seasons.find(s => s.season_number === seasonNumber);
  if (!season) {
    const opt = document.createElement('option');
    opt.value = 1;
    opt.textContent = '1';
    targetSelect.appendChild(opt);
    return;
  }
  const totalEp = season.episode_count || 1;
  for (let i = 1; i <= totalEp; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    targetSelect.appendChild(opt);
  }
}

// ========== RENDER ==========
function render() {
  const tab = currentTab;
  const search = searchInput.value.toLowerCase().trim();
  const statusFilter = filterStatus.value;
  const tierFilter = filterTier.value;
  const sortKey = sortOrder.value;

  let filtered = items.slice();
  if (tab !== 'all') filtered = filtered.filter(item => item.tipo === tab);
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

  totalCount.textContent = items.length;
  animeCount.textContent = items.filter(i => i.tipo === 'anime').length;
  animacaoCount.textContent = items.filter(i => i.tipo === 'animacao').length;
  serieCount.textContent = items.filter(i => i.tipo === 'serie').length;

  grid.innerHTML = '';
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum título encontrado</p></div>`;
    grid.className = `grid grid-cols-${gridDensity}`;
    return;
  }
  grid.className = `grid grid-cols-${gridDensity}`;
  const fragment = document.createDocumentFragment();

  if (groupingActive) {
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
      header.innerHTML = `<h3>${tier || 'Sem tier'}</h3><span class="group-count">${itemsInTier.length}</span>`;
      fragment.appendChild(header);
      itemsInTier.forEach((item) => fragment.appendChild(createCardElement(item)));
    }
  } else {
    filtered.forEach((item) => fragment.appendChild(createCardElement(item)));
  }
  grid.appendChild(fragment);
}

// ========== CRIAR CARD ==========
function createCardElement(item) {
  const realIndex = items.indexOf(item);
  const progress = calcularProgresso(item);
  const icon = item.tipo === 'anime' ? 'fa-tv' : item.tipo === 'animacao' ? 'fa-paint-brush' : 'fa-video';
  const tipoLabel = item.tipo === 'anime' ? 'Anime' : item.tipo === 'animacao' ? 'Animação' : 'Série';
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.index = realIndex;
  const tierBadgeHtml = item.tier ? `<div class="card-tier-badge ${getTierClass(item.tier)}">${item.tier}</div>` : '';
  const anoDisplay = item.ano ? ` (${item.ano})` : '';
  card.innerHTML = `
    <div class="card-img" data-index="${realIndex}">
      ${item.imagem ? `<img src="${item.imagem}" alt="${item.nome}" loading="lazy" />` : `<i class="fas ${icon}" style="font-size:1.8rem; opacity:0.3;"></i>`}
      ${tierBadgeHtml}
    </div>
    <div class="card-body">
      <span class="badge">${tipoLabel}</span>
      <h3 title="${item.nome}${anoDisplay}">${item.nome}${anoDisplay}</h3>
      <div class="info"><span>T${item.temporada} • Ep ${item.episodio}/${item.totalEpisodios}</span><span>${progress}%</span></div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${progress}%;"></div></div>
    </div>
  `;
  card.querySelector('.card-img').addEventListener('click', () => {
    const index = parseInt(card.dataset.index);
    openDetailModal(index);
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

function populateSeasons(seasons) {
  temporada.innerHTML = '<option value="">Selecione</option>';
  seasons.forEach(s => {
    if (s.season_number === 0) return;
    const opt = document.createElement('option');
    opt.value = s.season_number;
    opt.textContent = `Temporada ${s.season_number}`;
    temporada.appendChild(opt);
  });
  const firstSeason = seasons.find(s => s.season_number !== 0);
  if (firstSeason) { temporada.value = firstSeason.season_number; }
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

// ========== ADICIONAR/EDITAR ==========
async function addItem(e) {
  e.preventDefault();
  const nomeVal = nome.value.trim();
  const tempVal = parseInt(temporada.value);
  const epVal = parseInt(episodio.value);
  const statusVal = statusSelect.value;
  const tierVal = tierForm.value || null;

  if (!nomeVal) { showToast('Digite o nome.'); return; }
  if (isNaN(tempVal) || tempVal < 1) { showToast('Selecione uma temporada válida.'); return; }
  if (isNaN(epVal) || epVal < 1) { showToast('Selecione um episódio válido.'); return; }
  const tipoVal = tipo.value;

  let totalEp = 0, seasonEpisodesMap = {};
  let ano = null;
  if (cachedShowDetails && cachedShowDetails.totalEpisodes > 0) {
    totalEp = cachedShowDetails.totalEpisodes;
    cachedShowDetails.seasons.forEach(s => { if (s.season_number !== 0) seasonEpisodesMap[s.season_number] = s.episode_count || 0; });
    // Extrair ano (para desambiguação)
    if (cachedShowDetails.first_air_date) {
      ano = parseInt(cachedShowDetails.first_air_date.substring(0,4));
    } else if (cachedShowDetails.release_date) {
      ano = parseInt(cachedShowDetails.release_date.substring(0,4));
    }
  } else {
    showToast('Buscando informações da série...', 2000);
    setLoading(true);
    await fetchDetailsAndThen(nomeVal, selectedTmdbId, selectedMediaType);
    setLoading(false);
    selectedTmdbId = null; selectedMediaType = null;
    await addItem(e);
    return;
  }
  if (totalEp === 0) { showToast('Não foi possível obter o total de episódios. Tente novamente.'); return; }

  // Verificação de duplicata: usa tmdb_id se disponível, senão fallback para nome+tipo+ano
  const duplicate = items.some((it, i) => {
    if (i === editingIndex) return false;
    const sameName = it.nome.toLowerCase() === nomeVal.toLowerCase();
    const sameType = it.tipo === tipoVal;
    // Se ambos têm tmdb_id, compara por ID
    if (it.tmdb_id && selectedTmdbId) {
      return sameName && sameType && it.tmdb_id === selectedTmdbId;
    }
    // Fallback: usa nome+tipo+ano (se ano disponível)
    if (it.ano && ano) {
      return sameName && sameType && it.ano === ano;
    }
    // Último fallback: apenas nome+tipo (comportamento antigo)
    return sameName && sameType;
  });
  if (duplicate) { showToast('Este título já existe no seu catálogo.'); return; }

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
  } catch (error) { showToast('Erro: ' + error.message, 3000); console.error(error); return; }

  render();
  closeModal();
  form.reset();
  temporada.value = '';
  episodio.innerHTML = '';
  clearPreview();
  cachedShowDetails = null;
  suggestions.classList.remove('active');
  setLoading(false);
  selectedTmdbId = null;
  selectedMediaType = null;
  selectedPosterPath = null;
  selectedAno = null;
}

// ========== MODAL DE DETALHES ==========
function openDetailModal(index) {
  detailCurrentIndex = index;
  const item = items[index];
  if (!item) return;

  detailTitle.textContent = item.nome;
  detailStatus.value = item.status || 'assistindo';
  detailTier.value = item.tier || '';
  detailTipo.value = item.tipo || 'anime';
  detailSinopse.textContent = 'Carregando sinopse...';
  detailLoading.style.display = 'flex';
  detailStartYear.textContent = '--';
  detailEndYear.textContent = '--';
  detailStatusLabel.textContent = '--';

  const imagemUrl = item.imagem || null;
  if (imagemUrl) {
    detailPosterImg.src = imagemUrl;
    detailBackdropBlur.style.backgroundImage = `url(${imagemUrl})`;
  } else {
    const tierColor = item.tier ? getComputedStyle(document.documentElement).getPropertyValue(`--tier-${item.tier.toLowerCase()}`).trim() || '#6b7280' : '#6b7280';
    const placeholder = `https://placehold.co/500x750/${tierColor.replace('#','')}/FFFFFF?text=${encodeURIComponent(item.nome)}`;
    detailPosterImg.src = placeholder;
    detailBackdropBlur.style.backgroundImage = `url(${placeholder})`;
  }

  detailPosterImg.onload = function() {
    const img = this;
    requestAnimationFrame(() => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      if (naturalWidth === 0 || naturalHeight === 0) return;
      const aspectRatio = naturalWidth / naturalHeight;
      const mediaContainer = img.closest('.detail-media');
      if (!mediaContainer) return;
      const containerWidth = mediaContainer.getBoundingClientRect().width;
      const columnWidth = containerWidth / 2;
      const idealHeight = columnWidth / aspectRatio;
      mediaContainer.style.height = `${Math.min(idealHeight, window.innerHeight * 0.7)}px`;
    });
  };
  if (detailPosterImg.complete) {
    detailPosterImg.onload?.();
  }

  updateTierBadge(item.tier);
  detailModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  const modalElem = detailModal.querySelector('.modal');
  window.anime({ targets: modalElem, translateY: ['20px', '0'], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });

  fetchFullDetailsAndPopulate(item);
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

async function fetchFullDetailsAndPopulate(item) {
  try {
    let tmdbId = item.tmdb_id;
    let mediaType = 'tv';
    let detailsData = null;
    let imagesData = null;

    if (!tmdbId) {
      const searchData = await callTMDB('search/multi', { query: item.nome }, 'pt-BR');
      const result = searchData.results?.[0];
      if (result) {
        tmdbId = result.id;
        mediaType = result.media_type || 'tv';
      }
    }

    if (tmdbId) {
      if (mediaType === 'tv' || !mediaType) {
        [detailsData, imagesData] = await Promise.all([
          callTMDB(`tv/${tmdbId}`, {}, 'pt-BR'),
          callTMDB(`tv/${tmdbId}/images`, {}, 'pt-BR')
        ]);
      } else if (mediaType === 'movie') {
        [detailsData, imagesData] = await Promise.all([
          callTMDB(`movie/${tmdbId}`, {}, 'pt-BR'),
          callTMDB(`movie/${tmdbId}/images`, {}, 'pt-BR')
        ]);
      }
    }

    // Sinopse e imagem
    let overview = detailsData?.overview || 'Sinopse não disponível.';
    if (imagesData && imagesData.posters && imagesData.posters.length > 0) {
      const poster = imagesData.posters.reduce((a, b) => (a.vote_count || 0) > (b.vote_count || 0) ? a : b);
      const posterUrl = `https://image.tmdb.org/t/p/w500${poster.file_path}`;
      if (!item.imagem) {
        item.imagem = posterUrl;
        if (item.id) await updateItemInSupabase(item.id, { imagem: posterUrl });
        detailPosterImg.src = posterUrl;
        detailBackdropBlur.style.backgroundImage = `url(${posterUrl})`;
        detailPosterImg.onload?.();
      }
    }

    // Metadados (anos e status traduzido)
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
      // Se a série não estiver finalizada, 'end' permanece '--'

      detailStartYear.textContent = start;
      detailEndYear.textContent = end;

      // Tradução dos status
      const statusMap = {
        'Returning Series': 'Em exibição',
        'Ended': 'Finalizada',
        'In Production': 'Em produção',
        'Planned': 'Planejada',
        'Canceled': 'Cancelada'
      };
      detailStatusLabel.textContent = statusMap[detailsData.status] || detailsData.status || '--';
    }

    // Preencher selects de temporada e episódio
    if (detailsData && detailsData.seasons) {
      detailCachedShowDetails = { seasons: detailsData.seasons };
      populateDetailSeasonsAndEpisodes(item);
    } else {
      detailTemporada.innerHTML = `<option value="${item.temporada}">Temporada ${item.temporada}</option>`;
      const epOpt = document.createElement('option');
      epOpt.value = item.episodio;
      epOpt.textContent = item.episodio;
      detailEpisodio.innerHTML = '';
      detailEpisodio.appendChild(epOpt);
    }

    detailSinopse.textContent = overview;
    detailLoading.style.display = 'none';
  } catch (e) {
    console.warn('Erro ao buscar detalhes completos:', e);
    detailSinopse.textContent = 'Erro ao carregar sinopse.';
    detailLoading.style.display = 'none';
    detailTemporada.innerHTML = `<option value="${item.temporada}">Temporada ${item.temporada}</option>`;
    const epOpt = document.createElement('option');
    epOpt.value = item.episodio;
    epOpt.textContent = item.episodio;
    detailEpisodio.innerHTML = '';
    detailEpisodio.appendChild(epOpt);
  }
}

function populateDetailSeasonsAndEpisodes(item) {
  const seasons = detailCachedShowDetails.seasons || [];
  const seasonSelect = detailTemporada;
  const episodeSelect = detailEpisodio;

  seasonSelect.innerHTML = '';
  seasons.forEach(s => {
    if (s.season_number === 0) return;
    const opt = document.createElement('option');
    opt.value = s.season_number;
    opt.textContent = `Temporada ${s.season_number}`;
    seasonSelect.appendChild(opt);
  });

  if (item.temporada && seasonSelect.querySelector(`option[value="${item.temporada}"]`)) {
    seasonSelect.value = item.temporada;
  } else if (seasonSelect.options.length > 0) {
    seasonSelect.selectedIndex = 0;
  }

  const currentSeason = parseInt(seasonSelect.value) || 1;
  populateDetailEpisodeSelect(currentSeason, item.episodio);

  seasonSelect.addEventListener('change', function() {
    const val = parseInt(this.value);
    if (val) populateDetailEpisodeSelect(val);
  });
}

function populateDetailEpisodeSelect(seasonNumber, currentEp) {
  const targetSelect = detailEpisodio;
  targetSelect.innerHTML = '';
  const seasons = detailCachedShowDetails.seasons || [];
  const season = seasons.find(s => s.season_number === seasonNumber);
  if (!season) {
    const opt = document.createElement('option');
    opt.value = 1;
    opt.textContent = '1';
    targetSelect.appendChild(opt);
    return;
  }
  const totalEp = season.episode_count || 1;
  for (let i = 1; i <= totalEp; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    targetSelect.appendChild(opt);
  }
  if (currentEp && targetSelect.querySelector(`option[value="${currentEp}"]`)) {
    targetSelect.value = currentEp;
  }
}

// ========== SALVAR ALTERAÇÕES NO MODAL DE DETALHES ==========
async function saveDetailChanges() {
  const index = detailCurrentIndex;
  if (index === null) return;
  const item = items[index];
  const newTemporada = parseInt(detailTemporada.value);
  const newEpisodio = parseInt(detailEpisodio.value);
  const newStatus = detailStatus.value;
  const newTier = detailTier.value || null;
  const newTipo = detailTipo.value;

  if (isNaN(newTemporada) || newTemporada < 1) { showToast('Selecione uma temporada válida.', 2000); return; }
  if (isNaN(newEpisodio) || newEpisodio < 1) { showToast('Selecione um episódio válido.', 2000); return; }

  try {
    const updates = { temporada: newTemporada, episodio: newEpisodio, status: newStatus, tier: newTier, tipo: newTipo };
    const saved = await updateItemInSupabase(item.id, updates);
    items[index] = saved;
    render();
    showToast('Alterações salvas!', 2000);
    closeDetailModal();
  } catch (error) { showToast('Erro ao salvar: ' + error.message, 3000); }
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
  } catch (error) { showToast('Erro ao remover: ' + error.message, 3000); }
}

function closeDetailModal() {
  detailModal.classList.remove('active');
  document.body.style.overflow = '';
  detailCurrentIndex = null;
  detailCachedShowDetails = null;
}

// ========== ANIMAÇÕES NOS SELECTS ==========
document.querySelectorAll('.detail-form select, .detail-form input').forEach(el => {
  el.addEventListener('focus', () => { window.anime({ targets: el, scale: 1.02, duration: 200, easing: 'easeOutQuad' }); });
  el.addEventListener('blur', () => { window.anime({ targets: el, scale: 1, duration: 200, easing: 'easeOutQuad' }); });
});
detailTier.addEventListener('change', function() { updateTierBadge(this.value); });

// ========== SUGESTÕES RICAS ==========
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
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.dataset.id = res.id;
        div.dataset.mediaType = res.media_type;
        div.dataset.poster = res.poster_path || '';
        div.innerHTML = `
          <img src="${poster || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'60\' viewBox=\'0 0 40 60\'%3E%3Crect fill=\'%23242427\' width=\'40\' height=\'60\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%236b7280\' font-size=\'10\' font-family=\'Inter\'%3E?%3C/text%3E%3C/svg%3E'}" alt="${name}" />
          <div class="info">
            <div class="title">${name}</div>
            <div class="sub">
              <span class="year">${year || '--'}</span>
              <span class="type">${mediaType}</span>
            </div>
          </div>
        `;
        div.addEventListener('click', () => {
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
              // Extrair ano para desambiguação
              if (details.first_air_date) {
                selectedAno = parseInt(details.first_air_date.substring(0,4));
              } else if (details.release_date) {
                selectedAno = parseInt(details.release_date.substring(0,4));
              }
              populateSeasons(cachedShowDetails.seasons);
              if (temporada.value) {
                const seasonNum = parseInt(temporada.value);
                populateEpisodeSelect(seasonNum, episodio);
              }
              showToast(`Total de episódios: ${cachedShowDetails.totalEpisodes}`, 2000);
              setLoading(false);
            }).catch(() => { showToast('Não foi possível buscar detalhes.', 2000); setLoading(false); });
          } else {
            cachedShowDetails = { totalEpisodes: 1, seasons: [{ season_number: 1, episode_count: 1 }] };
            selectedAno = parseInt(year) || null;
            populateSeasons(cachedShowDetails.seasons);
            temporada.value = 1;
            populateEpisodeSelect(1, episodio);
            showToast('Filme único (1 episódio)', 1500);
            setLoading(false);
          }
        });
        suggestions.appendChild(div);
      });
      suggestions.classList.add('active');
    } catch (e) { console.warn('Erro ao buscar sugestões:', e); }
  }, 300);
});
document.addEventListener('click', (e) => { if (!e.target.closest('.form-group')) suggestions.classList.remove('active'); });

// ========== EVENTO MUDANÇA DE TEMPORADA (ADIÇÃO) ==========
temporada.addEventListener('change', function() {
  const val = parseInt(this.value);
  if (val && cachedShowDetails) {
    populateEpisodeSelect(val, episodio);
  } else {
    episodio.innerHTML = '';
  }
});

// ========== BOTÃO CONCLUÍDO ==========
document.getElementById('btnConcluido').addEventListener('click', async function() {
  const nomeVal = nome.value.trim();
  if (!nomeVal) { showToast('Digite o nome do título primeiro.', 3000); return; }
  if (!cachedShowDetails || !cachedShowDetails.seasons) {
    setLoading(true);
    try {
      await fetchDetailsAndThen(nomeVal, selectedTmdbId, selectedMediaType);
      if (cachedShowDetails && cachedShowDetails.seasons) {
        populateSeasons(cachedShowDetails.seasons);
        const firstSeason = cachedShowDetails.seasons.find(s => s.season_number !== 0);
        if (firstSeason) {
          temporada.value = firstSeason.season_number;
          populateEpisodeSelect(firstSeason.season_number, episodio);
        }
      }
    } catch (e) { showToast('Erro ao buscar detalhes. Tente novamente.', 3000); setLoading(false); return; }
    setLoading(false);
  }
  const seasons = cachedShowDetails.seasons.filter(s => s.season_number !== 0);
  if (seasons.length === 0) { showToast('Nenhuma temporada encontrada.', 3000); return; }
  const lastSeason = seasons.reduce((a, b) => a.season_number > b.season_number ? a : b);
  const lastSeasonNumber = lastSeason.season_number;
  const lastEpisodeCount = lastSeason.episode_count || 0;
  if (lastEpisodeCount === 0) { showToast('Não foi possível determinar o número de episódios.', 3000); return; }
  temporada.value = lastSeasonNumber;
  populateEpisodeSelect(lastSeasonNumber, episodio);
  episodio.value = lastEpisodeCount;
  statusSelect.value = 'concluido';
  btnSubmit.focus();
  showToast(`Concluído! T${lastSeasonNumber} • Ep ${lastEpisodeCount}`, 2500);
});

// ========== NAVEGAÇÃO ==========
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const tab = item.dataset.tab;
    if (tab) { currentTab = tab; render(); }
  });
});

// ========== TOOLBAR ==========
openFormBtn.addEventListener('click', () => {
  if (editingIndex !== null) cancelEdit();
  clearPreview();
  cachedShowDetails = null;
  temporada.innerHTML = '<option value="">Selecione</option>';
  episodio.innerHTML = '';
  statusSelect.value = 'assistindo';
  tierForm.value = '';
  selectedTmdbId = null;
  selectedMediaType = null;
  selectedPosterPath = null;
  selectedAno = null;
  openModal();
});
modalClose.addEventListener('click', () => { cancelEdit(); closeModal(); });
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) { cancelEdit(); closeModal(); } });
searchInput.addEventListener('input', render);
filterStatus.addEventListener('change', render);
filterTier.addEventListener('change', render);
sortOrder.addEventListener('change', render);

// ========== DENSIDADE E AGRUPAMENTO ==========
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

// ========== DETAIL EVENTS ==========
detailClose.addEventListener('click', closeDetailModal);
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeDetailModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (detailModal.classList.contains('active')) closeDetailModal();
    else if (modalOverlay.classList.contains('active')) { cancelEdit(); closeModal(); }
  }
});
detailSave.addEventListener('click', saveDetailChanges);
detailDelete.addEventListener('click', deleteFromDetail);

// ========== MODAL ADIÇÃO ==========
function openModal() {
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => nome.focus(), 100);
}
function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
}
function cancelEdit() {
  editingIndex = null;
  btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar';
  modalTitle.innerHTML = '<i class="fas fa-pen"></i> Adicionar título';
  btnCancel.style.display = 'inline-flex';
  form.reset();
  temporada.value = '';
  episodio.innerHTML = '';
  clearPreview();
  cachedShowDetails = null;
  suggestions.classList.remove('active');
  closeModal();
  setLoading(false);
  selectedTmdbId = null;
  selectedMediaType = null;
  selectedPosterPath = null;
  selectedAno = null;
}

// ========== EXPORT / IMPORT ==========
document.getElementById('exportBtn').style.display = 'none';
document.getElementById('importBtn').style.display = 'none';

// ========== EVENTOS DO FORM ==========
form.addEventListener('submit', addItem);
btnCancel.addEventListener('click', cancelEdit);

// ========== TEMA ==========
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

window.items = items;
console.log('Script carregado com sucesso!');