/**
 * Componente de Cards - o modelo de card do projeto inteiro
 *
 * Havia dois cartões completos para o mesmo conteúdo: `card` (Catálogo e
 * listas) e `home-card` (Home), cada um com raio, hover, `padding`, corpo de
 * texto, barra de progresso e imagem próprios. Dois modelos para o mesmo item
 * é a origem de "aqui a fonte é outra": cada tela ajustava o seu e o catálogo
 * deixava de valer como referência.
 *
 * Agora existe um só. A anatomia e a tipografia vivem em `.card` no
 * `style.css`, e o markup mora aqui — `cardMarkup` é a única função que escreve
 * a estrutura, chamada tanto por `createCardElement` quanto por `createHomeCard`.
 * O que muda entre as telas não é o cartão, é a **largura**: o Catálogo usa a
 * coluna do grid, a Home usa o trilho. Isso é `.card--rail`.
 *
 * As exceções ao modelo (`.pesquisa-card`, o cartão da Roleta) mantêm a própria
 * anatomia porque não têm os mesmos dados — mas não inventam raio, borda,
 * sombra nem tipografia: saem dos mesmos tokens.
 */

import { calcularProgresso, getTierClass, escapeHTML } from '../lib/catalog.js';
import { fetchTitleLogo, callTMDB, resolveItemPosterUrl } from '../lib/api.js';

/**
 * Placeholder do pôster ausente. Um só para o projeto: havia `fa-video` com
 * `style` inline no Catálogo e `fa-film` com regra CSS na Home, e o mesmo
 * vão vazio ficava com dois tamanhos e duas opacidades diferentes.
 */
const IMG_FALLBACK = '<i class="fas fa-film"></i>';

/**
 * Markup único de card: pôster 2/3 → título → linha de metadado → barra de
 * progresso. Tudo que uma tela não tem simplesmente não vem — a linha de
 * metadado e a barra são opcionais porque a pesquisa e a Home não têm progresso
 * para mostrar, e forçá-las a renderizar um trilho vazio seria pior.
 *
 * @param {Object} o
 * @param {string} [o.posterUrl] - URL do pôster; vazio usa o placeholder.
 * @param {string} [o.titleHtml] - Título já escapado (o Catálogo junta o ano).
 * @param {string} [o.titleAttr] - Texto do atributo `title`; puro, escapado aqui.
 * @param {string} [o.metaHtml] - Linha de metadado (`.info`) já montada.
 * @param {string} [o.extraHtml] - Conteúdo específico da seção, depois da meta.
 * @param {string} [o.stampHtml] - Selo sobre o pôster (tier).
 * @param {string} [o.imgAttrs] - Atributos extras no `<img>` do pôster.
 * @returns {string} HTML do interior do card.
 */
export function cardMarkup({ posterUrl = '', titleHtml = '', titleAttr = '', metaHtml = '', extraHtml = '', stampHtml = '', imgAttrs = '' }) {
  const label = escapeHTML(titleAttr || titleHtml.replace(/<[^>]*>/g, ''));
  return `
    <div class="card-img">
      ${posterUrl ? `<img src="${escapeHTML(posterUrl)}" alt="${label}" loading="lazy" ${imgAttrs} />` : IMG_FALLBACK}
      ${stampHtml}
    </div>
    <div class="card-body">
      <h3 title="${label}">${titleHtml}</h3>
      ${metaHtml}
      ${extraHtml}
    </div>`;
}

/**
 * Liga o card ao clique e ao teclado. Mesmo par de eventos em todas as telas —
 * era o Catálogo com `role="listitem"` e a Home com `role="button"`, e a
 * diferença de papel é que a Home não tem lista por trás.
 */
export function attachCardInteraction(card, onActivate) {
  if (typeof onActivate !== 'function') return;
  card.addEventListener('click', onActivate);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(e); }
  });
}

/**
 * Troca o pôster salvo pela arte da temporada quando o TMDb devolve.
 *
 * As duas fábricas de card faziam isto: uma buscava a arte da temporada, a
 * outra resolvia o pôster. Uma função só, e o seletor é `.card-img` porque
 * agora é a mesma classe nas duas.
 */
export function resolveCardPoster(card, item) {
  const img = card.querySelector('.card-img img');
  if (!img || !item || !item.tmdb_id) return;
  resolveItemPosterUrl(item, 'w500')
    .then((url) => { if (url && img.src !== url) img.src = url; })
    .catch(() => {});
}

/**
 * Cria o elemento DOM de um card do Catálogo e das listas.
 *
 * A grade decide a largura (`1fr` da coluna), então este cartão não carrega
 * nenhuma variante: ele é o modelo. A Home chama `cardMarkup` direto e soma
 * `.card--rail`.
 *
 * @param {Object} item - Dados do item
 * @param {Array} items - Lista completa de itens (para buscar índice)
 * @param {Function} onCardClick - Callback quando card é clicado
 * @returns {HTMLElement} Elemento do card
 */
export function createCardElement(item, items, onCardClick) {
  const realIndex = items.indexOf(item);
  const progress = calcularProgresso(item);
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.index = realIndex;
  card.dataset.itemId = item.id;
  card.dataset.tmdbId = item.tmdb_id || '';
  card.dataset.mediaType = 'tv';
  card.setAttribute('role', 'listitem');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Ver detalhes de ${item.nome}`);

  const ano = item.ano ? ` (${item.ano})` : '';
  card.innerHTML = cardMarkup({
    posterUrl: item.imagem || '',
    titleHtml: escapeHTML(item.nome) + ano,
    titleAttr: `${item.nome}${ano}`,
    stampHtml: item.tier
      ? `<div class="tier-stamp ${getTierClass(item.tier)}">${escapeHTML(item.tier)}</div>`
      : '',
    imgAttrs: `data-index="${realIndex}"`,
    metaHtml: `<div class="info"><span>T${item.temporada} - Ep ${String(item.episodio).padStart(2, '0')}</span></div>`,
    extraHtml: `
      <div class="progress-wrap">
        <div class="progress-track"><div class="progress-bar" style="width:${progress}%;"></div></div>
        <span class="progress-pct">${progress}%</span>
      </div>`
  });

  resolveCardPoster(card, item);

  // Pré-carregar logo + detalhes no hover para modal instantâneo
  let logoPreloadTimeout = null;
  card.addEventListener('mouseenter', () => {
    const tmdbId = card.dataset.tmdbId;
    const mediaType = card.dataset.mediaType;

    if (tmdbId && mediaType) {
      clearTimeout(logoPreloadTimeout);
      logoPreloadTimeout = setTimeout(async () => {
        // Paraleliza logo + detalhes
        await Promise.allSettled([
          fetchTitleLogo(tmdbId, mediaType, true),
          callTMDB(`tv/${tmdbId}`, {}, 'pt-BR').catch(()=>null)
        ]);
      }, 200);
    }
  });

  card.addEventListener('mouseleave', () => {
    clearTimeout(logoPreloadTimeout);
  });

  attachCardInteraction(card, () => {
    const index = parseInt(card.dataset.index);
    const itemId = card.dataset.itemId;

    if (items[index] && items[index].id === itemId) {
      onCardClick(index);
    } else {
      const foundIndex = items.findIndex(i => i.id === itemId);
      if (foundIndex !== -1) {
        onCardClick(foundIndex);
      } else {
        console.error('Item não encontrado:', itemId);
      }
    }
  });

  return card;
}
