/**
 * Componente TitleInfoModal - Informações completas do título
 * Dados: TMDB (tv/{id} + aggregate_credits) e Wikipédia (curiosidades)
 */

import { callTMDB, fetchTitleLogo } from '../lib/api.js';
import { escapeHTML, formatDateBR } from '../lib/catalog.js';
import { US_RATING_BR } from '../lib/discoverSearch.js';
import { lockScreen, unlockScreen, trapFocus, releaseFocusTrap } from './uiHelpers.js';

const STATUS_PT = {
  'Returning Series': 'Em exibição',
  'Ended': 'Finalizada',
  'Canceled': 'Cancelada',
  'In Production': 'Em produção',
  'Planned': 'Planejada'
};

const TYPE_PT = {
  'Scripted': 'Roteirizada',
  'Miniseries': 'Minissérie',
  'Talk Show': 'Talk show',
  'Documentary': 'Documentário',
  'News': 'Notícias',
  'Reality': 'Reality',
  'Competition': 'Competição'
};

/**
 * Ícone e cor por status.
 *
 * A linha de status era só texto, e "Em exibição" não se distinguia de
 * "Finalizada" sem ler. Agora cada estado tem um marcador: check no encerrado,
 * X no cancelado, e play no que ainda está rolando.
 */
export const STATUS_ICON = {
  'Returning Series': 'fa-play',
  'Ended': 'fa-check',
  'Canceled': 'fa-xmark',
  'In Production': 'fa-hammer',
  'Planned': 'fa-calendar-day'
};

export const STATUS_TONE = {
  'Returning Series': 'is-live',
  'Ended': 'is-done',
  'Canceled': 'is-canceled',
  'In Production': 'is-live',
  'Planned': 'is-planned'
};

/**
 * Nome do idioma em português.
 *
 * A linha "Idioma original" mostrava o código cru em maiúscula (`EN`, `JA`),
 * que não é legível para quem não sabe o código. O idioma continua vindo do
 * TMDB em ISO 639-1; aqui só vira texto.
 */
export const LANG_PT = {
  en: 'Inglês', ja: 'Japonês', ko: 'Coreano', pt: 'Português', es: 'Espanhol',
  fr: 'Francês', de: 'Alemão', it: 'Italiano', ru: 'Russo', zh: 'Chinês',
  hi: 'Hindi', ar: 'Árabe', tr: 'Turco', nl: 'Holandês', sv: 'Sueco',
  no: 'Norueguês', da: 'Dinamarquês', fi: 'Finlandês', pl: 'Polonês',
  cs: 'Tcheco', th: 'Tailandês', id: 'Indonésio', ms: 'Malaio',
  he: 'Hebraico', el: 'Grego', ro: 'Romeno', hu: 'Húngaro', uk: 'Ucraniano'
};

/**
 * Escolhe a classificação etária a exibir.
 *
 * O `content_ratings` traz uma lista por país. O app é pt-BR, então a nota
 * brasileira vem primeiro ("16", "14", "L"); sem ela, cai para a americana
 * ("TV-MA") — a mesma faixa usada nos filtros da Pesquisar. Entradas sem
 * `rating` (que significam "não classificada") são ignoradas.
 * @param {Object} contentRatings - Bloco `content_ratings` do TMDB.
 * @param {string[]} [preferidos] - Países em ordem de prioridade.
 * @returns {Object|null} `{ iso_3166_1, rating, descriptors }` ou null.
 */
export function pickContentRating(contentRatings, preferidos = ['BR', 'US']) {
  const results = Array.isArray(contentRatings?.results) ? contentRatings.results : [];
  const comNota = results.filter(r => r && r.rating);
  for (const code of preferidos) {
    const hit = comNota.find(r => r.iso_3166_1 === code);
    if (hit) return hit;
  }
  return comNota[0] || null;
}

/** Texto da classificação: nota + país de referência (ex.: "16 · BR"). */
export function formatAgeRating(rating) {
  if (!rating || !rating.rating) return '';
  const pais = rating.iso_3166_1 ? ` · ${rating.iso_3166_1}` : '';
  return `${rating.rating}${pais}`;
}

/**
 * Tom do selo de faixa etária a partir da nota.
 *
 * Segue as cores oficiais brasileiras (L verde, 10 azul, 12 amarelo,
 * 14 laranja, 16 vermelho, 18 preto); a nota americana cai na faixa
 * equivalente via `US_RATING_BR`, que é a fonte única da equivalência.
 * Sem nota conhecida, o selo sai neutro em vez de sumir, para a linha
 * não desaparecer conforme o país.
 * @param {string} nota - Ex.: "16", "L", "TV-MA".
 * @returns {string} Sufixo de classe (`l`, `10`…`18`, `na`).
 */
export function ageTone(nota) {
  const key = String(nota || '').trim().toUpperCase();
  const br = US_RATING_BR[key] || key;
  return ['L', '10', '12', '14', '16', '18'].includes(br) ? br.toLowerCase() : 'na';
}

/**
 * Rótulo do bloco de data final conforme o estado da série.
 *
 * "Encerramento" só faz sentido para série encerrada ou cancelada; em
 * exibição a data é a do último episódio que foi ao ar, não a do fim.
 * @param {string} status - Status cru do TMDB (ex.: "Ended").
 * @returns {string} "Encerramento" ou "Último episódio".
 */
export function endDateLabel(status) {
  return status === 'Ended' || status === 'Canceled' ? 'Encerramento' : 'Último episódio';
}

/**
 * Selo colorido da classificação + país de referência em texto apagado.
 *
 * O selo mostra sempre o código brasileiro (`TV-MA` vira `16`): é o padrão
 * do app, o mesmo do filtro de pesquisa. O original vai no tooltip.
 * @param {Object|null} rating - `{ iso_3166_1, rating }` de `pickContentRating`.
 * @returns {string} HTML, ou vazio sem nota.
 */
function ageBadge(rating) {
  if (!rating || !rating.rating) return '';
  const key = String(rating.rating).trim().toUpperCase();
  const exibida = US_RATING_BR[key] || rating.rating;
  return `<span class="ti-age ti-age--${ageTone(rating.rating)}" title="${escapeHTML(formatAgeRating(rating))}">${escapeHTML(exibida)}</span>`;
}

/**
 * Lista de pills (gêneros): um marcador por item, em vez de texto corrido
 * separado por vírgula, que não se distingue do resto da linha.
 * @param {string[]} items
 * @returns {string} HTML, ou vazio sem itens.
 */
function pills(items) {
  const list = (items || []).map((s) => String(s).trim()).filter(Boolean);
  if (!list.length) return '';
  return `<span class="ti-pills">${list.map((g) => `<span class="ti-pill">${escapeHTML(g)}</span>`).join('')}</span>`;
}

/**
 * Converte ISO 3166-1 alpha-2 no emoji da bandeira.
 *
 * O TMDB entrega o país como `origin_country: ['US']` ou em
 * `production_countries: [{ iso_3166_1: 'US' }]`. Cada letra vira o símbolo
 * regional correspondente (U+1F1E6 é 'A'..'Z'), e o par de símbolos é a
 * bandeira. Entrada que não são duas letras ASCII viram string vazia, para não
 * despejar lixo visual quando o campo vier inesperado.
 * @param {string} iso2
 * @returns {string}
 */
export function flagEmoji(iso2) {
  const code = String(iso2 || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

/**
 * URL da bandeira em imagem.
 *
 * O emoji de bandeira não serve: no Windows ele não é renderizado como
 * bandeira, e sim como o par de letras dentro de um quadrado ("US", "JP"), que
 * é pior que não ter nada. O flagcdn serve o SVG do país, que é vetorial e
 * aceita tema escuro sem ficar com borda branca.
 *
 * O código vai validado por `flagEmoji` antes, então a URL nunca carrega nada
 * vindo do dado do TMDB sem checagem.
 * @param {string} iso2
 * @returns {string} URL, ou string vazia se o código não for válido.
 */
export function flagUrl(iso2) {
  const code = String(iso2 || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return `https://flagcdn.com/${code.toLowerCase()}.svg`;
}

/**
 * Elemento da bandeira: imagem de verdade, com o emoji guardado como reserva.
 *
 * Se a imagem não carregar (CDN fora do ar, offline, código sem bandeira), o
 * `applyFlagFallbacks` troca pelo emoji em vez de deixar o ícone quebrado.
 * @param {string} iso2
 * @returns {string} HTML, ou vazio se não houver bandeira.
 */
function flagTag(iso2, alt) {
  const url = flagUrl(iso2);
  if (!url) return '';
  return `<img class="ti-flag" src="${escapeHTML(url)}" data-fallback="${flagEmoji(iso2)}" alt="${escapeHTML(alt || '')}" loading="lazy" width="20" height="14" />`;
}

/**
 * Troca a imagem de bandeira pelo emoji quando ela não carrega.
 *
 * A lista de imagens já renderizadas é conferida depois do `innerHTML`, para
 * não depender de atributo `onerror` inline (que quebra com CSP restritivo).
 * @param {HTMLElement} root - Container onde o HTML foi injetado.
 */
function applyFlagFallbacks(root) {
  root.querySelectorAll('img.ti-flag').forEach(img => {
    if (img.dataset.fallbackBound) return;
    img.dataset.fallbackBound = '1';
    img.addEventListener('error', () => {
      const marca = document.createElement('span');
      marca.className = 'ti-flag ti-flag--emoji';
      marca.textContent = img.dataset.fallback || '';
      img.replaceWith(marca);
    }, { once: true });
  });
}

/**
 * Extrai curiosidades da Wikipédia (parágrafos após a introdução)
 */
async function fetchWikipediaCuriosities(query) {
  try {
    const url = `https://pt.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0];
    const text = page?.extract;
    if (!text) return null;
    const paragraphs = text.split(/\n{1,}/).map(p => p.trim()).filter(p => p.length > 90);
    if (paragraphs.length === 0) return null;
    return paragraphs.slice(0, 3);
  } catch {
    return null;
  }
}

function section(title, icon, inner) {
  if (!inner) return '';
  return `<section class="ti-section"><h3 class="ti-section-title"><i class="fas ${icon}"></i> ${escapeHTML(title)}</h3>${inner}</section>`;
}

/**
 * Uma célula da ficha em grade: rótulo em cima, valor embaixo.
 *
 * O indicador (bandeira, marcador de status) fica **depois** do valor, e não
 * antes do rótulo: a bandeira tem que vir em seguida do nome do país, e o
 * marcador de status em seguida do estado. Fato longo (nomes, pills) usa
 * `opts.wide` e ocupa a linha inteira da grade.
 * @param {string} label - Rótulo, em maiúsculas via CSS.
 * @param {string} value - Texto do valor; ignorado se vazio. Com `opts.html`,
 *   é HTML já montado (pills, selo) em vez de texto a escapar.
 * @param {Object} [opts]
 * @param {string} [opts.suffix] - HTML depois do valor (bandeira, ícone).
 * @param {boolean} [opts.html] - Não escapa o valor.
 * @param {boolean} [opts.wide] - Célula larga, na linha inteira.
 * @returns {string} HTML da célula. Sem valor, mostra "—" em vez de sumir:
 *   o bloco existe mesmo quando o TMDB não tem o dado.
 */
function cell(label, value, opts = {}) {
  const corpo = value ? (opts.html ? value : escapeHTML(value)) : '<span class="ti-dash">—</span>';
  const larga = opts.wide ? ' ti-cell--wide' : '';
  return `<div class="ti-cell${larga}"><span class="ti-cell-label">${escapeHTML(label)}</span><span class="ti-cell-value">${opts.prefix || ''}${corpo}${opts.suffix || ''}</span></div>`;
}

/**
 * Grade da ficha: monta o wrapper com as células (vazias viram "—" no `cell`).
 */
function grid(cells) {
  const inner = (cells || []).filter(Boolean).join('');
  return inner ? `<div class="ti-grid">${inner}</div>` : '';
}

/**
 * Configura e controla o modal de informações do título
 * @param {Object} elements - Elementos DOM do modal
 * @param {Object} callbacks
 * @returns {Object} API do modal
 */
export function setupTitleInfoModal(elements, callbacks = {}) {
  const { titleInfoModal, titleInfoClose, titleInfoTitle, titleInfoLoading, titleInfoContent, titleInfoLogoWrap, titleInfoLogoImg } = elements;
  const { onToast, onResolveTmdbId } = callbacks;

  function hideTitleInfoLogo() {
    if (!titleInfoLogoWrap || !titleInfoLogoImg) return;
    titleInfoLogoWrap.style.display = 'none';
    titleInfoLogoImg.removeAttribute('src');
    titleInfoLogoImg.alt = '';
  }

  function showTitleInfoLogo(url, nome) {
    if (!titleInfoLogoWrap || !titleInfoLogoImg || !url) return;
    titleInfoLogoImg.src = url;
    titleInfoLogoImg.alt = `Logo de ${nome || ''}`.trim();
    titleInfoLogoImg.onerror = () => hideTitleInfoLogo();
    titleInfoLogoWrap.style.display = 'flex';
  }

  function closeTitleInfoModal() {
    titleInfoModal.classList.remove('active');
    unlockScreen();
    hideTitleInfoLogo();
    titleInfoContent.innerHTML = '';
    titleInfoContent.style.display = 'none';
    titleInfoLoading.style.display = 'flex';
    releaseFocusTrap();
  }

  /**
   * Tirar o fade da direita do trilho de elenco quando não sobrou ninguém.
   *
   * A máscara do trilho é fixa, como nas faixas da home, mas o elenco é
   * limitado a 12 e pode ser bem menor: uma minissérie de três nomes cabe na
   * tela, e um fade que não tem para onde apontar apagaria a terceira foto sem
   * motivo. Rolar de volta traz a máscara.
   *
   * @param {HTMLElement} [rail] - Trilho. Sem argumento, procura o do modal
   *   atual — é o que a abertura e o redimensionamento usam, porque o trilho
   *   pode parar de transbordar sem que ninguém tenha rolado.
   */
  function syncCastFade(rail = titleInfoContent.querySelector('.ti-cast')) {
    if (!rail) return;
    const fim = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
    rail.classList.toggle('is-end', fim);
  }

  async function openTitleInfoModal(item) {
    if (!item) return;
    titleInfoTitle.innerHTML = `<i class="fas fa-circle-info"></i> ${escapeHTML(item.nome || 'Detalhes')}`;
    hideTitleInfoLogo();
    titleInfoLoading.style.display = 'flex';
    titleInfoContent.style.display = 'none';
    titleInfoContent.innerHTML = '';
    titleInfoModal.classList.add('active');
    lockScreen();
    const modalElem = titleInfoModal.querySelector('.modal');
    if (typeof window !== 'undefined' && window.anime) {
      window.anime({ targets: modalElem, translateY: ['20px', '0'], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
    }
    trapFocus(modalElem);

    try {
      let tmdbId = item.tmdb_id;
      if (!tmdbId && typeof onResolveTmdbId === 'function') {
        tmdbId = await onResolveTmdbId(item);
      }
      if (!tmdbId) throw new Error('Sem TMDB ID');

      const [details, credits, logoUrl] = await Promise.all([
        callTMDB(`tv/${tmdbId}`, { append_to_response: 'content_ratings' }, 'pt-BR'),
        callTMDB(`tv/${tmdbId}/aggregate_credits`, {}, 'pt-BR').catch(() => null),
        fetchTitleLogo(tmdbId, 'tv').catch(() => null)
      ]);

      showTitleInfoLogo(logoUrl, details.name || item.nome);

      // Equipe com foto: objeto inteiro (foto/logo) e teto menor, porque aqui
      // cada um vira um cartão.
      const creatorCards = (details.created_by || []).filter(c => c?.name).slice(0, 4);
      const directorCards = [];
      for (const m of (credits?.crew || [])) {
        if (!/director/i.test(m?.job || '') || !m?.name) continue;
        if (directorCards.some(d => d.name === m.name)) continue;
        directorCards.push(m);
        if (directorCards.length >= 4) break;
      }
      const networkCards = (details.networks || []).filter(n => n?.name).slice(0, 4);
      const companyCards = (details.production_companies || []).filter(c => c?.name).slice(0, 6);
      const cast = (credits?.cast || []).filter(c => c.name).slice(0, 12);
      const genres = (details.genres || []).map(g => g.name).filter(Boolean);
      const runtime = Array.isArray(details.episode_run_time) && details.episode_run_time.length
        ? `${Math.min(...details.episode_run_time)} min`
        : '';
      const statusPt = STATUS_PT[details.status] || details.status || '';
      // Origem mostra só as bandeiras, uma por país. `production_countries`
      // traz iso + nome; `origin_country` traz só o iso e completa o que
      // faltar, sem repetir. Inválido não vira bandeira (`flagTag` ignora).
      const vistos = new Set();
      const bandeiras = [];
      for (const c of (details.production_countries || [])) {
        const iso = String(c?.iso_3166_1 || '').toUpperCase();
        if (!/^[A-Z]{2}$/.test(iso) || vistos.has(iso)) continue;
        vistos.add(iso);
        bandeiras.push(flagTag(iso, c.name || iso));
      }
      for (const isoRaw of (details.origin_country || [])) {
        const iso = String(isoRaw || '').toUpperCase();
        if (!/^[A-Z]{2}$/.test(iso) || vistos.has(iso)) continue;
        vistos.add(iso);
        bandeiras.push(flagTag(iso, iso));
      }
      const flagImg = bandeiras.join('');
      const typePt = TYPE_PT[details.type] || details.type || '';
      const age = pickContentRating(details.content_ratings);
      const estreia = details.first_air_date ? formatDateBR(details.first_air_date) : '';
      const encerramento = details.last_air_date ? formatDateBR(details.last_air_date) : '';

      const curiosities = await fetchWikipediaCuriosities(details.name || item.nome);

      let html = '';

      html += `<div class="ti-hero">`;
      html += `<div class="ti-titles">`;
      html += `<div class="ti-name">${escapeHTML(details.name || item.nome || '')}</div>`;
      if (details.original_name && details.original_name !== details.name) {
        html += `<div class="ti-original">${escapeHTML(details.original_name)}</div>`;
      }
      html += `</div>`;
      html += `</div>`;

      html += section('Sinopse', 'fa-align-left', details.overview
        ? `<p class="ti-text">${escapeHTML(details.overview)}</p>`
        : '');

      // Padrão da seção: tudo em bloco — fato curto em cartão compacto, fato
      // longo em cartão de linha inteira (`wide`).
      const statusTone = STATUS_TONE[details.status] || '';
      const ficha = grid([
        cell('Gênero', pills(genres), { html: true, wide: true }),
        cell('Status', statusPt, statusTone ? { suffix: `<span class="ti-dot ${statusTone}"></span>` } : {}),
        cell('Faixa etária', ageBadge(age), { html: true }),
        cell('Estreia', estreia),
        cell(endDateLabel(details.status), encerramento),
        cell('Origem', flagImg, { html: true }),
        cell('Duração', runtime),
        cell('Tipo', typePt)
      ]);
      html += section('Detalhes', 'fa-list', ficha);

      if (cast.length) {
        const cards = cast.map(p => {
          const photo = p.profile_path
            ? `<img src="https://image.tmdb.org/t/p/w185${p.profile_path}" alt="${escapeHTML(p.name)}" loading="lazy" />`
            : `<span class="ti-cast-ph ti-cast-ph--empty"><i class="fas fa-user"></i></span>`;
          const role = (p.roles || []).map(r => r.character).filter(Boolean).slice(0, 2).join(' / ');
          return `<div class="ti-cast-card">${photo}<div class="ti-cast-name">${escapeHTML(p.name)}</div>${role ? `<div class="ti-cast-role">${escapeHTML(role)}</div>` : ''}</div>`;
        }).join('');
        html += section('Elenco', 'fa-users', `<div class="ti-cast">${cards}</div>`);
      }

      // Equipe numa linha só: criação, direção, emissora e produtora no mesmo
      // trilho do Elenco; a função embaixo de cada foto e a divisória entre
      // grupos separam sem quebrar a linha.
      const personCard = (p, funcao) => {
        const photo = p.profile_path
          ? `<img src="https://image.tmdb.org/t/p/w185${p.profile_path}" alt="${escapeHTML(p.name)}" loading="lazy" />`
          : `<span class="ti-cast-ph ti-cast-ph--empty"><i class="fas fa-user"></i></span>`;
        return `<div class="ti-cast-card">${photo}<div class="ti-cast-name">${escapeHTML(p.name)}</div><div class="ti-cast-role">${funcao}</div></div>`;
      };
      // Logo original da marca, com ícone de prédio quando não há logo.
      const orgCard = (o, funcao) => {
        const logo = o.logo_path
          ? `<img class="ti-team-logo" src="https://image.tmdb.org/t/p/w185${o.logo_path}" alt="${escapeHTML(o.name)}" loading="lazy" />`
          : `<span class="ti-cast-ph ti-cast-ph--empty"><i class="fas fa-building"></i></span>`;
        return `<div class="ti-cast-card">${logo}<div class="ti-cast-name">${escapeHTML(o.name)}</div><div class="ti-cast-role">${funcao}</div></div>`;
      };
      const grupos = [
        creatorCards.map(p => personCard(p, 'Criação')),
        directorCards.map(p => personCard(p, 'Direção')),
        networkCards.map(o => orgCard(o, 'Emissora')),
        companyCards.map(o => orgCard(o, 'Produtora'))
      ].filter(g => g.length);
      const equipeHtml = grupos.map(g => g.join('')).join('<div class="ti-team-sep" aria-hidden="true"></div>');
      if (equipeHtml) html += section('Equipe', 'fa-clapperboard', `<div class="ti-cast">${equipeHtml}</div>`);

      html += section('Curiosidades', 'fa-lightbulb', curiosities && curiosities.length
        ? `<ul class="ti-list">${curiosities.map(c => `<li>${escapeHTML(c)}</li>`).join('')}</ul>`
        : '<p class="ti-text ti-text--muted">Curiosidades indisponíveis.</p>');

      const links = [];
      if (details.homepage) links.push(`<a class="ti-link" href="${escapeHTML(details.homepage)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-globe"></i> Site oficial</a>`);
      if (details.imdb_id) links.push(`<a class="ti-link" href="https://www.imdb.com/title/${escapeHTML(details.imdb_id)}/" target="_blank" rel="noopener noreferrer"><i class="fas fa-star"></i> IMDb</a>`);
      else links.push(`<a class="ti-link" href="https://www.imdb.com/find?q=${encodeURIComponent(details.name || item.nome)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-star"></i> IMDb</a>`);
      links.push(`<a class="ti-link" href="https://pt.wikipedia.org/wiki/${encodeURIComponent(details.name || item.nome).replace(/%20/g, '_')}" target="_blank" rel="noopener noreferrer"><i class="fab fa-wikipedia-w"></i> Wikipédia</a>`);
      links.push(`<a class="ti-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent((details.name || item.nome) + ' trailer')}" target="_blank" rel="noopener noreferrer"><i class="fab fa-youtube"></i> YouTube</a>`);
      html += section('Sites', 'fa-link', `<div class="ti-links">${links.join('')}</div>`);

      titleInfoContent.innerHTML = html;
      applyFlagFallbacks(titleInfoContent);
      const castRails = titleInfoContent.querySelectorAll('.ti-cast');
      castRails.forEach((rail) => rail.addEventListener('scroll', () => syncCastFade(rail), { passive: true }));
      titleInfoLoading.style.display = 'none';
      titleInfoContent.style.display = 'block';
      // A medição vem depois do `display: block`: um elemento escondido tem
      // `clientWidth` e `scrollWidth` zerados, e o trilho pareceria nunca
      // transbordar — o que tiraria o fade de um elenco cheio logo na abertura.
      // O `scroll` é passivo: ele só mede e troca uma classe, e não quer
      // competir com a rolagem suave por causa disso.
      castRails.forEach((rail) => syncCastFade(rail));
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      titleInfoContent.innerHTML = `<div class="no-episodes">${item.tmdb_id ? 'Erro ao carregar detalhes.' : 'Sem dados no TMDB para este título.'}</div>`;
      titleInfoLoading.style.display = 'none';
      titleInfoContent.style.display = 'block';
      if (onToast) onToast('Não foi possível carregar os detalhes.', 3000);
    }
  }

  titleInfoClose.addEventListener('click', closeTitleInfoModal);
  titleInfoModal.addEventListener('click', (e) => {
    if (e.target === titleInfoModal) closeTitleInfoModal();
  });
  // Uma vez só, na montagem: o modal é único, e a cada abertura o `innerHTML`
  // troca os trilhos. O redimensionamento importa porque o modal acompanha a
  // largura da janela — alargar pode fazer um trilho curto deixar de transbordar.
  window.addEventListener('resize', () => {
    titleInfoContent.querySelectorAll('.ti-cast').forEach((rail) => syncCastFade(rail));
  });

  return {
    open: (item) => openTitleInfoModal(item),
    close: closeTitleInfoModal
  };
}
