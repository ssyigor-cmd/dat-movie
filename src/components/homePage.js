/**
 * HomePage - Renderiza a página inicial do Dat-Movie
 * Seções: Saudação, Continuar Assistindo, Novidades, Em Alta, Favoritos, Estatísticas
 */
import { escapeHTML, calcularProgresso } from '../lib/catalog.js';
import { getTrendingToSuggest, getFavorites, formatAirDate, getTitlesByGenre, getTitlesByYear, getUpcomingTitles, CATEGORIES, getFullWidthCount, getUserTopGenres, composeCategoryList, getCalendarWeek, getAbandoned, getAffinityRecommendations, normalizeTrendingItem, pickVariety, getAffinityRail, getAffinityRails, AFFINITY_RAIL_COUNT } from '../lib/trendingApi.js';
import { callTMDB } from '../lib/api.js';
import { cardMarkup, attachCardInteraction, resolveCardPoster } from './cards.js';
import { pickWithMix } from '../lib/recommendScoring.js';
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
 *
 * O `.home-section-head` vem do template de todas as seções, inclusive das de
 * categoria. Antes ele era criado aqui quando não existisse, e era por isso que
 * o título de cinco seções ficava mais baixo que o das outras — o wrapper
 * sumia de uma seção para a outra conforme o chamador. Agora o wrapper é parte
 * do contrato da seção: se faltar, é bug do template e vale aparecer no console
 * em vez de a seção renderizar com o título desalinhado.
 *
 * @param {Element} section - Elemento da seção (.home-section).
 * @param {Function} onRefresh - Callback que recarrega a lista.
 * @param {string} [label] - Texto do title/aria-label do botão.
 */
function setupSectionRefresh(section, onRefresh, label = 'Atualizar lista') {
  if (!section || typeof onRefresh !== 'function') return;
  const head = section.querySelector('.home-section-head');
  if (!head || !head.querySelector('.home-section-title')) {
    console.warn('Seção sem .home-section-head; botão de atualizar não aplicado:', section.id);
    return;
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
    // `full_name` é a chave que o cadastro grava (`auth.js`) e que o menu do
    // perfil lê e edita. A saudação lia `name`, que ninguém escreve — por isso
    // toda tela inicial mostrava a parte antes do @ do email, mesmo com nome
    // cadastrado.
    name = user.user_metadata?.full_name || '';
    if (typeof name === 'string') name = name.trim();
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
 * Uma faixa "Se você gostou de X vai gostar disso".
 *
 * O número entra à mão no template e não sai de um `Array.from`: as quatro
 * faixas são **espalhadas** entre as outras seções, e é essa distribuição que
 * evita quatro títulos iguais empilhados. Um laço seria mais curto, mas as
 * quatro cairiam no mesmo ponto da página, coladas.
 *
 * @param {number} index - Posição da faixa, de 0 a `AFFINITY_RAIL_COUNT - 1`.
 * @returns {string} HTML da seção.
 */
function railHTML(index) {
  return `
      <section class="home-section" id="homeRail${index}" aria-label="Recomendações a partir de um título do seu catálogo" style="display:none;">
        <div class="home-section-head">
          <h2 class="home-section-title" id="homeRail${index}Title"><i class="fas fa-heart"></i> Recomendações</h2>
          <button type="button" id="homeRail${index}Refresh" class="home-refresh-btn" title="Atualizar recomendações" aria-label="Atualizar recomendações"><i class="fas fa-rotate"></i></button>
        </div>
        <div class="home-h-scroll" id="homeRail${index}Grid"></div>
        <div class="home-h-scroll home-skeleton" id="homeRail${index}Skeleton">${skeletonHTML()}</div>
      </section>`;
}

/**
 * Cria o card da home.
 *
 * A home não tem um cartão próprio: usa `cardMarkup` de `cards.js`, o mesmo
 * markup do Catálogo, e só acrescenta a variante de largura `card--rail`
 * porque aqui a faixa é um trilho horizontal de largura fixa. Raio, borda,
 * hover, imagem, tipografia e barra de progresso vêm de `card` — foi esta
 * função, enquanto escrevia o `home-card` com regras próprias, a origem da
 * fonte diferente entre a home e o resto do app.
 *
 * A anatomia é única: imagem com o título por cima + `extraHtml` no corpo. Os
 * parâmetros `badge` e `actionBtnHtml` que já existiram aqui renderizavam um
 * selo de tier e um botão flutuante, e nenhuma das nove seções que usam esta
 * função passava um nem o outro — eram 44 linhas de CSS para duas formas que
 * ninguém produzia. Se um dia um selo voltar, ele volta pelo `stampHtml` de
 * `cardMarkup`.
 *
 * @param {Object} o - { posterUrl, title, onClick, extraHtml, item }.
 * @returns {HTMLElement} Card.
 */
function createHomeCard({ posterUrl, title, onClick, extraHtml = '', item = null }) {
  const card = document.createElement('div');
  card.className = 'card card--rail';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', title);
  const safeTitle = escapeHTML(title);
  card.innerHTML = cardMarkup({
    posterUrl: posterUrl || '',
    titleHtml: safeTitle,
    titleAttr: title,
    extraHtml
  });
  attachCardInteraction(card, onClick);
  resolveCardPoster(card, item);
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

    <section class="home-section" id="homeContinueSection" aria-label="Continuar assistindo">
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas fa-play"></i> Continuar Assistindo</h2>
      </div>
      <div class="home-h-scroll" id="homeContinueGrid"></div>
      <div class="home-empty" id="homeContinueEmpty" style="display:none;">
        <p>Você ainda não começou nenhum título. Que tal adicionar um?</p>
        <button class="home-empty-btn" id="homeContinueAddBtn"><i class="fas fa-plus"></i> Adicionar título</button>
      </div>
    </section>

    <section class="home-section home-section--panel home-section--centered" id="homeRouletteSection" aria-label="Roleta">
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas fa-random"></i> Não sabe o que assistir?</h2>
      </div>
      <div class="home-roulette-controls">
        <button id="homeRouletteBtn" class="home-empty-btn"><i class="fas fa-dice"></i> Sortear título novo</button>
      </div>
      <div id="homeRouletteResult" class="home-roulette-result" style="display:none;"></div>
      <div id="homeRouletteHistory" class="home-roulette-history" style="display:none;"><small>Últimos sorteados:</small> <span id="homeRouletteHistoryList"></span></div>
    </section>

    ${railHTML(0)}

    <section class="home-section" id="homeCalendarSection" aria-label="Calendário da semana" style="display:none;">
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas fa-calendar-week"></i> Episódios da Semana</h2>
      </div>
      <p class="home-hint" id="homeCalendarHint" style="display:none;"></p>
      <div id="homeCalendarGrid" class="home-h-scroll"></div>
      <div class="home-h-scroll home-skeleton" id="homeCalendarSkeleton">${skeletonHTML()}</div>
    </section>

    <section class="home-section home-section--panel home-section--centered" id="homeAffinitySection" aria-label="Descoberta por afinidade">
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas fa-flask"></i> Descubra por afinidade</h2>
      </div>
      <p class="home-hint">Adicione até 4 títulos que você curtiu e descubra algo novo para assistir</p>
      <div class="home-affinity-search">
        <div class="toolbar-search">
          <i class="fas fa-search"></i>
          <input type="text" id="homeAffinityInput" placeholder="Buscar título para comparar..." aria-label="Buscar título para afinidade" />
        </div>
        <div id="homeAffinityDropdown" class="home-affinity-dropdown" style="display:none;"></div>
      </div>
      <div id="homeAffinityChips" class="home-affinity-chips"></div>
      <button id="homeAffinityAnalyze" class="home-empty-btn" disabled><i class="fas fa-microscope"></i> Analisar (0/4)</button>
      <div class="home-h-scroll" id="homeAffinityGrid" style="display:none;"></div>
      <div class="home-h-scroll home-skeleton" id="homeAffinitySkeleton" style="display:none;">${skeletonHTML()}</div>
      <div class="home-error" id="homeAffinityError" style="display:none;"></div>
    </section>

    <section class="home-section" id="homeUpcomingSection" aria-label="Próximos lançamentos" style="display:none;">
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas fa-rocket"></i> Em Breve</h2>
      </div>
      <div class="home-h-scroll" id="homeUpcomingGrid"></div>
      <div class="home-h-scroll home-skeleton" id="homeUpcomingSkeleton">${skeletonHTML()}</div>
    </section>

    ${railHTML(3)}

    <section class="home-section" id="homeAbandonedSection" aria-label="Abandonados" style="display:none;">
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas fa-pause-circle"></i> Abandonados</h2>
      </div>
      <div class="home-h-scroll" id="homeAbandonedGrid"></div>
    </section>

    ${railHTML(1)}

    <section class="home-section home-section--panel" id="homeYearSection" aria-label="Destaques do ano" style="display:none;">
      <div class="home-section-head">
        <h2 class="home-section-title" id="homeYearTitle"><i class="fas fa-calendar-alt"></i> Destaques do ano</h2>
      </div>
      <div class="home-field-row">
        <div class="toolbar-search">
          <i class="fas fa-calendar-alt"></i>
          <input type="text" id="homeYearInput" inputmode="numeric" maxlength="4" placeholder="2020" aria-label="Ano para buscar destaques" />
        </div>
        <button type="button" id="homeYearSearch" class="home-empty-btn"><i class="fas fa-magnifying-glass"></i> Buscar ano</button>
      </div>
      <div class="home-h-scroll" id="homeYearGrid"></div>
      <div class="home-h-scroll home-skeleton" id="homeYearSkeleton" style="display:none;">${skeletonHTML()}</div>
      <div class="home-error" id="homeYearError" style="display:none;"></div>
    </section>

    ${railHTML(2)}

    <section class="home-section" id="homeTrendingSection" aria-label="Em alta" style="display:none;">
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas fa-fire"></i> Em Alta</h2>
      </div>
      <div class="home-h-scroll" id="homeTrendingGrid"></div>
      <div class="home-h-scroll home-skeleton" id="homeTrendingSkeleton">${skeletonHTML()}</div>
      <div class="home-error" id="homeTrendingError" style="display:none;"></div>
    </section>

    <section class="home-section" id="homeFavoritesSection" aria-label="Seus favoritos" style="display:none;">
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas fa-star"></i> Seus Favoritos</h2>
      </div>
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
 * Renderiza Continuar Assistindo (carrossel horizontal máx. 20)
 */
export function renderHomeContinue(container, items, onCardClick) {
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
    const progress = calcularProgresso(item);
    // A barra é a do modelo (`.progress-wrap`, com a porcentagem ao lado), a
    // mesma do Catálogo. A home tinha uma trilha de 3px sem porcentagem: o
    // mesmo dado de progresso com duas formas de mostrar.
    const extra = `
      <div class="progress-wrap">
        <div class="progress-track"><div class="progress-bar" style="width:${progress}%;"></div></div>
        <span class="progress-pct">${progress}%</span>
      </div>`;
    const card = createHomeCard({
      posterUrl: item.imagem || '',
      title: item.nome,
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

/**
 * Carrega e pinta o carrossel "Em Breve", logo após a descoberta por afinidade.
 *
 * A seção mostra o que ainda vai estrear, então a janela de busca é o futuro
 * (quem decide o que aparece é o `sort_by` do pedido). A semente alterna a
 * ordenação da busca (data de estreia mais próxima ↔ mais esperados), e a
 * seleção (`pickForSection`) escolhe dentro do pool o que ainda não foi
 * exibido — antes o loader pintava o topo do pool inteiro, então o clique de
 * atualizar só trocava entre duas listas fixas.
 *
 * O pedido é o dobro da largura porque o getter já devolve só `limit` itens
 * (com folga interna para pôster ausente): pedir o dobro deixa material para
 * a seleção variar sem repetir, e o que não cabe é descartado na escolha.
 *
 * @param {HTMLElement} container - Container da home.
 * @param {Array} items - Catálogo do usuário.
 * @param {Function} onAddFromTrending - Callback dos cards.
 * @param {Object} [opts] - { fresh }: o clique de atualizar pede dado novo da
 *   TMDb em vez de reexibir o pool do cache.
 * @returns {Promise<void>}
 */
export async function loadAndRenderUpcoming(container, items, onAddFromTrending, opts = {}) {
  const section = container.querySelector('#homeUpcomingSection');
  const grid = container.querySelector('#homeUpcomingGrid');
  const skel = container.querySelector('#homeUpcomingSkeleton');
  if (!section || !grid || !skel) return;

  setupSectionRefresh(section, () => {
    bumpSeed('upcoming');
    loadAndRenderUpcoming(container, items, onAddFromTrending, { fresh: true });
  }, 'Atualizar em breve');

  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';

  try {
    const seed = getVariety('upcoming').seed;
    const largura = getFullWidthCount();
    const pool = await getUpcomingTitles(items, largura * 2, {
      sortBy: seed % 2 === 0 ? 'first_air_date.asc' : 'popularity.desc',
      fresh: opts.fresh
    });
    const escolhidos = pickForSection('upcoming', pool, largura);
    skel.style.display = 'none';
    if (!escolhidos || escolhidos.length === 0) {
      section.style.display = 'none';
      return;
    }
    grid.style.display = '';
    grid.innerHTML = '';
    escolhidos.forEach((t) => {
      // A data de estreia é o motivo da seção existir: sem ela o card "Em
      // Breve" é idêntico ao de qualquer outro trilho.
      const data = t.date ? `<div class="home-upcoming-date"><i class="fas fa-calendar-day"></i> ${escapeHTML(formatAirDate(t.date))}</div>` : '';
      const card = createHomeCard({
        posterUrl: t.posterUrl,
        title: t.title,
        extraHtml: data,
        onClick: () => onAddFromTrending && onAddFromTrending(t)
      });
      grid.appendChild(card);
    });
    animateCards(grid);
  } catch (e) {
    skel.style.display = 'none';
    // Spec: se busca falhar ocultar a seção
    section.style.display = 'none';
    console.warn('Erro upcoming:', e);
  }
}

/**
 * Carrossel "Em Alta".
 *
 * @param {Element} container - Container da home.
 * @param {Array} items - Catálogo.
 * @param {Function} onAddFromTrending - Callback dos cards.
 * @param {Object} [opts] - { fresh }: o clique de atualizar pede dado novo da
 *   TMDb em vez de reexibir o pool do cache.
 */
export async function loadAndRenderTrending(container, items, onAddFromTrending, opts = {}) {
  const section = container.querySelector('#homeTrendingSection');
  const grid = container.querySelector('#homeTrendingGrid');
  const skel = container.querySelector('#homeTrendingSkeleton');
  const errEl = container.querySelector('#homeTrendingError');
  if (!section || !grid || !skel) return;

  setupSectionRefresh(section, () => {
    bumpSeed('trending');
    loadAndRenderTrending(container, items, onAddFromTrending, { fresh: true });
  }, 'Atualizar em alta');

  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  if (errEl) errEl.style.display = 'none';

  try {
    const seed = getVariety('trending').seed;
    const pool = await getTrendingToSuggest(items, null, { window: seed % 2 === 0 ? 'week' : 'day', fresh: opts.fresh });
    const trending = pickScoredForSection('trending', pool, getFullWidthCount());
    skel.style.display = 'none';
    if (!trending || trending.length === 0) {
      section.style.display = 'none';
      return;
    }
    grid.style.display = '';
    grid.innerHTML = '';
    trending.forEach((t) => {
      const card = createHomeCard({
        posterUrl: t.posterUrl,
        title: t.title,
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
 * Uma faixa "Se você gostou de X vai gostar disso".
 *
 * Cada faixa tem estado próprio — âncora, títulos exibidos e semente de
 * seleção — e é o que faz o botão atualizar **uma** faixa e não a página. O
 * estado vive no DOM (`dataset`) em vez de num `Map` do módulo porque a home é
 * remontada do zero a cada render: um `Map` guardaria as âncoras da instância
 * anterior, e a faixa recém-carregada receberia um filtro de títulos obsoleto.
 *
 * @param {Element} section - A `<section>` da faixa.
 * @param {number} index - Posição da faixa.
 * @returns {Element|null} A seção, ou null se não existir.
 */
function railSection(container, index) {
  return container.querySelector(`#homeRail${index}`);
}

/**
 * Acende a faixa e pinta o esqueleto enquanto a base é buscada.
 *
 * @param {Element} section - A `<section>` da faixa.
 * @param {number} index - Posição da faixa.
 */
function railLoading(section, index) {
  section.style.display = '';
  const grid = section.querySelector(`#homeRail${index}Grid`);
  const skel = section.querySelector(`#homeRail${index}Skeleton`);
  if (grid) grid.style.display = 'none';
  if (skel) skel.style.display = '';
}

/**
 * Pinta os cards de uma faixa, ou apaga a faixa se não houver o que mostrar.
 *
 * A faixa apagada perde o `dataset`, e isso é o ponto: sem âncora registrada,
 * as outras faixas não a contam como vizinha ocupada, e o `offset` delas pode
 * reaproveitar a base que ficou livre.
 *
 * @param {Element} section - A `<section>` da faixa.
 * @param {number} index - Posição da faixa.
 * @param {Object|null} rail - `{ base, pool }` da faixa.
 * @param {Function} onAddFromTrending - Callback dos cards.
 * @returns {boolean} true se a faixa ficou acesa.
 */
function railPaint(section, index, rail, onAddFromTrending) {
  const grid = section.querySelector(`#homeRail${index}Grid`);
  const skel = section.querySelector(`#homeRail${index}Skeleton`);
  const titleEl = section.querySelector(`#homeRail${index}Title`);
  if (skel) skel.style.display = 'none';

  const chosen = rail ? pickScoredForSection(`affinity${index}`, rail.pool, getFullWidthCount()) : null;
  if (!rail || !grid || !chosen || chosen.length === 0) {
    section.style.display = 'none';
    delete section.dataset.baseId;
    delete section.dataset.shown;
    delete section.dataset.seed;
    return false;
  }

  if (titleEl) titleEl.innerHTML = `<i class="fas fa-heart"></i> Se você gostou de "${escapeHTML(rail.base.nome)}" vai gostar disso`;
  grid.style.display = '';
  grid.innerHTML = '';
  chosen.forEach((t) => {
    // Envelope em arrow: o card chama o handler com o evento do DOM, e
    // `onAddFromTrending` espera o item.
    grid.appendChild(createHomeCard({
      posterUrl: t.posterUrl,
      title: t.title,
      onClick: () => onAddFromTrending && onAddFromTrending(t)
    }));
  });
  animateCards(grid);

  // O que a faixa está exibindo agora, para as vizinhas não repetirem nem
  // tomarem a mesma âncora. Fica no `dataset` porque o `Map` do módulo não
  // sobrevive ao remount.
  section.dataset.baseId = String(rail.base.tmdb_id);
  section.dataset.shown = chosen.map((t) => String(t.id)).join(',');
  section.dataset.seed = String(bumpSeedIfNew(section));
  return true;
}

/**
 * Lê (e cria) a semente de seleção de cards da faixa.
 *
 * Não é a semente da âncora: é a do `pickWithMix`, que decide a ordem dos
 * títulos dentro da faixa. Vive no `dataset` pelo mesmo motivo do resto.
 *
 * @param {Element} section - A `<section>` da faixa.
 * @returns {number} Semente atual.
 */
function bumpSeedIfNew(section) {
  const atual = Number(section.dataset.seed || 0);
  section.dataset.seed = String(atual + 1);
  return atual;
}

/**
 * O que as outras faixas estão ocupando agora: âncoras e títulos.
 *
 * É o que mantém as quatro faixas distintas depois de uma atualização
 * individual. Sem isto, a faixa 2 giraria para a base que a faixa 1 acabou de
 * escolher e as duas ofereceriam as mesmas coisas com nomes diferentes no
 * título — repetição que o clique do usuário produziu.
 *
 * @param {Element} container - Container da home.
 * @param {number} index - Faixa a ignorar (a que está se atualizando).
 * @returns {{titles: Set<string>, bases: Set<string>}} Conjuntos das vizinhas.
 */
function railNeighbours(container, index) {
  const titles = new Set();
  const bases = new Set();
  for (let i = 0; i < AFFINITY_RAIL_COUNT; i++) {
    if (i === index) continue;
    const vizinha = railSection(container, i);
    if (!vizinha || vizinha.style.display === 'none') continue;
    if (vizinha.dataset.baseId) bases.add(vizinha.dataset.baseId);
    if (vizinha.dataset.shown) vizinha.dataset.shown.split(',').forEach((id) => titles.add(id));
  }
  return { titles, bases };
}

/**
 * Carrega uma faixa, ou recarrega só ela.
 *
 * O primeiro carregamento pede as `AFFINITY_RAIL_COUNT` faixas de uma vez: o
 * `seen` compartilhado garante a não repetição entre elas com um filtro só. A
 * atualização pede uma, com o que as vizinhas estão exibindo como exclusão —
 * é a diferença entre "as quatro mudam" e "esta muda".
 *
 * Faixa sem pool é apagada em vez de ficar vazia: três faixas verdadeiras são
 * melhores do que quatro com uma oca no meio, e o conjunto menor que o pedido é
 * o próprio aviso de que o catálogo não ancora mais que isso.
 *
 * @param {Element} container - Container da home.
 * @param {Array} items - Catálogo do usuário.
 * @param {Function} onAddFromTrending - Callback dos cards.
 * @param {number} [onlyIndex] - Recarrega só esta faixa.
 * @param {Object} [opts] - { fresh }: o clique de atualizar pede as
 *   recomendações da rede em vez do cache de 1h.
 * @returns {Promise<void>}
 */
export async function loadAndRenderAffinityRails(container, items, onAddFromTrending, onlyIndex = null, opts = {}) {
  const todas = Array.from({ length: AFFINITY_RAIL_COUNT }, (_, i) => railSection(container, i)).filter(Boolean);
  if (todas.length === 0) return;

  const primeiro = onlyIndex === null;
  if (primeiro) {
    todas.forEach((section, i) => {
      setupSectionRefresh(section, () => {
        loadAndRenderAffinityRails(container, items, onAddFromTrending, i, { fresh: true });
      }, 'Atualizar recomendações');
      railLoading(section, i);
    });
  } else {
    const section = railSection(container, onlyIndex);
    if (!section) return;
    railLoading(section, onlyIndex);
  }

  try {
    if (primeiro) {
      const dados = await getAffinityRails(items, { count: AFFINITY_RAIL_COUNT });
      dados.forEach((rail, i) => {
        const section = railSection(container, i);
        if (section) railPaint(section, i, rail, onAddFromTrending);
      });
      return;
    }

    // A faixa que está se atualizando libera a própria âncora e os próprios
    // títulos: são eles que estão sendo trocados. Sem isso, a faixa estaria
    // excluindo de si mesma e nunca encontraria material novo.
    const vizinhas = railNeighbours(container, onlyIndex);
    const baseAtual = railSection(container, onlyIndex)?.dataset.baseId;
    if (baseAtual) vizinhas.bases.add(baseAtual);
    const rail = await getAffinityRail(items, {
      offset: bumpSeed('affinity'),
      excludeTitles: vizinhas.titles,
      excludeBaseIds: vizinhas.bases,
      fresh: opts.fresh
    });
    const section = railSection(container, onlyIndex);
    if (section) railPaint(section, onlyIndex, rail, onAddFromTrending);
  } catch {
    const indices = primeiro
      ? todas.map((_, i) => i)
      : [onlyIndex];
    indices.forEach((i) => {
      const section = railSection(container, i);
      if (!section) return;
      const skel = section.querySelector(`#homeRail${i}Skeleton`);
      if (skel) skel.style.display = 'none';
      section.style.display = 'none';
    });
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
 * @param {Object} [opts] - { fresh }: o clique de atualizar pede dado novo da
 *   TMDb em vez de reexibir o pool do cache.
 * @returns {Promise<void>}
 */
function renderCategorySection(container, items, cat, onAddFromTrending, opts = {}) {
  const wrap = container.querySelector('#homeCategories');
  if (!wrap) return Promise.resolve();
  const key = `cat-${cat.id}`;
  let section = wrap.querySelector(`#homeCatSection-${cat.id}`);
  if (!section) {
    section = document.createElement('section');
    section.className = 'home-section';
    section.id = `homeCatSection-${cat.id}`;
    section.innerHTML = `
      <div class="home-section-head">
        <h2 class="home-section-title"><i class="fas ${cat.icon}"></i> ${escapeHTML(cat.name)}</h2>
      </div>
      <div class="home-h-scroll" id="cat-${cat.id}"></div>
      <div class="home-h-scroll home-skeleton" id="cat-skel-${cat.id}">${skeletonHTML()}</div>
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
      const pool = await getTitlesByGenre(cat.id, items, null, { sortBy: CAT_SORT, fresh: opts.fresh });
      const titles = pickScoredForSection(key, pool, getFullWidthCount());
      skel.style.display = 'none';
      if (!titles || titles.length === 0) {
        section.style.display = 'none';
        return;
      }
      setupSectionRefresh(section, () => {
        bumpSeed(key);
        renderCategorySection(container, items, cat, onAddFromTrending, { fresh: true });
      }, `Atualizar ${cat.name}`);
      grid.style.display = '';
      grid.innerHTML = '';
      titles.forEach((t) => {
        const card = createHomeCard({
          posterUrl: t.posterUrl,
          title: t.title,
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
export async function loadAndRenderCalendar(container, items, onCardClick, opts = {}) {
  const section = container.querySelector('#homeCalendarSection');
  const grid = container.querySelector('#homeCalendarGrid');
  const skel = container.querySelector('#homeCalendarSkeleton');
  const hint = container.querySelector('#homeCalendarHint');
  if (!section || !grid || !skel) return;
  setupSectionRefresh(section, () => {
    loadAndRenderCalendar(container, items, onCardClick, { fresh: true });
  }, 'Atualizar calend�rio');
  section.style.display = '';
  grid.style.display = 'none';
  skel.style.display = '';
  try {
    const week = await getCalendarWeek(items, { fresh: opts.fresh });
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
        <div class="home-calendar-eps"></div>`;
      const epsWrap = col.querySelector('.home-calendar-eps');
      eps.forEach(({ item, episode }) => {
        // Sem pôster do título, usa a still do episódio: melhor que cartão vazio.
        const posterUrl = item.imagem || (episode.still_path ? `https://image.tmdb.org/t/p/w300${episode.still_path}` : '');
        // O corpo deste card é o único da Home que não é barra de progresso:
        // ele diz qual episódio sai naquela data — número e nome.
        const epNum = `T${episode.season_number} · E${episode.episode_number}`;
        const epNome = episode.name || '';
        const c = createHomeCard({
          posterUrl,
          title: item.nome,
          extraHtml: `
            <div class="home-calendar-epinfo">
              <span class="home-calendar-epnum">${epNum}</span>
              ${epNome ? `<span class="home-calendar-epname" title="${escapeHTML(epNome)}">${escapeHTML(epNome)}</span>` : ''}
            </div>`,
          onClick: () => onCardClick && onCardClick(items.indexOf(item)),
          item
        });
        c.classList.add('card--calendar');
        c.classList.remove('card--rail');
        epsWrap.appendChild(c);
      });
      grid.appendChild(col);
    });
    animateCards(grid);
  } catch { skel.style.display = 'none'; section.style.display = 'none'; }
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
    const card = createHomeCard({ posterUrl: item.imagem || '', title: item.nome, onClick: () => onCardClick && onCardClick(items.indexOf(item)), item });
    grid.appendChild(card);
  });
  animateCards(grid);
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
    res.innerHTML = '<div class="home-roulette-shuffle"><i class="fas fa-dice fa-spin"></i> Buscando título novo...</div>';
    res.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const pool = await getNewPool();
    if (pool.length === 0) { res.style.display = ''; res.innerHTML = '<p class="home-note">Nenhum título novo encontrado. Tente novamente.</p>'; btn.disabled = false; btn.innerHTML = '<i class="fas fa-dice"></i> Sortear aleatório'; return; }
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
        <small class="home-roulette-note">Título novo para descobrir</small>
        <div class="home-roulette-actions">
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
          row.innerHTML = `<img src="${raw.poster_path ? `https://image.tmdb.org/t/p/w92${raw.poster_path}` : ''}" alt="" onerror="this.style.display='none'" /><span>${escapeHTML(title)}</span><small>${(raw.first_air_date || '').slice(0,4) || ''}</small>`;
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
        const card = createHomeCard({ posterUrl: t.posterUrl, title: t.title, onClick: () => onAddFromTrending && onAddFromTrending(t) });
        grid.appendChild(card);
      });
      animateCards(grid);
    } catch {
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
    const cards = gridEl.querySelectorAll('.card--rail, .card--calendar, .home-skeleton-card');
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
  renderHomeContinue(container, items, context.onCardClick, context.onOpenAddModal);
  renderHomeFavorites(container, items, context.onCardClick);
  // Novas seções
  loadAndRenderCalendar(container, items, context.onCardClick);
  setupRoulette(container, items, context.onCardClick, context.onAddFromTrending);
  loadAndRenderAbandoned(container, items, context.onCardClick);
  setupAffinityDiscovery(container, items, context.onAddFromTrending);
  // Em Breve vem depois da afinidade no template; a chamada acompanha, para
  // a ordem de resolução seguir a ordem de leitura da página.
  loadAndRenderUpcoming(container, items, context.onAddFromTrending);
  setupYearPicker(container, items, context.onAddFromTrending);
  loadAndRenderByYear(container, items, context.onAddFromTrending);
  // Async seções existentes - don't block
  loadAndRenderTrending(container, items, context.onAddFromTrending);
  loadAndRenderAffinityRails(container, items, context.onAddFromTrending);
  loadAndRenderCategories(container, items, context.onAddFromTrending);
}
