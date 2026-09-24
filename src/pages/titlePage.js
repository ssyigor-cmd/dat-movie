import { callTMDB, fetchTitleLogo } from '../lib/api.js';
import { getTierClass, formatDateBR, calcularProgresso } from '../lib/catalog.js';
let currentItem=null, onUpdate=null, onDelete=null, onBack=null;
export function setupTitlePage(c){ onUpdate=c.onUpdateItem; onDelete=c.onDeleteItem; onBack=c.onBack; }
function renderTitlePage(item, container){
  currentItem=item;
  const progress=calcularProgresso(item);
  const tierClass=item.tier?getTierClass(item.tier):'';
  container.innerHTML=`
    <div class="tp-hero" id="tpHero">
      <div class="tp-backdrop" id="tpBackdrop"></div>
      <div class="tp-hero-gradient"></div>
      <button id="titleBack" class="tp-back"><i class="fas fa-arrow-left"></i> Voltar</button>
      <div class="tp-hero-content">
        <div class="tp-poster-wrap">
          <img id="titlePosterImg" src="${item.imagem||''}" alt="${item.nome}" style="display:${item.imagem?'block':'none'}"/>
          <div id="titlePosterPlaceholder" style="display:${item.imagem?'none':'flex'}"><i class="fas fa-image"></i></div>
          ${item.tier?`<div class="tier-stamp ${tierClass}">${item.tier}</div>`:''}
        </div>
        <div class="tp-info">
          <div id="titleLogoContainer" style="display:none; margin-bottom:12px;"><img id="titleLogoImg" src="" alt="Logo" style="max-height:64px; max-width:100%;"/></div>
          <h1 id="titlePageTitle" style="font-family:var(--font-display); font-size:2rem; line-height:1.1; margin:0;">${item.nome} ${item.ano?`(${item.ano})`:''}</h1>
          <div id="titleMeta" style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap; font-size:0.8rem; color:var(--text-muted);"></div>
          <div style="margin-top:12px; display:flex; align-items:center; gap:12px;">
            <div class="tp-progress-ring" data-progress="${progress}"><svg width="56" height="56"><circle cx="28" cy="28" r="22" stroke="var(--border)" stroke-width="4" fill="none"/><circle cx="28" cy="28" r="22" stroke="var(--accent)" stroke-width="4" fill="none" stroke-dasharray="${2*Math.PI*22}" stroke-dashoffset="${2*Math.PI*22*(1-progress/100)}" transform="rotate(-90 28 28)" style="transition:stroke-dashoffset 0.6s"/></svg><span>${progress}%</span></div>
            <div style="flex:1;"><div id="titleSynopsis" style="color:var(--text-secondary); font-size:0.88rem; line-height:1.6; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;"></div><button id="titleSynopsisMore" style="background:none; border:none; color:var(--accent); font-size:0.75rem; cursor:pointer; margin-top:4px; display:none;">Ver mais</button></div>
          </div>
        </div>
      </div>
    </div>
    <div class="tp-actions">
      <div class="episode-progress-panel tp-panel">
        <div class="epp-status" style="flex:0 0 14%;"><button class="dm-status-btn ${item.status==='assistindo'?'active':''}" data-status="assistindo">Assistindo</button><button class="dm-status-btn ${item.status==='concluido'?'active':''}" data-status="concluido">Concluído</button><button class="dm-status-btn ${item.status==='pausado'?'active':''}" data-status="pausado">Pausado</button><button class="dm-status-btn ${item.status==='planejado'?'active':''}" data-status="planejado">Planejado</button></div>
        <div class="epp-season" style="flex:0 0 13%;"><span class="epp-season-label">Temporada</span><div class="tp-stepper-val"><span id="titleTemporadaDisplay">${String(item.temporada||1).padStart(2,'0')}</span><span class="epp-season-text">/</span><span id="titleSeasonMax">--</span></div><div class="tp-stepper-ctrl"><button class="poster-stepper-btn" data-target="titleTemporada" data-step="-1">-</button><button class="poster-stepper-btn" data-target="titleTemporada" data-step="1">+</button></div></div>
        <div class="epp-episode" style="flex:0 0 13%;"><span class="epp-episode-label">Episódio</span><div class="tp-stepper-val"><span id="titleEpisodioDisplay" class="epp-ep-badge">${String(item.episodio||0).padStart(2,'0')}</span><span class="epp-season-text">/</span><span id="titleEpMax">--</span></div><div class="tp-stepper-ctrl"><button class="poster-stepper-btn" data-target="titleEpisodio" data-step="-1">-</button><button class="poster-stepper-btn" data-target="titleEpisodio" data-step="1">+</button></div></div>
        <div class="epp-episode-meta" style="flex:1;"><strong id="titleEpTitle">—</strong><small id="titleEpDate"></small><p id="titleEpOverview" style="font-size:0.8rem; color:var(--text-secondary); margin:4px 0 0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;"></p></div>
        <div class="epp-actions" style="flex:0 0 18%;"><select id="titlePageTier" style="width:100%; padding:6px; border-radius:6px; background:var(--bg-elevated); color:var(--text-primary); border:1px solid var(--border);"><option value="" ${!item.tier?'selected':''}>Sem tier</option><option value="S+" ${item.tier==='S+'?'selected':''}>S+</option><option value="S" ${item.tier==='S'?'selected':''}>S</option><option value="A" ${item.tier==='A'?'selected':''}>A</option><option value="B" ${item.tier==='B'?'selected':''}>B</option><option value="C" ${item.tier==='C'?'selected':''}>C</option><option value="D" ${item.tier==='D'?'selected':''}>D</option></select><button id="titleSave" class="dm-btn dm-btn-primary" style="width:100%; margin-top:6px;"><i class="fas fa-save"></i> Salvar</button><button id="titleDelete" class="dm-btn dm-btn-danger" style="width:100%;"><i class="fas fa-trash"></i> Remover</button></div>
      </div>
    </div>
    <div id="titleEpisodes" style="margin-top:20px;"></div>
  `;
  container.querySelector('#titleBack').addEventListener('click',()=>onBack&&onBack());
  container.querySelectorAll('#titlePageStatusBar .dm-status-btn, .tp-actions .dm-status-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      container.querySelectorAll('.dm-status-btn').forEach(b=>b.classList.remove('active'));
      // sync both bars if exist
      const val=btn.dataset.status;
      container.querySelectorAll(`.dm-status-btn[data-status="${val}"]`).forEach(b=>b.classList.add('active'));
    });
  });
  let curTemp=Number(item.temporada)||1, curEp=Number(item.episodio)||0;
  container.querySelectorAll('.poster-stepper-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      const t=b.dataset.target, s=parseInt(b.dataset.step,10)||1;
      if(t==='titleTemporada'){curTemp=Math.max(1,curTemp+s); container.querySelector('#titleTemporadaDisplay').textContent=String(curTemp).padStart(2,'0'); updateEpInfo();}
      else{curEp=Math.max(0,curEp+s); container.querySelector('#titleEpisodioDisplay').textContent=String(curEp).padStart(2,'0'); updateEpInfo();}
    });
  });
  async function updateEpInfo(){
    const epTitleEl=container.querySelector('#titleEpTitle'), epDateEl=container.querySelector('#titleEpDate'), epOverEl=container.querySelector('#titleEpOverview');
    if(!item.tmdb_id||curEp===0){ if(epTitleEl)epTitleEl.textContent='Ainda não iniciado'; if(epDateEl)epDateEl.textContent=''; if(epOverEl)epOverEl.textContent=''; return; }
    try{
      const seasonData=await callTMDB(`tv/${item.tmdb_id}/season/${curTemp}`,{},'pt-BR');
      const ep=seasonData.episodes?.find(e=>Number(e.episode_number)===curEp);
      if(ep){ if(epTitleEl)epTitleEl.textContent=ep.name||`Episódio ${curEp}`; if(epDateEl)epDateEl.textContent=ep.air_date?formatDateBR(ep.air_date):''; if(epOverEl)epOverEl.textContent=ep.overview||''; }
    }catch{}
  }
  container.querySelector('#titleSave').addEventListener('click',async()=>{
    const newStatus=container.querySelector('.dm-status-btn.active')?.dataset.status||item.status;
    const newTier=container.querySelector('#titlePageTier').value||null;
    try{ const saved=await onUpdate(item.id,{temporada:curTemp, episodio:curEp, status:newStatus, tier:newTier}); Object.assign(item,saved); onBack(); }catch(e){console.error(e);}
  });
  container.querySelector('#titleDelete').addEventListener('click',async()=>{ if(!confirm('Tem certeza que deseja remover este título?'))return; try{await onDelete(item.id); onBack();}catch(e){console.error(e);} });
  const moreBtn=container.querySelector('#titleSynopsisMore');
  if(moreBtn){
    moreBtn.addEventListener('click',()=>{
      const syn=container.querySelector('#titleSynopsis');
      const isClamped=syn.style.webkitLineClamp==='3' || syn.style.display==='-webkit-box' || getComputedStyle(syn).webkitLineClamp==='3';
      if(syn.style.webkitLineClamp==='3'||syn.style.webkitLineClamp===''){ syn.style.webkitLineClamp='unset'; syn.style.display='block'; moreBtn.textContent='Ver menos'; } else { syn.style.webkitLineClamp='3'; syn.style.display='-webkit-box'; moreBtn.textContent='Ver mais'; }
    });
  }
  // Load
  (async()=>{
    if(!item.tmdb_id)return;
    try{
      const [details, logo]=await Promise.all([callTMDB(`tv/${item.tmdb_id}`,{},'pt-BR').catch(()=>null), fetchTitleLogo(item.tmdb_id,'tv').catch(()=>null)]);
      if(details){
        const syn=container.querySelector('#titleSynopsis');
        if(syn){ syn.textContent=details.overview||'Sinopse não disponível.'; if(details.overview&&details.overview.length>180){ moreBtn.style.display='inline-block'; syn.style.display='-webkit-box'; } }
        const meta=container.querySelector('#titleMeta');
        if(meta)meta.innerHTML=`<span>${details.first_air_date?.slice(0,4)||''} - ${details.last_air_date?.slice(0,4)||''}</span><span>${details.status||''}</span><span>${(details.genres||[]).map(g=>`<span style="background:var(--bg-elevated); border:1px solid var(--border); padding:2px 6px; border-radius:999px; font-size:0.7rem;">${g.name}</span>`).join(' ')}</span>`;
        const bg=document.querySelector('#tpBackdrop');
        if(bg&&details.backdrop_path){ bg.style.backgroundImage=`url(https://image.tmdb.org/t/p/w1280${details.backdrop_path})`; }
        const posterImg=container.querySelector('#titlePosterImg');
        const ph=container.querySelector('#titlePosterPlaceholder');
        if(posterImg&&!item.imagem&&details.poster_path){ posterImg.src=`https://image.tmdb.org/t/p/w342${details.poster_path}`; posterImg.style.display='block'; if(ph)ph.style.display='none'; }
        const seasons=(details.seasons||[]).filter(s=>s.season_number>0);
        const maxTemp=seasons.length?Math.max(...seasons.map(s=>s.season_number)):1;
        const maxEpMap={}; seasons.forEach(s=>{maxEpMap[s.season_number]=s.episode_count||0;});
        const seasonMaxEl=container.querySelector('#titleSeasonMax');
        const epMaxEl=container.querySelector('#titleEpMax');
        if(seasonMaxEl)seasonMaxEl.textContent=String(maxTemp).padStart(2,'0');
        if(epMaxEl)epMaxEl.textContent=String(maxEpMap[curTemp]||1).padStart(2,'0');
        // Logo
        const logoContainer=container.querySelector('#titleLogoContainer');
        const logoImg=container.querySelector('#titleLogoImg');
        const titleEl=container.querySelector('#titlePageTitle');
        if(logo&&logoImg&&logoContainer){ logoImg.src=logo; logoContainer.style.display='block'; if(titleEl)titleEl.style.display='none'; }
      }
    }catch{}
  })();
}
export function showTitlePage(item, container){ container.style.display='block'; renderTitlePage(item, container); window.scrollTo(0,0); }
export function hideTitlePage(container){ container.style.display='none'; container.innerHTML=''; currentItem=null; }
