/**
 * Componente TitleInfoModal - Informações completas do título
 * Dados: TMDB (tv/{id} + aggregate_credits) e Wikipédia (curiosidades)
 */

import { callTMDB, fetchTitleLogo } from '../lib/api.js';
import { escapeHTML, formatDateBR } from '../lib/catalog.js';
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

/**
 * Uma linha de "Detalhes".
 *
 * O indicador fica **depois** do valor, e não antes do rótulo: nos testes de
 * tela a bandeira tem que vir em seguida do nome do país, e o marcador de status
 * tem que vir em seguida do estado.
 * @param {string} label - Rótulo, em maiúsculas via CSS.
 * @param {string} value - Texto do valor; ignorado se vazio.
 * @param {Object} [opts]
 * @param {string} [opts.suffix] - HTML depois do valor (bandeira, ícone).
 * @returns {string} HTML da linha, ou vazio.
 */
function row(label, value, opts = {}) {
  if (!value) return '';
  return `<div class="ti-row"><span class="ti-label">${escapeHTML(label)}</span><span class="ti-value">${opts.prefix || ''}${escapeHTML(value)}${opts.suffix || ''}</span></div>`;
}

/**
 * Marcador de status: ícone + classe de tom, para a linha e para o badge do topo.
 * @param {string} status - `details.status` cru do TMDB.
 * @returns {{ icon: string, tone: string }}
 */
function statusMarker(status) {
  return {
    icon: STATUS_ICON[status] || 'fa-circle-question',
    tone: STATUS_TONE[status] || 'is-planned'
  };
}

function section(title, icon, inner) {
  if (!inner) return '';
  return `<section class="ti-section"><h3 class="ti-section-title"><i class="fas ${icon}"></i> ${escapeHTML(title)}</h3>${inner}</section>`;
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
        callTMDB(`tv/${tmdbId}`, {}, 'pt-BR'),
        callTMDB(`tv/${tmdbId}/aggregate_credits`, {}, 'pt-BR').catch(() => null),
        fetchTitleLogo(tmdbId, 'tv').catch(() => null)
      ]);

      showTitleInfoLogo(logoUrl, details.name || item.nome);

      const createdBy = (details.created_by || []).map(c => c.name).filter(Boolean);
      const directors = ((credits?.crew || []).filter(c => /director/i.test(c.job || '')).map(c => c.name).filter(Boolean) || [])
        .filter((n, i, arr) => arr.indexOf(n) === i)
        .slice(0, 6);
      const cast = (credits?.cast || []).filter(c => c.name).slice(0, 12);
      const countries = (details.origin_country || details.production_countries?.map(c => c.iso_3166_1 || c.name) || []).filter(Boolean);
      const countryNames = (details.production_countries || []).map(c => c.name).filter(Boolean);
      const networks = (details.networks || []).map(n => n.name).filter(Boolean);
      const companies = (details.production_companies || []).map(c => c.name).filter(Boolean);
      const producers = [...new Set([...networks, ...companies])];
      const genres = (details.genres || []).map(g => g.name).filter(Boolean);
      const runtime = Array.isArray(details.episode_run_time) && details.episode_run_time.length
        ? `${Math.min(...details.episode_run_time)} min`
        : '';
      const language = details.original_language ? details.original_language.toUpperCase() : '';
      const statusPt = STATUS_PT[details.status] || details.status || '';
      const status = statusMarker(details.status);
      // Bandeira: `origin_country` é onde a série foi criada;
      // `production_countries` é onde foi produzida. Serve o primeiro que vier.
      const isoCountry = (details.origin_country || [])[0]
        || (details.production_countries || [])[0]?.iso_3166_1
        || '';
      const flag = flagEmoji(isoCountry);
      const flagImg = flagTag(isoCountry, countryNames[0] || countries[0] || '');
      const countryText = (countryNames.length ? countryNames : countries).join(', ');
      // O código ISO 639-1 virava "Inglês" em vez de "EN".
      const langCode = String(details.original_language || '').toLowerCase();
      const langText = LANG_PT[langCode] || language;
      const typePt = TYPE_PT[details.type] || details.type || '';
      const release = details.first_air_date
        ? `${formatDateBR(details.first_air_date)}${details.last_air_date ? ` — ${formatDateBR(details.last_air_date)}` : ''}`
        : '';

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
      if (details.tagline) {
        html += section('Frase de destaque', 'fa-quote-left', `<p class="ti-text ti-text--muted">${escapeHTML(details.tagline)}</p>`);
      }

      const facts = [
        row('Criador', createdBy.join(', ')),
        row('Direção', directors.join(', ')),
        row('País de origem', countryText, { suffix: flagImg }),
        row('Lançamento', release),
        row('Produtora', producers.join(', ')),
        row('Gênero', genres.join(', ')),
        row('Tipo', typePt),
        row('Duração', runtime),
row('Idioma original', langText),
        row('Status', statusPt),
        row('Temporadas', details.number_of_seasons ? String(details.number_of_seasons) : ''),
        row('Episódios', details.number_of_episodes ? String(details.number_of_episodes) : ''),
        row('IMDb', details.imdb_id ? details.imdb_id : '')
      ].join('');
      html += section('Detalhes', 'fa-list', facts ? `<div class="ti-rows">${facts}</div>` : '');

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
      const castRail = titleInfoContent.querySelector('.ti-cast');
      if (castRail) castRail.addEventListener('scroll', () => syncCastFade(castRail), { passive: true });
      titleInfoLoading.style.display = 'none';
      titleInfoContent.style.display = 'block';
      // A medição vem depois do `display: block`: um elemento escondido tem
      // `clientWidth` e `scrollWidth` zerados, e o trilho pareceria nunca
      // transbordar — o que tiraria o fade de um elenco cheio logo na abertura.
      // O `scroll` é passivo: ele só mede e troca uma classe, e não quer
      // competir com a rolagem suave por causa disso.
      syncCastFade(castRail);
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
  // troca o trilho. O redimensionamento importa porque o modal acompanha a
  // largura da janela — alargar pode fazer o elenco curto deixar de transbordar.
  window.addEventListener('resize', () => syncCastFade());

  return {
    open: (item) => openTitleInfoModal(item),
    close: closeTitleInfoModal
  };
}
