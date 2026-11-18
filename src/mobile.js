/**
 * mobile.js — Entry point do app mobile
 *
 * Importa a lógica REAL do projeto (auth, Supabase, TMDB, catalog, lists)
 * e conecta com o HTML do mobile.html. As funções ficam em window.*
 * porque o HTML usa onclick="" inline.
 */

import { supabase } from './lib/supabase.js';
import {
  getCurrentSession,
  getCurrentUser,
  loginWithPassword,
  signUpWithPassword,
  updateDisplayName,
} from './lib/auth.js';
import {
  escapeHTML,
  formatDateBR,
  calcularProgresso,
  totalDeEpisodiosDaSerie,
  filterItems,
  sortItems,
  TIER_ORDER,
} from './lib/catalog.js';
import { callTMDB, fetchTitleLogo } from './lib/api.js';
import {
  getCalendarWeek, getTrendingToSuggest, CATEGORIES,
  normalizeTrendingItem, filterNotInCatalog,
  getTitlesByYear, getAffinityRecommendations, getTitlesByGenre,
  getUpcomingTitles, getAffinityRails, getAffinityRail, AFFINITY_RAIL_COUNT,
  getFavorites, getAbandoned, getUserTopGenres, composeCategoryList,
  formatAirDate, pickVariety, cachedCallTMDB,
} from './lib/trendingApi.js';
import {
  searchTitles, emptySearchFilters, hasActiveFilters, fetchTvGenres, COUNTRY_OPTIONS,
} from './lib/discoverSearch.js';
import {
  fetchUserLists, createList, renameList, deleteList, updateListsOrder,
  addItemToList, removeItemFromList,
} from './lib/lists.js';
import { state, STORAGE_KEYS } from './lib/state.js';
import { cacheGet, cacheSet, cacheClear } from './lib/cache.js';

// ================================================================
// ESTADO MOBILE
// ================================================================
let authMode = 'login';
let currentTitle = null;
let currentTier = '';
let currentStatus = 'assistindo';
let curTemp = 1, curEp = 0;
let seasonMax = 1, epMaxByTemp = {};
let bdImages = [], bdIndex = 0, bdAutoTimer = null;
let catalogFilter = 'todos';
let sortMode = 'data-desc';
let groupByTier = false;
let rouletteHistory = [];
let roulettePreview = null;
let actionsSectionHTML = null;
let affinitySelected = [];
let affinitySearchTimeout = null;
let currentScreen = 'login';
let titleOriginScreen = 'catalog';

// Gêneros da home (derivados do catálogo, como no desktop)
let homeGenres = [];

// Busca com filtros avançados e paginação — mesmo estado do desktop
let searchFilters = emptySearchFilters();
let searchResults = [];
let searchPage = 1;
let searchTotalPages = 0;
let searchTotalResults = 0;
let searchSeq = 0;
let editingCollectionId = null;
let catalogListId = null;

// Guardas contra carregamentos duplicados (mesma ideia do desktop:
// tvDetailsInflight/seq, mas aplicadas também às telas mobile).
let itemsInflight = null;
let initAppInflight = null;
let searchMoreInflight = false;
const tmdbInflight = new Map();
const prefersLight = window.matchMedia('(prefers-color-scheme: light)');

// Variedade por seção (seed + itens já vistos), igual ao homePage.js
const sectionVariety = new Map();
function getVariety(key) {
  if (!sectionVariety.has(key)) sectionVariety.set(key, { seed: 0, seen: new Set() });
  return sectionVariety.get(key);
}
function bumpSeed(key) { const v = getVariety(key); v.seed += 1; return v.seed; }
function pickForSection(key, pool, count) {
  const v = getVariety(key);
  return pickVariety(pool, v.seen, count, v.seed);
}

// ================================================================
// HELPERS
// ================================================================
function $(id) { return document.getElementById(id); }
function showToast(msg, duration = 2800) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}
function tierClass(t) { return t ? 'tier-' + t.toLowerCase().replace('+', 'plus') : ''; }

/**
 * Cache + dedupe de chamadas TMDB. O desktop usa cacheGet/cacheSet com as
 * mesmas chaves (`tvcache_`, `season_`) e um Map de inflight para não buscar a
 * mesma série N vezes quando vários cards pedem a imagem na mesma render.
 */
async function cachedTMDB(cacheKey, endpoint, params = {}, lang = 'pt-BR', opts = {}) {
  if (!opts.fresh) {
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;
  }
  if (tmdbInflight.has(cacheKey)) return tmdbInflight.get(cacheKey);
  const promise = callTMDB(endpoint, params, lang)
    .then((data) => { if (data != null) cacheSet(cacheKey, data); return data; })
    .finally(() => { if (tmdbInflight.get(cacheKey) === promise) tmdbInflight.delete(cacheKey); });
  tmdbInflight.set(cacheKey, promise);
  return promise;
}

function fetchTvDetailsCached(tmdbId, lang = 'pt-BR', opts = {}) {
  if (!tmdbId) return Promise.resolve(null);
  return cachedTMDB(`tvcache_${tmdbId}_${lang}`, `tv/${tmdbId}`, {}, lang, opts);
}

function fetchSeasonCached(tmdbId, seasonNum, opts = {}) {
  if (!tmdbId) return Promise.resolve(null);
  return cachedTMDB(`season_${tmdbId}:${seasonNum}`, `tv/${tmdbId}/season/${seasonNum}`, {}, 'pt-BR', opts);
}

// JSONB não garante ordem de chaves: comparar por valor evita gravar de novo
// toda vez que o título é aberto (mesma regra do titlePage.js do desktop).
function mesmaContagemDeEpisodios(a, b) {
  const chaves = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const chave of chaves) {
    if ((Number(a?.[chave]) || 0) !== (Number(b?.[chave]) || 0)) return false;
  }
  return true;
}

/**
 * Equivalente mobile de persistirTotaisCorrigidos (titlePage.js). Corrige
 * títulos antigos que vieram com total_episodios = 1 e mapa vazio usando os
 * dados de `tv/{id}` que a tela já busca para os steppers.
 */
async function persistirTotaisCorrigidos(item, mapaTmdb, totalTmdb) {
  if (!item || !Object.keys(mapaTmdb || {}).length) return;
  const totalReal = Number(totalTmdb) || totalDeEpisodiosDaSerie(mapaTmdb);
  const mapaMudou = !mesmaContagemDeEpisodios(item.seasonEpisodesMap, mapaTmdb);
  const totalMudou = Number(item.totalEpisodios) !== totalReal;
  if (!mapaMudou && !totalMudou) return;

  const normalizado = { seasonEpisodesMap: mapaTmdb, totalEpisodios: totalReal };
  // Preview ainda não está no banco: só prepara o insert de "Adicionar".
  if (item._isPreview) { Object.assign(item, normalizado); return; }
  try {
    const { data, error } = await supabase.from('items').update({
      season_episodes_map: mapaTmdb,
      total_episodios: totalReal,
    }).eq('id', item.id).select();
    if (error) throw error;
    const saved = data?.[0];
    if (saved) {
      normalizado.totalEpisodios = saved.total_episodios ?? totalReal;
      normalizado.seasonEpisodesMap = saved.season_episodes_map || mapaTmdb;
    }
    Object.assign(item, normalizado);
    const idx = state.items.findIndex(i => String(i.id) === String(item.id));
    if (idx !== -1) Object.assign(state.items[idx], normalizado);
  } catch (e) {
    // Falhar o conserto não pode derrubar a tela de detalhe.
    console.error('Não foi possível corrigir os totais de episódios:', e);
  }
}

function seasonMapFromDetails(details) {
  const map = {};
  (details?.seasons || []).forEach(s => {
    if (s.season_number > 0) map[s.season_number] = s.episode_count || 0;
  });
  return map;
}

function cardHTML(item, opts = {}) {
  const safeName = escapeHTML(item.nome || item.name || '');
  const tier = item.tier || '';
  const tc = tier ? tierClass(tier) : '';
  const stamp = tier ? `<span class="card-stamp ${tc}">${tier}</span>` : '';
  const posterUrl = (opts.continue && item._wideImg) ? item._wideImg : (item.imagem || item.posterUrl || '');
  const poster = posterUrl
    ? `<img src="${escapeHTML(posterUrl)}" alt="${safeName}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;card-fallback&quot;><i class=&quot;fas fa-film&quot;></i></div>'" />`
    : '<div class="card-fallback"><i class="fas fa-film"></i></div>';

  let body = '';
  const progress = calcularProgresso(item);
  if (opts.continue) {
    // Sempre renderiza; a preferência é aplicada por classe no body (igual ao
    // desktop), evitando re-render de toda a grade ao alternar o toggle.
    const progHtml = `<div class="progress-label">${progress}% concluído</div><div class="card-progress" style="margin-top:6px"><span style="width:${progress}%"></span></div>`;
    body = `<div class="card-meta"><i class="fas fa-play"></i> T${item.temporada || 1} - Ep ${String(item.episodio || 0).padStart(2, '0')}</div>
      <div class="episode-label">${safeName}</div>
      ${progHtml}`;
  } else if (progress > 0 && progress < 100) {
    body = `<div class="progress-wrap"><div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div><span class="progress-pct">${progress}%</span></div>`;
  }
  const cls = opts.continue ? 'card card-continue' : 'card';
  const onclick = opts.previewKey
    ? `openPreview('${opts.previewKey}')`
    : opts.preview ? 'openRoulettePreview()' : `openTitle('${item.id || 0}')`;
  return `<div class="${cls}" onclick="${onclick}">
    <div class="card-img">${poster}${stamp}<h3 class="card-title" title="${safeName}">${safeName}</h3></div>
    ${body ? `<div class="card-body">${body}</div>` : ''}
    ${opts.extraHtml ? `<div class="card-extra">${opts.extraHtml}</div>` : ''}
  </div>`;
}

// ================================================================
// PREVIEW DE TÍTULOS EXTERNOS (roleta, afinidade, destaques do ano)
// Segue o padrão do desktop: abre a tela de detalhe com Adicionar/Cancelar.
// ================================================================
const externalPreviews = {};
const externalPreviewsById = {};
let previewSeq = 0;

function registerExternalPreview(raw) {
  const key = 'pv' + (++previewSeq);
  externalPreviews[key] = raw;
  if (raw.id != null) externalPreviewsById[String(raw.id)] = raw;
  return key;
}

function externalCardHTML(raw, opts = {}) {
  const key = registerExternalPreview(raw);
  return cardHTML({
    id: raw.id,
    nome: raw.title || raw.nome || '',
    imagem: raw.posterUrl || raw.imagem || '',
    ano: (raw.date || raw.ano || '').slice(0, 4) || null
  }, { previewKey: key, extraHtml: opts.extraHtml || '' });
}

function openPreview(key) {
  const raw = externalPreviews[key];
  if (raw) openExternalPreview(raw);
}

function openExternalPreview(raw, opts = {}) {
  openTitleFromCatalog({
    id: `preview-${raw.id}`,
    _isPreview: true,
    nome: raw.title || raw.nome || '',
    tipo: 'serie',
    temporada: 1,
    episodio: 0,
    totalEpisodios: 1,
    seasonEpisodesMap: {},
    status: 'assistindo',
    tier: null,
    imagem: raw.posterUrl || raw.imagem || '',
    tmdb_id: raw.id,
    ano: (raw.date || raw.ano || '').slice(0, 4) || null,
    lists: []
  }, { pushHistory: opts.pushHistory !== false, previewRaw: raw });
}

// ================================================================
// AUTH
// ================================================================
async function handleAuth() {
  const email = $('authEmail').value.trim();
  const pwd = $('authPassword').value;
  const msg = $('authMessage');
  const isSignup = authMode === 'signup';
  const name = $('authName').value.trim();
  const confirm = $('authPasswordConfirm').value;

  document.querySelectorAll('.field-error').forEach(e => (e.textContent = ''));
  document.querySelectorAll('.login-input').forEach(i => i.classList.remove('is-invalid'));

  // Mesmas regras do desktop (validateSignup/handleLogin em main.js).
  const invalidInputs = [];
  const fail = (inputId, errorId, text) => {
    $(errorId).textContent = text;
    $(inputId).classList.add('is-invalid');
    invalidInputs.push($(inputId));
  };
  if (isSignup) {
    if (name.length < 2) fail('authName', 'authNameError', 'Diga como quer ser chamado (mínimo 2 letras).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('authEmail', 'authEmailError', 'Email inválido.');
    if (pwd.length < 8) fail('authPassword', 'authPasswordError', 'A senha precisa de pelo menos 8 caracteres.');
    if (confirm !== pwd) fail('authPasswordConfirm', 'authConfirmError', 'As senhas não são iguais.');
  } else {
    if (!email) fail('authEmail', 'authEmailError', 'Preencha o email.');
    if (!pwd) fail('authPassword', 'authPasswordError', 'Preencha a senha.');
  }
  if (invalidInputs.length) {
    msg.className = 'auth-message error';
    msg.textContent = isSignup ? 'Confira os campos destacados.' : 'Preencha email e senha.';
    invalidInputs[0].focus();
    return;
  }

  $('loginSubmitBtn').disabled = true;
  $('loginSubmitBtn').textContent = 'Entrando...';

  try {
    if (isSignup) {
      const result = await signUpWithPassword(email, pwd, name);
      // Com confirmação de email ligada, `session` vem nulo: não entra ainda.
      if (!result?.session) {
        toggleAuthMode(); // volta para login (limpa a mensagem)
        $('authEmail').value = email;
        msg.className = 'auth-message success';
        msg.textContent = 'Conta criada! Confira seu email para confirmar e depois entre.';
        return;
      }
      msg.className = 'auth-message success';
      msg.textContent = 'Conta criada!';
    } else {
      await loginWithPassword(email, pwd);
      msg.className = 'auth-message success';
      msg.textContent = 'Bem-vindo de volta!';
    }
    await initApp();
  } catch (e) {
    const text = e.message || 'Erro ao autenticar';
    const already = /already registered|already exists/i.test(text);
    const invalid = /invalid login credentials/i.test(text);
    msg.className = 'auth-message error';
    if (already) {
      $('authEmailError').textContent = 'Esse email já tem conta.';
      $('authEmail').classList.add('is-invalid');
      msg.textContent = 'Esse email já está cadastrado.';
    } else {
      msg.textContent = invalid ? 'Email ou senha incorretos.' : 'Erro: ' + text;
    }
  } finally {
    // Sempre reabilita — inclusive após sucesso, para o logout poder voltar ao login.
    $('loginSubmitBtn').disabled = false;
    $('loginSubmitBtn').textContent = authMode === 'signup' ? 'Cadastrar' : 'Entrar';
  }
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  const isSignup = authMode === 'signup';
  $('loginTitle').textContent = isSignup ? 'Cadastrar' : 'Entrar';
  $('loginSubtitle').textContent = isSignup ? 'Crie sua conta para começar.' : 'Acesse sua biblioteca para continuar de onde parou.';
  $('loginSubmitBtn').textContent = isSignup ? 'Cadastrar' : 'Entrar';
  $('switchText').textContent = isSignup ? 'Já tem conta?' : 'Ainda não tem conta?';
  $('switchBtn').textContent = isSignup ? 'Entrar' : 'Cadastrar';
  $('nameGroup').hidden = !isSignup;
  $('confirmGroup').hidden = !isSignup;
  $('authStrength').hidden = !isSignup;
  $('authPassword').setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
  $('authMessage').textContent = '';
  document.querySelectorAll('.field-error').forEach(e => (e.textContent = ''));
  document.querySelectorAll('.login-input').forEach(i => i.classList.remove('is-invalid'));
}

function togglePassword() {
  const input = $('authPassword');
  const btn = $('authRevealBtn');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

function checkPasswordStrength() {
  const pwd = $('authPassword').value;
  if (authMode !== 'signup') return;
  // Mesmos 5 critérios do desktop (passwordStrength em main.js).
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const level = score >= 5 ? 4 : score >= 4 ? 3 : score >= 3 ? 2 : score > 0 ? 1 : 0;
  const labels = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  const colors = ['', 'var(--danger)', 'var(--warning)', 'var(--success)', 'var(--accent)'];
  const widths = ['0%', '25%', '50%', '75%', '100%'];
  const bar = $('strengthBar');
  const label = $('strengthLabel');
  bar.style.width = widths[level];
  bar.style.background = colors[level];
  label.textContent = labels[level];
}

// ================================================================
// INIT APP (após login)
// ================================================================
async function initApp() {
  // boot() e handleAuth() podem chegar juntos: uma única inicialização.
  if (initAppInflight) return initAppInflight;
  const promise = (async () => {
    const user = await getCurrentUser();
    if (!user) { switchScreen('login'); return; }
    state.currentUser = user;

    // Carregar itens e listas do Supabase. loadItems() já carrega as listas
    // (igual ao desktop) e deduplica chamadas concorrentes.
    try {
      await loadItems();
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
      showToast('Erro ao carregar dados');
    }

    // Preencher perfil
    fillProfile(user);

    // Fechar o dropdown de afinidade ao tocar fora (igual ao desktop)
    if (!initApp._affinityClickBound) {
      initApp._affinityClickBound = true;
      document.addEventListener('click', (e) => {
        const wrap = document.querySelector('.affinity-search-wrap');
        if (wrap && !wrap.contains(e.target)) hideAffinityDropdown();
      });
    }

    // Deep link: guarda o ID antes de trocar de tela (switchScreen limpa o hash).
    const deepLinkId = location.hash.startsWith('#/titulo/')
      ? location.hash.replace('#/titulo/', '')
      : '';

    // Ir pra home — switchScreen() já renderiza a tela (evita duplo render/fetch).
    switchScreen('home');

    if (deepLinkId && !deepLinkId.startsWith('ext-')) {
      const deepItem = state.items.find(i => String(i.id) === String(deepLinkId));
      if (deepItem) openTitleFromCatalog(deepItem, { pushHistory: true });
    }
  })();
  initAppInflight = promise;
  try {
    return await promise;
  } finally {
    if (initAppInflight === promise) initAppInflight = null;
  }
}

async function loadItems() {
  // login e boot podem resolver juntos: dedupe para não buscar o catálogo
  // (e as listas) duas vezes seguidas.
  if (itemsInflight) return itemsInflight;
  const promise = (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('items')
      .select(`*, item_lists (list_id, user_lists (id, nome, is_system))`)
      .eq('user_id', user.id);
    if (error) throw error;
    // Normaliza snake_case (DB) -> camelCase (JS), igual ao desktop
    state.items = (data || []).map(item => ({
      id: item.id,
      user_id: item.user_id,
      nome: item.nome,
      tipo: item.tipo,
      temporada: item.temporada,
      episodio: item.episodio,
      totalEpisodios: item.total_episodios,
      seasonEpisodesMap: item.season_episodes_map || {},
      status: item.status,
      nota: item.nota,
      imagem: item.imagem,
      dataCriacao: item.data_criacao,
      dataAtualizacao: item.data_atualizacao,
      tmdb_id: item.tmdb_id,
      tier: item.tier || null,
      ano: item.ano || null,
      lists: (item.item_lists || []).map(il => il.user_lists).filter(Boolean),
    }));
    // No desktop loadUserLists() é chamada por loadItems().
    await loadUserLists();
  })();
  itemsInflight = promise;
  try {
    return await promise;
  } finally {
    if (itemsInflight === promise) itemsInflight = null;
  }
}

async function loadUserLists() {
  try {
    state.userLists = await fetchUserLists();
  } catch (e) {
    console.error('Erro ao carregar listas:', e);
    state.userLists = [];
  }
}

function fillProfile(user) {
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário';
  $('profileDisplayName').textContent = name;
  $('profileAvatar').textContent = name.slice(0, 2).toUpperCase();
  $('profileEmail').textContent = user.email || '';
  const created = user.created_at ? new Date(user.created_at) : null;
  if (created) {
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    $('profileSince').innerHTML = `<i class="fas fa-calendar"></i> Membro desde ${meses[created.getMonth()]} ${created.getFullYear()}`;
  }
  // Toggle progress bar + tema (sem re-render de grade)
  $('progressToggle').classList.toggle('on', state.showProgressBar);
  document.body.classList.toggle('is-progress-bar-hidden', !state.showProgressBar);
  applyTheme();
}

function toggleProgressBar(btn) {
  btn.classList.toggle('on');
  state.showProgressBar = btn.classList.contains('on');
  try { localStorage.setItem(STORAGE_KEYS.SHOW_PROGRESS_BAR, String(state.showProgressBar)); } catch {}
  document.body.classList.toggle('is-progress-bar-hidden', !state.showProgressBar);
  showToast(state.showProgressBar ? 'Barra de progresso ativada' : 'Barra de progresso desativada');
}

// ================================================================
// HOME
// ================================================================
function renderHome() {
  const items = state.items || [];
  const user = state.currentUser;
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const cap = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
  $('greetingText').textContent = cap ? `Bom te ver, ${cap}` : 'Bom te ver';
  $('greetingSubtitle').textContent = `Você tem ${items.length} títulos no catálogo`;

  // Continuar assistindo
  loadContinueRail(items.filter(i => i.status === 'assistindo'), $('continueRail'), $('continueEmpty'));

  // Seções externas (não bloqueiam a tela)
  loadTrending();
  loadUpcoming();
  loadAffinityRails();

  // Favoritos — getFavorites do desktop (S+ antes de S, depois atualização)
  const favs = getFavorites(items, 10);
  $('favoritesRail').innerHTML = favs.map(t => cardHTML(t)).join('');
  $('favoritesSection').style.display = favs.length ? '' : 'none';

  // Gêneros derivados do que o usuário assiste
  renderGenres();

  // Calendário — getCalendarWeek real
  loadCalendar(items);

  // Abandonados — getAbandoned do desktop (mais recentes primeiro)
  const abandoned = getAbandoned(items, 10);
  $('abandonedRail').innerHTML = abandoned.map(t => cardHTML(t)).join('');
  $('abandonedSection').style.display = abandoned.length ? '' : 'none';
}

async function loadTrending(opts = {}) {
  const grid = $('trendingRail');
  if (!grid) return;
  grid.innerHTML = skeletonCards(5);
  try {
    // Mesma seleção do desktop: filtra o catálogo e renova com seed/fresh.
    const pool = await getTrendingToSuggest(state.items || [], 20, { fresh: !!opts.fresh });
    const chosen = pickForSection('trending', pool, 10);
    grid.innerHTML = chosen.map(t => externalCardHTML(t)).join('') || '<p class="home-hint">Nada por aqui.</p>';
  } catch (e) {
    console.warn('Erro trending:', e);
    grid.innerHTML = '<p class="home-hint">Não foi possível carregar.</p>';
  }
}

async function loadUpcoming(opts = {}) {
  const section = $('upcomingSection');
  const grid = $('upcomingRail');
  if (!section || !grid) return;
  grid.innerHTML = skeletonCards(5);
  try {
    const pool = await getUpcomingTitles(state.items || [], 20, { fresh: !!opts.fresh });
    const chosen = pickForSection('upcoming', pool, 10);
    if (!chosen.length) { section.style.display = 'none'; return; }
    grid.innerHTML = chosen.map(t => externalCardHTML(t, {
      extraHtml: t.date ? `<span class="home-upcoming-date">${escapeHTML(formatAirDate(t.date))}</span>` : ''
    })).join('');
    section.style.display = '';
  } catch (e) {
    console.warn('Erro Em Breve:', e);
    section.style.display = 'none';
  }
}

function paintAffinityRail(idx, rail) {
  const section = $('rail' + idx);
  const title = $('rail' + idx + 'Title');
  const grid = $('rail' + idx + 'Grid');
  if (!section || !grid) return;
  if (!rail || !rail.pool || !rail.pool.length) {
    section.style.display = 'none';
    delete section.dataset.baseId;
    delete section.dataset.shown;
    return;
  }
  const chosen = pickForSection('rail' + idx, rail.pool, 10);
  if (!chosen.length) { section.style.display = 'none'; return; }
  if (title) title.innerHTML = `<i class="fas fa-heart"></i> Se você gostou de "${escapeHTML(rail.base?.nome || '')}" vai gostar disso`;
  grid.innerHTML = chosen.map(t => externalCardHTML(t)).join('');
  section.dataset.baseId = String(rail.base?.tmdb_id || rail.base?.id || '');
  section.dataset.shown = chosen.map(t => String(t.id)).join(',');
  section.style.display = '';
}

async function loadAffinityRails(opts = {}) {
  const items = state.items || [];
  if (!items.length) {
    for (let i = 0; i < AFFINITY_RAIL_COUNT; i++) { const s = $('rail' + i); if (s) s.style.display = 'none'; }
    return;
  }
  try {
    const rails = await getAffinityRails(items, { count: AFFINITY_RAIL_COUNT, fresh: !!opts.fresh });
    for (let i = 0; i < AFFINITY_RAIL_COUNT; i++) paintAffinityRail(i, rails[i] || null);
  } catch (e) {
    console.warn('Erro trilhas de afinidade:', e);
    for (let i = 0; i < AFFINITY_RAIL_COUNT; i++) { const s = $('rail' + i); if (s) s.style.display = 'none'; }
  }
}

function startRefreshSpin(e) {
  const btn = e?.target?.closest('.home-refresh-btn');
  if (!btn) return { done() {}, skip: false };
  // Guarda de inflight: clique repetido no mesmo botão não refaz a busca.
  if (btn.dataset.busy === '1') return { done() {}, skip: true };
  btn.dataset.busy = '1';
  btn.classList.add('is-loading');
  btn.disabled = true;
  return {
    skip: false,
    done() { delete btn.dataset.busy; btn.classList.remove('is-loading'); btn.disabled = false; }
  };
}

async function refreshTrending(e) {
  const spin = startRefreshSpin(e);
  if (spin.skip) return;
  bumpSeed('trending');
  try { await loadTrending({ fresh: true }); } finally { spin.done(); }
}

async function refreshUpcoming(e) {
  const spin = startRefreshSpin(e);
  if (spin.skip) return;
  bumpSeed('upcoming');
  try { await loadUpcoming({ fresh: true }); } finally { spin.done(); }
}

async function refreshFavorites(e) {
  const spin = startRefreshSpin(e);
  if (spin.skip) return;
  try {
    const favs = getFavorites(state.items || [], 10);
    $('favoritesRail').innerHTML = favs.map(t => cardHTML(t)).join('');
    $('favoritesSection').style.display = favs.length ? '' : 'none';
  } finally { spin.done(); }
}

async function refreshAbandoned(e) {
  const spin = startRefreshSpin(e);
  if (spin.skip) return;
  bumpSeed('abandoned');
  try {
    const ab = getAbandoned(state.items || [], 10);
    $('abandonedRail').innerHTML = ab.map(t => cardHTML(t)).join('');
    $('abandonedSection').style.display = ab.length ? '' : 'none';
  } finally { spin.done(); }
}

async function refreshCalendarSection(e) {
  const spin = startRefreshSpin(e);
  if (spin.skip) return;
  try { await loadCalendar(state.items || [], { fresh: true }); } finally { spin.done(); }
}

async function refreshAffinityRail(idx, e) {
  const spin = startRefreshSpin(e);
  if (spin.skip) return;
  const section = $('rail' + idx);
  const titles = new Set();
  const bases = new Set();
  for (let i = 0; i < AFFINITY_RAIL_COUNT; i++) {
    if (i === idx) continue;
    const s = $('rail' + i);
    if (!s || s.style.display === 'none') continue;
    (s.dataset.shown || '').split(',').filter(Boolean).forEach(id => titles.add(id));
    if (s.dataset.baseId) bases.add(s.dataset.baseId);
  }
  if (section?.dataset.baseId) bases.add(section.dataset.baseId);
  try {
    const rail = await getAffinityRail(state.items || [], {
      offset: bumpSeed('rail' + idx),
      excludeTitles: [...titles],
      excludeBaseIds: [...bases],
      fresh: true
    });
    paintAffinityRail(idx, rail);
  } catch (err) {
    console.warn('Erro ao atualizar afinidade:', err);
  } finally { spin.done(); }
}

function skeletonCards(n) {
  return Array.from({ length: n || 5 }).map(() =>
    `<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div></div>`
  ).join('');
}

let activeGenreId = null;

async function renderGenres() {
  // Mesma lista do desktop: categorias fixas + gêneros mais assistidos.
  const top = await getUserTopGenres(state.items || []);
  homeGenres = composeCategoryList(top);
  $('genreGrid').innerHTML = homeGenres.map(g =>
    `<button class="genre-card" onclick="openGenre(${g.id})"><span class="genre-card-icon"><i class="fas ${g.icon}"></i></span><span class="genre-card-name">${escapeHTML(g.name)}</span></button>`
  ).join('');
}

async function loadCalendar(items, opts = {}) {
  const section = $('calendarSection');
  const grid = $('calendarGrid');
  if (!section || !grid) return;
  try {
    const week = await getCalendarWeek(items, { fresh: !!opts.fresh });
    if (!week || week.length === 0) { section.style.display = 'none'; return; }
    const isUpcoming = week[0]?.[2] === true;
    const hint = $('calendarHint');
    if (hint) hint.textContent = isUpcoming ? 'Próximos episódios' : 'Episódios que saíram esta semana';
    const dows = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    const html = [];
    for (const [date, eps] of week) {
      const parts = String(date).split('-');
      const dayNum = parts.length === 3 ? parts[2] : '';
      const month = parts.length === 3 ? parts[1] : '';
      const dt = new Date(date + 'T12:00:00');
      const dow = !Number.isNaN(dt.getTime()) ? dows[dt.getDay()] : '';
      for (const e of eps) {
        const ep = e.episode || {};
        const epNum = `T${ep.season_number || 1} · E${ep.episode_number || 0}`;
      const title = e.item?.nome || '';
      const posterUrl = e.item?.imagem || (ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : '');
      const imgHtml = posterUrl ? `<div class="cal-poster"><img src="${escapeHTML(posterUrl)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'" /></div>` : '';
      html.push(`<div class="cal-card" onclick="openTitle('${e.item?.id}')">${imgHtml}<div class="cal-date"><div class="cal-dnum">${dayNum}</div><div class="cal-dday">${dow} ${month}</div></div><div class="cal-body"><div class="cal-title">${escapeHTML(title)}</div><div class="cal-ep">${epNum}</div></div></div>`);
      }
    }
    if (html.length === 0) { section.style.display = 'none'; return; }
    grid.innerHTML = html.join('');
    section.style.display = '';
  } catch (e) {
    console.error('Erro ao carregar calendário:', e);
    section.style.display = 'none';
  }
}

async function loadContinueRail(items, rail, empty) {
  if (!rail) return;
  if (!items || items.length === 0) {
    rail.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  rail.classList.remove('hidden');
  // Busca imagens wide (backdrop) do TMDB para cada título
  await Promise.all(items.map(async (it) => {
    if (it._wideImg) return;
    if (!it.tmdb_id) { it._wideImg = it.imagem || ''; return; }
    try {
      const d = await fetchTvDetailsCached(it.tmdb_id);
      if (d?.backdrop_path) it._wideImg = `https://image.tmdb.org/t/p/w780${d.backdrop_path}`;
      else if (d.poster_path) it._wideImg = `https://image.tmdb.org/t/p/w500${d.poster_path}`;
      else it._wideImg = it.imagem || '';
    } catch {
      it._wideImg = it.imagem || '';
    }
  }));
  rail.innerHTML = items.map(t => cardHTML(t, { continue: true })).join('');
}

function openGenre(id) {
  const g = homeGenres.find(x => x.id === id);
  $('genreTitle').innerHTML = `<i class="fas ${g?.icon || 'fa-layer-group'}"></i> ${escapeHTML(g?.name || 'Gênero')}`;
  $('genreBack').classList.remove('hidden');
  activeGenreId = id;
  loadTitlesByGenre(id);
}

async function loadTitlesByGenre(id, opts = {}) {
  const grid = $('genreGrid');
  grid.innerHTML = skeletonCards(5);
  try {
    // getTitlesByGenre faz fallback por keyword e filtra o catálogo (igual desktop).
    const pool = await getTitlesByGenre(id, state.items || [], 10, { fresh: !!opts.fresh });
    const chosen = pickForSection('cat-' + id, pool, 10);
    grid.innerHTML = chosen.length ? chosen.map(t => externalCardHTML(t)).join('') : '<p class="home-hint">Nada por aqui.</p>';
  } catch {
    grid.innerHTML = '<p class="home-hint">Erro ao carregar.</p>';
  }
}

function backToGenres() {
  $('genreTitle').innerHTML = '<i class="fas fa-layer-group"></i> Explorar por gênero';
  $('genreBack').classList.add('hidden');
  activeGenreId = null;
  renderGenres();
}

async function refreshGenres(e) {
  const spin = startRefreshSpin(e);
  if (spin.skip) return;
  try {
    if (activeGenreId) {
      bumpSeed('cat-' + activeGenreId);
      await loadTitlesByGenre(activeGenreId, { fresh: true });
    } else {
      await renderGenres();
    }
  } finally { spin.done(); }
}

async function getRoulettePool() {
  try {
    // 30% das vezes usa o trending; o resto, discover com parâmetros aleatórios
    if (Math.random() < 0.3) {
      const trending = await getTrendingToSuggest(state.items, 20);
      if (trending.length > 0) return trending.sort(() => 0.5 - Math.random());
    }
    const page = Math.floor(Math.random() * 10) + 1;
    const sorts = ['popularity.desc', 'vote_average.desc', 'first_air_date.desc', 'vote_count.desc'];
    const sort = sorts[Math.floor(Math.random() * sorts.length)];
    const params = { sort_by: sort, page, 'vote_count.gte': 30 };
    if (Math.random() < 0.5) {
      const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      params.with_genres = String(cat.id);
    }
    // cachedCallTMDB evita buscar o mesmo pool duas vezes em sorteios seguidos.
    const data = await cachedCallTMDB('discover/tv', params, 'pt-BR');
    const results = (data.results || []).filter(r => r.poster_path);
    const filtered = filterNotInCatalog(results, state.items);
    return filtered.slice(0, 20).map(normalizeTrendingItem).sort(() => 0.5 - Math.random());
  } catch { return []; }
}

async function spinRoulette() {
  const btn = document.querySelector('.roulette-btn');
  const result = $('rouletteResult');
  if (!result || btn?.disabled) return; // clique duplo durante o sorteio
  const originalLabel = '<i class="fas fa-dice"></i> Sortear título novo';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sorteando...'; }
  result.classList.remove('hidden');
  result.innerHTML = '<div class="roulette-shuffle"><i class="fas fa-dice fa-spin"></i> Buscando título novo...</div>';
  const pool = await getRoulettePool();
  if (pool.length === 0) {
    result.innerHTML = '<p class="home-note">Nenhum título novo encontrado. Tente novamente.</p>';
    if (btn) { btn.disabled = false; btn.innerHTML = originalLabel; }
    return;
  }
  // Animação de embaralhamento — 4 picks rápidos antes do resultado final
  for (let k = 0; k < 4; k++) {
    await new Promise(r => setTimeout(r, 120 + k * 40));
    const tmp = pool[Math.floor(Math.random() * pool.length)];
    result.innerHTML = `<div class="roulette-shuffle" style="opacity:${0.6 + k * 0.1}">${escapeHTML(tmp.title)}</div>`;
  }
  await new Promise(r => setTimeout(r, 180));
  const picked = pool[Math.floor(Math.random() * pool.length)];
  roulettePreview = picked;
  result.innerHTML = `<div class="roulette-result-card">${externalCardHTML(picked)}</div>`;
  rouletteHistory.unshift(picked.title);
  if (rouletteHistory.length > 3) rouletteHistory.pop();
  $('rouletteHistoryList').textContent = rouletteHistory.join(' • ');
  $('rouletteHistory').classList.remove('hidden');
  // Botão único: após o primeiro sorteio, vira "Sortear outro" (como no desktop)
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-redo"></i> Sortear outro'; }
}

function openRoulettePreview() {
  if (roulettePreview) openExternalPreview(roulettePreview);
}

async function addRouletteTitle() {
  if (!currentTitle?._isPreview) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não logado.');
    // Busca os totais antes do insert para não gravar o DEFAULT
    // total_episodios = 1 / season_episodes_map = {} do preview.
    if (currentTitle.tmdb_id && !Object.keys(currentTitle.seasonEpisodesMap || {}).length) {
      const details = await fetchTvDetailsCached(currentTitle.tmdb_id);
      const map = seasonMapFromDetails(details);
      if (Object.keys(map).length) {
        currentTitle.seasonEpisodesMap = map;
        currentTitle.totalEpisodios = Number(details?.number_of_episodes) || totalDeEpisodiosDaSerie(map);
      }
    }
    const { data, error } = await supabase.from('items').insert([{
      user_id: user.id, nome: currentTitle.nome, tipo: 'serie',
      temporada: 1, episodio: 0,
      total_episodios: currentTitle.totalEpisodios || 1,
      season_episodes_map: currentTitle.seasonEpisodesMap || {}, status: 'assistindo', tier: null,
      imagem: currentTitle.imagem || null, tmdb_id: currentTitle.tmdb_id || null,
      ano: currentTitle.ano || null, data_criacao: new Date().toISOString()
    }]).select();
    if (error) {
      if (error.code === '23505') throw new Error('Este título já existe no seu catálogo.');
      throw error;
    }
    const created = data[0];
    const fullItem = {
      ...created,
      totalEpisodios: created.total_episodios,
      seasonEpisodesMap: created.season_episodes_map || {},
      dataCriacao: created.data_criacao,
      dataAtualizacao: created.data_atualizacao,
      lists: []
    };
    state.items.unshift(fullItem);
    stopBackdropAutoRotate();
    showToast('Título adicionado ao catálogo!');
    openTitleFromCatalog(fullItem, { pushHistory: true });
  } catch (e) {
    showToast('Erro ao adicionar: ' + e.message);
  }
}

// ---------- Descubra por afinidade (mesma lógica do desktop) ----------
function updateAffinityChips() {
  const wrap = $('affinityChips');
  if (!wrap) return;
  wrap.innerHTML = affinitySelected.map((s, idx) =>
    `<span class="affinity-chip">${escapeHTML(s.title)} <button type="button" aria-label="Remover ${escapeHTML(s.title)}" onclick="removeAffinity(${idx})"><i class="fas fa-times"></i></button></span>`
  ).join('');
  const btn = $('affinityAnalyze');
  if (btn) {
    btn.disabled = affinitySelected.length === 0;
    btn.innerHTML = `<i class="fas fa-microscope"></i> Analisar (<span id="affinityCount">${affinitySelected.length}</span>/4)`;
  }
}

function removeAffinity(idx) {
  affinitySelected.splice(idx, 1);
  updateAffinityChips();
}

function hideAffinityDropdown() {
  const dd = $('affinityDropdown');
  if (!dd) return;
  dd.classList.add('hidden');
  dd.innerHTML = '';
}

function handleAffinitySearch(val) {
  clearTimeout(affinitySearchTimeout);
  const q = (val || '').trim();
  if (q.length < 2) { hideAffinityDropdown(); return; }
  affinitySearchTimeout = setTimeout(async () => {
    const dd = $('affinityDropdown');
    if (!dd) return;
    try {
      const data = await callTMDB('search/tv', { query: q }, 'pt-BR');
      const results = (data.results || []).slice(0, 6);
      const html = results.map(raw => {
        const title = raw.name || raw.title || '';
        if (!title || affinitySelected.some(s => String(s.id) === String(raw.id))) return '';
        const poster = raw.poster_path ? `https://image.tmdb.org/t/p/w92${raw.poster_path}` : '';
        return `<button type="button" class="affinity-option" onclick="selectAffinity(${raw.id}, this)">
          ${poster ? `<img src="${escapeHTML(poster)}" alt="" onerror="this.style.display='none'" />` : ''}
          <span>${escapeHTML(title)}</span>
          <small>${(raw.first_air_date || '').slice(0, 4) || ''}</small>
        </button>`;
      }).filter(Boolean).join('');
      if (!html) { hideAffinityDropdown(); return; }
      dd.innerHTML = html;
      dd.classList.remove('hidden');
    } catch { hideAffinityDropdown(); }
  }, 300);
}

function selectAffinity(id, btn) {
  if (affinitySelected.length >= 4) return;
  affinitySelected.push({
    id,
    title: btn.querySelector('span')?.textContent || '',
    posterUrl: btn.querySelector('img')?.src || ''
  });
  const input = $('affinityInput');
  if (input) input.value = '';
  hideAffinityDropdown();
  updateAffinityChips();
}

async function analyzeAffinity() {
  if (affinitySelected.length === 0) return;
  const btn = $('affinityAnalyze');
  const grid = $('affinityGrid');
  grid.classList.add('hidden');
  grid.innerHTML = '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando...'; }
  try {
    const ids = affinitySelected.map(s => s.id);
    const recs = await getAffinityRecommendations(ids, state.items, 10);
    if (!recs || recs.length === 0) {
      showToast('Nenhuma recomendação encontrada para essa combinação. Tente outros títulos.');
      return;
    }
    grid.innerHTML = recs.map(externalCardHTML).join('');
    grid.classList.remove('hidden');
  } catch (e) {
    showToast('Erro ao buscar recomendações: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-microscope"></i> Analisar (${affinitySelected.length}/4)`;
    }
  }
}

// ---------- Destaques do ano (mesma lógica do desktop) ----------
function searchYear() {
  const year = $('yearInput').value.trim();
  if (!/^\d{4}$/.test(year)) { showToast('Digite um ano válido (4 dígitos)'); return; }
  $('yearTitle').innerHTML = `<i class="fas fa-calendar-alt"></i> Destaques de ${year}`;
  loadTitlesByYear(year);
}

async function loadTitlesByYear(year) {
  const grid = $('yearGrid');
  grid.innerHTML = skeletonCards(5);
  grid.classList.remove('hidden');
  try {
    const results = await getTitlesByYear(year, state.items, 10);
    grid.innerHTML = results.length
      ? results.map(externalCardHTML).join('')
      : `<p class="home-hint">Nenhum título encontrado para ${year}.</p>`;
  } catch {
    grid.innerHTML = '<p class="home-hint">Não foi possível buscar.</p>';
  }
}

// ================================================================
// CATALOG
// ================================================================
function renderCatalog() {
  const items = state.items || [];
  // "planejado" tem tela própria no menu inferior (filterItems exclui esses
  // itens quando currentTab === 'all', exatamente como no desktop).
  const statusMap = { 'todos': undefined, 'assistindo': 'assistindo', 'concluido': 'concluido', 'pausado': 'pausado' };
  let filtered = filterItems(items, {
    // filterItems só aplica currentListId quando a aba não é 'all'
    currentTab: catalogListId ? 'list' : 'all',
    currentListId: catalogListId || null,
    statusFilter: statusMap[catalogFilter] || 'todos',
  });
  // Sort usando sortItems real
  filtered = sortItems(filtered, sortMode);

  const listName = (state.userLists || []).find(l => String(l.id) === String(catalogListId))?.nome;
  $('catalogSubtitle').textContent = `${filtered.length} título(s) · ${listName || 'Total'}`;
  const grid = $('catalogGrid');

  if (groupByTier) {
    let html = '';
    for (const tier of [...TIER_ORDER, '']) {
      const items = filtered.filter(i => (i.tier || '') === tier);
      if (items.length === 0) continue;
      const tc = tier ? tierClass(tier) : '';
      html += `<div class="tier-group-header"><div class="tier-group-stamp ${tc}">${tier || 'N/A'}</div> ${tier || 'Sem tier'}</div><div class="catalog-grid">${items.map(t => cardHTML(t)).join('')}</div>`;
    }
    grid.className = '';
    grid.innerHTML = html || '<p class="home-hint">Nenhum título encontrado.</p>';
  } else {
    grid.className = 'catalog-grid';
    grid.innerHTML = filtered.length ? filtered.map(t => cardHTML(t)).join('') : '<p class="home-hint">Nenhum título encontrado.</p>';
  }
}

function renderProximos() {
  // Espelha a aba "Próximos" do desktop: itens planejados, que o
  // filterItems/currentTab: 'all' do catálogo normal exclui.
  let filtered = (state.items || []).filter(i => i.status === 'planejado');
  filtered = sortItems(filtered, sortMode);

  $('proximosSubtitle').textContent = `${filtered.length} título(s) · Próximos`;
  const grid = $('proximosGrid');
  if (!grid) return;

  if (groupByTier) {
    let html = '';
    for (const tier of [...TIER_ORDER, '']) {
      const group = filtered.filter(i => (i.tier || '') === tier);
      if (group.length === 0) continue;
      const tc = tier ? tierClass(tier) : '';
      html += `<div class="tier-group-header"><div class="tier-group-stamp ${tc}">${tier || 'N/A'}</div> ${tier || 'Sem tier'}</div><div class="catalog-grid">${group.map(t => cardHTML(t)).join('')}</div>`;
    }
    grid.className = '';
    grid.innerHTML = html || '<p class="home-hint">Nenhum título planejado por aqui.</p>';
  } else {
    grid.className = 'catalog-grid';
    grid.innerHTML = filtered.length
      ? filtered.map(t => cardHTML(t)).join('')
      : '<p class="home-hint">Nenhum título planejado por aqui.</p>';
  }
}

// Ordenar e Agrupar são compartilhados entre Catálogo e Próximos.
function renderCurrentCatalog() {
  if (currentScreen === 'proximos') renderProximos();
  else renderCatalog();
}

function setCatalogFilter(btn, value) {
  catalogFilter = value;
  document.querySelectorAll('#catalogScreen .filter-chip').forEach(c => { if (!c.querySelector('i')) c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderCatalog();
}

function setStatusFilter(btn, value) {
  // Ativa apenas dentro do grupo de Status do sheet
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.sheet-option').forEach(o => o.classList.remove('active'));
    btn.classList.add('active');
  }
  catalogFilter = value;
  renderCatalog();
}

function toggleGroupByTier() {
  groupByTier = !groupByTier;
  // Mantém o chip "Agrupar" sincronizado nas duas telas.
  document.querySelectorAll('.filter-chip').forEach(c => {
    if (c.querySelector('.fa-layer-group')) c.classList.toggle('active', groupByTier);
  });
  renderCurrentCatalog();
}

// ================================================================
// SEARCH (TMDB)
// ================================================================
let searchDebounce = null;
let searchMode = 'idle';

function showSearchEmpty(msg) {
  const empty = $('searchEmpty');
  if (!empty) return;
  const p = empty.querySelector('p');
  if (p) p.textContent = msg;
  empty.classList.remove('hidden');
  $('searchGrid').classList.add('hidden');
  $('searchSummary').classList.add('hidden');
  $('searchMore').classList.add('hidden');
}

function renderSearchResults() {
  const grid = $('searchGrid');
  const summary = $('searchSummary');
  const more = $('searchMore');

  if (searchMode === 'idle') {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    showSearchEmpty('Digite pelo menos 2 caracteres para buscar');
    return;
  }

  if (searchTotalResults > 0) {
    summary.textContent = `${searchTotalResults.toLocaleString('pt-BR')} ${searchTotalResults === 1 ? 'resultado' : 'resultados'}`;
    summary.classList.remove('hidden');
  } else {
    summary.classList.add('hidden');
  }

  if (searchResults.length) {
    grid.innerHTML = searchResults.map(t => externalCardHTML(t)).join('');
    grid.classList.remove('hidden');
    $('searchEmpty').classList.add('hidden');
  } else {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    showSearchEmpty('Nenhum resultado encontrado');
  }
  more.classList.toggle('hidden', !(searchPage < searchTotalPages));
}

async function runSearch(reset = true, query = null) {
  const q = query == null ? ($('searchInput')?.value || '').trim() : String(query).trim();
  if (reset) { searchPage = 1; searchResults = []; }
  const my = ++searchSeq;
  try {
    const result = await searchTitles({ query: q, filters: searchFilters, page: reset ? 1 : searchPage + 1 });
    if (my !== searchSeq) return; // resposta antiga
    searchMode = result.mode;
    searchPage = result.page;
    searchTotalPages = result.totalPages;
    searchTotalResults = result.totalResults;
    if (reset) searchResults = [];
    const known = new Set(searchResults.map(i => String(i.id)));
    searchResults.push(...result.items.filter(i => !known.has(String(i.id))));
    renderSearchResults();
  } catch (e) {
    if (my !== searchSeq) return;
    console.warn('Erro na pesquisa:', e);
    $('searchMore').classList.add('hidden');
    showSearchEmpty('Erro ao buscar. Tente novamente.');
  } finally {
    if (my === searchSeq) $('searchLoading').classList.add('hidden');
  }
}

function handleSearch(val) {
  clearTimeout(searchDebounce);
  const q = String(val || '').trim();
  if (q.length < 2 && !hasActiveFilters(searchFilters) && !searchFilters.sort) {
    searchSeq++;
    searchMode = 'idle';
    searchResults = [];
    searchPage = 1;
    searchTotalPages = 0;
    searchTotalResults = 0;
    $('searchGrid').innerHTML = '';
    $('searchLoading').classList.add('hidden');
    showSearchEmpty('Digite pelo menos 2 caracteres para buscar');
    return;
  }
  $('searchEmpty').classList.add('hidden');
  $('searchLoading').classList.remove('hidden');
  $('searchGrid').classList.add('hidden');
  searchDebounce = setTimeout(() => runSearch(true, q), 400);
}

async function loadMoreSearch() {
  if (searchMoreInflight || searchPage >= searchTotalPages) return;
  searchMoreInflight = true;
  const btn = $('searchMore')?.querySelector('button');
  if (btn) btn.disabled = true;
  try { await runSearch(false); } finally {
    searchMoreInflight = false;
    if (btn) btn.disabled = false;
  }
}

function countActiveSearchFilters(f) {
  // Ordenação não conta como filtro — mesma regra do desktop.
  let n = 0;
  if (f.genres.length) n++;
  if (f.excludeGenres.length) n++;
  if (f.countries.length) n++;
  if (f.excludeCountries.length) n++;
  if (f.certification) n++;
  if (f.runtime) n++;
  if (f.language) n++;
  if (f.status !== '') n++;
  if (f.type !== '') n++;
  if (f.yearFrom) n++;
  if (f.yearTo) n++;
  return n;
}

function syncAdvBadge() {
  const n = countActiveSearchFilters(searchFilters);
  const badge = $('advFilterCount');
  if (!badge) return;
  badge.textContent = String(n);
  badge.classList.toggle('hidden', n === 0);
}

function readChipValues(containerId, cls, numeric = false) {
  return Array.from(document.querySelectorAll(`#${containerId} .sheet-option.${cls}`))
    .map(b => numeric ? Number(b.dataset.value) : b.dataset.value)
    .filter(v => v !== '' && v != null && (numeric ? Number.isFinite(v) : true));
}

function readSearchFilters() {
  const f = emptySearchFilters();
  f.genres = readChipValues('advGenres', 'active', true);
  f.excludeGenres = readChipValues('advGenres', 'excluded', true);
  f.countries = readChipValues('advCountries', 'active');
  f.excludeCountries = readChipValues('advCountries', 'excluded');
  f.certification = $('advCertification').value;
  f.runtime = $('advRuntime').value;
  f.language = $('advLanguage').value;
  f.status = $('advStatus').value;
  f.type = $('advType').value;
  f.sort = $('advSort').value;
  f.yearFrom = ($('advYearFrom').value || '').trim();
  f.yearTo = ($('advYearTo').value || '').trim();
  return f;
}

function applySearchFilters() {
  searchFilters = readSearchFilters();
  syncAdvBadge();
  runSearch(true);
}

function clearSearchFilters() {
  searchFilters = emptySearchFilters();
  syncFilterSheetUI();
  syncAdvBadge();
  runSearch(true);
}

// ================================================================
// TITLE DETAIL
// ================================================================
async function openTitle(id) {
  const item = state.items.find(i => String(i.id) === String(id));
  if (item) {
    openTitleFromCatalog(item, { pushHistory: true });
    return;
  }
  // Resultado externo (busca/trending/gênero): abre o preview com Adicionar.
  const raw = externalPreviewsById[String(id)];
  if (raw) { openExternalPreview(raw, { pushHistory: true }); return; }
  showToast('Título fora do catálogo');
}

const TIER_CYCLE = ['S+', 'S', 'A', 'B', 'C', 'D', ''];
const STATUS_CYCLE = ['assistindo', 'concluido', 'planejado', 'pausado'];

function updateTitleMeta() {
  const meta = $('titleMeta');
  if (!meta || !currentTitle) return;
  const item = currentTitle;
  let mh = '';
  if (item.ano) mh += `<span class="title-badge">${item.ano}</span>`;
  const tc = currentTier ? tierClass(currentTier) : '';
  mh += `<button class="title-badge title-badge-btn tier" onclick="cycleTier()">${currentTier ? `<span class="tier-group-stamp ${tc}" style="width:18px;height:18px;font-size:0.5rem">${currentTier}</span>` : 'N/A'}</button>`;
  const sm = { 'assistindo': ['live', 'Assistindo'], 'concluido': ['done', 'Concluído'], 'planejado': ['info', 'Planejado'], 'pausado': ['warn', 'Pausado'] };
  const [dc, sl] = sm[currentStatus] || ['live', currentStatus];
  mh += `<button class="title-badge title-badge-btn" onclick="cycleStatus()"><span class="status-dot ${dc}"></span> ${sl}</button>`;
  meta.innerHTML = mh;
}

function cycleTier() {
  const idx = TIER_CYCLE.indexOf(currentTier);
  const next = TIER_CYCLE[(idx + 1) % TIER_CYCLE.length];
  currentTier = next;
  if (currentTitle) currentTitle.tier = next || null;
  updateTitleMeta();
  showToast('Tier: ' + (next || 'N/A'));
}

function cycleStatus() {
  const idx = STATUS_CYCLE.indexOf(currentStatus);
  const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  currentStatus = next;
  if (currentTitle) currentTitle.status = next;
  updateTitleMeta();
  showToast('Status: ' + (next === 'assistindo' ? 'Assistindo' : next === 'concluido' ? 'Concluído' : next === 'planejado' ? 'Planejado' : 'Pausado'));
}

async function openTitleFromCatalog(item, opts = {}) {
  // Guarda a tela de origem e registra o título no histórico (igual ao desktop).
  if (currentScreen !== 'title') titleOriginScreen = currentScreen;
  if (opts.pushHistory) {
    const hashId = item._isPreview ? `ext-${item.tmdb_id}` : item.id;
    history.pushState(
      { titleId: item._isPreview ? null : item.id, previewRaw: opts.previewRaw || null },
      '', `#/titulo/${hashId}`
    );
  }
  currentTitle = item;
  curTemp = item.temporada || 1;
  curEp = item.episodio || 0;
  currentTier = item.tier || '';
  currentStatus = item.status || 'assistindo';

  $('titleName').textContent = item.nome;

  // Preview (título novo sorteado): troca as ações por Adicionar/Cancelar
  const actions = $('actionsSection');
  if (actions) {
    if (actionsSectionHTML === null) actionsSectionHTML = actions.innerHTML;
    actions.innerHTML = item._isPreview
      ? '<div class="twin-label">Adicionar</div><button class="badge-action" onclick="addRouletteTitle()"><i class="fas fa-plus"></i>Adicionar</button><button class="badge-action" onclick="goBackFromTitle()"><i class="fas fa-times"></i>Cancelar</button>'
      : actionsSectionHTML;
  }

  // Meta badges
  updateTitleMeta();

  const tp = $('titlePoster');
  if (tp) { tp.src = item.imagem || ''; tp.style.display = item.imagem ? 'block' : 'none'; }

  // Status buttons
  document.querySelectorAll('#statusRow .status-btn').forEach(b => { b.classList.toggle('active', b.textContent.toLowerCase() === currentStatus); });
  // Tier buttons
  document.querySelectorAll('#tierOptions .tier-opt').forEach(b => { b.classList.toggle('active', b.textContent === (currentTier || 'N/A')); });

  // Buscar detalhes do TMDB (seasons, backdrops, sinopse)
  if (item.tmdb_id) {
    loadTitleTMDBDetails(item);
  } else {
    updateSteppers();
    syncEpisodePanel();
  }

  switchScreen('title');
}

async function loadTitleTMDBDetails(item) {
  try {
    const details = await fetchTvDetailsCached(item.tmdb_id);
    if (!details) { updateSteppers(); syncEpisodePanel(); return; }
    // Seasons
    if (details.seasons) {
      const seasons = details.seasons.filter(s => s.season_number > 0);
      seasonMax = seasons.length || 1;
      epMaxByTemp = {};
      seasons.forEach(s => { epMaxByTemp[s.season_number] = s.episode_count || 0; });
      // Mesmo conserto do desktop: grava mapa/total quando o banco está
      // divergente (títulos antigos com total = 1 e mapa vazio).
      persistirTotaisCorrigidos(item, epMaxByTemp, details.number_of_episodes);
      if (curTemp > seasonMax) curTemp = seasonMax;
      const maxEp = epMaxByTemp[curTemp] || item.totalEpisodios || 1;
      if (curEp > maxEp) curEp = maxEp;
    }
    // Backdrops
    try {
      const imgData = await cachedTMDB(`tvimag_${item.tmdb_id}`, `tv/${item.tmdb_id}/images`, {}, null);
      const backdrops = (imgData?.backdrops || []).map(b => b.file_path).filter(Boolean);
      if (details.backdrop_path && !backdrops.includes(details.backdrop_path)) backdrops.unshift(details.backdrop_path);
      if (backdrops.length > 0) {
        bdImages = backdrops;
        bdIndex = 0;
        showBackdrop(0);
      } else if (details.backdrop_path) {
        bdImages = [details.backdrop_path];
        showBackdrop(0);
      }
    } catch {}
    // Poster atualizado
    if (details.poster_path && !item.imagem) {
      const tp2 = $('titlePoster');
      if (tp2) { tp2.src = `https://image.tmdb.org/t/p/w500${details.poster_path}`; tp2.style.display = 'block'; }
    }
    // Ano de lançamento (fallback via TMDB)
    if (!currentTitle.ano) {
      const y = (details.first_air_date || details.release_date || '').slice(0, 4);
      if (y) currentTitle.ano = y;
    }
    updateTitleMeta();
    // Logo do título
    try {
      const logo = await fetchTitleLogo(item.tmdb_id, 'tv');
      const lw = $('titleLogoWrap');
      const li = $('titleLogoImg');
      const tn = $('titleName');
      if (logo && li && lw) { li.src = logo; lw.style.display = 'flex'; if (tn) tn.style.display = 'none'; }
      else { if (lw) lw.style.display = 'none'; if (tn) tn.style.display = 'block'; }
    } catch {}
  } catch (e) {
    console.warn('Erro ao carregar detalhes TMDB:', e);
  }
  updateSteppers();
  syncEpisodePanel();
}

function showBackdrop(idx) {
  if (!bdImages.length) return;
  bdIndex = ((idx % bdImages.length) + bdImages.length) % bdImages.length;
  const img = $('titleBackdrop');
  img.src = `https://image.tmdb.org/t/p/w780${bdImages[bdIndex]}`;
  img.style.display = 'block';
  $('bdPrev').style.display = bdImages.length > 1 ? 'flex' : 'none';
  $('bdNext').style.display = bdImages.length > 1 ? 'flex' : 'none';
}

function navBackdrop(dir) { showBackdrop(bdIndex + dir); startBackdropAutoRotate(); }
function startBackdropAutoRotate() { stopBackdropAutoRotate(); if (bdImages.length <= 1) return; bdAutoTimer = setInterval(() => { if (!document.hidden) showBackdrop(bdIndex + 1); }, 15000); }
function stopBackdropAutoRotate() { if (bdAutoTimer) { clearInterval(bdAutoTimer); bdAutoTimer = null; } }

function updateSteppers() {
  $('tempDisplay').textContent = String(curTemp).padStart(2, '0');
  $('tempMax').textContent = String(seasonMax).padStart(2, '0');
  const maxEp = epMaxByTemp[curTemp] || currentTitle?.totalEpisodios || 1;
  $('epDisplay').textContent = String(curEp).padStart(2, '0');
  $('epMax').textContent = String(maxEp).padStart(2, '0');
  document.querySelectorAll('.stepper-btn').forEach(btn => {
    const target = btn.dataset.target;
    const step = parseInt(btn.dataset.step);
    if (target === 'temp') { btn.disabled = step > 0 ? curTemp >= seasonMax : curTemp <= 1; }
    else { const m = epMaxByTemp[curTemp] || 1; btn.disabled = step > 0 ? curEp >= m : curEp <= 0; }
  });
}

function applyStep(btn) {
  if (btn.dataset.holdFired === '1') { btn.dataset.holdFired = '0'; return; }
  const step = parseInt(btn.dataset.step);
  if (btn.dataset.target === 'temp') {
    const nt = Math.max(1, Math.min(seasonMax, curTemp + step));
    if (nt === curTemp) return;
    curTemp = nt; curEp = 0;
  } else {
    const m = epMaxByTemp[curTemp] || 1;
    const ne = Math.max(0, Math.min(m, curEp + step));
    if (ne === curEp) return;
    curEp = ne;
  }
  updateSteppers(); syncEpisodePanel();
}

let holdTimer = null, holdInterval = null;
let episodePanelSeq = 0;
function startHold(btn) {
  stopHold();
  holdTimer = setTimeout(() => { holdTimer = null; applyStep(btn); btn.dataset.holdFired = '1'; holdInterval = setInterval(() => applyStep(btn), 100); }, 300);
}
function stopHold() { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } if (holdInterval) { clearInterval(holdInterval); holdInterval = null; } }

async function syncEpisodePanel() {
  const my = ++episodePanelSeq;
  const et = $('epTitle'), ed = $('epDate'), es = $('epSynopsis'), el = $('epLoading');
  if (curEp === 0) { et.textContent = 'Ainda não iniciado'; ed.textContent = ''; es.textContent = 'Selecione um episódio para ver a sinopse.'; return; }
  if (!currentTitle?.tmdb_id) { et.textContent = `Episódio ${curEp}`; ed.textContent = ''; es.textContent = 'Sinopse não disponível.'; return; }
  el.classList.remove('hidden');
  try {
    const seasonData = await fetchSeasonCached(currentTitle.tmdb_id, curTemp);
    if (my !== episodePanelSeq) return; // resposta antiga (stepper segurado)
    const ep = seasonData?.episodes?.find(e => Number(e.episode_number) === curEp);
    if (ep) {
      et.textContent = ep.name || `Episódio ${curEp}`;
      ed.textContent = ep.air_date ? formatDateBR(ep.air_date) : '';
      es.textContent = ep.overview || 'Sinopse não disponível.';
    } else { et.textContent = `Episódio ${curEp}`; es.textContent = 'Sinopse não disponível.'; }
  } catch {
    if (my !== episodePanelSeq) return;
    et.textContent = `Episódio ${curEp}`; es.textContent = 'Erro ao carregar sinopse.';
  }
  el.classList.add('hidden');
}

function setStatus(btn, s) { currentStatus = s; document.querySelectorAll('#statusRow .status-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
function setTier(btn, t) { currentTier = t; document.querySelectorAll('#tierOptions .tier-opt').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }

async function saveTitle() {
  if (!currentTitle) return;
  try {
    const { data, error } = await supabase.from('items').update({
      temporada: curTemp, episodio: curEp, status: currentStatus, tier: currentTier || null,
    }).eq('id', currentTitle.id).select();
    if (error) throw error;
    if (data?.[0]) {
      const saved = data[0];
      // O retorno vem em snake_case: normaliza como em loadItems(), para não
      // sujar o item com `total_episodios`/`season_episodes_map` duplicados.
      const normalizado = {
        totalEpisodios: saved.total_episodios ?? currentTitle.totalEpisodios,
        seasonEpisodesMap: saved.season_episodes_map || currentTitle.seasonEpisodesMap || {},
        dataCriacao: saved.data_criacao ?? currentTitle.dataCriacao,
        dataAtualizacao: saved.data_atualizacao ?? currentTitle.dataAtualizacao,
      };
      Object.assign(currentTitle, saved, normalizado);
      const idx = state.items.findIndex(i => String(i.id) === String(currentTitle.id));
      if (idx !== -1) Object.assign(state.items[idx], normalizado, {
        temporada: saved.temporada, episodio: saved.episodio,
        status: saved.status, tier: saved.tier,
      });
    }
    showToast('Progresso salvo!');
    goBackFromTitle();
  } catch (e) { showToast('Erro ao salvar: ' + e.message); }
}

function goBackFromTitle() {
  stopBackdropAutoRotate();
  // Se veio de um pushState, usa o histórico do navegador (igual ao desktop).
  if (history.state && (history.state.titleId || history.state.previewRaw)) {
    history.back();
    return;
  }
  switchScreen(titleOriginScreen || 'catalog');
}

function hideTitlePage() {
  stopBackdropAutoRotate();
  currentTitle = null;
  switchScreen(titleOriginScreen || 'catalog');
}

// Roteamento: voltar do título e abrir URL profunda (#/titulo/ID).
window.addEventListener('popstate', (e) => {
  if (location.hash.startsWith('#/titulo/')) {
    const st = e.state || {};
    if (st.previewRaw) { openExternalPreview(st.previewRaw, { pushHistory: false }); return; }
    const id = location.hash.replace('#/titulo/', '');
    const item = state.items.find(i => String(i.id) === String(id));
    if (item) { openTitleFromCatalog(item, { pushHistory: false }); return; }
  }
  hideTitlePage();
});

function confirmDelete() {
  openConfirm('Remover título', 'Tem certeza que deseja remover este título?', async () => {
    if (!currentTitle) return;
    try {
      const { error } = await supabase.from('items').delete().eq('id', currentTitle.id);
      if (error) throw error;
      state.items = state.items.filter(i => i.id !== currentTitle.id);
      showToast('Título removido');
      goBackFromTitle();
    } catch (e) { showToast('Erro ao remover: ' + e.message); }
  });
}

// ================================================================
// EPISODES MODAL
// ================================================================
async function openEpisodesModal() {
  if (!currentTitle) return;
  $('episodesModalTitle').innerHTML = `<i class="fas fa-list"></i> Episódios - ${escapeHTML(currentTitle.nome)}`;
  $('episodesLoading').classList.remove('hidden');
  $('episodesContent').style.display = 'none';
  $('episodesContent').innerHTML = '';
  $('episodesModal').classList.add('open');
  try {
    let tmdbId = currentTitle.tmdb_id;
    if (!tmdbId) {
      const searchData = await callTMDB('search/tv', { query: currentTitle.nome }, 'pt-BR');
      const result = searchData.results?.[0];
      if (result) { tmdbId = result.id; currentTitle.tmdb_id = tmdbId; await supabase.from('items').update({ tmdb_id: tmdbId }).eq('id', currentTitle.id); }
    }
    const seriesDetails = await fetchTvDetailsCached(tmdbId);
    const seasons = (seriesDetails?.seasons || []).filter(s => s.season_number > 0);
    if (seasons.length === 0) throw new Error('Nenhuma temporada encontrada.');

    // O modal também é uma fonte confiável de totais: grava o mesmo mapa/total
    // que a tela de detalhe usa nos steppers.
    persistirTotaisCorrigidos(currentTitle, seasonMapFromDetails(seriesDetails), seriesDetails.number_of_episodes);

    const seasonsData = await Promise.all(seasons.map(s => fetchSeasonCached(tmdbId, s.season_number)));
    let html = '';
    seasonsData.forEach((sd, idx) => {
      const sn = seasons[idx].season_number;
      const sName = seasons[idx].name || `${sn}ª Temporada`;
      const epCount = sd?.episodes?.length || 0;
      html += `<div class="season-container"><div class="season-header" data-season="${sn}" onclick="toggleSeason(this)"><button class="season-toggle"><i class="fas fa-chevron-down"></i></button><h3><i class="fas fa-tag"></i> ${escapeHTML(sName)} <span class="ep-count">${epCount} episódios</span></h3></div><div class="season-episodes">`;
      if (sd?.overview) html += `<div class="season-overview" style="padding:0 16px 8px;font-size:0.78rem;color:var(--text-secondary)">${escapeHTML(sd.overview)}</div>`;
      (sd?.episodes || []).forEach(ep => {
        const epNum = ep.episode_number;
        const isCurrent = sn === curTemp && epNum === curEp;
        const thumb = ep.still_path ? `https://image.tmdb.org/t/p/w92${ep.still_path}` : null;
        html += `<div class="episode-item${isCurrent ? ' current' : ''}"><div class="episode-number">E${String(epNum).padStart(2, '0')}</div><div class="episode-thumb">${thumb ? `<img src="${thumb}" alt="Ep ${epNum}" loading="lazy" />` : '<i class="fas fa-film"></i>'}</div><div class="episode-info"><span class="episode-info-title">${escapeHTML(ep.name || `Episódio ${epNum}`)} <span class="episode-airdate">${ep.air_date ? formatDateBR(ep.air_date) : 'Data desconhecida'}</span></span><div class="episode-overview">${escapeHTML(ep.overview || 'Sinopse não disponível.')}</div></div></div>`;
      });
      html += `</div></div>`;
    });
    $('episodesContent').innerHTML = html;
    $('episodesLoading').classList.add('hidden');
    $('episodesContent').style.display = 'block';
    // Auto-expandir a temporada atual (igual ao desktop), não sempre a primeira.
    const currentHeader = document.querySelector(`.season-header[data-season="${curTemp}"]`);
    if (currentHeader) toggleSeason(currentHeader);
  } catch (e) {
    $('episodesContent').innerHTML = `<div class="search-empty"><i class="fas fa-exclamation-circle"></i><p>Erro ao carregar episódios: ${escapeHTML(e.message)}</p></div>`;
    $('episodesLoading').classList.add('hidden');
    $('episodesContent').style.display = 'block';
  }
}

function toggleSeason(header) {
  const episodes = header.nextElementSibling;
  const toggle = header.querySelector('.season-toggle');
  const isExpanded = episodes.classList.contains('expanded');
  if (isExpanded) {
    episodes.style.maxHeight = episodes.scrollHeight + 'px'; episodes.offsetHeight;
    episodes.style.maxHeight = '0px'; episodes.classList.remove('expanded'); toggle.classList.remove('expanded');
  } else {
    episodes.classList.add('expanded'); episodes.style.maxHeight = episodes.scrollHeight + 'px'; toggle.classList.add('expanded');
    episodes.addEventListener('transitionend', function onEnd(e) { if (e.propertyName === 'max-height' && episodes.classList.contains('expanded')) episodes.style.maxHeight = 'none'; episodes.removeEventListener('transitionend', onEnd); });
  }
}
function closeEpisodesModal() { $('episodesModal').classList.remove('open'); }

// ================================================================
// TITLE INFO MODAL
// ================================================================
async function openTitleInfoModal() {
  if (!currentTitle) return;
  $('titleInfoLoading').classList.remove('hidden');
  $('titleInfoContent').style.display = 'none';
  $('titleInfoModal').classList.add('open');
  try {
    let tmdbId = currentTitle.tmdb_id;
    if (!tmdbId) { const sd = await callTMDB('search/tv', { query: currentTitle.nome }, 'pt-BR'); tmdbId = sd.results?.[0]?.id; }
    if (!tmdbId) throw new Error('Sem TMDB ID');

    const [details, credits] = await Promise.all([
      cachedTMDB(`tvcache_${tmdbId}_ratings`, `tv/${tmdbId}`, { append_to_response: 'content_ratings' }, 'pt-BR'),
      cachedTMDB(`tvcred_${tmdbId}`, `tv/${tmdbId}/aggregate_credits`, {}, 'pt-BR').catch(() => null),
    ]);

    let html = `<div class="ti-hero"><div class="ti-name">${escapeHTML(details.name || currentTitle.nome)}</div></div>`;
    html += `<div class="ti-section"><div class="ti-section-title"><i class="fas fa-align-left"></i> Sinopse</div><p class="ti-text">${escapeHTML(details.overview || 'Sinopse não disponível.')}</p></div>`;
    // Links
    html += `<div class="ti-section"><div class="ti-section-title"><i class="fas fa-link"></i> Sites</div><div class="ti-links">`;
    if (details.homepage) html += `<a class="ti-link" href="${escapeHTML(details.homepage)}" target="_blank" rel="noopener"><i class="fas fa-globe"></i> Site oficial</a>`;
    html += `<a class="ti-link" href="https://www.imdb.com/find?q=${encodeURIComponent(details.name || currentTitle.nome)}" target="_blank" rel="noopener"><i class="fas fa-star"></i> IMDb</a>`;
    html += `<a class="ti-link" href="https://pt.wikipedia.org/wiki/${encodeURIComponent((details.name || currentTitle.nome).replace(/ /g, '_'))}" target="_blank" rel="noopener"><i class="fab fa-wikipedia-w"></i> Wikipédia</a>`;
    html += `<a class="ti-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent((details.name || currentTitle.nome) + ' trailer')}" target="_blank" rel="noopener"><i class="fab fa-youtube"></i> YouTube</a>`;
    html += `</div></div>`;
    // Detalhes
    const statusMap = { 'Returning Series': 'Em exibição', 'Ended': 'Finalizada', 'Canceled': 'Cancelada', 'In Production': 'Em produção', 'Planned': 'Planejada' };
    const genres = (details.genres || []).map(g => g.name).filter(Boolean);
    const runtime = Array.isArray(details.episode_run_time) && details.episode_run_time.length ? `${Math.min(...details.episode_run_time)} min` : '';
    html += `<div class="ti-section"><div class="ti-section-title"><i class="fas fa-list"></i> Detalhes</div><div class="ti-grid">`;
    html += `<div class="ti-cell ti-cell--wide"><span class="ti-cell-label">Gênero</span><span class="ti-cell-value">${genres.map(g => `<span class="ti-pill">${escapeHTML(g)}</span>`).join('')}</span></div>`;
    html += `<div class="ti-cell"><span class="ti-cell-label">Status</span><span class="ti-cell-value">${escapeHTML(statusMap[details.status] || details.status || '—')}</span></div>`;
    html += `<div class="ti-cell"><span class="ti-cell-label">Estreia</span><span class="ti-cell-value">${details.first_air_date ? formatDateBR(details.first_air_date) : '—'}</span></div>`;
    html += `<div class="ti-cell"><span class="ti-cell-label">Último episódio</span><span class="ti-cell-value">${details.last_air_date ? formatDateBR(details.last_air_date) : '—'}</span></div>`;
    html += `<div class="ti-cell"><span class="ti-cell-label">Duração</span><span class="ti-cell-value">${runtime || '—'}</span></div>`;
    html += `<div class="ti-cell"><span class="ti-cell-label">Tipo</span><span class="ti-cell-value">${escapeHTML(details.type || '—')}</span></div>`;
    html += `</div></div>`;
    // Elenco
    const cast = (credits?.cast || []).filter(c => c.name).slice(0, 12);
    if (cast.length) {
      html += `<div class="ti-section"><div class="ti-section-title"><i class="fas fa-users"></i> Elenco</div><div class="ti-cast">`;
      cast.forEach(p => {
        const photo = p.profile_path ? `<img src="https://image.tmdb.org/t/p/w185${p.profile_path}" alt="${escapeHTML(p.name)}" loading="lazy" style="width:72px;height:72px;border-radius:10px;object-fit:cover" />` : `<span class="ti-cast-ph"><i class="fas fa-user"></i></span>`;
        const role = (p.roles || []).map(r => r.character).filter(Boolean).slice(0, 2).join(' / ');
        html += `<div class="ti-cast-card">${photo}<div class="ti-cast-name">${escapeHTML(p.name)}</div>${role ? `<div class="ti-cast-role">${escapeHTML(role)}</div>` : ''}</div>`;
      });
      html += `</div></div>`;
    }
    $('titleInfoContent').innerHTML = html;
    $('titleInfoLoading').classList.add('hidden');
    $('titleInfoContent').style.display = 'block';
  } catch (e) {
    $('titleInfoContent').innerHTML = `<div class="search-empty"><i class="fas fa-exclamation-circle"></i><p>${escapeHTML(e.message)}</p></div>`;
    $('titleInfoLoading').classList.add('hidden');
    $('titleInfoContent').style.display = 'block';
  }
}
function closeTitleInfoModal() { $('titleInfoModal').classList.remove('open'); }

// ================================================================
// RELINK
// ================================================================
function openRelinkModal() { $('relinkSheet').classList.add('open'); $('relinkOverlay').classList.add('open'); }
function closeRelinkModal() { $('relinkSheet').classList.remove('open'); $('relinkOverlay').classList.remove('open'); }
async function handleRelinkSearch(val) {
  const results = $('relinkResults');
  if (val.length < 2) { results.innerHTML = ''; return; }
  try {
    const data = await callTMDB('search/tv', { query: val, language: 'pt-BR' }, 'pt-BR');
    results.innerHTML = (data.results || []).slice(0, 8).map(r => `
      <div class="relink-result" onclick="relinkTitle(${r.id})">
        ${r.poster_path ? `<img src="https://image.tmdb.org/t/p/w92${r.poster_path}" style="width:40px;height:60px;border-radius:6px;object-fit:cover" />` : '<div style="width:40px;height:60px;background:var(--bg-secondary);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--text-muted)"><i class="fas fa-film"></i></div>'}
        <div style="flex:1"><div class="relink-result-name">${escapeHTML(r.name)}</div><div class="relink-result-year">${(r.first_air_date || '').slice(0, 4) || '—'}</div></div>
      </div>`).join('');
  } catch { results.innerHTML = '<p style="color:var(--text-muted)">Erro na busca.</p>'; }
}

async function relinkTitle(tmdbId) {
  if (!currentTitle) return;
  try {
    // Mesmo fluxo do desktop (applyRelink): nome/imagem/ano e totais vão
    // juntos com o tmdb_id corrigido.
    const details = await fetchTvDetailsCached(tmdbId, 'pt-BR', { fresh: true });
    const map = seasonMapFromDetails(details);
    const nome = details?.name || currentTitle.nome;
    const ano = (details?.first_air_date || details?.release_date || '').slice(0, 4) || currentTitle.ano || null;
    const imagem = details?.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : currentTitle.imagem;
    const totalEpisodios = Number(details?.number_of_episodes) || currentTitle.totalEpisodios || 1;
    const seasonEpisodesMap = Object.keys(map).length ? map : (currentTitle.seasonEpisodesMap || {});
    const { data, error } = await supabase.from('items').update({
      nome, tmdb_id: tmdbId, imagem, ano,
      total_episodios: totalEpisodios,
      season_episodes_map: seasonEpisodesMap,
    }).eq('id', currentTitle.id).select();
    if (error) throw error;
    const saved = data?.[0];
    Object.assign(currentTitle, saved || {}, {
      totalEpisodios: saved?.total_episodios ?? totalEpisodios,
      seasonEpisodesMap: saved?.season_episodes_map || seasonEpisodesMap,
      dataAtualizacao: saved?.data_atualizacao ?? currentTitle.dataAtualizacao,
    });
    const idx = state.items.findIndex(i => String(i.id) === String(currentTitle.id));
    if (idx !== -1) Object.assign(state.items[idx], currentTitle);
    showToast('Título corrigido!');
    closeRelinkModal();
    openTitleFromCatalog(currentTitle);
  } catch (e) { showToast('Erro: ' + e.message); }
}

// ================================================================
// CONFIRM
// ================================================================
let confirmCallback = null;
function openConfirm(title, msg, cb) { $('confirmTitleText').textContent = title; $('confirmMsgText').textContent = msg; $('confirmSheet').classList.add('open'); $('confirmOverlay').classList.add('open'); confirmCallback = cb; }
function executeConfirm() { closeConfirm(); if (confirmCallback) confirmCallback(); confirmCallback = null; }
function closeConfirm() { $('confirmSheet').classList.remove('open'); $('confirmOverlay').classList.remove('open'); }

// ================================================================
// LIST MODAL
// ================================================================
function isUserCollection(l) {
  return !l?.is_system && l?.nome !== 'Próximos' && l?.nome !== 'Lista de Desejos';
}

function openListModal() {
  // Mesmo filtro do desktop: listas do sistema não são coleções selecionáveis.
  const lists = (state.userLists || [])
    .filter(l => l.nome !== 'Próximos' && l.nome !== 'Lista de Desejos')
    .sort((a, b) => (b.is_system ? 1 : 0) - (a.is_system ? 1 : 0));
  const selected = new Set((currentTitle?.lists || []).map(l => String(l.id)));
  $('listCheckboxes').innerHTML = lists.length ? lists.map(l => `
    <label class="list-checkbox">
      <input type="checkbox" ${selected.has(String(l.id)) ? 'checked' : ''} data-list-id="${l.id}" />
      <i class="fas ${l.is_system ? 'fa-heart' : 'fa-list'}"></i>
      <span>${escapeHTML(l.nome)}</span>
    </label>`).join('') : '<p style="padding:16px;color:var(--text-muted)">Nenhuma lista criada.</p>';
  $('listSheet').classList.add('open');
  $('listOverlay').classList.add('open');
}

async function saveTitleLists() {
  if (!currentTitle || currentTitle._isPreview) { closeListModal(); return; }
  const checked = new Set(
    Array.from(document.querySelectorAll('#listCheckboxes input:checked')).map(c => String(c.dataset.listId))
  );
  const current = new Set((currentTitle.lists || []).map(l => String(l.id)));
  // Calcula o diff — diferente do desktop, permite remover até a última lista.
  const toAdd = [...checked].filter(id => !current.has(id));
  const toRemove = [...current].filter(id => !checked.has(id));
  try {
    const addRes = await Promise.allSettled(toAdd.map(id => addItemToList(currentTitle.id, id)));
    const remRes = await Promise.allSettled(toRemove.map(id => removeItemFromList(currentTitle.id, id)));
    const addedOk = new Set(toAdd.filter((_, i) => addRes[i]?.status === 'fulfilled'));
    const removedOk = new Set(toRemove.filter((_, i) => remRes[i]?.status === 'fulfilled'));
    const userLists = state.userLists || [];
    currentTitle.lists = userLists
      .filter(l => current.has(String(l.id)) && !removedOk.has(String(l.id)))
      .concat(userLists.filter(l => addedOk.has(String(l.id))));
    const idx = state.items.findIndex(i => String(i.id) === String(currentTitle.id));
    if (idx >= 0) state.items[idx].lists = currentTitle.lists;
    showToast('Listas atualizadas');
  } catch (e) {
    console.warn('Erro ao atualizar listas:', e);
    showToast('Erro ao atualizar listas');
  } finally {
    closeListModal();
  }
}

function closeListModal() { $('listSheet').classList.remove('open'); $('listOverlay').classList.remove('open'); }

// ================================================================
// LISTAS (criar / renomear / excluir / reordenar)
// ================================================================
function openCollectionsSheet() {
  renderCollectionsList();
  $('collectionsSheet').classList.add('open');
  $('collectionsOverlay').classList.add('open');
}
function closeCollectionsSheet() {
  $('collectionsSheet').classList.remove('open');
  $('collectionsOverlay').classList.remove('open');
  editingCollectionId = null;
  $('collectionNameInput').value = '';
  $('collectionFormTitle').textContent = 'Nova lista';
  $('collectionSaveBtn').textContent = 'Adicionar';
}

function renderCollectionsList() {
  const lists = (state.userLists || []).filter(isUserCollection);
  const box = $('collectionsList');
  if (!box) return;
  box.innerHTML = lists.length ? lists.map((l, i) => `
    <div class="collection-row">
      <span class="collection-name">${escapeHTML(l.nome)}</span>
      <span class="collection-actions">
        <button onclick="moveCollection('${l.id}', -1)" ${i === 0 ? 'disabled' : ''} aria-label="Subir"><i class="fas fa-arrow-up"></i></button>
        <button onclick="moveCollection('${l.id}', 1)" ${i === lists.length - 1 ? 'disabled' : ''} aria-label="Descer"><i class="fas fa-arrow-down"></i></button>
        <button onclick="editCollection('${l.id}')" aria-label="Renomear"><i class="fas fa-pen"></i></button>
        <button onclick="deleteCollection('${l.id}')" aria-label="Excluir"><i class="fas fa-trash"></i></button>
      </span>
    </div>`).join('') : '<p class="home-hint">Nenhuma coleção criada.</p>';
}

async function reloadUserLists() {
  state.userLists = await fetchUserLists();
}

async function saveCollection() {
  const input = $('collectionNameInput');
  const nome = (input.value || '').trim();
  if (!nome) { showToast('Digite um nome para a coleção'); return; }
  if (nome.length > 100) { showToast('Nome muito longo (máx. 100)'); return; }
  try {
    if (editingCollectionId) {
      await renameList(editingCollectionId, nome);
      showToast('Coleção renomeada!');
    } else {
      await createList(nome);
      showToast('Coleção criada!');
    }
    editingCollectionId = null;
    input.value = '';
    $('collectionFormTitle').textContent = 'Nova coleção';
    $('collectionSaveBtn').textContent = 'Adicionar';
    await reloadUserLists();
    renderCollectionsList();
    renderColecaoOptions();
    renderLists();
  } catch (e) {
    showToast('Erro: ' + (e.message || 'Não foi possível salvar'));
  }
}

function editCollection(id) {
  const l = (state.userLists || []).find(x => String(x.id) === String(id));
  if (!l) return;
  editingCollectionId = String(id);
  $('collectionNameInput').value = l.nome;
  $('collectionFormTitle').textContent = 'Renomear coleção';
  $('collectionSaveBtn').textContent = 'Salvar';
  $('collectionNameInput').focus();
}

function deleteCollection(id) {
  const l = (state.userLists || []).find(x => String(x.id) === String(id));
  if (!l) return;
  openConfirm('Excluir coleção', `Tem certeza que deseja excluir "${l.nome}"?`, async () => {
    try {
      await deleteList(id);
      await reloadUserLists();
      if (state.currentListId === id) state.currentListId = null;
      if (catalogListId === id) { catalogListId = null; renderCatalog(); }
      renderCollectionsList();
      renderColecaoOptions();
      renderLists();
      showToast('Coleção excluída!');
    } catch (e) {
      showToast('Erro: ' + (e.message || 'Não foi possível excluir'));
    }
  });
}

async function moveCollection(id, delta) {
  const lists = (state.userLists || []).filter(isUserCollection);
  const idx = lists.findIndex(l => String(l.id) === String(id));
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= lists.length) return;
  const reordered = lists.slice();
  [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
  const ids = reordered.map(l => l.id);
  try {
    await updateListsOrder(ids.map((listId, i) => ({ id: listId, ordem: i })));
    const byId = new Map((state.userLists || []).map(l => [String(l.id), l]));
    const rest = (state.userLists || []).filter(l => !ids.some(x => String(x) === String(l.id)));
    state.userLists = [...ids.map(x => byId.get(String(x))).filter(Boolean), ...rest];
    renderCollectionsList();
    renderLists();
  } catch (e) {
    console.warn('Erro ao salvar ordem das coleções:', e);
    showToast('Erro ao salvar ordem');
  }
}

// ================================================================
// FILTER SHEETS
// ================================================================
function renderColecaoOptions() {
  const box = $('colecaoOptions');
  if (!box) return;
  const lists = (state.userLists || []).filter(isUserCollection);
  box.innerHTML = `<button class="sheet-option ${catalogListId ? '' : 'active'}" onclick="setCollectionFilter(this,'')">Todas</button>`
    + lists.map(l => `<button class="sheet-option ${String(catalogListId) === String(l.id) ? 'active' : ''}" onclick="setCollectionFilter(this,'${l.id}')">${escapeHTML(l.nome)}</button>`).join('');
}

function setCollectionFilter(btn, id) {
  const l = (state.userLists || []).find(x => String(x.id) === String(id || ''));
  // Preserva o tipo real do id (UUID string no banco): filterItems compara com ===.
  catalogListId = l ? l.id : (id || null);
  const box = $('colecaoOptions');
  if (box) box.querySelectorAll('.sheet-option').forEach(o => o.classList.remove('active'));
  btn?.classList.add('active');
  renderCatalog();
}

// ================================================================
// TELA "LISTAS" (menu inferior)
// Espelha o menu "Listas" do desktop: só coleções do usuário, com a
// quantidade de títulos e atalho para abrir a lista no catálogo.
// ================================================================
function renderLists() {
  const grid = $('listsGrid');
  if (!grid) return;
  const lists = (state.userLists || []).filter(isUserCollection);
  const countFor = (list) => (state.items || [])
    .filter(i => (i.lists || []).some(l => String(l.id) === String(list.id)))
    .length;

  $('listsSubtitle').textContent = `${lists.length} ${lists.length === 1 ? 'lista' : 'listas'} · Minhas Listas`;

  const tiles = lists.map(l => {
    const count = countFor(l);
    return `<div class="list-tile" onclick="openListCatalog('${l.id}')">
      <div class="list-tile-actions">
        <button type="button" aria-label="Renomear ${escapeHTML(l.nome)}" onclick="event.stopPropagation();editCollection('${l.id}')"><i class="fas fa-pen"></i></button>
        <button type="button" aria-label="Excluir ${escapeHTML(l.nome)}" onclick="event.stopPropagation();deleteCollection('${l.id}')"><i class="fas fa-trash"></i></button>
      </div>
      <div class="list-tile-icon"><i class="fas fa-list"></i></div>
      <div class="list-tile-name">${escapeHTML(l.nome)}</div>
      <div class="list-tile-count">${count} ${count === 1 ? 'título' : 'títulos'}</div>
    </div>`;
  });

  tiles.push(`<div class="list-tile list-tile--new" onclick="openCollectionsSheet()">
    <div class="list-tile-icon"><i class="fas fa-plus"></i></div>
    <div class="list-tile-name">Nova lista</div>
    <div class="list-tile-count">Criar</div>
  </div>`);

  grid.innerHTML = tiles.join('');
}

function openListCatalog(id) {
  const l = (state.userLists || []).find(x => String(x.id) === String(id));
  // Preserva o tipo real do id (UUID string no banco): filterItems compara com ===.
  catalogListId = l ? l.id : id;
  switchScreen('catalog');
}

function openFilterSheet() {
  renderColecaoOptions();
  $('filterSheet').classList.add('open');
  $('filterOverlay').classList.add('open');
}
function closeFilterSheet() { $('filterSheet').classList.remove('open'); $('filterOverlay').classList.remove('open'); }
function selectSheetOption(btn) { btn.parentElement.querySelectorAll('.sheet-option').forEach(o => o.classList.remove('active')); btn.classList.add('active'); }
function clearFilters() {
  catalogListId = null;
  document.querySelectorAll('#filterSheet .sheet-option.active').forEach(b => { b.classList.remove('active'); b.parentElement.querySelector('.sheet-option').classList.add('active'); });
  renderColecaoOptions();
  renderCatalog();
}
function openSortSheet() { $('sortSheet').classList.add('open'); $('sortOverlay').classList.add('open'); }
function closeSortSheet() { $('sortSheet').classList.remove('open'); $('sortOverlay').classList.remove('open'); }
function selectSortOption(btn, mode) { document.querySelectorAll('#sortOpts .sheet-option').forEach(s => s.classList.remove('active')); btn.classList.add('active'); sortMode = mode; setTimeout(() => { closeSortSheet(); renderCurrentCatalog(); showToast('Ordenado por ' + btn.textContent); }, 200); }
function advChipHTML(value, label) {
  return `<button type="button" class="sheet-option" data-value="${escapeHTML(String(value))}" aria-pressed="false" onclick="toggleAdvChip(this)">${escapeHTML(label)}</button>`;
}

// Mesmo ciclo de 3 estados do desktop: neutro → incluir → excluir → neutro.
function toggleAdvChip(btn) {
  const ativo = btn.classList.contains('active');
  const negado = btn.classList.contains('excluded');
  const proximo = !ativo && !negado ? 'include' : ativo ? 'exclude' : 'none';
  btn.classList.toggle('active', proximo === 'include');
  btn.classList.toggle('excluded', proximo === 'exclude');
  btn.setAttribute('aria-pressed', proximo === 'exclude' ? 'mixed' : String(proximo === 'include'));
  searchFilters = readSearchFilters();
  syncAdvBadge();
}

function setChipStates(containerId, include, exclude) {
  document.querySelectorAll(`#${containerId} .sheet-option`).forEach(btn => {
    const v = String(btn.dataset.value);
    const inc = include.map(String).includes(v);
    const exc = exclude.map(String).includes(v);
    btn.classList.toggle('active', inc);
    btn.classList.toggle('excluded', exc);
    btn.setAttribute('aria-pressed', exc ? 'mixed' : String(inc));
  });
}

function syncFilterSheetUI() {
  setChipStates('advGenres', searchFilters.genres, searchFilters.excludeGenres);
  setChipStates('advCountries', searchFilters.countries, searchFilters.excludeCountries);
  $('advCertification').value = searchFilters.certification || '';
  $('advRuntime').value = searchFilters.runtime || '';
  $('advLanguage').value = searchFilters.language || '';
  $('advStatus').value = searchFilters.status == null ? '' : String(searchFilters.status);
  $('advType').value = searchFilters.type == null ? '' : String(searchFilters.type);
  $('advSort').value = searchFilters.sort || '';
  $('advYearFrom').value = searchFilters.yearFrom || '';
  $('advYearTo').value = searchFilters.yearTo || '';
  syncAdvBadge();
}

async function openSearchFilterSheet() {
  const genresBox = $('advGenres');
  if (!genresBox.dataset.loaded) {
    genresBox.dataset.loaded = '1';
    // Lista real do TMDB (com fallback local), igual ao desktop.
    const list = await fetchTvGenres();
    genresBox.innerHTML = list.map(g => advChipHTML(g.id, g.name)).join('');
    $('advCountries').innerHTML = COUNTRY_OPTIONS.map(c => advChipHTML(c.code, c.name)).join('');
  }
  syncFilterSheetUI();
  $('searchFilterSheet').classList.add('open');
  $('searchFilterOverlay').classList.add('open');
}
function closeSearchFilterSheet() { $('searchFilterSheet').classList.remove('open'); $('searchFilterOverlay').classList.remove('open'); }

// ================================================================
// PROFILE
// ================================================================
function toggleNameEdit() {
  const row = $('nameEditRow');
  row.classList.toggle('hidden');
  if (!row.classList.contains('hidden')) { $('nameInput').value = $('profileDisplayName').textContent; $('nameInput').focus(); }
}

async function saveName() {
  const name = $('nameInput').value.trim();
  if (!name) return;
  try {
    await updateDisplayName(name);
    $('profileDisplayName').textContent = name;
    $('profileAvatar').textContent = name.slice(0, 2).toUpperCase();
    if (state.currentUser) state.currentUser.user_metadata = { ...state.currentUser.user_metadata, full_name: name };
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    $('greetingText').textContent = `Bom te ver, ${cap}`;
    toggleNameEdit();
    showToast('Nome atualizado');
  } catch (e) { showToast('Erro: ' + e.message); }
}

function resolveTheme() {
  if (state.theme === 'dark' || state.theme === 'light') return state.theme;
  return prefersLight.matches ? 'light' : 'dark';
}

// Mesmo contrato do desktop: data-theme, favicon e botão ativo. O favicon não
// troca por CSS, então precisa ser atualizado pelo href.
function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme();
  document.querySelectorAll('.theme-opt').forEach(b => b.classList.remove('active'));
  document.querySelector(`.theme-opt[onclick*="'${state.theme || 'system'}'"]`)?.classList.add('active');
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.href = resolveTheme() === 'light'
      ? 'assets/favicon/favicon-32-light.svg'
      : 'assets/favicon/favicon-32-dark.svg';
  }
}

// 'Sistema' continua vivo com a página aberta, como no desktop.
const onSystemThemeChange = () => { if (state.theme === 'system') applyTheme(); };
if (typeof prefersLight.addEventListener === 'function') prefersLight.addEventListener('change', onSystemThemeChange);
else if (typeof prefersLight.addListener === 'function') prefersLight.addListener(onSystemThemeChange);

function setTheme(theme) {
  state.theme = theme;
  try { localStorage.setItem(STORAGE_KEYS.THEME, theme); } catch {}
  applyTheme();
  showToast('Tema: ' + (theme === 'system' ? 'Sistema' : theme === 'dark' ? 'Escuro' : 'Claro'));
}

function logout() {
  openConfirm('Sair', 'Deseja realmente sair?', async () => {
    await supabase.auth.signOut();
    // Paridade com o desktop: limpa o cache persistido e todo o estado local.
    cacheClear();
    state.currentUser = null;
    state.items = [];
    state.userLists = [];
    currentTitle = null;
    authMode = 'login';
    catalogFilter = 'todos';
    sortMode = 'data-desc';
    groupByTier = false;
    catalogListId = null;
    searchFilters = emptySearchFilters();
    searchResults = [];
    searchPage = 1;
    searchTotalPages = 0;
    searchTotalResults = 0;
    searchMode = 'idle';
    searchSeq++;
    rouletteHistory = [];
    roulettePreview = null;
    affinitySelected = [];
    homeGenres = [];
    seasonMax = 1;
    epMaxByTemp = {};
    sectionVariety.clear();
    tmdbInflight.clear();
    Object.keys(externalPreviews).forEach(k => delete externalPreviews[k]);
    Object.keys(externalPreviewsById).forEach(k => delete externalPreviewsById[k]);
    stopBackdropAutoRotate();
    switchScreen('login');
  });
}

// ================================================================
// SCREEN SWITCHING
// ================================================================
function switchScreen(name) {
  currentScreen = name;
  // Saiu da tela de detalhe: limpa o hash da entrada atual do histórico.
  if (name !== 'title' && location.hash.startsWith('#/titulo/')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(name + 'Screen');
  if (el) el.classList.add('active');
  const isLogin = name === 'login';
  $('appHeader').classList.toggle('hidden', isLogin);
  $('bottomNav').classList.toggle('hidden', isLogin);
  document.querySelectorAll('.nav-tab').forEach(tab => { tab.classList.toggle('active', tab.dataset.screen === name); });
  if (name === 'home') renderHome();
  if (name === 'catalog') renderCatalog();
  if (name === 'proximos') renderProximos();
  if (name === 'lists') renderLists();
  window.scrollTo(0, 0);
}

// ================================================================
// EXPORT PARA window (necessário para onclick inline)
// ================================================================
Object.assign(window, {
  handleAuth, toggleAuthMode, togglePassword, checkPasswordStrength,
  switchScreen, showToast, openTitle, openTitleFromCatalog,
  spinRoulette, openRoulettePreview, addRouletteTitle, openPreview, openExternalPreview,
  externalCardHTML, registerExternalPreview,
  handleAffinitySearch, removeAffinity, selectAffinity, hideAffinityDropdown,
  analyzeAffinity, searchYear,
  openGenre, backToGenres, refreshGenres,
  refreshTrending, refreshUpcoming, refreshFavorites, refreshAbandoned,
  refreshCalendarSection, refreshAffinityRail,
  setCatalogFilter, setStatusFilter, toggleGroupByTier, renderProximos,
  toggleAdvChip, syncFilterSheetUI,
  handleSearch, loadMoreSearch, applySearchFilters, clearSearchFilters,
  navBackdrop, applyStep, startHold, stopHold,
  setStatus, setTier, saveTitle, goBackFromTitle, confirmDelete, cycleTier, cycleStatus,
  openEpisodesModal, toggleSeason, closeEpisodesModal,
  openTitleInfoModal, closeTitleInfoModal,
  openRelinkModal, closeRelinkModal, handleRelinkSearch, relinkTitle,
  openConfirm, executeConfirm, closeConfirm,
  openListModal, closeListModal, saveTitleLists,
  openCollectionsSheet, closeCollectionsSheet, renderCollectionsList,
  saveCollection, editCollection, deleteCollection, moveCollection,
  renderColecaoOptions, setCollectionFilter, renderLists, openListCatalog,
  openFilterSheet, closeFilterSheet, selectSheetOption, clearFilters,
  openSortSheet, closeSortSheet, selectSortOption,
  openSearchFilterSheet, closeSearchFilterSheet,
  toggleNameEdit, saveName, setTheme, logout, toggleProgressBar,
});

// ================================================================
// BOOT
// ================================================================
async function boot() {
  // Password strength listener
  $('authPassword')?.addEventListener('input', checkPasswordStrength);

  // Preferências visuais (theme/favicon/barra) aplicadas antes de qualquer tela.
  document.body.classList.toggle('is-progress-bar-hidden', !state.showProgressBar);
  applyTheme();

  // Check existing session
  const session = await getCurrentSession();
  if (session) {
    await initApp();
  } else {
    switchScreen('login');
  }
}

boot();
