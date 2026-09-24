import { callTMDB, fetchTitleLogo } from '../lib/api.js';
import { getTierClass } from '../lib/catalog.js';

let onUpdate, onDelete, onBack;
let currentItem = null;

export function setupTitlePage(cbs) {
  onUpdate = cbs.onUpdateItem;
  onDelete = cbs.onDeleteItem;
  onBack = cbs.onBack;
}

function renderTitlePage(item, container) {
  currentItem = item;
  const tierClass = item.tier ? getTierClass(item.tier) : '';
  container.innerHTML = `
    <div style="max-width:1100px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; padding:16px; gap:16px;">
      <button id="titleBack" class="tool-btn"><i class="fas fa-arrow-left"></i> Voltar</button>
      <div id="titleLogoWrap" style="display:none; flex:1; justify-content:center; pointer-events:none;"><img id="titleLogoImg" src="" alt="Logo" style="max-width:420px; max-height:80px; object-fit:contain;" /></div>
      <div style="width:80px;"></div>
    </div>
    <div style="max-width:1100px; margin:0 auto; border:1px solid var(--border); display:grid; grid-template-columns: 340px 1fr; min-height:520px; background:var(--bg-primary); position:relative;">
      <!-- ESQUERDA: Imagem Vertical -->
      <div style="border-right:1px solid var(--border); display:flex; flex-direction:column; position:relative;">
        <div style="display:flex; justify-content:space-between; padding:8px 10px; font-size:0.7rem; font-weight:600; border-bottom:1px solid var(--border);">
          <span style="border:1px solid var(--border); padding:2px 6px; ${item.tier ? '' : 'visibility:hidden;'} ${tierClass ? `background:var(--tier-${item.tier === 'S+' ? 'splus' : item.tier.toLowerCase()});` : ''}">${item.tier || 'TIER'}</span>
          <span style="display:flex; gap:12px;"><a id="titleImdbLink" href="#" target="_blank" style="color:var(--text-muted); text-decoration:none;">IMDB</a> <a id="titleWikiLink" href="#" target="_blank" style="color:var(--text-muted); text-decoration:none;">WIKI</a> <a id="titleYoutubeLink" href="#" target="_blank" style="color:var(--text-muted); text-decoration:none;">YOUTUBE</a></span>
        </div>
        <div style="flex:1; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;">
          <img id="titleVerticalImg" src="${item.imagem || ''}" alt="Vertical" style="width:100%; height:100%; object-fit:contain; display:${item.imagem ? 'block' : 'none'};" />
          <div id="titleVerticalPlaceholder" style="display:${item.imagem ? 'none' : 'flex'}; width:100%; height:100%; align-items:center; justify-content:center; color:var(--text-muted);">IMAGEM VERTICAL</div>
        </div>
        <div id="titleStatusBar" style="display:flex; border-top:1px solid var(--border); font-size:0.7rem; font-weight:600;">
          <button class="dm-status-btn ${item.status==='assistindo'?'active':''}" data-status="assistindo" style="flex:1; border-radius:0; border:none; border-right:1px solid var(--border); padding:10px 4px; font-size:0.65rem;">ASSISTIDO</button>
          <button class="dm-status-btn ${item.status==='concluido'?'active':''}" data-status="concluido" style="flex:1; border-radius:0; border:none; border-right:1px solid var(--border); padding:10px 4px; font-size:0.65rem;">CONCLUIDO</button>
          <button class="dm-status-btn ${item.status==='pausado'?'active':''}" data-status="pausado" style="flex:1; border-radius:0; border:none; border-right:1px solid var(--border); padding:10px 4px; font-size:0.65rem;">PAUSADO</button>
          <button class="dm-status-btn ${item.status==='planejado'?'active':''}" data-status="planejado" style="flex:1; border-radius:0; border:none; padding:10px 4px; font-size:0.65rem;">PLANEJADO</button>
        </div>
      </div>
      <!-- DIREITA -->
      <div style="display:flex; flex-direction:column; min-height:0;">
        <div style="flex:1; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:center; min-height:260px; position:relative; overflow:hidden;">
          <img id="titleHorizontalImg" src="" alt="Horizontal" style="width:100%; height:100%; object-fit:contain; display:none;" />
          <div id="titleHorizontalPlaceholder" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.1rem; letter-spacing:0.05em;">IMAGEM HORIZONTAL</div>
        </div>
        <div style="display:grid; grid-template-columns: 110px 110px 1fr; gap:0; border-bottom:1px solid var(--border); min-height:110px;">
          <div style="border-right:1px solid var(--border); padding:12px; display:flex; flex-direction:column; gap:8px; align-items:center; justify-content:center;">
            <span style="font-size:0.65rem; font-weight:600; color:var(--text-muted); text-align:center;">NUMERO DA TEMPORADA</span>
            <div style="display:flex; align-items:center; gap:8px;"><button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="-1" style="width:28px; height:28px;">-</button><span id="titleTemporadaDisplay" style="font-size:1.6rem; font-weight:700; min-width:32px; text-align:center;">${String(item.temporada||1).padStart(2,'0')}</span><button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="1" style="width:28px; height:28px;">+</button></div>
            <small style="font-size:0.65rem; color:var(--text-muted);">/ <span id="titleSeasonMax">--</span></small>
          </div>
          <div style="border-right:1px solid var(--border); padding:12px; display:flex; flex-direction:column; gap:8px; align-items:center; justify-content:center;">
            <span style="font-size:0.65rem; font-weight:600; color:var(--text-muted); text-align:center;">NUMERO DO EPISODIO</span>
            <div style="display:flex; align-items:center; gap:8px;"><button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="-1" style="width:28px; height:28px;">-</button><span id="titleEpisodioDisplay" style="font-size:1.6rem; font-weight:700; min-width:32px; text-align:center;">${String(item.episodio||0).padStart(2,'0')}</span><button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="1" style="width:28px; height:28px;">+</button></div>
            <small style="font-size:0.65rem; color:var(--text-muted);">/ <span id="titleEpMax">--</span></small>
            <div id="titleEpLoading" style="display:none; font-size:0.6rem; color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i></div>
          </div>
          <div style="padding:12px; display:flex; flex-direction:column; gap:6px; min-width:0;">
            <span style="font-size:0.65rem; font-weight:600; color:var(--text-muted);">SINOPSE DO EPISODIO</span>
            <strong id="titleEpTitle" style="font-size:0.85rem; line-height:1.2;">—</strong>
            <small id="titleEpDate" style="font-size:0.7rem; color:var(--text-muted);"></small>
            <p id="titleEpOverview" style="font-size:0.75rem; color:var(--text-secondary); line-height:1.4; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; margin:0;"></p>
          </div>
        </div>
        <div style="display:flex; border-top:1px solid var(--border); font-size:0.7rem; font-weight:600;">
          <button id="titleEpisodesBtn" style="flex:1; padding:14px; background:transparent; border:none; border-right:1px solid var(--border); color:var(--text-primary); cursor:pointer;">EPISODIOS</button>
          <button id="titleListsBtn" style="flex:1; padding:14px; background:transparent; border:none; border-right:1px solid var(--border); color:var(--text-primary); cursor:pointer;">LISTAS</button>
          <button id="titleSave" style="flex:1; padding:14px; background:var(--accent); color:var(--accent-ink); border:none; cursor:pointer; font-weight:700;">SALVAR</button>
          <button id="titleDelete" style="flex:1; padding:14px; background:transparent; border:none; color:var(--danger); cursor:pointer;">REMOVER</button>
        </div>
      </div>
    </div>
    <div id="titleListsWrap" style="display:none; max-width:1100px; margin:12px auto; background:var(--bg-elevated); border:1px solid var(--border); border-radius:8px; padding:12px;"></div>
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
  let seasonLimits = { maxTemp: 1, maxEpByTemp: { 1: 1 } };
  const titleSeasonMax = container.querySelector('#titleSeasonMax');
  const titleEpMax = container.querySelector('#titleEpMax');
  const titleEpTitle = container.querySelector('#titleEpTitle');
  const titleEpDate = container.querySelector('#titleEpDate');
  const titleEpOverview = container.querySelector('#titleEpOverview');
  const titleEpLoading = container.querySelector('#titleEpLoading');
  async function updateEpDisplay() {
    container.querySelector('#titleTemporadaDisplay').textContent = String(curTemp).padStart(2,'0');
    container.querySelector('#titleEpisodioDisplay').textContent = String(curEp).padStart(2,'0');
    const maxEp = seasonLimits.maxEpByTemp?.[curTemp] || 1;
    if (titleEpMax) titleEpMax.textContent = String(maxEp).padStart(2,'0');
    if (curEp === 0) {
      if (titleEpTitle) titleEpTitle.textContent = 'Ainda não iniciado';
      if (titleEpDate) titleEpDate.textContent = '';
      if (titleEpOverview) titleEpOverview.textContent = '';
      return;
    }
    if (!item.tmdb_id) {
      if (titleEpTitle) titleEpTitle.textContent = `Episódio ${curEp}`;
      return;
    }
    if (titleEpLoading) titleEpLoading.style.display = 'flex';
    try {
      const seasonData = await callTMDB(`tv/${item.tmdb_id}/season/${curTemp}`, {}, 'pt-BR');
      const ep = seasonData.episodes?.find(e => Number(e.episode_number) === curEp);
      if (ep) {
        if (titleEpTitle) titleEpTitle.textContent = ep.name || `Episódio ${curEp}`;
        if (titleEpDate) titleEpDate.textContent = ep.air_date ? ep.air_date.split('-').reverse().join('/') : '';
        if (titleEpOverview) titleEpOverview.textContent = ep.overview || 'Sinopse não disponível.';
      } else {
        if (titleEpTitle) titleEpTitle.textContent = `Episódio ${curEp}`;
      }
    } catch {
      if (titleEpTitle) titleEpTitle.textContent = `Episódio ${curEp}`;
    } finally {
      if (titleEpLoading) titleEpLoading.style.display = 'none';
    }
  }
  container.querySelectorAll('.poster-stepper-btn').forEach(b => {
    b.addEventListener('click', () => {
      const t = b.dataset.target, s = parseInt(b.dataset.step,10)||1;
      if (t === 'titleTemporada') {
        const maxTemp = seasonLimits.maxTemp || 1;
        curTemp = Math.max(1, Math.min(maxTemp, curTemp + s));
        const maxEp = seasonLimits.maxEpByTemp?.[curTemp] || 1;
        if (curEp > maxEp) curEp = maxEp;
      } else {
        const maxEp = seasonLimits.maxEpByTemp?.[curTemp] || 1;
        curEp = Math.max(0, Math.min(maxEp, curEp + s));
      }
      updateEpDisplay();
    });
  });
  container.querySelector('#titleSave').addEventListener('click', async () => {
    const ns = container.querySelector('#titlePageStatusBar .dm-status-btn.active')?.dataset.status || item.status;
    const nt = null; // tier não exibido aqui, mantém
    try { const saved = await onUpdate(item.id, { temporada: curTemp, episodio: curEp, status: ns }); Object.assign(item, saved); onBack(); } catch(e){ console.error(e); }
  });
  container.querySelector('#titleDelete').addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja remover este título?')) return;
    try { await onDelete(item.id); onBack(); } catch(e){ console.error(e); }
  });
  const listsBtn = container.querySelector('#titleListsBtn');
  const listsWrap = container.querySelector('#titleListsWrap');
  if (listsBtn && listsWrap) {
    listsBtn.addEventListener('click', () => {
      listsWrap.style.display = listsWrap.style.display === 'none' ? 'block' : 'none';
      listsWrap.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted);">Listas em breve</p>';
    });
  }
  const epsBtn = container.querySelector('#titleEpisodesBtn');
  if (epsBtn) epsBtn.addEventListener('click', () => {
    // Reusa episodesModal se existir
    const ev = new CustomEvent('openEpisodes', { detail: { item } });
    window.dispatchEvent(ev);
  });
  (async () => {
    if (!item.tmdb_id) { updateEpDisplay(); return; }
    try {
      const details = await callTMDB(`tv/${item.tmdb_id}`, {}, 'pt-BR');
      // Imagens
      const vImg = container.querySelector('#titleVerticalImg');
      const hImg = container.querySelector('#titleHorizontalImg');
      const hPlaceholder = container.querySelector('#titleHorizontalPlaceholder');
      if (details.poster_path && vImg) { vImg.src = `https://image.tmdb.org/t/p/w342${details.poster_path}`; vImg.style.display = 'block'; const ph = container.querySelector('#titleVerticalPlaceholder'); if (ph) ph.style.display = 'none'; }
      if (details.backdrop_path && hImg) { hImg.src = `https://image.tmdb.org/t/p/w780${details.backdrop_path}`; hImg.style.display = 'block'; if (hPlaceholder) hPlaceholder.style.display = 'none'; }
      else if (hImg && details.poster_path) { hImg.src = `https://image.tmdb.org/t/p/w780${details.poster_path}`; hImg.style.display = 'block'; if (hPlaceholder) hPlaceholder.style.display = 'none'; }
      // Links
      const yt = container.querySelector('#titleYoutubeLink');
      const wiki = container.querySelector('#titleWikiLink');
      const imdb = container.querySelector('#titleImdbLink');
      if (yt) yt.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.nome + ' trailer')}`;
      if (wiki) wiki.href = `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.nome).replace(/%20/g,'_')}`;
      if (imdb && details.imdb_id) imdb.href = `https://www.imdb.com/title/${details.imdb_id}/`;
      // Logo
      const logoWrap = container.querySelector('#titleLogoWrap');
      const logoImg = container.querySelector('#titleLogoImg');
      const logo = await fetchTitleLogo(item.tmdb_id, 'tv').catch(()=>null);
      if (logo && logoImg && logoWrap) { logoImg.src = logo; logoWrap.style.display = 'flex'; }
      // Limites
      const seasons = details.seasons || [];
      const maxTemp = seasons.filter(s=>s.season_number>0).length || 1;
      const maxEpByTemp = {};
      seasons.forEach(s=>{ if(s.season_number>0) maxEpByTemp[s.season_number]=s.episode_count||0; });
      seasonLimits = { maxTemp, maxEpByTemp };
      if (titleSeasonMax) titleSeasonMax.textContent = String(maxTemp).padStart(2,'0');
      updateEpDisplay();
    } catch { updateEpDisplay(); }
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
}
