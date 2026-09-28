/**
 * HomePage - Renderiza a página inicial do Dat-Movie
 * Seções: Saudação, Continuar Assistindo, Novidades, Em Alta, Favoritos, Estatísticas
 */
import { escapeHTML, getTierClass, calcularProgresso } from '../lib/catalog.js';
import { getTrendingToSuggest, getFavorites, getCatalogStats, formatAirDate, getTitlesByGenre, getTitlesByYear, getRecommendationsForUser, CATEGORIES, getFullWidthCount, getUserTopGenres, composeCategoryList, getCalendarWeek, getAbandoned, getTimeline, getChallenge, pickRandomByTime, getAffinityRecommendations, normalizeTrendingItem, pickVariety } from '../lib/trendingApi.js';
import { callTMDB, resolveItemPosterUrl } from '../lib/api.js';
import { pickWithMix } from '../lib/recommendScoring.js';
import { getFriendPicks } from '../lib/friendPicks.js';
import { filterNotInCatalog } from '../lib/catalog.js';

/**
 * Estado de variedade por lista: semente do último clique e ids já exibidos,
 * para o botão de atualizar trazer títulos diferentes sempre que houver material.
 */
const sectionVariety = new Map();

function getVariety(key) {
  let v = sectionVariety.get(key);
  if (!v) {
    v = { seed: 0, seen: new Set() };
    sectionVariety.set(key, v);
  }
  return v;
}

function bumpSeed(key) {
  const v = getVariety(key);
  v.seed += 1;
  return v.seed;
}

/**
 * Escolhe os itens de uma lista evitando os já exibidos e marcando os novos.
 * @param {string} key - Chave da seção.
 * @param {Array} pool - Candidatos.
 * @param {number} count - Quantidade exibida.
 * @returns {Array} Itens escolhidos.
 */
function pickForSection(key, pool, count) {
  const v = getVariety(key);
  return pickVariety(pool, v.seen, count, v.seed);
}

/**
 * Escolhe os itens de um carrossel com cotas: a maioria são títulos conhecidos
 * (mainstream) e só uma parte é descoberta, evitando listas cheias de nicho
 * aleatório. A semente mantém o resultado determinístico entre renders.
 * @param {string} key - Chave da seção.
 * @param {Array} pool - Candidatos.
 * @param {number} count - Quantidade exibida.
 * @returns {Array} Itens escolhidos.
 */
function pickScoredForSection(key, pool, count) {
  const v = getVariety(key);
  return pickWithMix(pool, count, { seed: v.seed, seen: v.seen });
}

/**
 * Garante o cabeçalho da seção com o botão discreto de atualizar e o liga uma única vez.
 * @param {Element} section - Elemento da seção (.home-section).
 * @param {Function} onRefresh - Callback que recarrega a lista.
 * @param {string} [label] - Texto do title/aria-label do botão.
 */
function setupSectionRefresh(section, onRefresh, label = 'Atualizar lista') {
  if (!section || typeof onRefresh !== 'function') return;
  const title = section.querySelector('.home-section-title');
  if (!title) return;
  let head = title.parentElement;
  if (!head.classList.contains('home-section-head')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'home-section-head';
    title.replaceWith(wrapper);
    wrapper.appendChild(title);
    head = wrapper;
  }
  let btn = head.querySelector('.home-refresh-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'home-refresh-btn';
    btn.innerHTML = '<i class="fas fa-rotate"></i>';
    head.appendChild(btn);
  }
  btn.title = label;
  btn.setAttribute('aria-label', label);
  if (btn.dataset.bound) return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', async () => {
    btn.classList.add('is-loading');
    btn.disabled = true;
    try {
      await onRefresh();
    } catch (e) {
      console.warn('Erro ao atualizar lista:', e);
    }
    btn.classList.remove('is-loading');
    btn.disabled = false;
  });
}

/**
 * Gera saudação personalizada a partir do usuário
 * @param {Object|null} user - objeto com email, user_metadata
 * @returns {{greeting:string, subtitle:string}}
 */
export function buildGreeting(user) {
  let name = '';
  if (user) {
    name = user.user_metadata?.name || '';
    if (!name && user.email) {
      name = user.email.split('@')[0];
    }
  }
  if (!name) {
    return { greeting: 'Bem-vindo', subtitle: 'Acompanhe o que assiste, o que já viu e o que quer ver' };
  }
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return { greeting: `Olá, ${escapeHTML(cap)}`, subtitle: 'Acompanhe o que assiste, o que já viu e o que quer ver' };
}

/**
 * Cria skeleton loader para grids horizontais
 * @param {number} count
 * @returns {string} HTML
 */
export function skeletonHTML(count = null) {
  const c = count ?? getFullWidthCount();
  return Array.from({ length: c }).map(() => `
    <div class="home-skeleton-card" aria-hidden="true">
      <div class="skeleton-img"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
    </div>
  `).join('');
}

/**
 * Cria card pequeno para Home (120px)
 */
function createHomeCard({ posterUrl, title, subtitle, badge, onClick, extraHtml = '', actionBtnHtml = '', item = null }) {
  const card = document.createElement('div');
  card.className = 'home-card';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', title);
  const safeTitle = escapeHTML(title);
  const safeSubtitle = subtitle ? escapeHTML(subtitle) : '';
  const safeBadge = badge ? escapeHTML(badge) : '';
  card.innerHTML = `
    <div class="home-card-img">
      ${posterUrl ? `<img src="${escapeHTML(posterUrl)}" alt="${safeTitle}" loading="lazy" />` : `<i class="fas fa-film"></i>`}
      ${safeBadge ? `<span class="home-card-badge">${safeBadge}</span>` : ''}
      ${actionBtnHtml}
    </div>
    <div class="home-card-body">
      <h3 title="${safeTitle}">${safeTitle}</h3>
      ${safeSubtitle ? `<span class="home-card-subtitle">${safeSubtitle}</span>` : ''}
      ${extraHtml}
    </div>
  `;
  if (onClick) {
    card.addEventListener('click', onClick);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } });
  }
  if (actionBtnHtml) {
    const btn = card.querySelector('.home-card-add');
    if (btn && onClick) {
      // Prevent double trigger: action button stops propagation and still triggers onClick via separate handler
      // So we make button handle its own click and stop propagation to card
      btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(e); });
    }
  }
  if (item && item.tmdb_id) {
    const img = card.querySelector('.home-card-img img');
    if (img) {
      resolveItemPosterUrl(item, 'w500')
        .then(url => { if (url && img.src !== url) img.src = url; })
        .catch(() => {});
    }
  }
  return card;
}

/**
 * Renderiza a estrutura base da Home dentro do container
 * @param {HTMLElement} container - #homeSection
 * @param {Object} context - { user, items, onCardClick, onAddFromTrending, onOpenAddModal }
 */
export function renderHomeBase(container, context) {
  const { user } = context;
  const { greeting, subtitle } = buildGreeting(user);

  container.innerHTML = `
    <section class="home-greeting" aria-label="Saudação">
      <h1 class="home-greeting-title">${greeting}</h1>
      <p class="home-greeting-subtitle">${escapeHTML(subtitle)}</p>
    </section>

    <section class="home-stats" id="homeStats" aria-label="Estatísticas rápidas">
      <div class="home-stats-grid"></div>
    </section>

    <section class="home-section" id="homeContinueSection" aria-label="Continuar assistindo">
      <h2 class="home-section-title"><i class="fas fa-play"></i> Continuar Assistindo</h2>
      <div class="home-continue-grid" id="homeContinueGrid"></div>
      <div class="home-empty" id="homeContinueEmpty" style="display:none;">
        <p>Você ainda não começou nenhum título. Que tal adicionar um?</p>
        <button class="home-empty-btn" id="homeContinueAddBtn"><i class="fas fa-plus"></i> Adicionar título</button>
      </div>
    </section>

    <section class="home-section" id="homePicksSection" aria-label="Títulos para você" style="display:none;">
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas fa-user-friends"></i> Títulos para você</h2>
        <button type="button" id="homePicksRefresh" class="home-refresh-btn" title="Atualizar indicações" aria-label="Atualizar indicações"><i class="fas fa-rotate"></i></button>
      </div>
      <div class="home-h-scroll" id="homePicksGrid"></div>
      <div class="home-skeleton" id="homePicksSkeleton">${skeletonHTML()}</div>
    </section>

<section class="home-section home-section--panel" id="homeRouletteSection" aria-label="Roleta">
      <h2 class="home-section-title"><i class="fas fa-random"></i> Não sabe o que assistir?</h2>
      <div class="home-roulette-controls" style="justify-content:center; padding:12px 0;">
        <button id="homeRouletteBtn" class="home-empty-btn"><i class="fas fa-dice"></i> Sortear título novo</button>
      </div>
      <div id="homeRouletteResult" class="home-roulette-result" style="display:none; justify-content:center;"></div>
      <div id="homeRouletteHistory" class="home-roulette-history" style="display:none;"><small>Últimos sorteados:</small> <span id="homeRouletteHistoryList"></span></div>
    </section>


    

    <section class="home-section" id="homeCalendarSection" aria-label="Calendário da semana" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-calendar-week"></i> Episódios da Semana</h2>
      <p class="home-calendar-hint" id="homeCalendarHint" style="display:none;"></p>
      <div id="homeCalendarGrid" class="home-calendar-grid"></div>
      <div class="home-skeleton" id="homeCalendarSkeleton">${skeletonHTML()}</div>
    </section>

<section class="home-section home-section--panel" id="homeAffinitySection" aria-label="Descoberta por afinidade">
      <h2 class="home-section-title"><i class="fas fa-flask"></i> Descubra por afinidade</h2>
      <p class="home-affinity-hint">Adicione até 4 títulos que você curtiu e descubra algo novo para assistir</p>
      <div class="home-affinity-search">
        <div class="toolbar-search" style="flex:1; max-width:420px;">
          <i class="fas fa-search"></i>
          <input type="text" id="homeAffinityInput" placeholder="Buscar título para comparar..." aria-label="Buscar título para afinidade" />
        </div>
        <div id="homeAffinityDropdown" class="home-affinity-dropdown" style="display:none;"></div>
      </div>
      <div id="homeAffinityChips" class="home-affinity-chips"></div>
      <button id="homeAffinityAnalyze" class="home-empty-btn" disabled><i class="fas fa-microscope"></i> Analisar (0/4)</button>
      <div class="home-h-scroll" id="homeAffinityGrid" style="display:none; margin-top:12px;"></div>
      <div class="home-skeleton" id="homeAffinitySkeleton" style="display:none;">${skeletonHTML()}</div>
      <div class="home-error" id="homeAffinityError" style="display:none;"></div>
    </section>


    
        
<section class="home-section" id="homeAbandonedSection" aria-label="Abandonados" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-pause-circle"></i> Abandonados</h2>
      <div class="home-h-scroll" id="homeAbandonedGrid"></div>
    </section>

<section class="home-section home-section--panel" id="homeYearSection" aria-label="Destaques do ano" style="display:none;">
      <h2 class="home-section-title" id="homeYearTitle"><i class="fas fa-calendar-alt"></i> Destaques do ano</h2>
      <div class="home-year-row">
        <div class="toolbar-search" style="flex:0 0 150px;">
          <i class="fas fa-calendar-alt"></i>
          <input type="text" id="homeYearInput" inputmode="numeric" maxlength="4" placeholder="2020" aria-label="Ano para buscar destaques" />
        </div>
        <button type="button" id="homeYearSearch" class="home-empty-btn"><i class="fas fa-magnifying-glass"></i> Buscar ano</button>
      </div>
      <div class="home-h-scroll" id="homeYearGrid"></div>
      <div class="home-skeleton" id="homeYearSkeleton" style="display:none;">${skeletonHTML()}</div>
      <div class="home-error" id="homeYearError" style="display:none;"></div>
    </section>

    <section class="home-section" id="homeRecommendSection" aria-label="Recomendações" style="display:none;">
      <div class="home-section-head">
        <h2 class="home-section-title" id="homeRecommendTitle"><i class="fas fa-heart"></i> Recomendações</h2>
        <button type="button" id="homeRecommendRefresh" class="home-refresh-btn" title="Atualizar recomendações" aria-label="Atualizar recomendações"><i class="fas fa-rotate"></i></button>
      </div>
      <div class="home-h-scroll" id="homeRecommendGrid"></div>
      <div class="home-skeleton" id="homeRecommendSkeleton">${skeletonHTML()}</div>
    </section>

    <section class="home-section" id="homeTrendingSection" aria-label="Em alta" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-fire"></i> Em Alta</h2>
      <div class="home-h-scroll" id="homeTrendingGrid"></div>
      <div class="home-skeleton" id="homeTrendingSkeleton">${skeletonHTML()}</div>
      <div class="home-error" id="homeTrendingError" style="display:none;"></div>
    </section>

    <section class="home-section" id="homeFavoritesSection" aria-label="Seus favoritos" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-star"></i> Seus Favoritos</h2>
      <div class="home-h-scroll" id="homeFavoritesGrid"></div>
    </section>

    <section class="home-categories" id="homeCategories" aria-label="Categorias"></section>

    <div class="home-foot">
      <button type="button" id="homeBackToTop" class="home-backtop">
        <i class="fas fa-arrow-up"></i> Voltar ao topo
      </button>
    </div>
  `;

  // Bind add button
  const addBtn = container.querySelector('#homeContinueAddBtn');
  if (addBtn && context.onOpenAddModal) {
    addBtn.addEventListener('click', context.onOpenAddModal);
  }

  // Voltar ao topo.
  // Cuidado: o body usa `min-height:100vh` com display:flex, então o
  // .main-content CRESCE com o conteúdo e nunca vira scroller — apesar de ter
  // `overflow-y:auto` no CSS. Na prática quem rola é a janela. Por isso
  // conferimos se o elemento realmente tem rolagem antes de usá-lo; senão o
  // scrollTo é um no-op silencioso.
  const backToTop = container.querySelector('#homeBackToTop');
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      const opcoes = { top: 0, left: 0, behavior: 'smooth' };
      const scroller = container.closest('.main-content');
      if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) {
        scroller.scrollTo(opcoes);
      } else {
        window.scrollTo(opcoes);
      }
    });
  }
}

/**
 * Renderiza estatísticas rápidas
 */
export function renderHomeStats(container, items) {
  const stats = getCatalogStats(items);
  const grid = container.querySelector('.home-stats-grid');
  if (!grid) return;
  // Substitui contagens simples por métricas úteis: tempo investido, progresso médio, taxa de conclusão
  grid.innerHTML = `
    <div class="stat-card stat-card--highlight">
      <i class="fas fa-clock stat-icon"></i>
      <span class="stat-number">${stats.horasAssistidas}h</span>
      <span class="stat-label">${stats.totalEpisodiosAssistidos} episódios assistidos</span>
    </div>
    <div class="stat-card">
      <i class="fas fa-chart-line stat-icon"></i>
      <span class="stat-number">${stats.progressoMedio}%</span>
      <div class="stat-progress"><div class="stat-progress-bar" style="width:${stats.progressoMedio}%"></div></div>
      <span class="stat-label">Progresso médio</span>
    </div>
    <div class="stat-card">
      <i class="fas fa-check-circle stat-icon"></i>
      <span class="stat-number">${stats.taxaConclusao}%</span>
      <span class="stat-label">${stats.concluidos} de ${stats.total} concluídos</span>
    </div>
    <div class="stat-card">
      <i class="fas fa-play stat-icon"></i>
      <span class="stat-number">${stats.assistindo}</span>
      <span class="stat-label">Em andamento • ${stats.planejados} na lista</span>
    </div>
  `;
}

/**
 * Renderiza Continuar Assistindo (carrossel horizontal máx. 20)
 */
export function renderHomeContinue(container, items, onCardClick, onOpenAddModal) {
  const grid = container.querySelector('#homeContinueGrid');
  const empty = container.querySelector('#homeContinueEmpty');
  const section = container.querySelector('#homeContinueSection');
  if (!grid || !empty) return;

  const pool = items.filter((i) => i.status === 'assistindo');
  pool.sort((a, b) => new Date(b.dataAtualizacao || b.dataCriacao || 0) - new Date(a.dataAtualizacao || a.dataCriacao || 0));
  const limited = pool.slice(0, 20);

  if (limited.length === 0) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    empty.style.display = '';
    if (section) section.style.display = '';
    return;
  }
  empty.style.display = 'none';
  grid.style.display = '';
  if (section) section.style.display = '';
  grid.innerHTML = '';
  // Reuse card creation similar to cards.js but horizontal mini
  limited.forEach((item) => {
    const posterUrl = item.imagem || '';
    const subtitle = `T${item.temporada} · Ep ${String(item.episodio).padStart(2, '0')}`;
    const extra = `<div class="home-card-progress"><div class="home-card-progress-track"><div class="home-card-progress-bar" style="width:${calcularProgresso(item)}%"></div></div></div>`;
    const card = createHomeCard({
      posterUrl,
      title: item.nome,
      subtitle,
      extraHtml: extra,
      onClick: () => onCardClick && onCardClick(items.indexOf(item)),
      item
    });
    grid.appendChild(card);
  });
  animateCards(grid);
}

/**
 * Renderiza Favoritos (S+ e S)
 */
export function renderHomeFavorites(container, items, onCardClick) {
  const section = container.querySelector('#homeFavoritesSection');
  const grid = container.querySelector('#homeFavoritesGrid');
  if (!section || !grid) return;
  const all = getFavorites(items);
  const favs = pickForSection('favorites', all, getFullWidthCount());
  if (all.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  setupSectionRefresh(section, () => {
    bumpSeed('favorites');
    renderHomeFavorites(container, items, onCardClick);
  }, 'Atualizar favoritos');
  grid.innerHTML = '';
  favs.forEach((item) => {
    const posterUrl = item.imagem || '';
    const card = createHomeCard({
      posterUrl,
      title: item.nome,
      subtitle: '',
      onClick: () => onCardClick && onCardClick(items.indexOf(item)),
      item
    });
    grid.appendChild(card);
  });
  animateCards(grid);
}

/**
 * Carrega e renderiza Em Alta (trending)
 */
/**
 * Carrega os títulos mais relevantes de um ano escolhido pelo usuário.
 *
 * O ano vai como `discover/tv?first_air_date_year` — filtrar no cliente
 * traria o que a API devolve inteiro, sem limite de relevância. O padrão de
 * painel com controle + carrossel é o mesmo da seção de afinidade.
 *
 * @param {Element} container - Container da home.
 * @param {Array} items - Catálogo do usuário.
 * @param {Function} onAddFromTrending - Callback dos cards.
 * @param {number} [ano] - Ano a carregar. Default: ano atual.
 * @returns {Promise<void>}
 */
export async function loadAndRenderByYear(container, items, onAddFromTrending, ano) {
  const section = container.querySelector('#homeYearSection');
  const grid = container.querySelector('#homeYearGrid');
  const skel = container.querySelector('#homeYearSkeleton');
  const errEl = container.querySelector('#homeYearError');
  const titulo = container.querySelector('#homeYearTitle');
  if (!section || !grid || !skel) return;

  const anoAtual = String(ano ?? new Date().getFullYear());
  if (titulo) {
    const icone = '<i class="fas fa-calendar-alt"></i>';
    titulo.innerHTML = `${icone} Destaques de ${escapeHTML(anoAtual)}`;
  }
  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  if (errEl) errEl.style.display = 'none';

  try {
    const achados = await getTitlesByYear(anoAtual, items, getFullWidthCount());
    skel.style.display = 'none';
    if (!achados || achados.length === 0) {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = `Nenhum título encontrado para ${anoAtual}.`;
      }
      return;
    }
    grid.style.display = '';
    grid.innerHTML = '';
    achados.forEach((t) => {
      const card = createHomeCard({
        posterUrl: t.posterUrl,
        title: t.title,
        subtitle: t.date ? formatAirDate(t.date) : 'Série',
        onClick: () => onAddFromTrending && onAddFromTrending(t)
      });
      grid.appendChild(card);
    });
    animateCards(grid);
  } catch (e) {
    skel.style.display = 'none';
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'Não foi possível buscar os títulos deste ano.';
    }
    console.warn('Erro ao buscar por ano:', e);
  }
}

/**
 * Liga o campo de ano: valida, busca e renderiza.
 */
function setupYearPicker(container, items, onAddFromTrending) {
  const input = container.querySelector('#homeYearInput');
  const btn = container.querySelector('#homeYearSearch');
  if (!input || !btn) return;

  async function buscar() {
    const ano = input.value.trim();
    if (!/^\d{4}$/.test(ano)) {
      input.classList.add('is-invalid');
      input.focus();
      return;
    }
    input.classList.remove('is-invalid');
    btn.disabled = true;
    try {
      await loadAndRenderByYear(container, items, onAddFromTrending, ano);
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', buscar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscar(); }
  });
  input.addEventListener('input', () => input.classList.remove('is-invalid'));
  // Sem setupSectionRefresh aqui: o controle desta seção é o campo de ano,
  // não um "atualizar" que voltaria para o ano corrente por baixo dos panos.
}

export async function loadAndRenderTrending(container, items, onAddFromTrending) {
  const section = container.querySelector('#homeTrendingSection');
  const grid = container.querySelector('#homeTrendingGrid');
  const skel = container.querySelector('#homeTrendingSkeleton');
  const errEl = container.querySelector('#homeTrendingError');
  if (!section || !grid || !skel) return;

  setupSectionRefresh(section, () => {
    bumpSeed('trending');
    loadAndRenderTrending(container, items, onAddFromTrending);
  }, 'Atualizar em alta');

  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  if (errEl) errEl.style.display = 'none';

  try {
    const seed = getVariety('trending').seed;
    const pool = await getTrendingToSuggest(items, null, { window: seed % 2 === 0 ? 'week' : 'day' });
    const trending = pickScoredForSection('trending', pool, getFullWidthCount());
    skel.style.display = 'none';
    if (!trending || trending.length === 0) {
      section.style.display = 'none';
      return;
    }
    grid.style.display = '';
    grid.innerHTML = '';
    trending.forEach((t) => {
      const subtitle = t.date ? formatAirDate(t.date) : 'Série';
      const card = createHomeCard({
        posterUrl: t.posterUrl,
        title: t.title,
        subtitle,
        onClick: () => onAddFromTrending && onAddFromTrending(t)
      });
      grid.appendChild(card);
    });
    animateCards(grid);
  } catch (e) {
    skel.style.display = 'none';
    // Spec: se busca falhar ocultar a seção
    section.style.display = 'none';
    console.warn('Erro trending:', e);
  }
}

/**
 * Card de indicação: a mesma anatomia do card da home, mais a frase que
 * justifica a indicação e o rosto de quem fez.
 *
 * A frase é uma linha de verdade, não um rótulo — por isso ela é o elemento de
 * maior peso do card, e o subtítulo da data cede lugar a ela.
 * @param {Object} pick - Item devolvido por `getFriendPicks`.
 * @param {Function} onClick - Callback de abertura.
 * @returns {HTMLElement} Card.
 */
function createPickCard(pick, onClick) {
  const card = document.createElement('div');
  card.className = 'home-card home-pick-card';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', pick.title);
  const title = escapeHTML(pick.title);
  card.innerHTML = `
    <div class="home-card-img">
      ${pick.posterUrl ? `<img src="${escapeHTML(pick.posterUrl)}" alt="${title}" loading="lazy" />` : '<i class="fas fa-film"></i>'}
    </div>
    <div class="home-card-body">
      <h3 title="${title}">${title}</h3>
      <p class="home-pick-reason">${escapeHTML(pick.reason)}</p>
      ${pick.person?.profileUrl ? `<img class="home-pick-avatar" src="${escapeHTML(pick.person.profileUrl)}" alt="" loading="lazy" />` : ''}
    </div>
  `;
  if (onClick) {
    card.addEventListener('click', onClick);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } });
  }
  return card;
}

/**
 * Carrega "Títulos para você".
 *
 * A seção se esconde em três casos, e nos três a resposta é a mesma: não há
 * âncora forte no catálogo, a API falhou, ou nenhum candidato tem criador em
 * comum verificado. Preferimos não mostrar a mostrar indicação sem lastro — é a
 * diferença entre "um amigo indicou" e "o app escolheu".
 * @param {Element} container - Container da home.
 * @param {Array} items - Catálogo do usuário.
 * @param {Function} onAddFromTrending - Callback dos cards.
 * @returns {Promise<void>}
 */
export async function loadAndRenderFriendPicks(container, items, onAddFromTrending) {
  const section = container.querySelector('#homePicksSection');
  const grid = container.querySelector('#homePicksGrid');
  const skel = container.querySelector('#homePicksSkeleton');
  if (!section || !grid || !skel) return;

  setupSectionRefresh(section, () => {
    bumpSeed('picks');
    loadAndRenderFriendPicks(container, items, onAddFromTrending);
  }, 'Atualizar indicações');

  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';

  try {
    const picks = await getFriendPicks(items, { anchorIndex: getVariety('picks').seed });
    skel.style.display = 'none';
    if (!picks || picks.length === 0) {
      section.style.display = 'none';
      return;
    }
    grid.style.display = '';
    grid.innerHTML = '';
    picks.forEach((pick) => {
      grid.appendChild(createPickCard(pick, () => onAddFromTrending && onAddFromTrending(pick)));
    });
    animateCards(grid);
  } catch (e) {
    skel.style.display = 'none';
    section.style.display = 'none';
    console.warn('Erro ao buscar indicações:', e);
  }
}

export async function loadAndRenderRecommendations(container, items, onCardClick, onAddFromTrending) {
  const section = container.querySelector('#homeRecommendSection');
  const grid = container.querySelector('#homeRecommendGrid');
  const skel = container.querySelector('#homeRecommendSkeleton');
  const titleEl = container.querySelector('#homeRecommendTitle');
  if (!section || !grid || !skel) return;

  setupSectionRefresh(section, () => {
    bumpSeed('recommend');
    loadAndRenderRecommendations(container, items, onCardClick, onAddFromTrending);
  }, 'Atualizar recomendações');

  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  try {
    const data = await getRecommendationsForUser(items, null, { baseIndex: getVariety('recommend').seed });
    const pool = data?.pool?.length ? data.pool : (data?.recommendations || []);
    const chosen = pickScoredForSection('recommend', pool, getFullWidthCount());
    skel.style.display = 'none';
    if (!data || !chosen || chosen.length === 0) {
      section.style.display = 'none';
      return;
    }
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-heart"></i> Se você gostou de "${escapeHTML(data.base.nome)}" vai gostar disso`;
    grid.style.display = '';
    grid.innerHTML = '';
    chosen.forEach((t) => {
      const subtitle = t.date ? formatAirDate(t.date) : 'Série';
      const card = createHomeCard({
        posterUrl: t.posterUrl,
        title: t.title,
        subtitle,
        onClick: () => onAddFromTrending && onAddFromTrending(t)
      });
      grid.appendChild(card);
    });
    animateCards(grid);
  } catch (e) {
    skel.style.display = 'none';
    section.style.display = 'none';
  }
}

/**
 * Ordenação do pool das categorias: sempre por popularidade.
 *
 * Antes rodava `CAT_SORTS` alternando `popularity.desc`, `vote_average.desc` e
 * `first_air_date.desc` a cada refresh para dar variedade. Medido no pool real,
 * isso foi um erro: o `discover` por nota/data joga na lista muita nota alta com
 * pouca popularidade, que é justamente o material "nada a ver" que o usuário
 * reclamou. Drama com `vote_average.desc` devolvia 20 itens aceitos em 160,
 * contra 126 com `popularity.desc`.
 *
 * A variedade agora vem da seleção (`pickWithMix`), que anda pelo ranking de
 * score preferindo o que ainda não foi exibido. Assim o pool é sempre material
 * conhecido e a lista ainda muda a cada clique.
 */
const CAT_SORT = 'popularity.desc';

/**
 * Carrega uma única categoria, sem tocar nas demais seções, para que o botão de
 * atualizar recarregue apenas a lista em que foi clicado.
 * @param {Element} container - Container da home.
 * @param {Array} items - Catálogo.
 * @param {Object} cat - Categoria { id, name, icon }.
 * @param {Function} onAddFromTrending - Callback dos cards.
 * @returns {Promise<void>}
 */
function renderCategorySection(container, items, cat, onAddFromTrending) {
  const wrap = container.querySelector('#homeCategories');
  if (!wrap) return Promise.resolve();
  const key = `cat-${cat.id}`;
  let section = wrap.querySelector(`#homeCatSection-${cat.id}`);
  if (!section) {
    section = document.createElement('section');
    section.className = 'home-section';
    section.id = `homeCatSection-${cat.id}`;
    section.innerHTML = `
      <h2 class="home-section-title"><i class="fas ${cat.icon}"></i> ${escapeHTML(cat.name)}</h2>
      <div class="home-h-scroll" id="cat-${cat.id}"></div>
      <div class="home-skeleton" id="cat-skel-${cat.id}">${skeletonHTML()}</div>
    `;
    wrap.appendChild(section);
  }
  const grid = section.querySelector(`#cat-${cat.id}`);
  const skel = section.querySelector(`#cat-skel-${cat.id}`);
  if (!grid || !skel) return Promise.resolve();

  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';

  return (async () => {
    try {
      const pool = await getTitlesByGenre(cat.id, items, null, { sortBy: CAT_SORT });
      const titles = pickScoredForSection(key, pool, getFullWidthCount());
      skel.style.display = 'none';
      if (!titles || titles.length === 0) {
        section.style.display = 'none';
        return;
      }
      setupSectionRefresh(section, () => {
        bumpSeed(key);
        renderCategorySection(container, items, cat, onAddFromTrending);
      }, `Atualizar ${cat.name}`);
      grid.style.display = '';
      grid.innerHTML = '';
      titles.forEach((t) => {
        const card = createHomeCard({
          posterUrl: t.posterUrl,
          title: t.title,
          subtitle: t.date ? formatAirDate(t.date) : 'Série',
          onClick: () => onAddFromTrending && onAddFromTrending(t)
        });
        grid.appendChild(card);
      });
      animateCards(grid);
    } catch {
      skel.style.display = 'none';
      section.style.display = 'none';
    }
  })();
}

/**
 * Monta e carrega as categorias da home. Ver `composeCategoryList`.
 */
export async function loadAndRenderCategories(container, items, onAddFromTrending) {
  const wrap = container.querySelector('#homeCategories');
  if (!wrap) return;
  wrap.innerHTML = '';
  // As 6 categorias fixas entram sempre; os gêneros do usuário viram extras.
  let userCats = null;
  try {
    userCats = await getUserTopGenres(items, 4);
  } catch {}
  for (const cat of composeCategoryList(userCats)) {
    await renderCategorySection(container, items, cat, onAddFromTrending);
  }
}

/**
 * Carrega e renderiza o Calend�rio da Semana.
 *
 * Esta se��o substituiu "Novos Epis�dios", que era a mesma informa��o em linha
 * plana: as duas chamavam `getNewEpisodes` com a mesma janela de 7 dias sobre os
 * mesmos t�tulos `assistindo`. O calend�rio agrupa por data, o que d� o mesmo
 * conte�do com mais contexto, ent�o a lista plana foi removida. O que ela tinha
 * de bom foi preservado aqui: bot�o de atualizar, card clic�vel e still do
 * epis�dio quando o t�tulo n�o tem p�ster.
 */
export async function loadAndRenderCalendar(container, items, onCardClick) {
  const section = container.querySelector('#homeCalendarSection');
  const grid = container.querySelector('#homeCalendarGrid');
  const skel = container.querySelector('#homeCalendarSkeleton');
  const hint = container.querySelector('#homeCalendarHint');
  if (!section || !grid || !skel) return;
  setupSectionRefresh(section, () => {
    loadAndRenderCalendar(container, items, onCardClick);
  }, 'Atualizar calend�rio');
  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  try {
    const week = await getCalendarWeek(items);
    skel.style.display = 'none';
    if (!week || week.length === 0) { section.style.display = 'none'; return; }
    grid.style.display = '';
    grid.innerHTML = '';
    // Sem nada agendado, `getCalendarWeek` devolve o que acabou de exibir. O
    // rótulo evita que o usuário leia "Calendário da Semana" e ache que o
    // aplicativo errou a data.
    const isUpcoming = week[0][2];
    if (hint) {
      hint.textContent = isUpcoming
        ? 'Próximos episódios dos títulos que você está assistindo'
        : 'Nada agendado para os próximos dias. Estes são os episódios que saíram na semana.';
      hint.style.display = '';
    }
    const hoje = new Date();
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    week.forEach(([date, eps]) => {
      const col = document.createElement('div');
      // A data vem do TMDB como `YYYY-MM-DD`. Fatiar a string evita passar por
      // `new Date()`, onde um deslocamento de fuso poderia trocar o dia.
      const partes = String(date).split('-');
      const br = partes.length === 3 ? `${partes[2]}/${partes[1]}` : formatAirDate(date);
      const brCompleta = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : br;
      // Meio-dia no parse: fora do horário de verão, o dia não pula.
      const dt = new Date(date + 'T12:00:00');
      const valido = !Number.isNaN(dt.getTime());
      const dow = valido ? dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace(/\./g, '') : '';
      const estado = date === hojeIso ? 'is-today' : (isUpcoming ? 'is-future' : 'is-past');
      col.className = `home-calendar-day ${estado}`;
      col.innerHTML = `
        <div class="home-calendar-date" title="${escapeHTML(brCompleta)}">
          <span class="home-calendar-dow">${escapeHTML(dow)}</span>
          <span class="home-calendar-dnum">${escapeHTML(br)}</span>
        </div>
        <div class="home-calendar_eps"></div>`;
      const epsWrap = col.querySelector('.home-calendar_eps');
      eps.forEach(({ item, episode }) => {
        // Sem pôster do título, usa a still do episódio: melhor que cartão vazio.
        const posterUrl = item.imagem || (episode.still_path ? `https://image.tmdb.org/t/p/w300${episode.still_path}` : '');
        const epName = episode.name || '';
        const c = createHomeCard({
          posterUrl,
          title: item.nome,
          // Temporada e episódio no subtítulo, como nos outros cards da home. O
          // nome do episódio ia espremido no subtítulo, que é de 0.62rem com
          // ellipsis: ficava "T1 E2 - Episó..." e não se lia nada.
          subtitle: `T${episode.season_number} · E${episode.episode_number}`,
          extraHtml: epName ? `<span class="home-cal-epname" title="${escapeHTML(epName)}">${escapeHTML(epName)}</span>` : '',
          onClick: () => onCardClick && onCardClick(items.indexOf(item)),
          item
        });
        c.classList.add('home-cal-card');
        epsWrap.appendChild(c);
      });
      grid.appendChild(col);
    });
    animateCards(grid);
  } catch { skel.style.display = 'none'; section.style.display = 'none'; }
}

export function loadAndRenderChallenge(container, items) {
  const section = container.querySelector('#homeChallengeSection');
  const grid = container.querySelector('#homeChallengeGrid');
  if (!section || !grid) return;
  const ch = getChallenge(items, 5);
  if (ch.goal === 0) { section.style.display = 'none'; return; }
  section.style.display = '';
  grid.innerHTML = `
    <div class="home-challenge-card">
      <div class="home-challenge-head"><span>${ch.concluidosMes} / ${ch.goal} concluídos no mês</span><span>${ch.pct}%</span></div>
      <div class="home-card-progress-track"><div class="home-card-progress-bar" style="width:${ch.pct}%"></div></div>
      <p class="home-challenge-hint">${ch.pct >= 100 ? 'Desafio completo!' : `Faltam ${ch.goal - ch.concluidosMes} para bater a meta`}</p>
    </div>`;
}

export function loadAndRenderAbandoned(container, items, onCardClick) {
  const section = container.querySelector('#homeAbandonedSection');
  const grid = container.querySelector('#homeAbandonedGrid');
  if (!section || !grid) return;
  const all = getAbandoned(items);
  const list = pickForSection('abandoned', all, getFullWidthCount());
  if (all.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';
  setupSectionRefresh(section, () => {
    bumpSeed('abandoned');
    loadAndRenderAbandoned(container, items, onCardClick);
  }, 'Atualizar abandonados');
  grid.innerHTML = '';
  list.forEach(item => {
    const days = Math.floor((Date.now() - new Date(item.dataAtualizacao || item.dataCriacao || 0).getTime())/86400000);
    const card = createHomeCard({ posterUrl: item.imagem || '', title: item.nome, subtitle: `há ${days}d • T${item.temporada} E${item.episodio}`, onClick: () => onCardClick && onCardClick(items.indexOf(item)), item });
    grid.appendChild(card);
  });
  animateCards(grid);
}

export function loadAndRenderTimeline(container, items, onCardClick) {
  const section = container.querySelector('#homeTimelineSection');
  const grid = container.querySelector('#homeTimelineGrid');
  if (!section || !grid) return;
  const list = getTimeline(items, 10);
  if (list.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';
  grid.innerHTML = '';
  list.forEach(item => {
    const d = new Date(item.dataAtualizacao || item.dataCriacao || 0);
    const dateStr = isNaN(d.getTime()) ? '' : formatAirDate(d.toISOString().slice(0,10));
    const card = document.createElement('div');
    card.className = 'home-timeline-item';
    card.innerHTML = `<div class="home-timeline-date">${dateStr}</div><div class="home-timeline-card"><img src="${item.imagem || ''}" alt="" style="width:40px;height:60px;object-fit:cover;border-radius:4px;" /><div><strong>${escapeHTML(item.nome)}</strong><br><small>T${item.temporada} E${item.episodio} • ${item.status}</small><div class="home-card-progress-track" style="margin-top:4px;"><div class="home-card-progress-bar" style="width:${calcularProgresso(item)}%"></div></div></div></div>`;
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => onCardClick && onCardClick(items.indexOf(item)));
    if (item.tmdb_id) {
      const img = card.querySelector('img');
      resolveItemPosterUrl(item, 'w500')
        .then(url => { if (url && img.src !== url) img.src = url; })
        .catch(() => {});
    }
    grid.appendChild(card);
  });
}

export function setupRoulette(container, items, onCardClick, onAddFromTrending) {
  const btn = container.querySelector('#homeRouletteBtn');
  const res = container.querySelector('#homeRouletteResult');
  const histWrap = container.querySelector('#homeRouletteHistory');
  const histList = container.querySelector('#homeRouletteHistoryList');
  if (!btn || !res) return;
  const history = [];
  async function getNewPool() {
    try {
      if (Math.random() < 0.3) {
        const trending = await getTrendingToSuggest(items, 20);
        if (trending.length > 0) return trending.sort(() => 0.5 - Math.random());
      }
      const page = Math.floor(Math.random() * 10) + 1;
      const sorts = ['popularity.desc', 'vote_average.desc', 'first_air_date.desc', 'vote_count.desc'];
      const sort = sorts[Math.floor(Math.random() * sorts.length)];
      const useGenre = Math.random() < 0.5;
      const params = { sort_by: sort, page, 'vote_count.gte': 30 };
      if (useGenre) {
        const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        params.with_genres = String(cat.id);
      }
      const data = await callTMDB('discover/tv', params, 'pt-BR');
      const results = (data.results || []).filter(r => r.poster_path);
      const filtered = filterNotInCatalog(results, items);
      return filtered.slice(0, 20).map(normalizeTrendingItem).sort(() => 0.5 - Math.random());
    } catch { return []; }
  }
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sorteando...';
    res.style.display = 'flex';
    res.style.justifyContent = 'center';
    res.innerHTML = '<div class="home-roulette-shuffle"><i class="fas fa-dice fa-spin"></i> Buscando título novo...</div>';
    res.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const pool = await getNewPool();
    if (pool.length === 0) { res.style.display = ''; res.innerHTML = '<p class="home-empty">Nenhum título novo encontrado. Tente novamente.</p>'; btn.disabled = false; btn.innerHTML = '<i class="fas fa-dice"></i> Sortear aleatório'; return; }
    // Animação de embaralhamento - mostra 4 picks rápidos
    for (let k = 0; k < 4; k++) {
      await new Promise(r => setTimeout(r, 120 + k*40));
      const tmp = pool[Math.floor(Math.random()*pool.length)];
      res.innerHTML = `<div class="home-roulette-shuffle" style="opacity:${0.6 + k*0.1}">${escapeHTML(tmp.title)}</div>`;
    }
    await new Promise(r => setTimeout(r, 180));
    const picked = pool[Math.floor(Math.random()*pool.length)];
    res.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'home-roulette-card';
    wrap.innerHTML = `
      <div class="home-roulette-poster"><img src="${picked.posterUrl || ''}" alt="" onerror="this.style.display='none'" /></div>
      <div class="home-roulette-info">
        <strong>${escapeHTML(picked.title)}</strong>
        <small>${picked.date ? formatAirDate(picked.date) : 'Série'}</small>
        <small style="color:var(--text-muted)">Título novo para descobrir</small>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button class="home-empty-btn" data-action="details"><i class="fas fa-eye"></i> Mais Detalhes</button>
          <button class="tool-btn" data-action="again"><i class="fas fa-redo"></i> Sortear outro</button>
        </div>
      </div>`;
    wrap.querySelector('[data-action="details"]').addEventListener('click', () => onAddFromTrending && onAddFromTrending(picked));
    wrap.querySelector('[data-action="again"]').addEventListener('click', () => btn.click());
    res.appendChild(wrap);
    // Histórico
    history.unshift(picked.title);
    if (history.length > 3) history.pop();
    if (histWrap && histList) {
      histWrap.style.display = '';
      histList.textContent = history.join(' • ');
    }
    if (typeof window !== 'undefined' && window.anime) {
      window.anime({ targets: wrap, scale: [0.96,1], opacity: [0,1], duration: 300, easing: 'easeOutQuad' });
    }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-dice"></i> Sortear aleatório';
  });
}

function setupAffinityDiscovery(container, catalogItems, onAddFromTrending) {
  const input = container.querySelector('#homeAffinityInput');
  const dropdown = container.querySelector('#homeAffinityDropdown');
  const chipsWrap = container.querySelector('#homeAffinityChips');
  const analyzeBtn = container.querySelector('#homeAffinityAnalyze');
  const grid = container.querySelector('#homeAffinityGrid');
  const skel = container.querySelector('#homeAffinitySkeleton');
  const errEl = container.querySelector('#homeAffinityError');
  if (!input || !dropdown || !chipsWrap || !analyzeBtn || !grid) return;
  let selected = [];
  let searchTimeout = null;
  function updateChips() {
    chipsWrap.innerHTML = '';
    selected.forEach((item, idx) => {
      const chip = document.createElement('span');
      chip.className = 'home-affinity-chip';
      chip.innerHTML = `${escapeHTML(item.title)} <button aria-label="Remover ${escapeHTML(item.title)}" data-idx="${idx}"><i class="fas fa-times"></i></button>`;
      chip.querySelector('button').addEventListener('click', () => {
        selected.splice(idx, 1);
        updateChips();
      });
      chipsWrap.appendChild(chip);
    });
    analyzeBtn.disabled = selected.length === 0;
    analyzeBtn.innerHTML = `<i class="fas fa-microscope"></i> Analisar (${selected.length}/4)`;
    if (selected.length === 0) { grid.style.display = 'none'; grid.innerHTML = ''; if (errEl) errEl.style.display = 'none'; }
  }
  function hideDropdown() { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = input.value.trim();
    if (q.length < 2) { hideDropdown(); return; }
    searchTimeout = setTimeout(async () => {
      try {
        const data = await callTMDB('search/tv', { query: q }, 'pt-BR');
        const results = (data.results || []).slice(0, 6);
        if (results.length === 0) { hideDropdown(); return; }
        dropdown.innerHTML = '';
        dropdown.style.display = 'block';
        results.forEach(raw => {
          const title = raw.name || raw.title || '';
          if (!title) return;
          if (selected.some(s => String(s.id) === String(raw.id))) return;
          const row = document.createElement('button');
          row.className = 'home-affinity-option';
          row.innerHTML = `<img src="${raw.poster_path ? `https://image.tmdb.org/t/p/w92${raw.poster_path}` : ''}" alt="" style="width:32px;height:48px;object-fit:cover;border-radius:4px;background:var(--bg-secondary);" onerror="this.style.display='none'" /><span>${escapeHTML(title)}</span><small>${(raw.first_air_date || '').slice(0,4) || ''}</small>`;
          row.addEventListener('click', () => {
            if (selected.length >= 4) return;
            selected.push({ id: raw.id, title, poster_path: raw.poster_path });
            updateChips();
            input.value = '';
            hideDropdown();
          });
          dropdown.appendChild(row);
        });
      } catch { hideDropdown(); }
    }, 300);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideDropdown(); });
  document.addEventListener('click', (e) => { if (!dropdown.contains(e.target) && e.target !== input) hideDropdown(); });
  analyzeBtn.addEventListener('click', async () => {
    if (selected.length === 0) return;
    grid.style.display = 'none'; if (errEl) errEl.style.display = 'none'; skel.style.display = 'flex';
    analyzeBtn.disabled = true; analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando...';
    try {
      const ids = selected.map(s => s.id);
      const recs = await getAffinityRecommendations(ids, catalogItems);
      skel.style.display = 'none';
      if (!recs || recs.length === 0) {
        if (errEl) { errEl.textContent = 'Nenhuma recomendação encontrada para essa combinação. Tente outros títulos.'; errEl.style.display = 'block'; }
        grid.style.display = 'none';
        analyzeBtn.disabled = false; analyzeBtn.innerHTML = `<i class="fas fa-microscope"></i> Analisar (${selected.length}/4)`;
        return;
      }
      grid.style.display = 'flex';
      grid.innerHTML = '';
      recs.forEach(t => {
        const card = createHomeCard({ posterUrl: t.posterUrl, title: t.title, subtitle: t.date ? formatAirDate(t.date) : 'Série', onClick: () => onAddFromTrending && onAddFromTrending(t) });
        grid.appendChild(card);
      });
      animateCards(grid);
    } catch (e) {
      skel.style.display = 'none';
      if (errEl) { errEl.textContent = 'Erro ao buscar recomendações.'; errEl.style.display = 'block'; }
    } finally {
      analyzeBtn.disabled = false; analyzeBtn.innerHTML = `<i class="fas fa-microscope"></i> Analisar (${selected.length}/4)`;
    }
  });
  updateChips();
}

function animateCards(gridEl) {
  if (typeof window !== 'undefined' && window.anime) {
    const cards = gridEl.querySelectorAll('.home-card, .home-skeleton-card');
    if (cards.length) {
      window.anime({
        targets: cards,
        translateY: [16, 0],
        opacity: [0, 1],
        duration: 400,
        delay: window.anime.stagger(60),
        easing: 'easeOutQuad'
      });
    }
  }
}

/**
 * Orquestra render completo da Home (síncrono + assíncrono)
 */
export async function renderHome(container, context) {
  const { items } = context;
  renderHomeBase(container, context);
  renderHomeStats(container, items);
  renderHomeContinue(container, items, context.onCardClick, context.onOpenAddModal);
  renderHomeFavorites(container, items, context.onCardClick);
  // Novas seções
  loadAndRenderCalendar(container, items, context.onCardClick);
  loadAndRenderFriendPicks(container, items, context.onAddFromTrending);
  setupRoulette(container, items, context.onCardClick, context.onAddFromTrending);
  loadAndRenderAbandoned(container, items, context.onCardClick);
  setupAffinityDiscovery(container, items, context.onAddFromTrending);
  setupYearPicker(container, items, context.onAddFromTrending);
  loadAndRenderByYear(container, items, context.onAddFromTrending);
  // Async seções existentes - don't block
  loadAndRenderTrending(container, items, context.onAddFromTrending);
  loadAndRenderRecommendations(container, items, context.onCardClick, context.onAddFromTrending);
  loadAndRenderCategories(container, items, context.onAddFromTrending);
}
