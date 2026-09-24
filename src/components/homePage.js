/**
 * HomePage - Renderiza a página inicial do Dat-Movie
 * Seções: Saudação, Continuar Assistindo, Novidades, Em Alta, Favoritos, Estatísticas
 */
import { escapeHTML, getTierClass, calcularProgresso } from '../lib/catalog.js';
import { getTrendingToSuggest, getNewEpisodes, getFavorites, getCatalogStats, formatAirDate } from '../lib/trendingApi.js';

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
    return { greeting: 'Bem-vindo 👋', subtitle: 'Seu catálogo pessoal de animes e séries' };
  }
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return { greeting: `Olá, ${escapeHTML(cap)} 👋`, subtitle: 'Bem-vindo de volta' };
}

/**
 * Cria skeleton loader para grids horizontais
 * @param {number} count
 * @returns {string} HTML
 */
export function skeletonHTML(count = 6) {
  return Array.from({ length: count }).map(() => `
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

    <section class="home-section" id="homeNewEpisodesSection" aria-label="Novidades da semana" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-sparkles"></i> Novos Episódios</h2>
      <div class="home-h-scroll" id="homeNewEpisodesGrid"></div>
      <div class="home-skeleton" id="homeNewEpisodesSkeleton">${skeletonHTML(6)}</div>
      <div class="home-error" id="homeNewEpisodesError" style="display:none;"></div>
    </section>

    <section class="home-section" id="homeTrendingSection" aria-label="Em alta" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-fire"></i> Em Alta</h2>
      <div class="home-h-scroll" id="homeTrendingGrid"></div>
      <div class="home-skeleton" id="homeTrendingSkeleton">${skeletonHTML(6)}</div>
      <div class="home-error" id="homeTrendingError" style="display:none;"></div>
    </section>

    <section class="home-section" id="homeFavoritesSection" aria-label="Seus favoritos" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-star"></i> Seus Favoritos</h2>
      <div class="home-h-scroll" id="homeFavoritesGrid"></div>
    </section>
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
  grid.innerHTML = `
    <div class="stat-card"><span class="stat-number">${stats.total}</span><span class="stat-label">Total</span></div>
    <div class="stat-card"><span class="stat-number">${stats.assistindo}</span><span class="stat-label">Assistindo</span></div>
    <div class="stat-card"><span class="stat-number">${stats.concluidos}</span><span class="stat-label">Concluídos</span></div>
    <div class="stat-card"><span class="stat-number">${stats.planejados}</span><span class="stat-label">Lista de Desejos</span></div>
    <div class="stat-card"><span class="stat-number">${stats.totalEpisodiosAssistidos || 0}</span><span class="stat-label">Eps. Assistidos</span></div>
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
    const badge = item.tier || '';
    const extra = `<div class="home-card-progress"><div class="home-card-progress-track"><div class="home-card-progress-bar" style="width:${calcularProgresso(item)}%"></div></div></div>`;
    const card = createHomeCard({
      posterUrl,
      title: item.nome,
      subtitle,
      badge,
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
  const favs = getFavorites(items, 6);
  if (favs.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  grid.innerHTML = '';
  favs.forEach((item) => {
    const posterUrl = item.imagem || '';
    const badge = item.tier || '';
    const card = createHomeCard({
      posterUrl,
      title: item.nome,
      subtitle: badge ? `Tier ${badge}` : '',
      badge,
      onClick: () => onCardClick && onCardClick(items.indexOf(item))
    });
    // Add tier color class to badge if exists
    const badgeEl = card.querySelector('.home-card-badge');
    if (badgeEl && badge) {
      const cls = getTierClass(badge);
      if (cls) badgeEl.classList.add(cls);
    }
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
    const novidades = await getNewEpisodes(items, 7, new Date(), 6);
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
    const trending = await getTrendingToSuggest(items, 6);
    skel.style.display = 'none';
    if (!trending || trending.length === 0) {
      section.style.display = 'none';
      return;
    }
    grid.style.display = '';
    grid.innerHTML = '';
    trending.forEach((t) => {
      const subtitle = t.date ? formatAirDate(t.date) : (t.mediaType === 'movie' ? 'Filme' : 'Série');
      const actionBtn = `<button class="home-card-add" aria-label="Adicionar ${escapeHTML(t.title)}"><i class="fas fa-plus"></i></button>`;
      const card = createHomeCard({
        posterUrl: t.posterUrl,
        title: t.title,
        subtitle,
        actionBtnHtml: actionBtn,
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
}
