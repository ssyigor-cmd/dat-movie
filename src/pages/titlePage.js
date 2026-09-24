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
    <div class="title-page-header">
      <div class="title-page-poster">
        <img src="${item.imagem || ''}" alt="${item.nome}" style="width:100%; max-width:320px; aspect-ratio:2/3; object-fit:cover; border-radius:8px; background:var(--bg-secondary);" />
        ${item.tier ? `<div class="tier-stamp ${tierClass}" style="position:absolute; top:8px; right:8px;">${item.tier}</div>` : ''}
      </div>
      <div class="title-page-info">
        <h1 style="font-family:var(--font-display); font-size:1.8rem;">${item.nome} ${item.ano ? `(${item.ano})` : ''}</h1>
        <p style="color:var(--text-muted); font-size:0.85rem; margin:8px 0;">${item.tipo || 'serie'} • T${item.temporada} E${String(item.episodio).padStart(2,'0')} • ${progress}%</p>
        <div class="progress-wrap" style="max-width:320px;"><div class="progress-track"><div class="progress-bar" style="width:${progress}%;"></div></div><span class="progress-pct">${progress}%</span></div>
        <div id="titlePageStatusBar" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="dm-status-btn ${item.status==='assistindo'?'active':''}" data-status="assistindo">Assistindo</button>
          <button class="dm-status-btn ${item.status==='concluido'?'active':''}" data-status="concluido">Concluído</button>
          <button class="dm-status-btn ${item.status==='pausado'?'active':''}" data-status="pausado">Pausado</button>
          <button class="dm-status-btn ${item.status==='planejado'?'active':''}" data-status="planejado">Planejado</button>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <select id="titlePageTier" style="padding:6px 10px; border-radius:8px; background:var(--bg-elevated); color:var(--text-primary); border:1px solid var(--border);">
            <option value="" ${!item.tier?'selected':''}>Sem tier</option>
            <option value="S+" ${item.tier==='S+'?'selected':''}>S+</option>
            <option value="S" ${item.tier==='S'?'selected':''}>S</option>
            <option value="A" ${item.tier==='A'?'selected':''}>A</option>
            <option value="B" ${item.tier==='B'?'selected':''}>B</option>
            <option value="C" ${item.tier==='C'?'selected':''}>C</option>
            <option value="D" ${item.tier==='D'?'selected':''}>D</option>
          </select>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="-1">-</button>
            <span>T<span id="titleTemporadaDisplay">${String(item.temporada||1).padStart(2,'0')}</span></span>
            <button class="poster-stepper-btn stepper-btn" data-target="titleTemporada" data-step="1">+</button>
            <span style="margin-left:12px;">E<span id="titleEpisodioDisplay">${String(item.episodio||0).padStart(2,'0')}</span></span>
            <button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="-1">-</button>
            <button class="poster-stepper-btn stepper-btn" data-target="titleEpisodio" data-step="1">+</button>
          </div>
        </div>
        <div style="margin-top:16px; display:flex; gap:8px;">
          <button id="titleSave" class="dm-btn dm-btn-primary"><i class="fas fa-save"></i> Salvar</button>
          <button id="titleDelete" class="dm-btn dm-btn-danger"><i class="fas fa-trash"></i> Remover</button>
        </div>
        <div id="titleSynopsis" style="margin-top:16px; color:var(--text-secondary); font-size:0.85rem; line-height:1.6;"></div>
        <div id="titleMeta" style="margin-top:12px; font-size:0.8rem; color:var(--text-muted); display:flex; gap:12px; flex-wrap:wrap;"></div>
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
  // Load synopsis and meta async
  (async () => {
    if (!item.tmdb_id) return;
    try {
      const details = await callTMDB(`tv/${item.tmdb_id}`, {}, 'pt-BR');
      const syn = container.querySelector('#titleSynopsis');
      if (syn) syn.textContent = details.overview || 'Sinopse não disponível.';
      const meta = container.querySelector('#titleMeta');
      if (meta) meta.innerHTML = `<span>${details.first_air_date?.slice(0,4) || ''} - ${details.last_air_date?.slice(0,4) || ''}</span><span>${details.status || ''}</span><span>${(details.genres||[]).map(g=>g.name).join(', ')}</span>`;
      const logo = await fetchTitleLogo(item.tmdb_id, 'tv').catch(()=>null);
      if (logo) {
        const img = container.querySelector('.title-page-poster img');
        if (img) { /* keep poster, logo could be shown as overlay if needed */ }
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
