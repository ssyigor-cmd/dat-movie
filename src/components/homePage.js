/**
 * HomePage - Renderiza a página inicial do Dat-Movie
 * Seções: Saudação, Continuar Assistindo, Novidades, Em Alta, Favoritos, Estatísticas
 */
import { escapeHTML, getTierClass, calcularProgresso } from '../lib/catalog.js';
import { getTrendingToSuggest, getNewEpisodes, getFavorites, getCatalogStats, formatAirDate, getTitlesByGenre, getRecommendationsForUser, CATEGORIES, getFullWidthCount, getUserTopGenres, getCalendarWeek, getAbandoned, getTimeline, getChallenge, pickRandomByTime, getAffinityRecommendations } from '../lib/trendingApi.js';
import { callTMDB } from '../lib/api.js';

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

    <section class="home-section" id="homeCalendarSection" aria-label="Calendário da semana" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-calendar-week"></i> Calendário da Semana</h2>
      <div id="homeCalendarGrid" class="home-calendar-grid"></div>
      <div class="home-skeleton" id="homeCalendarSkeleton">${skeletonHTML()}</div>
    </section>

    <section class="home-section" id="homeRouletteSection" aria-label="Roleta">
      <h2 class="home-section-title"><i class="fas fa-random"></i> Não sabe o que assistir?</h2>
      <div class="home-roulette-controls">
        <div class="home-roulette-time">
          <input type="range" id="homeRouletteTime" min="30" max="480" step="30" value="60" aria-label="Tempo disponível" />
          <span id="homeRouletteTimeLabel" class="home-roulette-time-label">1h</span>
        </div>
        <button id="homeRouletteBtn" class="home-empty-btn"><i class="fas fa-dice"></i> Sortear aleatório</button>
      </div>
      <div id="homeRouletteResult" class="home-roulette-result" style="display:none;"></div>
      <div id="homeRouletteHistory" class="home-roulette-history" style="display:none;"><small>Últimos sorteados:</small> <span id="homeRouletteHistoryList"></span></div>
    </section>

    <section class="home-section" id="homeAbandonedSection" aria-label="Abandonados" style="display:none;">
      <h2 class="home-section-title"><i class="fas fa-pause-circle"></i> Abandonados</h2>
      <div class="home-h-scroll" id="homeAbandonedGrid"></div>
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

    <section class="home-section" id="homeAffinitySection" aria-label="Descoberta por afinidade">
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
  let categories = CATEGORIES;
  try {
    const userCats = await getUserTopGenres(items, 4);
    if (Array.isArray(userCats) && userCats.length > 0) categories = userCats;
  } catch {}
  for (const cat of categories) {
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

export async function loadAndRenderCalendar(container, items) {
  const section = container.querySelector('#homeCalendarSection');
  const grid = container.querySelector('#homeCalendarGrid');
  const skel = container.querySelector('#homeCalendarSkeleton');
  if (!section || !grid || !skel) return;
  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  try {
    const week = await getCalendarWeek(items);
    skel.style.display = 'none';
    if (!week || week.length === 0) { section.style.display = 'none'; return; }
    grid.style.display = '';
    grid.innerHTML = '';
    week.forEach(([date, eps]) => {
      const col = document.createElement('div');
      col.className = 'home-calendar-day';
      col.innerHTML = `<div class="home-calendar-date">${formatAirDate(date)}</div><div class="home-calendar_eps"></div>`;
      const epsWrap = col.querySelector('.home-calendar_eps');
      eps.forEach(({ item, episode }) => {
        const c = createHomeCard({ posterUrl: item.imagem || '', title: item.nome, subtitle: `T${episode.season_number} E${episode.episode_number} - ${episode.name || ''}`, onClick: null });
        c.style.flex = '0 0 100px'; c.style.width = '100px';
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
  const list = getAbandoned(items);
  if (list.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';
  grid.innerHTML = '';
  list.forEach(item => {
    const days = Math.floor((Date.now() - new Date(item.dataAtualizacao || item.dataCriacao || 0).getTime())/86400000);
    const card = createHomeCard({ posterUrl: item.imagem || '', title: item.nome, subtitle: `há ${days}d • T${item.temporada} E${item.episodio}`, onClick: () => onCardClick && onCardClick(items.indexOf(item)) });
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
    grid.appendChild(card);
  });
}

export function setupRoulette(container, items, onCardClick, onAddFromTrending) {
  const btn = container.querySelector('#homeRouletteBtn');
  const selTime = container.querySelector('#homeRouletteTime');
  const label = container.querySelector('#homeRouletteTimeLabel');
  const res = container.querySelector('#homeRouletteResult');
  const histWrap = container.querySelector('#homeRouletteHistory');
  const histList = container.querySelector('#homeRouletteHistoryList');
  if (!btn || !selTime || !res) return;
  function formatMins(v) {
    const n = parseInt(v, 10) || 60;
    if (n >= 480) return '8h+';
    if (n % 60 === 0) return `${n/60}h`;
    const h = Math.floor(n/60), m = n%60;
    return h ? `${h}h ${m}min` : `${m}min`;
  }
  if (label) label.textContent = formatMins(selTime.value);
  selTime.addEventListener('input', () => {
    if (label) label.textContent = formatMins(selTime.value);
    res.style.display = 'none';
  });
  const history = [];
  async function getNewPool(mins) {
    // Sorteio de título novo - busca no TMDb o que não está no catálogo
    try {
      const trending = await getTrendingToSuggest(items, 20);
      if (trending.length > 0) {
        // Filtra por tempo estimado se possível (precisa buscar detalhes para totalEpisodios)
        // Para novos, filtra por popularidade já é aleatório; mantém tempo como soft filter via voto
        return trending;
      }
      // Fallback: discover por gênero aleatório
      const randomCat = CATEGORIES[Math.floor(Math.random()*CATEGORIES.length)];
      return await getTitlesByGenre(randomCat.id, items, 20);
    } catch { return []; }
  }
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sorteando...';
    res.style.display = '';
    res.innerHTML = '<div class="home-roulette-shuffle"><i class="fas fa-dice fa-spin"></i> Buscando título novo...</div>';
    const pool = await getNewPool(parseInt(selTime.value, 10) || 60);
    if (pool.length === 0) { res.style.display = ''; res.innerHTML = '<p class="home-empty">Nenhum título novo encontrado. Tente novamente.</p>'; btn.disabled = false; btn.innerHTML = '<i class="fas fa-dice"></i> Sortear aleatório'; return; }
    // Animação de embaralhamento - mostra 4 picks rápidos
    for (let k = 0; k < 4; k++) {
      await new Promise(r => setTimeout(r, 120 + k*40));
      const tmp = pool[Math.floor(Math.random()*pool.length)];
      res.innerHTML = `<div class="home-roulette-shuffle" style="opacity:${0.6 + k*0.1}">${escapeHTML(tmp.nome)}</div>`;
    }
    await new Promise(r => setTimeout(r, 180));
    const picked = pool[Math.floor(Math.random()*pool.length)];
    const remaining = Math.max(0, (Number(picked.totalEpisodios||1) - (Number(picked.episodio)||0)) * 24);
    const horas = Math.floor(remaining/60), mins = remaining%60;
    const tempoTxt = remaining > 0 ? `${horas > 0 ? horas+'h ' : ''}${mins}min restantes` : 'Pronto para começar';
    res.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'home-roulette-card';
    wrap.innerHTML = `
      <div class="home-roulette-poster"><img src="${picked.imagem || ''}" alt="" onerror="this.style.display='none'" /></div>
      <div class="home-roulette-info">
        <strong>${escapeHTML(picked.nome)}</strong>
        <small>T${picked.temporada} E${String(picked.episodio).padStart(2,'0')} • ${picked.status} ${picked.tier ? '• Tier '+escapeHTML(picked.tier) : ''}</small>
        <small style="color:var(--text-muted)">${tempoTxt} • ${picked.tipo || 'serie'}</small>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button class="home-empty-btn" data-action="details"><i class="fas fa-eye"></i> Ver detalhes</button>
          <button class="tool-btn" data-action="again"><i class="fas fa-redo"></i> Sortear outro</button>
        </div>
      </div>`;
    wrap.querySelector('[data-action="details"]').addEventListener('click', () => onCardClick && onCardClick(items.indexOf(picked)));
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
  loadAndRenderCalendar(container, items);
  setupRoulette(container, items, context.onCardClick, context.onAddFromTrending);
  loadAndRenderAbandoned(container, items, context.onCardClick);
  setupAffinityDiscovery(container, items, context.onAddFromTrending);
  // Async seções existentes - don't block
  loadAndRenderNewEpisodes(container, items, context.onCardClick);
  loadAndRenderTrending(container, items, context.onAddFromTrending);
  loadAndRenderRecommendations(container, items, context.onCardClick, context.onAddFromTrending);
  loadAndRenderCategories(container, items, context.onAddFromTrending);
}
