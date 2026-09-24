import { callTMDB, fetchTitleLogo } from '../lib/api.js';
import { getTierClass, formatDateBR, calcularProgresso } from '../lib/catalog.js';

let currentItem = null;
let onUpdate = null;
let onDelete = null;
let onBack = null;

export function setupTitlePage(callbacks) {
  onUpdate = callbacks.onUpdateItem;
  onDelete = callbacks.onDeleteItem;
  onBack = callbacks.onBack;
}

function renderTitlePage(item, container) {
  currentItem = item;
  const tierClass = item.tier ? getTierClass(item.tier) : '';
  const progress = calcularProgresso(item);
  container.innerHTML = `
    <button id="titleBack" class="tool-btn" style="margin-bottom:16px;"><i class="fas fa-arrow-left"></i> Voltar</button>
    <div id="titleLogoContainer" style="display:none; text-align:center; margin-bottom:16px;"><img id="titleLogoImg" src="" alt="Logo" style="max-height:72px; max-width:80%; margin:0 auto; display:block;" /></div>
    <h1 id="titlePageTitle" style="font-family:var(--font-display); font-size:1.8rem; text-align:center; margin-bottom:4px;">${item.nome} ${item.ano ? `(${item.ano})` : ''}</h1>
    <div class="title-page-header">
      <div class="title-page-poster" style="position:relative;">
        <img id="titlePosterImg" src="${item.imagem || ''}" alt="${item.nome}" style="width:100%; max-width:320px; aspect-ratio:2/3; object-fit:cover; border-radius:8px; background:var(--bg-secondary); display:${item.imagem ? 'block' : 'none'};" />
        <div id="titlePosterPlaceholder" style="display:${item.imagem ? 'none' : 'flex'}; width:100%; max-width:320px; aspect-ratio:2/3; background:var(--bg-secondary); border-radius:8px; align-items:center; justify-content:center; color:var(--text-muted);"><i class="fas fa-image" style="font-size:2rem;"></i></div>
        ${item.tier ? `<div class="tier-stamp ${tierClass}" style="position:absolute; top:8px; right:8px;">${item.tier}</div>` : ''}
      </div>
      <div class="title-page-info">
        <p style="color:var(--text-muted); font-size:0.85rem; margin:8px 0;">${item.tipo || 'serie'} • T${item.temporada} E${String(item.episodio).padStart(2,'0')} • ${progress}%</p>
        <div class="progress-wrap" style="max-width:320px;"><div class="progress-track"><div class="progress-bar" style="width:${progress}%;"></div></div><span class="progress-pct">${progress}%</span></div>
        <div id="titleSynopsis" style="margin-top:16px; color:var(--text-secondary); font-size:0.85rem; line-height:1.6; min-height:1.2em;"></div>
        <div id="titleMeta" style="margin-top:12px; font-size:0.8rem; color:var(--text-muted); display:flex; gap:12px; flex-wrap:wrap;"></div>
      </div>
    </div>
    <!-- Barra ideal 10/10/10/55/15 -->
    <div class="episode-progress-panel" style="margin-top:16px; display:flex; border:1px solid var(--border); border-radius:8px; overflow:hidden;">
      <div class="epp-status" style="flex:0 0 10%; max-width:10%; display:flex; flex-direction:column; gap:8px; padding:8px; border-right:1px solid var(--border);">
        <button class="dm-status-btn ${item.status==='assistindo'?'active':''}" data-status="assistindo">Assistindo</button>
        <button class="dm-status-btn ${item.status==='concluido'?'active':''}" data-status="concluido">Concluído</button>
        <button class="dm-status-btn ${item.status==='pausado'?'active':''}" data-status="pausado">Pausado</button>
        <button class="dm-status-btn ${item.status==='planejado'?'active':''}" data-status="planejado">Planejado</button>
      </div>
      <div class="epp-season" style="flex:0 0 10%; max-width:10%; display:flex; flex-direction:column; align-items:center; gap:6px; padding:8px; border-right:1px solid var(--border);">
        <span class="epp-season-label">Temporada</span>
        <div style="display:flex; align-items:center; gap:6px;"><span class="epp-season-val" id="titleTemporadaDisplay">${String(item.temporada||1).padStart(2,'0')}</span><span>/</span><span id="titleSeasonMax">--</span></div>
        <div style="display:flex; gap:8px;"><button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="-1">-</button><button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="1">+</button></div>
      </div>
      <div class="epp-episode" style="flex:0 0 10%; max-width:10%; display:flex; flex-direction:column; align-items:center; gap:6px; padding:8px; border-right:1px solid var(--border);">
        <span class="epp-episode-label">Episódio</span>
        <div style="display:flex; align-items:center; gap:6px;"><span class="epp-ep-badge" id="titleEpisodioDisplay">${String(item.episodio||0).padStart(2,'0')}</span><span>/</span><span id="titleEpMax">--</span></div>
        <div style="display:flex; gap:8px;"><button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="-1">-</button><button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="1">+</button></div>
      </div>
      <div class="epp-episode-meta" style="flex:0 0 55%; max-width:55%; padding:8px; display:flex; flex-direction:column; gap:6px;">
        <strong id="titleEpTitle" style="font-size:0.85rem;">—</strong><small id="titleEpDate" style="color:var(--text-muted);"></small><p id="titleEpOverview" style="font-size:0.8rem; color:var(--text-secondary); margin:0;"></p>
      </div>
      <div class="epp-actions" style="flex:0 0 15%; max-width:15%; display:flex; flex-direction:column; gap:8px; padding:8px; border-left:1px solid var(--border);">
        <select id="titlePageTier" style="padding:6px 8px; border-radius:6px; background:var(--bg-elevated); color:var(--text-primary); border:1px solid var(--border);">
          <option value="" ${!item.tier?'selected':''}>Sem tier</option>
          <option value="S+" ${item.tier==='S+'?'selected':''}>S+</option>
          <option value="S" ${item.tier==='S'?'selected':''}>S</option>
          <option value="A" ${item.tier==='A'?'selected':''}>A</option>
          <option value="B" ${item.tier==='B'?'selected':''}>B</option>
          <option value="C" ${item.tier==='C'?'selected':''}>C</option>
          <option value="D" ${item.tier==='D'?'selected':''}>D</option>
        </select>
        <button id="titleSave" class="dm-btn dm-btn-primary" style="width:100%;"><i class="fas fa-save"></i> Salvar</button>
        <button id="titleDelete" class="dm-btn dm-btn-danger" style="width:100%;"><i class="fas fa-trash"></i> Remover</button>
      </div>
    </div>
    <div id="titleEpisodes" style="margin-top:24px;"></div>
  `;
  container.querySelector('#titleBack').addEventListener('click', () => onBack && onBack());
  // Status
  container.querySelectorAll('#titlePageStatusBar .dm-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#titlePageStatusBar .dm-status-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  // Steppers
  let curTemp = Number(item.temporada) || 1;
  let curEp = Number(item.episodio) || 0;
  container.querySelectorAll('.poster-stepper-btn').forEach(b => {
    b.addEventListener('click', () => {
      const target = b.dataset.target;
      const step = parseInt(b.dataset.step,10) || 1;
      if (target === 'titleTemporada') {
        curTemp = Math.max(1, curTemp + step);
        container.querySelector('#titleTemporadaDisplay').textContent = String(curTemp).padStart(2,'0');
      } else {
        curEp = Math.max(0, curEp + step);
        container.querySelector('#titleEpisodioDisplay').textContent = String(curEp).padStart(2,'0');
      }
    });
  });
  // Save
  container.querySelector('#titleSave').addEventListener('click', async () => {
    const newStatus = container.querySelector('#titlePageStatusBar .dm-status-btn.active')?.dataset.status || item.status;
    const newTier = container.querySelector('#titlePageTier').value || null;
    try {
      const saved = await onUpdate(item.id, { temporada: curTemp, episodio: curEp, status: newStatus, tier: newTier });
      Object.assign(item, saved);
      onBack();
    } catch (e) { console.error(e); }
  });
  container.querySelector('#titleDelete').addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja remover este título?')) return;
    try { await onDelete(item.id); onBack(); } catch(e){ console.error(e); }
  });
  // Load poster, logo, synopsis, meta e limites em paralelo
  (async () => {
    if (!item.tmdb_id) return;
    try {
      const [details, logo] = await Promise.all([
        callTMDB(`tv/${item.tmdb_id}`, {}, 'pt-BR').catch(()=>null),
        fetchTitleLogo(item.tmdb_id, 'tv').catch(()=>null)
      ]);
      if (details) {
        // Poster fallback
        const posterImg = container.querySelector('#titlePosterImg');
        const placeholder = container.querySelector('#titlePosterPlaceholder');
        if (posterImg && !item.imagem && details.poster_path) {
          posterImg.src = `https://image.tmdb.org/t/p/w342${details.poster_path}`;
          posterImg.style.display = 'block';
          if (placeholder) placeholder.style.display = 'none';
        }
        // Logo
        const logoContainer = container.querySelector('#titleLogoContainer');
        const logoImg = container.querySelector('#titleLogoImg');
        const titleEl = container.querySelector('#titlePageTitle');
        if (logo && logoImg && logoContainer) {
          logoImg.src = logo;
          logoImg.alt = `Logo de ${item.nome}`;
          logoContainer.style.display = 'block';
          if (titleEl) titleEl.style.display = 'none';
        }
        const syn = container.querySelector('#titleSynopsis');
        if (syn) syn.textContent = details.overview || 'Sinopse não disponível.';
        const meta = container.querySelector('#titleMeta');
        if (meta) meta.innerHTML = `<span>${details.first_air_date?.slice(0,4) || ''} - ${details.last_air_date?.slice(0,4) || ''}</span><span>${details.status || ''}</span><span>${(details.genres||[]).map(g=>g.name).join(', ')}</span>`;
        // Limites temporada/episódio
        const seasons = (details.seasons || []).filter(s => s.season_number > 0);
        const maxTemp = seasons.length ? Math.max(...seasons.map(s => s.season_number)) : 1;
        const maxEpMap = {};
        seasons.forEach(s => { maxEpMap[s.season_number] = s.episode_count || 0; });
        const seasonMaxEl = container.querySelector('#titleSeasonMax');
        const epMaxEl = container.querySelector('#titleEpMax');
        if (seasonMaxEl) seasonMaxEl.textContent = String(maxTemp).padStart(2,'0');
        const curT = curTemp;
        if (epMaxEl) epMaxEl.textContent = String(maxEpMap[curT] || 1).padStart(2,'0');
        // Episódio info inicial
        const epTitleEl = container.querySelector('#titleEpTitle');
        const epDateEl = container.querySelector('#titleEpDate');
        const epOverviewEl = container.querySelector('#titleEpOverview');
        if (epTitleEl && epDateEl && epOverviewEl && curEp > 0) {
          try {
            const seasonData = await callTMDB(`tv/${item.tmdb_id}/season/${curTemp}`, {}, 'pt-BR');
            const ep = seasonData.episodes?.find(e => Number(e.episode_number) === curEp);
            if (ep) {
              epTitleEl.textContent = ep.name || `Episódio ${curEp}`;
              epDateEl.textContent = ep.air_date ? formatDateBR(ep.air_date) : '';
              epOverviewEl.textContent = ep.overview || '';
            }
          } catch {}
        }
      }
    } catch {}
  })();
}

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
