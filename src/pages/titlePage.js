import { callTMDB, fetchTitleLogo } from '../lib/api.js';
import { getTierClass, calcularProgresso } from '../lib/catalog.js';

let onUpdate, onDelete, onBack;

export function setupTitlePage(cbs) {
  onUpdate = cbs.onUpdateItem;
  onDelete = cbs.onDeleteItem;
  onBack = cbs.onBack;
}

function renderTitlePage(item, container) {
  const tierClass = item.tier ? getTierClass(item.tier) : '';
  const progress = calcularProgresso(item);
  container.innerHTML = `
    <div style="max-width:1100px; margin:0 auto; padding:24px;">
      <button id="titleBack" class="tool-btn" style="margin-bottom:20px;"><i class="fas fa-arrow-left"></i> Voltar</button>
      <div style="display:grid; grid-template-columns: 320px 1fr; gap:32px; align-items:start;">
        <div style="position:sticky; top:24px;">
          <div style="position:relative; border-radius:12px; overflow:hidden; background:var(--bg-secondary); box-shadow:var(--shadow-lg);">
            <img id="titlePosterImgCard" src="${item.imagem || ''}" alt="Poster" style="width:100%; aspect-ratio:2/3; object-fit:cover; display:${item.imagem ? 'block' : 'none'};" />
            <div id="titlePosterPlaceholder" style="display:${item.imagem ? 'none' : 'flex'}; aspect-ratio:2/3; align-items:center; justify-content:center; color:var(--text-muted);"><i class="fas fa-image" style="font-size:2rem;"></i></div>
            ${item.tier ? `<div class="tier-stamp ${tierClass}" style="position:absolute; top:0; right:12px; width:22px; height:28px; font-size:0.52rem;">${item.tier}</div>` : ''}
          </div>
          <div id="titleBackdropWrap" style="margin-top:12px; border-radius:8px; overflow:hidden; display:none;"><img id="titleBackdrop" src="" alt="Backdrop" style="width:100%; aspect-ratio:16/9; object-fit:cover;" /></div>
          <div id="titleLogoWrap" style="display:none; margin-top:16px; text-align:center;"><img id="titleLogoImg" src="" alt="Logo" style="max-width:100%; max-height:80px; object-fit:contain;" /></div>
        </div>
        <div style="min-width:0;">
          <h1 id="titleName" style="font-family:var(--font-display); font-size:2rem; font-weight:700; line-height:1.1;">${item.nome} ${item.ano ? `<span style="font-weight:400; color:var(--text-muted);">(${item.ano})</span>` : ''}</h1>
          <div id="titleMeta" style="margin-top:8px; display:flex; gap:12px; flex-wrap:wrap; font-size:0.85rem; color:var(--text-muted);"></div>
          <p id="titleSynopsis" style="margin-top:16px; color:var(--text-secondary); line-height:1.6; font-size:0.9rem;"></p>
          <div class="episode-progress-panel" style="margin-top:24px; border-radius:12px; overflow:hidden;">
            <div class="epp-status" style="flex:0 0 10%; max-width:10%;">
              <span class="epp-season-label">Status</span>
              <div id="titlePageStatusBar" style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
                <button class="dm-status-btn ${item.status==='assistindo'?'active':''}" data-status="assistindo">Assistindo</button>
                <button class="dm-status-btn ${item.status==='concluido'?'active':''}" data-status="concluido">Concluído</button>
                <button class="dm-status-btn ${item.status==='pausado'?'active':''}" data-status="pausado">Pausado</button>
                <button class="dm-status-btn ${item.status==='planejado'?'active':''}" data-status="planejado">Planejado</button>
              </div>
            </div>
            <div class="epp-divider-h"></div>
            <div class="epp-season" style="flex:0 0 10%; max-width:10%;">
              <span class="epp-season-label">Temporada</span>
              <div class="epp-season-info"><span class="epp-season-val"><span id="titleTemporadaDisplay">${String(item.temporada||1).padStart(2,'0')}</span></span></div>
              <div class="epp-season-controls"><button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="-1">-</button><button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="1">+</button></div>
            </div>
            <div class="epp-divider-h"></div>
            <div class="epp-episode" style="flex:0 0 10%; max-width:10%;">
              <span class="epp-episode-label">Episódio</span>
              <div class="epp-episode-info"><span class="epp-ep-badge"><span id="titleEpisodioDisplay">${String(item.episodio||0).padStart(2,'0')}</span></span></div>
              <div class="epp-episode-controls"><button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="-1">-</button><button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="1">+</button></div>
            </div>
            <div class="epp-divider-h"></div>
            <div class="epp-episode-meta" style="flex:0 0 55%; max-width:55%;">
              <div class="progress-wrap" style="width:100%;"><div class="progress-track"><div class="progress-bar" style="width:${progress}%;"></div></div><span class="progress-pct">${progress}%</span></div>
              <small style="color:var(--text-muted);">${item.tipo || 'serie'} • ${progress}% concluído</small>
            </div>
            <div class="epp-divider-h"></div>
            <div class="epp-actions" style="flex:0 0 15%; max-width:15%;">
              <span class="epp-episode-label">Ações</span>
              <select id="titlePageTier" style="width:100%; padding:6px; border-radius:8px; background:var(--bg-elevated); border:1px solid var(--border); color:var(--text-primary);"><option value="" ${!item.tier?'selected':''}>Sem tier</option><option value="S+" ${item.tier==='S+'?'selected':''}>S+</option><option value="S" ${item.tier==='S'?'selected':''}>S</option><option value="A" ${item.tier==='A'?'selected':''}>A</option><option value="B" ${item.tier==='B'?'selected':''}>B</option><option value="C" ${item.tier==='C'?'selected':''}>C</option><option value="D" ${item.tier==='D'?'selected':''}>D</option></select>
              <button id="titleSave" class="dm-btn dm-btn-primary" style="width:100%;"><i class="fas fa-save"></i> Salvar</button>
              <button id="titleDelete" class="dm-btn dm-btn-danger" style="width:100%;"><i class="fas fa-trash"></i> Remover</button>
            </div>
          </div>
          <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap; font-size:0.8rem; color:var(--text-muted);" id="titleExtraMeta"></div>
        </div>
      </div>
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
      const t = b.dataset.target, s = parseInt(b.dataset.step,10)||1;
      if (t === 'titleTemporada') { curTemp = Math.max(1, curTemp + s); container.querySelector('#titleTemporadaDisplay').textContent = String(curTemp).padStart(2,'0'); }
      else { curEp = Math.max(0, curEp + s); container.querySelector('#titleEpisodioDisplay').textContent = String(curEp).padStart(2,'0'); }
    });
  });
  container.querySelector('#titleSave').addEventListener('click', async () => {
    const ns = container.querySelector('#titlePageStatusBar .dm-status-btn.active')?.dataset.status || item.status;
    const nt = container.querySelector('#titlePageTier').value || null;
    try { const saved = await onUpdate(item.id, { temporada: curTemp, episodio: curEp, status: ns, tier: nt }); Object.assign(item, saved); onBack(); } catch(e){ console.error(e); }
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
      if (syn) syn.textContent = details.overview || 'Sinopse não disponível.';
      const meta = container.querySelector('#titleMeta');
      if (meta) meta.innerHTML = `<span>${details.first_air_date?.slice(0,4) || ''}${details.last_air_date ? ' - ' + details.last_air_date.slice(0,4) : ''}</span><span>${details.status || ''}</span><span>${(details.genres||[]).map(g=>g.name).join(' • ')}</span>`;
      const extra = container.querySelector('#titleExtraMeta');
      if (extra) extra.innerHTML = `<span>${details.number_of_seasons} temporadas</span><span>${details.number_of_episodes} episódios</span><span>${details.vote_average ? '★ ' + details.vote_average.toFixed(1) : ''}</span>`;
      const backdrop = container.querySelector('#titleBackdrop');
      const posterCard = container.querySelector('#titlePosterImgCard');
      const posterWrap = container.querySelector('#titleBackdropWrap');
      if (backdrop && details.backdrop_path) {
        const bgWrap = document.getElementById('titleBackdropWrap');
        if (bgWrap) { bgWrap.style.display = 'block'; backdrop.src = `https://image.tmdb.org/t/p/w780${details.backdrop_path}`; backdrop.style.display = 'block'; }
        else {
          const w = container.querySelector('#titleBackdropWrap');
          if (w) w.style.display = 'block';
        }
      }
      if (posterCard && details.poster_path && !item.imagem) {
        posterCard.src = `https://image.tmdb.org/t/p/w342${details.poster_path}`;
        posterCard.style.display = 'block';
        const ph = container.querySelector('#titlePosterPlaceholder');
        if (ph) ph.style.display = 'none';
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
      // Backdrop horizontal
      const hBackdrop = container.querySelector('#titleBackdrop');
      if (hBackdrop && details.backdrop_path) {
        hBackdrop.src = `https://image.tmdb.org/t/p/w780${details.backdrop_path}`;
        hBackdrop.style.display = 'block';
        const w = container.querySelector('#titleBackdropWrap');
        if (w) w.style.display = 'block';
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
}
