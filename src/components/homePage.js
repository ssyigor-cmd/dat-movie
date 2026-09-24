/**
 * HomePage - Renderiza a página inicial do Dat-Movie
 * Seções: Saudação, Continuar Assistindo, Novidades, Em Alta, Favoritos, Estatísticas
 */
import { escapeHTML, getTierClass, calcularProgresso } from '../lib/catalog.js';
import { getTrendingToSuggest, getNewEpisodes, getFavorites, getCatalogStats, formatAirDate, getTitlesByGenre, getRecommendationsForUser, CATEGORIES, getFullWidthCount } from '../lib/trendingApi.js';

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
function createHomeCard({ posterUrl, title, subtitle, badge, onClick, extraHtml = '', actionBtnHtml = '' }) {
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

    <section class="home-section" id="homeRecommendSection" aria-label="Recomendações" style="display:none;">
      <h2 class="home-section-title" id="homeRecommendTitle"><i class="fas fa-heart"></i> Recomendações</h2>
      <div class="home-h-scroll" id="homeRecommendGrid"></div>
      <div class="home-skeleton" id="homeRecommendSkeleton">${skeletonHTML()}</div>
    </section>

    <section class="home-section" id="homeNewEpisodesSection" aria-label="Novidades da semana" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-sparkles"></i> Novos Episódios</h2>
      <div class="home-h-scroll" id="homeNewEpisodesGrid"></div>
      <div class="home-skeleton" id="homeNewEpisodesSkeleton">${skeletonHTML()}</div>
      <div class="home-error" id="homeNewEpisodesError" style="display:none;"></div>
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
  `;

  // Bind add button
  const addBtn = container.querySelector('#homeContinueAddBtn');
  if (addBtn && context.onOpenAddModal) {
    addBtn.addEventListener('click', context.onOpenAddModal);
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
 * Renderiza Continuar Assistindo (carrossel horizontal máx. 12)
 */
export function renderHomeContinue(container, items, onCardClick, onOpenAddModal) {
  const grid = container.querySelector('#homeContinueGrid');
  const empty = container.querySelector('#homeContinueEmpty');
  const section = container.querySelector('#homeContinueSection');
  if (!grid || !empty) return;

  const pool = items.filter((i) => i.status === 'assistindo');
  pool.sort((a, b) => new Date(b.dataAtualizacao || b.dataCriacao || 0) - new Date(a.dataAtualizacao || a.dataCriacao || 0));
  const limited = pool.slice(0, 12);

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
      onClick: () => onCardClick && onCardClick(items.indexOf(item))
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
  const favs = getFavorites(items);
  if (favs.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  grid.innerHTML = '';
  favs.forEach((item) => {
    const posterUrl = item.imagem || '';
    const card = createHomeCard({
      posterUrl,
      title: item.nome,
      subtitle: '',
      onClick: () => onCardClick && onCardClick(items.indexOf(item))
    });
    grid.appendChild(card);
  });
  animateCards(grid);
}

/**
 * Carrega e renderiza Novidades (novos episódios últimos 7 dias) de forma assíncrona
 */
export async function loadAndRenderNewEpisodes(container, items, onCardClick) {
  const section = container.querySelector('#homeNewEpisodesSection');
  const grid = container.querySelector('#homeNewEpisodesGrid');
  const skel = container.querySelector('#homeNewEpisodesSkeleton');
  const errEl = container.querySelector('#homeNewEpisodesError');
  if (!section || !grid || !skel) return;

  // Show skeleton, hide grid
  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  if (errEl) errEl.style.display = 'none';

  try {
    const novidades = await getNewEpisodes(items, 7, new Date());
    skel.style.display = 'none';
    if (!novidades || novidades.length === 0) {
      section.style.display = 'none';
      return;
    }
    grid.style.display = '';
    grid.innerHTML = '';
    novidades.forEach(({ item, episode, airDate }) => {
      const posterUrl = item.imagem || (episode.still_path ? `https://image.tmdb.org/t/p/w300${episode.still_path}` : '');
      const seasonEp = `T${episode.season_number} · E${episode.episode_number}`;
      const dateStr = formatAirDate(airDate);
      const subtitle = `${seasonEp} · ${dateStr}`;
      const extra = episode.name ? `<span class="home-card-epname">${escapeHTML(episode.name)}</span>` : '';
      const card = createHomeCard({
        posterUrl,
        title: item.nome,
        subtitle,
        extraHtml: extra,
        onClick: () => onCardClick && onCardClick(items.indexOf(item))
      });
      grid.appendChild(card);
    });
    animateCards(grid);
  } catch (e) {
    skel.style.display = 'none';
    section.style.display = 'none';
    console.warn('Erro novidades:', e);
  }
}

/**
 * Carrega e renderiza Em Alta (trending)
 */
export async function loadAndRenderTrending(container, items, onAddFromTrending) {
  const section = container.querySelector('#homeTrendingSection');
  const grid = container.querySelector('#homeTrendingGrid');
  const skel = container.querySelector('#homeTrendingSkeleton');
  const errEl = container.querySelector('#homeTrendingError');
  if (!section || !grid || !skel) return;

  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  if (errEl) errEl.style.display = 'none';

  try {
    const trending = await getTrendingToSuggest(items);
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

export async function loadAndRenderRecommendations(container, items, onCardClick, onAddFromTrending) {
  const section = container.querySelector('#homeRecommendSection');
  const grid = container.querySelector('#homeRecommendGrid');
  const skel = container.querySelector('#homeRecommendSkeleton');
  const titleEl = container.querySelector('#homeRecommendTitle');
  if (!section || !grid || !skel) return;
  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  try {
    const data = await getRecommendationsForUser(items);
    skel.style.display = 'none';
    if (!data || !data.recommendations || data.recommendations.length === 0) {
      section.style.display = 'none';
      return;
    }
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-heart"></i> Se você gostou de "${escapeHTML(data.base.nome)}" vai gostar disso`;
    grid.style.display = '';
    grid.innerHTML = '';
    data.recommendations.forEach((t) => {
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

export async function loadAndRenderCategories(container, items, onAddFromTrending) {
  const wrap = container.querySelector('#homeCategories');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const cat of CATEGORIES) {
    const section = document.createElement('section');
    section.className = 'home-section';
    section.innerHTML = `
      <h2 class="home-section-title"><i class="fas ${cat.icon}"></i> ${escapeHTML(cat.name)}</h2>
      <div class="home-h-scroll" id="cat-${cat.id}"></div>
      <div class="home-skeleton" id="cat-skel-${cat.id}">${skeletonHTML()}</div>
    `;
    wrap.appendChild(section);
    const grid = section.querySelector(`#cat-${cat.id}`);
    const skel = section.querySelector(`#cat-skel-${cat.id}`);
    try {
      const titles = await getTitlesByGenre(cat.id, items);
      skel.style.display = 'none';
      if (!titles || titles.length === 0) {
        section.style.display = 'none';
        continue;
      }
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
  }
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
  // Async sections - don't block
  loadAndRenderNewEpisodes(container, items, context.onCardClick);
  loadAndRenderTrending(container, items, context.onAddFromTrending);
  loadAndRenderRecommendations(container, items, context.onCardClick, context.onAddFromTrending);
  loadAndRenderCategories(container, items, context.onAddFromTrending);
}
