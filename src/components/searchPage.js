/**
 * searchPage - Tela da aba Pesquisar com filtros avançados de descoberta.
 *
 * Antes a aba era só um input que chamava `search/tv`. Agora:
 *  - sem filtro e com texto: busca por nome (mesmo comportamento de antes);
 *  - com filtro ativo: `discover/tv` (servidor), com o texto aplicado localmente;
 *  - sem filtro e sem texto: estado ocioso, com o convite para começar.
 *
 * Os resultados usam o card único do projeto (`cardMarkup` +
 * `attachCardInteraction`), e "Carregar mais" pede a próxima página.
 */
import anime from 'animejs';
import { escapeHTML } from '../lib/catalog.js';
import { cardMarkup, attachCardInteraction } from './cards.js';
import {
  searchTitles,
  fetchTvGenres,
  hasActiveFilters,
  emptySearchFilters,
  COUNTRY_OPTIONS,
  AGE_RATING_OPTIONS,
  EPISODE_RUNTIME_OPTIONS,
  SEARCH_SORT_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  LANGUAGE_OPTIONS
} from '../lib/discoverSearch.js';

const $ = (id) => document.getElementById(id);

/** Preenche um `<select>` com uma opção "qualquer" e a lista de opções. */
function fillSelect(select, options, anyLabel, valueOf = (o) => o.value, labelOf = (o) => o.name) {
  if (!select) return;
  select.innerHTML = '';
  const any = document.createElement('option');
  any.value = '';
  any.textContent = anyLabel;
  select.appendChild(any);
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = String(valueOf(opt));
    el.textContent = labelOf(opt);
    select.appendChild(el);
  }
}

/** Cria a fileira de "chips" clicáveis (gêneros, países). */
function fillChips(container, options, valueOf, labelOf) {
  if (!container) return;
  container.innerHTML = '';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'adv-chip';
    btn.dataset.value = String(valueOf(opt));
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = labelOf(opt);
    container.appendChild(btn);
  }
}

/**
 * Inicializa a tela de pesquisa. Devolve uma API usada pelo roteador do app.
 * @param {Object} o
 * @param {(raw:Object, allResults:Array)=>void} o.onOpenTitle - Abre o título.
 * @returns {{activate: Function, refresh: Function}}
 */
export function setupSearchPage({ onOpenTitle } = {}) {
  const view = $('searchView');
  const input = $('pesquisaInput');
  const grid = $('pesquisaGrid');
  const empty = $('pesquisaEmpty');
  const loading = $('pesquisaLoading');
  const summary = $('pesquisaSummary');
  const more = $('pesquisaMore');
  const moreBtn = $('pesquisaMoreBtn');
  const countBadge = $('advFiltersCount');
  const clearBtn = $('advClear');
  const genresEl = $('advGenres');
  const countriesEl = $('advCountries');
  const certEl = $('advCertification');
  const runtimeEl = $('advRuntime');
  const languageEl = $('advLanguage');
  const statusEl = $('advStatus');
  const typeEl = $('advType');
  const sortEl = $('advSort');
  const yearFromEl = $('advYearFrom');
  const yearToEl = $('advYearTo');

  if (!view || !input || !grid) {
    return { activate() {}, refresh() {} };
  }

  let results = [];
  let page = 1;
  let totalPages = 1;
  let mode = 'idle';
  // Cada `run` incrementa a sequência; só a resposta do pedido mais recente é
  // aplicada. Sem isso, um guard de "ocupado" descartaria cliques rápidos em
  // vários filtros (marcar dois gêneros depressa buscaria só o primeiro).
  let seq = 0;
  let debounce = null;

  // ===== montagem inicial da interface =====
  fillSelect(certEl, AGE_RATING_OPTIONS, 'Qualquer classificação');
  fillSelect(runtimeEl, EPISODE_RUNTIME_OPTIONS, 'Qualquer duração');
  fillSelect(languageEl, LANGUAGE_OPTIONS, 'Qualquer idioma');
  fillSelect(statusEl, STATUS_OPTIONS, 'Qualquer situação');
  fillSelect(typeEl, TYPE_OPTIONS, 'Qualquer formato');
  fillSelect(sortEl, SEARCH_SORT_OPTIONS, 'Mais relevantes');
  if (sortEl) sortEl.value = '';

  fillChips(countriesEl, COUNTRY_OPTIONS, (o) => o.code, (o) => o.name);
  fillChips(genresEl, [], () => '', () => '');

  fetchTvGenres()
    .then((list) => {
      fillChips(genresEl, list, (g) => g.id, (g) => g.name);
    })
    .catch(() => {});

  // ===== leitura do estado da interface =====
  function readChipStates(container) {
    const include = [];
    const exclude = [];
    for (const b of container?.querySelectorAll('.adv-chip') || []) {
      if (b.classList.contains('excluded')) exclude.push(b.dataset.value);
      else if (b.classList.contains('active')) include.push(b.dataset.value);
    }
    return { include, exclude };
  }

  function readFilters() {
    const f = emptySearchFilters();
    const genresState = readChipStates(genresEl);
    f.genres = genresState.include.map(Number).filter(Number.isFinite);
    f.excludeGenres = genresState.exclude.map(Number).filter(Number.isFinite);
    const countriesState = readChipStates(countriesEl);
    f.countries = countriesState.include;
    f.excludeCountries = countriesState.exclude;
    f.certification = certEl?.value || '';
    f.runtime = runtimeEl?.value || '';
    f.language = languageEl?.value || '';
    f.status = statusEl?.value || '';
    f.type = typeEl?.value || '';
    f.sort = sortEl?.value || '';
    f.yearFrom = (yearFromEl?.value || '').trim();
    f.yearTo = (yearToEl?.value || '').trim();
    return f;
  }

  function activeCount(f) {
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

  function syncIndicators() {
    const f = readFilters();
    const n = activeCount(f);
    if (countBadge) {
      countBadge.textContent = String(n);
      countBadge.hidden = n === 0;
    }
  }

  // ===== render =====
  function showEmpty(message) {
    if (!empty) return;
    empty.style.display = '';
    const p = empty.querySelector('p');
    if (p) p.textContent = message;
  }

  function hideEmpty() {
    if (empty) empty.style.display = 'none';
  }

  function setSummary(result) {
    if (!summary) return;
    if (result.mode === 'idle' || result.totalResults <= 0) {
      summary.hidden = true;
      summary.textContent = '';
      return;
    }
    const total = result.totalResults.toLocaleString('pt-BR');
    summary.hidden = false;
    summary.textContent = result.totalResults === 1
      ? '1 resultado'
      : `${total} resultados`;
  }

  function animateCards(nodes) {
    if (!nodes.length || typeof anime !== 'function') return;
    anime({ targets: nodes, translateY: [24, 0], opacity: [0, 1], duration: 500, delay: anime.stagger(60), easing: 'easeOutQuad' });
  }

  function createCard(item, allRaw) {
    const raw = item.raw || {};
    const name = item.title || raw.name || raw.title || '';
    if (!name) return null;
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.tmdbId = item.id;
    card.dataset.mediaType = 'tv';
    card.dataset.poster = item.posterPath || '';
    card.dataset.name = name;
    card.dataset.year = (item.date || '').slice(0, 4);
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Adicionar ${name}`);
    card.innerHTML = cardMarkup({
      posterUrl: item.posterUrl || '',
      titleHtml: escapeHTML(name),
      titleAttr: name
    });
    attachCardInteraction(card, () => onOpenTitle && onOpenTitle({
      ...raw,
      id: item.id,
      title: name,
      name,
      poster_path: item.posterPath || raw.poster_path || '',
      posterUrl: item.posterUrl || '',
      first_air_date: item.date || raw.first_air_date || '',
      release_date: item.date || raw.release_date || '',
      date: item.date || ''
    }, allRaw));
    return card;
  }

  function renderPage(pageItems, { reset }) {
    if (reset) grid.innerHTML = '';
    const allRaw = results.map(i => i.raw).filter(Boolean);
    const frag = document.createDocumentFragment();
    const nodes = [];
    for (const item of pageItems) {
      const card = createCard(item, allRaw);
      if (card) { frag.appendChild(card); nodes.push(card); }
    }
    grid.appendChild(frag);
    animateCards(nodes);
  }

  function applyResult(result, { reset }) {
    mode = result.mode;
    page = result.page;
    totalPages = result.totalPages || 1;

    if (reset) results = [];
    // Descarta títulos já carregados (mesmo id) para "Carregar mais" não repetir.
    const known = new Set(results.map(i => String(i.id)));
    const fresh = result.items.filter((i) => {
      const id = String(i.id);
      if (known.has(id)) return false;
      known.add(id);
      return true;
    });
    results.push(...fresh);

    renderPage(fresh, { reset });
    setSummary(result);

    if (results.length === 0) {
      showEmpty('Nenhum resultado encontrado');
    } else {
      hideEmpty();
    }
    if (more) more.style.display = page < totalPages ? '' : 'none';
  }

  async function run({ reset = true } = {}) {
    const query = input.value.trim();
    const filters = readFilters();
    syncIndicators();

    if (query.length < 2 && !hasActiveFilters(filters) && !filters.sort) {
      seq++; // invalida respostas pendentes: a tela voltou ao estado ocioso
      results = [];
      page = 1;
      totalPages = 1;
      mode = 'idle';
      grid.innerHTML = '';
      if (more) more.style.display = 'none';
      if (summary) { summary.hidden = true; summary.textContent = ''; }
      if (loading) loading.style.display = 'none';
      showEmpty('Digite pelo menos 2 caracteres para buscar');
      return;
    }

    const my = ++seq;
    if (loading) loading.style.display = '';
    hideEmpty();
    if (reset) {
      grid.innerHTML = '';
      if (more) more.style.display = 'none';
    }

    try {
      const result = await searchTitles({ query, filters, page: reset ? 1 : page + 1 });
      if (my !== seq) return; // veio uma busca mais nova depois desta
      applyResult(result, { reset });
    } catch (err) {
      if (my !== seq) return;
      console.warn('Erro na pesquisa:', err);
      if (reset) { results = []; grid.innerHTML = ''; }
      if (more) more.style.display = 'none';
      showEmpty('Erro ao buscar. Tente novamente.');
    } finally {
      if (my === seq && loading) loading.style.display = 'none';
    }
  }

  // ===== eventos =====
  if (input) {
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => run({ reset: true }), 400);
    });
  }

  [certEl, runtimeEl, languageEl, statusEl, typeEl, sortEl].forEach((el) => {
    el?.addEventListener('change', () => run({ reset: true }));
  });

  [yearFromEl, yearToEl].forEach((el) => {
    el?.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => run({ reset: true }), 500);
    });
  });

  [genresEl, countriesEl].forEach((container) => {
    container?.addEventListener('click', (e) => {
      const chip = e.target.closest('.adv-chip');
      if (!chip) return;
      // Três estados: neutro -> incluir -> excluir -> neutro.
      const ativo = chip.classList.contains('active');
      const negado = chip.classList.contains('excluded');
      const proximo = !ativo && !negado ? 'include' : ativo ? 'exclude' : 'none';
      chip.classList.toggle('active', proximo === 'include');
      chip.classList.toggle('excluded', proximo === 'exclude');
      chip.setAttribute('aria-pressed', proximo === 'exclude' ? 'mixed' : String(proximo === 'include'));
      run({ reset: true });
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      genresEl?.querySelectorAll('.adv-chip.active, .adv-chip.excluded').forEach(c => { c.classList.remove('active', 'excluded'); c.setAttribute('aria-pressed', 'false'); });
      countriesEl?.querySelectorAll('.adv-chip.active, .adv-chip.excluded').forEach(c => { c.classList.remove('active', 'excluded'); c.setAttribute('aria-pressed', 'false'); });
      [certEl, runtimeEl, languageEl, statusEl, typeEl].forEach(el => { if (el) el.value = ''; });
      if (sortEl) sortEl.value = '';
      if (yearFromEl) yearFromEl.value = '';
      if (yearToEl) yearToEl.value = '';
      run({ reset: true });
    });
  }

  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      run({ reset: false });
    });
  }

  return {
    /** Chamado quando a aba Pesquisar fica ativa. */
    activate() {
      syncIndicators();
      if (mode === 'idle' && results.length === 0 && !grid.children.length) {
        showEmpty('Digite pelo menos 2 caracteres para buscar');
      }
    },
    /** Reexecuta a busca atual (usado após adicionar título, por exemplo). */
    refresh() {
      run({ reset: true });
    }
  };
}
