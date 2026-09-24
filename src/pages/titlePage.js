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
    <button id="titleBack" class="tool-btn" style="margin:16px;"><i class="fas fa-arrow-left"></i> Voltar</button>
    <div class="title-hero" id="titleHero" style="position:relative; height:58vh; min-height:380px; max-height:520px; background:var(--bg-secondary); overflow:hidden; display:flex; align-items:flex-end;">
      <img id="titleBackdrop" src="" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:none;" />
      <div style="position:absolute; inset:0; background:linear-gradient(to top, var(--bg-primary) 0%, rgba(10,10,10,0.6) 50%, transparent 100%);"></div>
      <div style="position:absolute; inset:0; background:linear-gradient(to top, var(--bg-primary) 20%, transparent 70%);"></div>
      <div style="position:relative; z-index:1; display:flex; gap:24px; align-items:flex-end; width:100%; max-width:1100px; margin:0 auto; padding:24px;">
        <div style="position:relative; flex-shrink:0; box-shadow:0 8px 32px rgba(0,0,0,0.6); border-radius:8px; overflow:hidden;">
          <img id="titlePosterImgCard" src="${item.imagem || ''}" alt="Poster" style="width:180px; aspect-ratio:2/3; object-fit:cover; display:${item.imagem ? 'block' : 'none'}; background:var(--bg-secondary);" onerror="this.style.display='none'" />
          ${item.tier ? `<div class="tier-stamp ${tierClass}" style="position:absolute; top:0; right:6px; width:22px; height:28px; font-size:0.52rem;">${item.tier}</div>` : ''}
        </div>
        <div style="flex:1; min-width:0; padding-bottom:8px;">
          <div id="titleLogoWrap" style="display:none; margin-bottom:12px;"><img id="titleLogoImg" src="" alt="Logo" style="max-height:72px; max-width:420px; object-fit:contain; filter:drop-shadow(0 2px 8px rgba(0,0,0,0.8));" /></div>
          <h1 id="titleName" style="font-family:var(--font-display); font-size:clamp(1.4rem,3vw,2.2rem); font-weight:700; line-height:1.1; text-shadow:0 2px 12px rgba(0,0,0,0.8);">${item.nome} ${item.ano ? `<span style="font-weight:400; opacity:0.7;">(${item.ano})</span>` : ''}</h1>
          <div id="titleMeta" style="margin-top:8px; display:flex; gap:12px; flex-wrap:wrap; font-size:0.8rem; color:var(--text-secondary); text-shadow:0 1px 4px rgba(0,0,0,0.8);"></div>
          <p id="titleSynopsis" style="margin-top:12px; color:var(--text-secondary); font-size:0.88rem; line-height:1.5; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; text-shadow:0 1px 4px rgba(0,0,0,0.6);"></p>
        </div>
      </div>
    </div>
    <div class="title-controls" style="background:var(--bg-elevated); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:0; position:sticky; top:0; z-index:5;">
      <div class="episode-progress-panel" style="border:none; border-radius:0; box-shadow:none; max-width:1100px; margin:0 auto; width:100%;">
        <div class="epp-status" style="flex:0 0 10%; max-width:10%;">
          <span class="epp-season-label">Status</span>
          <div id="titlePageStatusBar" style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
            <button class="dm-status-btn ${item.status==='assistindo'?'active':''}" data-status="assistindo" style="width:100%; justify-content:center;">Assistindo</button>
            <button class="dm-status-btn ${item.status==='concluido'?'active':''}" data-status="concluido" style="width:100%; justify-content:center;">Concluído</button>
            <button class="dm-status-btn ${item.status==='pausado'?'active':''}" data-status="pausado" style="width:100%; justify-content:center;">Pausado</button>
            <button class="dm-status-btn ${item.status==='planejado'?'active':''}" data-status="planejado" style="width:100%; justify-content:center;">Planejado</button>
          </div>
        </div>
        <div class="epp-divider-h"></div>
        <div class="epp-season" style="flex:0 0 10%; max-width:10%;">
          <span class="epp-season-label">Temporada</span>
          <div class="epp-season-info"><span class="epp-season-val"><span id="titleTemporadaDisplay">${String(item.temporada||1).padStart(2,'0')}</span></span><span class="epp-season-text">/</span><span class="epp-season-max">${String(item.totalEpisodios ? Math.max(...Object.keys(item.seasonEpisodesMap||{}).map(Number).filter(n=>n>0)) || 1 : 1).padStart(2,'0')}</span></div>
          <div class="epp-season-controls"><button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="-1">-</button><button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="1">+</button></div>
        </div>
        <div class="epp-divider-h"></div>
        <div class="epp-episode" style="flex:0 0 10%; max-width:10%;">
          <span class="epp-episode-label">Episódio</span>
          <div class="epp-episode-info"><span class="epp-ep-badge"><span id="titleEpisodioDisplay">${String(item.episodio||0).padStart(2,'0')}</span></span><span class="epp-season-text">/</span><span class="epp-max">${String(item.totalEpisodios||1).padStart(2,'0')}</span></div>
          <div class="epp-episode-controls"><button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="-1">-</button><button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="1">+</button></div>
        </div>
        <div class="epp-divider-h"></div>
        <div class="epp-episode-meta" style="flex:0 0 55%; max-width:55%;">
          <div class="progress-wrap" style="width:100%;"><div class="progress-track"><div class="progress-bar" style="width:${progress}%;"></div></div><span class="progress-pct">${progress}%</span></div>
          <p style="font-size:0.72rem; color:var(--text-muted); margin:0;">${item.tipo || 'serie'} • ${progress}% concluído</p>
        </div>
        <div class="epp-divider-h"></div>
        <div class="epp-actions" style="flex:0 0 15%; max-width:15%;">
          <span class="epp-episode-label">Ações</span>
          <select id="titlePageTier" style="width:100%; padding:6px; border-radius:8px; background:var(--bg-elevated); color:var(--text-primary); border:1px solid var(--border); font-size:0.8rem;">
            <option value="" ${!item.tier?'selected':''}>Sem tier</option>
            <option value="S+" ${item.tier==='S+'?'selected':''}>S+</option>
            <option value="S" ${item.tier==='S'?'selected':''}>S</option>
            <option value="A" ${item.tier==='A'?'selected':''}>A</option>
            <option value="B" ${item.tier==='B'?'selected':''}>B</option>
            <option value="C" ${item.tier==='C'?'selected':''}>C</option>
            <option value="D" ${item.tier==='D'?'selected':''}>D</option>
          </select>
          <button id="titleSave" class="dm-btn dm-btn-primary" style="width:100%; justify-content:center;"><i class="fas fa-save"></i> Salvar</button>
          <button id="titleDelete" class="dm-btn dm-btn-danger" style="width:100%; justify-content:center;"><i class="fas fa-trash"></i> Remover</button>
        </div>
      </div>
    </div>
    <div style="max-width:1100px; margin:24px auto; padding:0 24px;">
      <div id="titleEpisodesList" style="display:grid; gap:12px;"></div>
    </div>
  `;
  container.querySelector('#titleBack').addEventListener('click', () => onBack && onBack());
  container.querySelectorAll('#titlePageStatusBar .dm-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('#titlePageStatusBar .dm-status-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
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
  (async () => {
    if (!item.tmdb_id) return;
    try {
      const details = await callTMDB(`tv/${item.tmdb_id}`, {}, 'pt-BR');
      const syn = container.querySelector('#titleSynopsis');
      // Synopsis já está no hero, não precisa repetir
      const meta = container.querySelector('#titleMeta');
      if (meta) meta.innerHTML = `<span>${details.first_air_date?.slice(0,4) || ''} • ${details.number_of_seasons} temp • ${details.number_of_episodes} eps</span><span>${(details.genres||[]).map(g=>g.name).join(' • ')}</span>`;
      const backdrop = container.querySelector('#titleBackdrop');
      if (backdrop && details.backdrop_path) {
        backdrop.src = `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`;
        backdrop.style.display = 'block';
      }
      const posterCard = container.querySelector('#titlePosterImgCard');
      if (posterCard && details.poster_path) {
        posterCard.src = `https://image.tmdb.org/t/p/w342${details.poster_path}`;
        posterCard.style.display = 'block';
      }
      const logoWrap = container.querySelector('#titleLogoWrap');
      const logoImg = container.querySelector('#titleLogoImg');
      const titleName = container.querySelector('#titleName');
      const logo = await fetchTitleLogo(item.tmdb_id, 'tv').catch(()=>null);
      if (logo && logoImg && logoWrap) {
        logoImg.src = logo;
        logoWrap.style.display = 'block';
        if (titleName) titleName.style.display = 'none';
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
