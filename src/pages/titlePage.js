/**
 * Página de Título — HUD + Layout Principal + Sidebar
 * Categorias:
 *  1) Estado & Callbacks
 *  2) Helpers — Tier / Temporada / Episódio / Cache
 *  3) Render — HUD, Poster, Conteúdo, Episódio Unificado, Sidebar
 *  4) Eventos & Side-effects (TMDB, listas, episódios)
 *  5) API pública
 */

import { callTMDB, fetchTitleLogo } from '../lib/api.js';
import { getTierClass, formatDateBR, calcularProgresso } from '../lib/catalog.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { nextImage, prevImage, filterImagesByLanguage, dedupeImages, sortImagesByWidth } from '../lib/imageNavigation.js';
import { resolveSeasonPosterUrl, shouldUseSeasonArt } from '../lib/seasonArt.js';

// ================================================================
// 1) ESTADO & CALLBACKS
// ================================================================
let currentItem = null;
let onUpdate = null;
let onDelete = null;
let onBack = null;
let onAddItemToList = null;
let onRemoveItemFromList = null;
let onGetUserLists = null;
let onOpenEpisodes = null;
let onOpenDetails = null;
let onOpenParent = null;
let onRelinkTitle = null;
let onCreateItem = null;

/**
 * @param {Object} callbacks
 * @param {Function} callbacks.onUpdateItem - (id, updates) => Promise<item>
 * @param {Function} callbacks.onDeleteItem - (id) => Promise
 * @param {Function} callbacks.onBack - () => void
 * @param {Function} [callbacks.onGetUserLists]
 * @param {Function} [callbacks.onAddItemToList]
 * @param {Function} [callbacks.onRemoveItemFromList]
 * @param {Function} [callbacks.onOpenEpisodes]
 * @param {Function} [callbacks.onOpenDetails] - (item) => void
 * @param {Function} [callbacks.onOpenParent] - (candidate, allResults) => void
 * @param {Function} [callbacks.onRelinkTitle] - (item) => void
 * @param {Function} [callbacks.onCreateItem] - (itemData) => Promise<item> para preview de pesquisa
 */
export function setupTitlePage(callbacks) {
  onUpdate = callbacks.onUpdateItem;
  onDelete = callbacks.onDeleteItem;
  onBack = callbacks.onBack;
  onAddItemToList = callbacks.onAddItemToList || null;
  onRemoveItemFromList = callbacks.onRemoveItemFromList || null;
  onGetUserLists = callbacks.onGetUserLists || null;
  onOpenEpisodes = callbacks.onOpenEpisodes || null;
  onOpenDetails = callbacks.onOpenDetails || null;
  onOpenParent = callbacks.onOpenParent || null;
  onRelinkTitle = callbacks.onRelinkTitle || null;
  onCreateItem = callbacks.onCreateItem || null;
}

// ================================================================
// 2) HELPERS
// ================================================================
async function fetchSeasonData(tmdbId, seasonNum) {
  const key = `season_${tmdbId}:${seasonNum}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const data = await callTMDB(`tv/${tmdbId}/season/${seasonNum}`, {}, 'pt-BR');
  cacheSet(key, data);
  return data;
}

function getSeasonLimits(item) {
  const map = item.seasonEpisodesMap || {};
  const keys = Object.keys(map).map(Number).filter(n => n > 0);
  const max = keys.length ? Math.max(...keys) : 1;
  return { maxTemp: max, map };
}

// ================================================================
// 3) RENDER
// ================================================================
function renderTitlePage(item, container) {
  currentItem = item;
  const tierClass = item.tier ? getTierClass(item.tier) : '';
  const progress = calcularProgresso(item); // mantido para cálculo interno, UI removida
  const { maxTemp: computedMaxTemp, map: seasonMap } = getSeasonLimits(item);
  const displayMaxTemp = String(computedMaxTemp).padStart(2, '0');
  const curTempInit = String(item.temporada || 1).padStart(2, '0');
  const curEpInit = String(item.episodio || 0).padStart(2, '0');
  const maxEpInit = String((seasonMap[item.temporada] ?? item.totalEpisodios ?? 1) || 1).padStart(2, '0');

  // ——— Categorias de layout ———
  // A) HUD Superior: Voltar | Logo+Original | Tier (mesmo design)
  // B) Layout: Main (Poster + Conteúdo) + Sidebar Vertical
  // C) Main Esquerda: Poster vertical
  // D) Main Direita: Backdrop horizontal + Episódio (Temporada | Episódio | Sinopse)
  // E) Sidebar: Status | Listas/Episódios | Salvar/Remover
  container.innerHTML = `
    <!-- A) HUD SUPERIOR — tier como marcador de livro rente ao limite -->
    <div class="tp-hud">
      <div class="tp-hud-top tp-pill" style="position:relative; overflow:visible;">
        <button id="titleBack" class="tp-back-btn--unified" aria-label="Voltar"><i class="fas fa-arrow-left"></i></button>
        <div class="tp-logo-block" id="tpLogoPill">
          <div class="tp-logo-main">
            <div id="titleLogoWrap" style="display:none; align-items:center; justify-content:center; max-width:380px;"><img id="titleLogoImg" src="" alt="Logo" style="max-height:44px; max-width:340px; object-fit:contain; display:block;" /></div>
            <div id="titleNameFallback" style="line-height:1.2;">
              <div id="titleName" style="font-family:var(--font-display); font-weight:700; font-size:0.95rem;">${item.nome}</div>
            </div>
          </div>
          <div class="tp-meta-group" id="tpMetaGroup" style="display:none;">
            <div id="titleOriginalName" style="font-size:0.68rem; color:var(--text-muted); font-style:italic; display:none;"></div>
            <div id="titleDates" style="font-size:0.62rem; color:rgba(255,255,255,0.35); display:none; align-items:center; gap:6px;"><i class="fas fa-calendar-alt" style="font-size:0.6rem; opacity:0.7;"></i><span id="titleStartDate">—</span><span style="opacity:0.4;">—</span><span id="titleEndDate">—</span><span id="titleStatusDot" style="width:4px; height:4px; border-radius:50%; background:var(--text-muted); opacity:0.5; display:inline-block;"></span><span id="titleStatusLabel" style="font-size:0.62rem;">—</span></div>
          </div>
        </div>
        <div class="tp-tier-block" id="tpTierTopWrap" style="position:absolute; top:0; right:44px; display:flex; align-items:flex-start; justify-content:center; z-index:2;">
          ${item.tier ? `<div class="tier-stamp ${tierClass}" id="tpTierStamp" style="width:22px; height:28px; font-size:0.52rem; cursor:pointer; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,0.35);">${item.tier}</div>` : `<div class="tier-stamp" id="tpTierStamp" style="width:22px; height:28px; font-size:0.52rem; background:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--border); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,0.35);">Tier</div>`}
          <div id="tpTierDropdown" style="display:none; position:absolute; top:30px; right:0; background:var(--bg-elevated); border:1px solid var(--border-strong); border-radius:10px; padding:6px; flex-direction:column; gap:4px; z-index:50; box-shadow:var(--shadow-lg); min-width:80px;">
            <button class="tier-option" data-tier="S+" style="padding:8px 14px; border-radius:6px; border:none; background:transparent; color:var(--text-primary); cursor:pointer;">S+</button>
            <button class="tier-option" data-tier="S" style="padding:8px 14px; border-radius:6px; border:none; background:transparent; color:var(--text-primary); cursor:pointer;">S</button>
            <button class="tier-option" data-tier="A" style="padding:8px 14px; border-radius:6px; border:none; background:transparent; color:var(--text-primary); cursor:pointer;">A</button>
            <button class="tier-option" data-tier="B" style="padding:8px 14px; border-radius:6px; border:none; background:transparent; color:var(--text-primary); cursor:pointer;">B</button>
            <button class="tier-option" data-tier="C" style="padding:8px 14px; border-radius:6px; border:none; background:transparent; color:var(--text-primary); cursor:pointer;">C</button>
            <button class="tier-option" data-tier="D" style="padding:8px 14px; border-radius:6px; border:none; background:transparent; color:var(--text-primary); cursor:pointer;">D</button>
            <button class="tier-option" data-tier="" style="padding:8px 14px; border-radius:6px; border:none; background:transparent; color:var(--text-primary); cursor:pointer;">N/A</button>
          </div>
        </div>
      </div>
    </div>

    <!-- B) LAYOUT PRINCIPAL + SIDEBAR -->
    ${item._parentCandidate ? `
    <div class="tp-parent-hint">
      <i class="fas fa-code-branch"></i>
      <span class="tp-parent-hint-text">Parece ser a continuação de <strong>${item._parentCandidate.name || item._parentCandidate.title || ''}</strong></span>
      <button type="button" id="tpOpenParentBtn" class="tp-parent-hint-btn">Abrir série principal</button>
      <button type="button" id="tpDismissParentBtn" class="tp-parent-hint-close" aria-label="Fechar aviso"><i class="fas fa-times"></i></button>
    </div>` : ''}
    <div class="tp-layout">
      <!-- C) MAIN -->
      <div class="tp-main" style="flex:1;">
        <!-- C1) Poster vertical -->
        <div class="tp-poster-col" style="flex:0 0 380px; max-width:400px; display:flex; flex-direction:column;">
          <div class="tp-frame tp-poster-frame" style="position:relative; background:var(--bg-secondary); border:1px solid var(--border); border-radius:14px; overflow:hidden; aspect-ratio:2/3; display:flex; align-items:center; justify-content:center; flex:1; min-height:0;">
              <img id="titlePosterImgCard" src="${item.imagem || ''}" alt="Poster" style="width:100%; height:100%; object-fit:contain; object-position:center; display:${item.imagem ? 'block' : 'none'};" onerror="this.style.display='none'" />
            <div id="titlePosterPlaceholder" style="display:${item.imagem ? 'none' : 'flex'}; align-items:center; justify-content:center; width:100%; height:100%; color:var(--text-muted); font-size:0.8rem;"><i class="fas fa-image"></i>&nbsp; Imagem vertical</div>
          </div>
        </div>

        <!-- C2) Conteúdo direita -->
        <div class="tp-content-col" style="flex:1; min-width:0; display:flex; flex-direction:column; gap:12px;">
        <div class="tp-frame tp-backdrop-frame" style="position:relative; background:var(--bg-secondary); border:1px solid var(--border); border-radius:14px; overflow:hidden; display:flex; align-items:center; justify-content:center; min-height:200px; flex:1; aspect-ratio:16/9;">
            <img id="titleBackdrop" src="" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:none;" />
            <div id="titleBackdropPlaceholder" style="position:relative; z-index:1; color:var(--text-muted); font-size:0.85rem; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">Imagem horizontal</div>
            <button id="tpBackdropPrev" class="poster-icon-btn" aria-label="Imagem anterior" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); display:none; z-index:3; width:28px; height:28px;"><i class="fas fa-chevron-left"></i></button>
            <button id="tpBackdropNext" class="poster-icon-btn" aria-label="Próxima imagem" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); display:none; z-index:3; width:28px; height:28px;"><i class="fas fa-chevron-right"></i></button>
            <div id="tpBackdropCounter" style="position:absolute; bottom:8px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.55); color:#fff; padding:2px 8px; border-radius:999px; font-size:0.65rem; display:none; z-index:3; backdrop-filter:blur(4px);"></div>
            <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.35), transparent 60%); pointer-events:none;"></div>
          </div>

          <div class="tp-episode-row" style="display:flex; gap:12px; align-items:stretch;">
            <div class="tp-season-block" style="flex:0 0 110px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:12px; border:1px solid var(--border); background:var(--bg-elevated); border-radius:14px;">
              <span class="tp-label" style="font-size:0.65rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em;">Temporada</span>
              <div style="display:flex; align-items:baseline; gap:4px; font-family:var(--font-body); font-weight:800; line-height:1;">
                <span id="titleTemporadaDisplay" style="font-size:2.2rem; color:var(--text-primary);">${curTempInit}</span>
                <span style="font-size:1rem; color:var(--text-muted); font-weight:400;">/</span>
                <span id="titleSeasonMax" style="font-size:1.1rem; color:var(--text-muted);">${displayMaxTemp}</span>
              </div>
              <div style="display:flex; gap:12px;">
                <button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="1" style="width:36px; height:36px; border-radius:999px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer;">+</button>
                <button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="-1" style="width:36px; height:36px; border-radius:999px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer;">-</button>
              </div>
            </div>
            <div class="tp-episode-block" style="flex:0 0 110px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:12px; border:1px solid var(--border); background:var(--bg-elevated); border-radius:14px;">
              <span class="tp-label" style="font-size:0.65rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em;">Episódio</span>
              <div style="display:flex; align-items:baseline; gap:4px; font-family:var(--font-body); font-weight:800; line-height:1;">
                <span id="titleEpisodioDisplay" style="font-size:2.2rem; color:var(--text-primary);">${curEpInit}</span>
                <span style="font-size:1rem; color:var(--text-muted); font-weight:400;">/</span>
                <span id="titleEpMax" style="font-size:1.1rem; color:var(--text-muted);">${maxEpInit}</span>
              </div>
              <div style="display:flex; gap:12px;">
                <button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="1" style="width:36px; height:36px; border-radius:999px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer;">+</button>
                <button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="-1" style="width:36px; height:36px; border-radius:999px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer;">-</button>
              </div>
            </div>
            <div class="tp-synopsis-block" style="flex:1; min-width:0; display:flex; flex-direction:column; gap:12px; padding:12px; border:1px solid var(--border); background:var(--bg-elevated); border-radius:14px; text-align:left; position:relative; overflow:hidden;">
              <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
                <span id="titleEpTitle" style="font-size:0.82rem; font-weight:600; color:var(--text-primary); flex:1; min-width:0;">Sinopse do episódio</span>
                <span id="titleEpDate" style="font-size:0.68rem; color:var(--text-muted); white-space:nowrap;"></span>
              </div>
              <p id="titleSynopsisEp" style="margin:0; font-size:0.78rem; line-height:1.45; color:var(--text-secondary); display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden;">Selecione temporada e episódio para ver a sinopse.</p>
              <div id="titleEpLoading" style="display:none; position:absolute; top:8px; right:8px; font-size:0.6rem; color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i></div>
            </div>
          </div>
        </div>
      </div>

      <!-- D) SIDEBAR VERTICAL — 3 categorias separadas -->
      <div class="tp-side-hud">
        <!-- D1) Categoria: Status -->
        <div class="tp-side-card">
          <div class="tp-side-card-head"><i class="fas fa-play-circle"></i> Status</div>
          <div id="titlePageStatusBar" class="tp-status-col" style="display:flex; flex-direction:column; gap:12px;">
            <button class="dm-status-btn ${item.status==='assistindo'?'active':''}" data-status="assistindo">Assistindo</button>
            <button class="dm-status-btn ${item.status==='concluido'?'active':''}" data-status="concluido">Concluído</button>
            <button class="dm-status-btn ${item.status==='planejado'?'active':''}" data-status="planejado">Planejado</button>
            <button class="dm-status-btn ${item.status==='pausado'?'active':''}" data-status="pausado">Pausado</button>
          </div>
        </div>
        <!-- D2) Categoria: Coleções -->
        <div class="tp-side-card">
          <div class="tp-side-card-head"><i class="fas fa-layer-group"></i> Coleções</div>
          <button id="tpListBtn" class="dm-action-btn" style="width:100%; justify-content:center;"><i class="fas fa-layer-group"></i> Listas</button>
          <button id="tpEpisodesBtn" class="dm-action-btn" style="width:100%; justify-content:center;"><i class="fas fa-film"></i> Episódios</button>
          <button id="tpDetailsBtn" class="dm-action-btn" style="width:100%; justify-content:center;"><i class="fas fa-circle-info"></i> Detalhes</button>
        </div>
        <!-- D3) Categoria: Ações -->
        <div class="tp-side-card tp-side-card--actions">
          <div class="tp-side-card-head"><i class="fas fa-bolt"></i> ${item._isPreview ? 'Adicionar' : 'Ações'}</div>
          ${item._isPreview ? `
          <button id="titleAdd" class="dm-btn dm-btn-primary" style="width:100%; justify-content:center;"><i class="fas fa-plus"></i> Adicionar</button>
          <button id="titleCancel" class="dm-btn" style="width:100%; justify-content:center; border:1px solid var(--border); background:var(--bg-surface);"><i class="fas fa-times"></i> Cancelar</button>
          ` : `
          <button id="titleSave" class="dm-btn dm-btn-primary" style="width:100%; justify-content:center;"><i class="fas fa-save"></i> Salvar</button>
          <button id="tpRelinkBtn" class="dm-btn" style="width:100%; justify-content:center; border:1px solid var(--border); background:var(--bg-surface);"><i class="fas fa-link"></i> Corrigir título</button>
          <button id="titleDelete" class="dm-btn dm-btn-danger" style="width:100%; justify-content:center;"><i class="fas fa-trash"></i> Remover</button>
          `}
        </div>
      </div>
    </div>

    <select id="titlePageTier" style="display:none;">
      <option value="" ${!item.tier?'selected':''}>Sem tier</option>
      <option value="S+" ${item.tier==='S+'?'selected':''}>S+</option>
      <option value="S" ${item.tier==='S'?'selected':''}>S</option>
      <option value="A" ${item.tier==='A'?'selected':''}>A</option>
      <option value="B" ${item.tier==='B'?'selected':''}>B</option>
      <option value="C" ${item.tier==='C'?'selected':''}>C</option>
      <option value="D" ${item.tier==='D'?'selected':''}>D</option>
    </select>
  `;

  // ==============================================================
  // 4) EVENTOS
  // ==============================================================
  // — Navegação
  container.querySelector('#titleBack').addEventListener('click', () => onBack && onBack());

  // — Status
  container.querySelectorAll('#titlePageStatusBar .dm-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#titlePageStatusBar .dm-status-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // — Tier
  const tierStamp = container.querySelector('#tpTierStamp');
  const tierDropdown = container.querySelector('#tpTierDropdown');
  const tierSelect = container.querySelector('#titlePageTier');
  let currentTier = item.tier || '';
  function updateTierUI(tier) {
    currentTier = tier || '';
    if (tierSelect) tierSelect.value = tier || '';
    if (tierStamp) {
      tierStamp.textContent = tier || 'Tier';
      tierStamp.className = tier ? `tier-stamp ${getTierClass(tier)}` : 'tier-stamp';
      // mantém design do HUD (pill discreto) — sem absolute
      tierStamp.style.background = tier ? '' : 'var(--bg-elevated)';
      tierStamp.style.color = tier ? '' : 'var(--text-muted)';
      tierStamp.style.border = tier ? '' : '1px solid var(--border)';
      tierStamp.style.position = 'relative';
      tierStamp.style.top = 'auto';
      tierStamp.style.right = 'auto';
      tierStamp.style.width = '22px';
      tierStamp.style.height = '28px';
      tierStamp.style.fontSize = '0.52rem';
      tierStamp.style.cursor = 'pointer';
      tierStamp.style.display = 'flex';
      tierStamp.style.alignItems = 'flex-start';
      tierStamp.style.justifyContent = 'center';
      tierStamp.style.padding = '4px 0 6px';
      tierStamp.style.flexShrink = '0';
    }
  }
  if (tierStamp && tierDropdown) {
    tierStamp.addEventListener('click', (e) => {
      e.stopPropagation();
      tierDropdown.style.display = tierDropdown.style.display === 'flex' ? 'none' : 'flex';
    });
    tierDropdown.querySelectorAll('.tier-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        updateTierUI(opt.dataset.tier);
        tierDropdown.style.display = 'none';
      });
    });
    document.addEventListener('click', (e) => {
      if (!tierStamp.contains(e.target) && !tierDropdown.contains(e.target)) tierDropdown.style.display = 'none';
    }, { once: false });
  }

  // — Steppers & Sinopse
  let curTemp = Number(item.temporada) || 1;
  let curEp = Number(item.episodio) || 0;
  const temporadaDisplay = container.querySelector('#titleTemporadaDisplay');
  const episodioDisplay = container.querySelector('#titleEpisodioDisplay');
  const seasonMaxEl = container.querySelector('#titleSeasonMax');
  const epMaxEl = container.querySelector('#titleEpMax');
  const epTitleEl = container.querySelector('#titleEpTitle');
  const epSynopsisEl = container.querySelector('#titleSynopsisEp');
  const epDateEl = container.querySelector('#titleEpDate');
  const epLoadingEl = container.querySelector('#titleEpLoading');
  let seasonLimits = { maxTemp: computedMaxTemp, maxEpByTemp: seasonMap };

  // Limite único de episódios por temporada — display e clamp usam a MESMA fonte
  function episodeLimitFor(temp) {
    const map = seasonLimits.maxEpByTemp || {};
    if (Object.prototype.hasOwnProperty.call(map, temp)) {
      const n = Number(map[temp]);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    const total = Number(item.totalEpisodios) || 0;
    if (total > 0) return temp <= 1 ? total : Math.max(1, total);
    return temp <= 1 ? 1 : 0;
  }

  const stepperBtns = Array.from(container.querySelectorAll('.poster-stepper-btn'));

  function stepperState(btn) {
    if (btn.dataset.target === 'titleTemporada') return { min: 1, max: seasonLimits.maxTemp || 1, value: curTemp };
    const max = episodeLimitFor(curTemp);
    return { min: 0, max, value: curEp };
  }

  function updateStepperButtons() {
    stepperBtns.forEach(btn => {
      const { min, max, value } = stepperState(btn);
      const step = parseInt(btn.dataset.step, 10) || 1;
      const blocked = step > 0 ? value >= max : value <= min;
      btn.disabled = blocked;
      btn.style.opacity = blocked ? '0.3' : '';
      btn.style.cursor = blocked ? 'not-allowed' : 'pointer';
    });
  }

  function updateEpMax() {
    if (epMaxEl) epMaxEl.textContent = String(episodeLimitFor(curTemp)).padStart(2,'0');
    if (seasonMaxEl) seasonMaxEl.textContent = String(seasonLimits.maxTemp || 1).padStart(2,'0');
    updateStepperButtons();
  }

  // — Backdrop carrossel (várias horizontais com setas, sem repetidas)
  let backdropImages = [];
  let currentBackdropIndex = 0;
  const backdropEl = container.querySelector('#titleBackdrop');
  const backdropPh = container.querySelector('#titleBackdropPlaceholder');
  const backdropPrev = container.querySelector('#tpBackdropPrev');
  const backdropNext = container.querySelector('#tpBackdropNext');
  const backdropCounter = container.querySelector('#tpBackdropCounter');
  function refreshBackdropControls() {
    const hasMany = backdropImages.length > 1;
    if (backdropPrev) backdropPrev.style.display = hasMany ? 'inline-flex' : 'none';
    if (backdropNext) backdropNext.style.display = hasMany ? 'inline-flex' : 'none';
    if (backdropCounter) {
      if (hasMany) {
        backdropCounter.textContent = `${currentBackdropIndex + 1} / ${backdropImages.length}`;
        backdropCounter.style.display = 'block';
      } else backdropCounter.style.display = 'none';
    }
  }
  function showBackdropAt(idx) {
    if (!backdropEl || backdropImages.length === 0) return;
    currentBackdropIndex = ((idx % backdropImages.length) + backdropImages.length) % backdropImages.length;
    const fp = backdropImages[currentBackdropIndex];
    backdropEl.src = `https://image.tmdb.org/t/p/w1280${fp}`;
    backdropEl.style.display = 'block';
    if (backdropPh) backdropPh.style.display = 'none';
    refreshBackdropControls();
  }
  if (backdropPrev) backdropPrev.addEventListener('click', (e) => { e.stopPropagation(); showBackdropAt(prevImage(currentBackdropIndex, backdropImages.length)); });
  if (backdropNext) backdropNext.addEventListener('click', (e) => { e.stopPropagation(); showBackdropAt(nextImage(currentBackdropIndex, backdropImages.length)); });
  // teclado ←→ e swipe
  container.addEventListener('keydown', (e) => {
    if (backdropImages.length <= 1) return;
    if (e.key === 'ArrowLeft') showBackdropAt(prevImage(currentBackdropIndex, backdropImages.length));
    if (e.key === 'ArrowRight') showBackdropAt(nextImage(currentBackdropIndex, backdropImages.length));
  });
  container.setAttribute('tabindex', '0');
  let touchStartX = null;
  if (backdropEl) {
    backdropEl.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    backdropEl.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40 && backdropImages.length > 1) {
        if (dx > 0) showBackdropAt(prevImage(currentBackdropIndex, backdropImages.length));
        else showBackdropAt(nextImage(currentBackdropIndex, backdropImages.length));
      }
      touchStartX = null;
    });
  }

  let epRequestId = 0;
  async function syncEpisodePanel() {
    if (!item.tmdb_id) {
      if (epTitleEl) epTitleEl.textContent = curEp === 0 ? 'Ainda não iniciado' : `Episódio ${curEp}`;
      if (epSynopsisEl) epSynopsisEl.textContent = curEp === 0 ? 'Selecione temporada e episódio para ver a sinopse.' : 'Sinopse não disponível para este episódio.';
      if (epDateEl) epDateEl.textContent = '';
      return;
    }
    if (curEp === 0) {
      if (epLoadingEl) epLoadingEl.style.display = 'none';
      if (epTitleEl) epTitleEl.textContent = 'Ainda não iniciado';
      if (epSynopsisEl) epSynopsisEl.textContent = 'Selecione um episódio para ver a sinopse.';
      if (epDateEl) epDateEl.textContent = '';
      return;
    }
    const requestId = ++epRequestId;
    if (epLoadingEl) epLoadingEl.style.display = 'flex';
    try {
      const seasonData = await fetchSeasonData(item.tmdb_id, curTemp);
      if (requestId !== epRequestId) return;
      const ep = seasonData.episodes?.find(e => Number(e.episode_number) === curEp);
      if (ep) {
        if (epTitleEl) epTitleEl.textContent = ep.name || `Episódio ${curEp}`;
        if (epDateEl) epDateEl.textContent = ep.air_date ? formatDateBR(ep.air_date) : '';
        if (epSynopsisEl) epSynopsisEl.textContent = ep.overview || 'Sinopse não disponível.';
      } else {
        if (epTitleEl) epTitleEl.textContent = `Episódio ${curEp}`;
        if (epDateEl) epDateEl.textContent = '';
        if (epSynopsisEl) epSynopsisEl.textContent = 'Sinopse não disponível.';
      }
    } catch (e) {
      if (requestId !== epRequestId) return;
      if (epTitleEl) epTitleEl.textContent = `Episódio ${curEp}`;
      if (epSynopsisEl) epSynopsisEl.textContent = 'Erro ao carregar sinopse.';
    } finally {
      if (requestId === epRequestId && epLoadingEl) epLoadingEl.style.display = 'none';
    }
  }

  function applyStep(btn) {
    const step = parseInt(btn.dataset.step, 10) || 1;
    if (btn.dataset.target === 'titleTemporada') {
      const maxTemp = seasonLimits.maxTemp || 1;
      const newTemp = Math.max(1, Math.min(maxTemp, curTemp + step));
      if (newTemp === curTemp) return;
      curTemp = newTemp;
      temporadaDisplay.textContent = String(curTemp).padStart(2,'0');
      // Regra: ao mudar de temporada o episódio volta para 0
      curEp = 0;
      const maxEp = episodeLimitFor(curTemp);
      if (curEp > maxEp) curEp = maxEp;
      episodioDisplay.textContent = String(curEp).padStart(2,'0');
      updateEpMax(); syncEpisodePanel();
    } else {
      const maxEp = episodeLimitFor(curTemp);
      const newEp = Math.max(0, Math.min(maxEp, curEp + step));
      if (newEp === curEp) return;
      curEp = newEp;
      episodioDisplay.textContent = String(curEp).padStart(2,'0');
      updateStepperButtons();
      syncEpisodePanel();
    }
  }

  // clique-e-segure: 300ms até o primeiro repeat, depois a cada 100ms
  let holdTimer = null;
  let holdInterval = null;
  let holdFired = false;
  function stopHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
  }
  function startHold(btn) {
    stopHold();
    holdFired = false;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      applyStep(btn);
      holdFired = true;
      holdInterval = setInterval(() => applyStep(btn), 100);
    }, 300);
  }

  stepperBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (holdFired) { holdFired = false; return; }
      applyStep(btn);
    });
    btn.addEventListener('mousedown', () => startHold(btn));
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(btn); }, { passive: false });
    btn.addEventListener('mouseup', stopHold);
    btn.addEventListener('mouseleave', stopHold);
    btn.addEventListener('touchend', stopHold);
  });

  // — Salvar / Remover / Adicionar (com listas)
  const saveBtn = container.querySelector('#titleSave');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const newStatus = container.querySelector('#titlePageStatusBar .dm-status-btn.active')?.dataset.status || item.status;
    const newTier = currentTier || null;
    try {
      const saved = await onUpdate(item.id, { temporada: curTemp, episodio: curEp, status: newStatus, tier: newTier });
      Object.assign(item, saved);
      const box = document.getElementById('detailListCheckboxes')?.querySelectorAll('input[type="checkbox"]:checked').length ? document.getElementById('detailListCheckboxes') : document.getElementById('addListCheckboxes');
      if (box && onAddItemToList && onRemoveItemFromList && onGetUserLists) {
        const selectedIds = Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        const currentIds = (item.lists || []).map(l => l.id);
        const toAdd = selectedIds.filter(id => !currentIds.includes(id));
        const toRemove = currentIds.filter(id => !selectedIds.includes(id));
        const userLists = onGetUserLists() || [];
        const addRes = await Promise.allSettled(toAdd.map(id => onAddItemToList(item.id, id)));
        const remRes = await Promise.allSettled(toRemove.map(id => onRemoveItemFromList(item.id, id)));
        const addedOk = new Set(toAdd.filter((_,i)=>addRes[i]?.status==='fulfilled'));
        const removedOk = new Set(toRemove.filter((_,i)=>remRes[i]?.status==='fulfilled'));
        saved.lists = userLists.filter(l=> currentIds.includes(l.id)).filter(l=> !removedOk.has(l.id)).concat(userLists.filter(l=> addedOk.has(l.id)));
        Object.assign(item, saved);
      }
      document.getElementById('detailListModal')?.classList.remove('active');
      document.getElementById('addListModal')?.classList.remove('active');
      onBack();
    } catch (e) { console.error(e); }
  });
  const deleteBtn = container.querySelector('#titleDelete');
  if (deleteBtn) deleteBtn.addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja remover este título?')) return;
    try { await onDelete(item.id); onBack(); } catch(e){ console.error(e); }
  });
  const addBtn = container.querySelector('#titleAdd');
  if (addBtn) addBtn.addEventListener('click', async () => {
    if (!onCreateItem) { console.warn('onCreateItem não configurado'); return; }
    const newStatus = container.querySelector('#titlePageStatusBar .dm-status-btn.active')?.dataset.status || 'planejado';
    const newTier = currentTier || null;
    const box = document.getElementById('detailListCheckboxes')?.querySelectorAll('input[type="checkbox"]').length ? document.getElementById('detailListCheckboxes') : document.getElementById('addListCheckboxes');
    const selectedIds = box ? Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value) : [];
    const payload = {
      nome: item.nome,
      tipo: item.tipo || 'serie',
      temporada: curTemp,
      episodio: curEp,
      totalEpisodios: seasonLimits.maxEpByTemp?.[curTemp] || item.totalEpisodios || 1,
      seasonEpisodesMap: seasonLimits.maxEpByTemp || {},
      status: newStatus,
      tier: newTier,
      imagem: item.imagem || null,
      tmdb_id: item.tmdb_id,
      ano: item.ano || null,
      lists: selectedIds
    };
    try {
      addBtn.disabled = true;
      addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adicionando...';
      const created = await onCreateItem(payload);
      document.getElementById('detailListModal')?.classList.remove('active');
      document.getElementById('addListModal')?.classList.remove('active');
      // atualiza item para modo catálogo e volta
      if (created) Object.assign(item, created);
      onBack();
    } catch (e) { console.error(e); addBtn.disabled = false; addBtn.innerHTML = '<i class="fas fa-plus"></i> Adicionar'; }
  });
  const cancelBtn = container.querySelector('#titleCancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => onBack && onBack());

  // — Listas / Episódios — garante modal no body (detailListModal é aninhado no detailModal e ficaria escondido)
  function ensureListModalAtBody() {
    const m = document.getElementById('detailListModal');
    if (m && m.parentElement !== document.body) {
      document.body.appendChild(m);
      m.style.zIndex = '300';
    }
    // também garante addListModal como fallback
    return m || document.getElementById('addListModal');
  }
  const tpListBtn = container.querySelector('#tpListBtn');
  const tpEpisodesBtn = container.querySelector('#tpEpisodesBtn');
  if (tpListBtn) tpListBtn.addEventListener('click', () => {
    const modal = ensureListModalAtBody();
    const box = document.getElementById('detailListCheckboxes') || document.getElementById('addListCheckboxes');
    if (!modal || !box) return;
    const userLists = onGetUserLists ? onGetUserLists() : [];
    const selected = new Set((item.lists || []).map(l => l.id));
    box.innerHTML = '';
    const sorted = [...userLists].filter(l => l.nome !== 'Próximos' && l.nome !== 'Lista de Desejos').sort((a,b)=>(b.is_system?1:0)-(a.is_system?1:0));
    sorted.forEach(list => {
      const label = document.createElement('label');
      label.className = 'list-checkbox-pill';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = list.id; cb.checked = selected.has(list.id);
      const icon = document.createElement('i');
      icon.className = `fas ${list.is_system ? 'fa-heart' : 'fa-list'}`;
      label.append(cb, icon, document.createTextNode(` ${list.nome}`));
      box.appendChild(label);
    });
    modal.classList.add('active');
  });
  if (tpEpisodesBtn) tpEpisodesBtn.addEventListener('click', () => { if (onOpenEpisodes) onOpenEpisodes(null, item, curTemp, curEp); });
  const tpDetailsBtn = container.querySelector('#tpDetailsBtn');
  if (tpDetailsBtn) tpDetailsBtn.addEventListener('click', () => { if (onOpenDetails) onOpenDetails(item); });
  const tpRelinkBtn = container.querySelector('#tpRelinkBtn');
  if (tpRelinkBtn) tpRelinkBtn.addEventListener('click', () => { if (onRelinkTitle) onRelinkTitle(item); });

  // — Aviso de continuação (sugere a série principal)
  const tpOpenParentBtn = container.querySelector('#tpOpenParentBtn');
  const tpDismissParentBtn = container.querySelector('#tpDismissParentBtn');
  if (tpOpenParentBtn) tpOpenParentBtn.addEventListener('click', () => {
    if (onOpenParent && item._parentCandidate) onOpenParent(item._parentCandidate, item._parentResults || null);
  });
  if (tpDismissParentBtn) tpDismissParentBtn.addEventListener('click', () => {
    tpDismissParentBtn.closest('.tp-parent-hint')?.remove();
  });
  // fechar modais de listas (detail e add)
  ['detailListModal','addListModal'].forEach(id => {
    const m = document.getElementById(id);
    const closeBtn = document.getElementById(id === 'detailListModal' ? 'detailListModalClose' : 'addListModalClose');
    if (closeBtn && m) closeBtn.onclick = () => m.classList.remove('active');
    if (m) m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
  });

  // — Links externos ficam no modal de Detalhes

  updateEpMax(); syncEpisodePanel();

  // ==============================================================
  // 4) SIDE-EFFECTS — TMDB
  // ==============================================================
  (async () => {
    if (!item.tmdb_id) return;
    try {
      const details = await callTMDB(`tv/${item.tmdb_id}`, {}, 'pt-BR');
      const genresEl = container.querySelector('#titleGenres');
      if (genresEl) {
        const genres = (details.genres || []).map(g => g.name).filter(Boolean).join(', ');
        genresEl.textContent = genres || '—';
        genresEl.title = genresEl.textContent;
      }
      if (details.seasons) {
        const seasons = details.seasons.filter(s=>s.season_number>0);
        const maxTempReal = seasons.length || computedMaxTemp;
        const map = {};
        seasons.forEach(s=>{ map[s.season_number]= s.episode_count || 0; });
        seasonLimits = { maxTemp: maxTempReal, maxEpByTemp: map };
        if (seasonMaxEl) seasonMaxEl.textContent = String(maxTempReal).padStart(2,'0');
        if (curTemp > maxTempReal) { curTemp = maxTempReal; temporadaDisplay.textContent = String(curTemp).padStart(2,'0'); }
        const maxEpReal = episodeLimitFor(curTemp);
        if (curEp > maxEpReal) { curEp = maxEpReal; }
        episodioDisplay.textContent = String(curEp).padStart(2,'0');
        updateEpMax();
        syncEpisodePanel();
      }
      // — Backdrops múltiplos com setas (sem repetidas via dedupe)
      try {
        const imgData = await callTMDB(`tv/${item.tmdb_id}/images`, {}, null).catch(()=>null);
        const rawBackdrops = imgData?.backdrops || [];
        const filtered = filterImagesByLanguage(rawBackdrops);
        const deduped = dedupeImages(filtered);
        const sorted = sortImagesByWidth(deduped).map(i => i.file_path).filter(Boolean);
        // inclui backdrop principal se não estiver na lista
        if (details.backdrop_path && !sorted.includes(details.backdrop_path)) sorted.unshift(details.backdrop_path);
        if (sorted.length > 0) {
          backdropImages = sorted;
          currentBackdropIndex = 0;
          showBackdropAt(0);
        } else if (details.backdrop_path) {
          backdropImages = [details.backdrop_path];
          showBackdropAt(0);
        } else if (details.poster_path) {
          backdropImages = [details.poster_path];
          showBackdropAt(0);
        }
      } catch {
        const backdrop = container.querySelector('#titleBackdrop');
        const backdropPh = container.querySelector('#titleBackdropPlaceholder');
        if (backdrop && details.backdrop_path) {
          backdropImages = [details.backdrop_path];
          showBackdropAt(0);
        } else if (backdrop && details.poster_path) {
          backdropImages = [details.poster_path];
          showBackdropAt(0);
        }
      }
      const posterCard = container.querySelector('#titlePosterImgCard');
      const posterPh = container.querySelector('#titlePosterPlaceholder');
      // Arte da temporada em acompanhamento tem prioridade sobre a arte "vigente" da série,
      // mas só para séries com mais de 1 temporada e itens não concluídos
      const useSeasonArt = shouldUseSeasonArt({ ...item, temporada: curTemp }, details.number_of_seasons);
      const seasonPosterUrl = useSeasonArt ? resolveSeasonPosterUrl(details, { ...item, temporada: curTemp }) : null;
      const posterUrl = seasonPosterUrl
        || (details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null);
      if (posterCard && posterUrl) {
        posterCard.src = posterUrl;
        posterCard.style.display = 'block';
        if (posterPh) posterPh.style.display = 'none';
      }
      const logoWrap = container.querySelector('#titleLogoWrap');
      const logoImg = container.querySelector('#titleLogoImg');
      const titleName = container.querySelector('#titleName');
      const titleOriginalName = container.querySelector('#titleOriginalName');
      const titleMetaGroup = container.querySelector('#tpMetaGroup');
      const originalName = details.original_name || details.original_title || '';
      if (titleOriginalName) {
        if (originalName && originalName !== item.nome) { titleOriginalName.textContent = originalName; titleOriginalName.style.display = 'block'; }
        else titleOriginalName.style.display = 'none';
      }
      // Lançamento / Encerramento — só ano no bloco superior
      const titleDates = container.querySelector('#titleDates');
      const titleStartDate = container.querySelector('#titleStartDate');
      const titleEndDate = container.querySelector('#titleEndDate');
      const titleStatusLabel = container.querySelector('#titleStatusLabel');
      if (titleDates && titleStartDate && titleEndDate) {
        const startYear = (details.first_air_date || details.release_date || '').slice(0,4) || '—';
        let endYear = '—';
        let statusText = details.status || '—';
        const statusMap = { 'Returning Series':'Em exibição', 'Ended':'Finalizada', 'Canceled':'Cancelada', 'In Production':'Em produção', 'Planned':'Planejada' };
        statusText = statusMap[statusText] || statusText;
        if (details.status === 'Ended' && details.last_air_date) endYear = details.last_air_date.slice(0,4);
        else if (details.status === 'Returning Series') endYear = '—';
        else if (details.last_air_date) endYear = details.last_air_date.slice(0,4);
        titleStartDate.textContent = startYear;
        titleEndDate.textContent = endYear;
        if (titleStatusLabel) titleStatusLabel.textContent = statusText;
        titleDates.style.display = 'flex';
        if (titleMetaGroup) titleMetaGroup.style.display = 'flex';
      }
      try {
        const logo = await fetchTitleLogo(item.tmdb_id, 'tv').catch(()=>null);
        if (logo && logoImg && logoWrap) {
          logoImg.src = logo; logoWrap.style.display = 'flex';
          if (titleName) titleName.style.display = 'none';
        } else { if (logoWrap) logoWrap.style.display = 'none'; if (titleName) titleName.style.display = 'block'; }
      } catch {}
    } catch {}
  })();
}

// ================================================================
// 5) API PÚBLICA
// ================================================================
export function showTitlePage(item, container) {
  container.style.display = 'block';
  renderTitlePage(item, container);
  window.scrollTo(0,0);
}

export function hideTitlePage(container) {
  container.style.display = 'none';
  container.innerHTML = '';
  currentItem = null;
}
