(function () {
  'use strict';

  const loop=window.AXMPremadeLoopCore;
  const composer=window.AXMPremadeComposerCore;
  const evolution=window.AXMPremadeEvolutionCore;
  const patternCore=window.AXMPremadePatternCore;
  const guide=window.AXMPremadeGuideCore;
  const pack=window.AXMPremadePack;
  if (!loop || !composer || !evolution || !patternCore || !guide || !pack) throw new Error('Closed Loop Lab requires loop/composer/evolution/pattern/guide cores and premade pack.');
  const workspaceGrid=document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  let guidedReceipt=null;
  let library=null;
  let session=null;
  let selectedCandidateId=null;
  let memoryReceipt=null;
  const previewById=new Map();
  const imageCache=new Map();
  const localPatternKey='axm-premade-pattern-library-v0.15.0';
  const BLEND={normal:'source-over',multiply:'multiply',screen:'screen',overlay:'overlay','soft-light':'soft-light','hard-light':'hard-light',lighter:'lighter',difference:'difference'};

  const panel=document.createElement('section');
  panel.className='panel premade-loop-panel';
  panel.innerHTML=`
    <div class="panel-heading">
      <div><div class="panel-kicker">18</div><h2>Closed Loop Lab</h2></div>
      <span class="count-pill">v0.17</span>
    </div>
    <div class="truth-note">Close the deterministic creation loop: guided recipe → evolution → rendered technical evidence → explicit keepers → explicit pattern-memory commit. Ranking never becomes keeper authority.</div>

    <div class="loop-toolbar">
      <button class="button primary" id="loopUseGuide">Use current guided recipe</button>
      <label class="button" for="loopGuideInput">Import guided receipt</label><input id="loopGuideInput" type="file" accept="application/json,.json" hidden />
      <button class="button" id="loopLoadLibrary">Load saved pattern library</button>
      <label class="button" for="loopLibraryInput">Import pattern library</label><input id="loopLibraryInput" type="file" accept="application/json,.json" hidden />
      <label>Seed<input id="loopSeed" value="closed-loop-001" /></label>
      <label>Variants<select id="loopVariants"><option>4</option><option selected>8</option><option>16</option></select></label>
      <label>Mutation<select id="loopStrength"><option>low</option><option selected>medium</option><option>high</option></select></label>
      <label><span>Lock base</span><input id="loopLockBase" type="checkbox" checked /></label>
      <label><span>FX</span><input id="loopFx" type="checkbox" checked /></label>
      <label><span>Decals</span><input id="loopDecals" type="checkbox" checked /></label>
      <button class="button accent" id="loopStart" disabled>Spawn + evaluate descendants</button>
      <span id="loopStatus">load guided receipt + pattern library</span>
    </div>

    <div class="loop-summary" id="loopSummary">No loop session yet.</div>
    <div class="loop-grid" id="loopGrid"></div>

    <div class="loop-actions">
      <button class="button" id="loopToggleKeeper" disabled>Keep / unkeep selected</button>
      <button class="button primary" id="loopCommitMemory" disabled>Commit explicit keepers → pattern memory</button>
      <button class="button" id="loopSendComposer" disabled>Send selected → Composer</button>
      <button class="button" id="loopExportSession" disabled>Export loop session</button>
      <button class="button" id="loopExportLibrary" disabled>Export updated library</button>
      <button class="button" id="loopExportMemory" disabled>Export memory receipt</button>
    </div>

    <div class="loop-detail">
      <section class="loop-subpanel"><div class="influence-subheading"><strong>Selected descendant</strong><span id="loopSelected">none</span></div><pre id="loopCandidate" class="state-output loop-output"></pre></section>
      <section class="loop-subpanel"><div class="influence-subheading"><strong>Memory contribution</strong><span>explicit commit only</span></div><pre id="loopMemory" class="state-output loop-output"></pre></section>
    </div>
  `;
  workspaceGrid.appendChild(panel);

  const el={
    useGuide:panel.querySelector('#loopUseGuide'),guideInput:panel.querySelector('#loopGuideInput'),loadLibrary:panel.querySelector('#loopLoadLibrary'),libraryInput:panel.querySelector('#loopLibraryInput'),
    seed:panel.querySelector('#loopSeed'),variants:panel.querySelector('#loopVariants'),strength:panel.querySelector('#loopStrength'),lockBase:panel.querySelector('#loopLockBase'),fx:panel.querySelector('#loopFx'),decals:panel.querySelector('#loopDecals'),start:panel.querySelector('#loopStart'),status:panel.querySelector('#loopStatus'),
    summary:panel.querySelector('#loopSummary'),grid:panel.querySelector('#loopGrid'),toggleKeeper:panel.querySelector('#loopToggleKeeper'),commitMemory:panel.querySelector('#loopCommitMemory'),sendComposer:panel.querySelector('#loopSendComposer'),exportSession:panel.querySelector('#loopExportSession'),exportLibrary:panel.querySelector('#loopExportLibrary'),exportMemory:panel.querySelector('#loopExportMemory'),
    selected:panel.querySelector('#loopSelected'),candidate:panel.querySelector('#loopCandidate'),memory:panel.querySelector('#loopMemory')
  };

  function download(name,value) {
    const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function loadImage(path) {
    if (imageCache.has(path)) return imageCache.get(path);
    const promise=new Promise((resolve,reject)=>{ const image=new Image(); image.onload=()=>resolve(image); image.onerror=()=>reject(new Error(`missing runtime asset: ${path}`)); image.src=path; });
    imageCache.set(path,promise); return promise;
  }
  async function renderRecipe(recipe) {
    const plan=composer.compilePlan(recipe,pack);
    const canvas=document.createElement('canvas'); canvas.width=320; canvas.height=320;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.clearRect(0,0,canvas.width,canvas.height);
    const held=[]; let rendered=0;
    for (const layer of plan.layers) {
      if (!layer.visible) continue;
      try {
        const image=await loadImage(layer.resourcePath),s=layer.sourceRect,t=layer.transform;
        const sx=image.naturalWidth/(pack.binaryPack.runtimeDimensions[0]||512), sy=image.naturalHeight/(pack.binaryPack.runtimeDimensions[1]||512);
        const dw=t.width*canvas.width,dh=t.height*canvas.height;
        ctx.save(); ctx.globalAlpha=layer.opacity; ctx.globalCompositeOperation=BLEND[layer.blendMode]||'source-over';
        ctx.translate(t.x*canvas.width,t.y*canvas.height); ctx.rotate(t.rotation*Math.PI/180); ctx.scale(t.mirrorX?-1:1,t.mirrorY?-1:1);
        ctx.drawImage(image,s.x*sx,s.y*sy,s.width*sx,s.height*sy,-dw/2,-dh/2,dw,dh); ctx.restore(); rendered+=1;
      } catch (error) { held.push({layerId:layer.id,assetId:layer.assetId,reason:error.message}); }
    }
    const data=ctx.getImageData(0,0,canvas.width,canvas.height);
    return {canvas,pixels:evolution.summarizePixels(data.data,canvas.width,canvas.height),held,rendered,completed:rendered>0&&held.length===0};
  }
  function selectedCandidate() { return session&&session.evolution.candidates.find((row)=>row.id===selectedCandidateId)||null; }
  function canStart() { el.start.disabled=!(guidedReceipt&&library); }
  function setGuided(receipt,label) {
    const validation=guide.validateReceipt(receipt,pack); if (!validation.ok) throw new Error(validation.reason);
    guidedReceipt=receipt; session=null; memoryReceipt=null; previewById.clear();
    el.status.textContent=label||`guided source ${receipt.id}`; canStart(); renderState();
  }
  function setLibrary(next,label) {
    const validation=patternCore.validateLibrary(next); if (!validation.ok) throw new Error(validation.reason);
    library=next; el.status.textContent=label||`pattern library ${next.id}`; canStart(); renderState();
  }
  function renderState() {
    if (!session) {
      el.summary.textContent=`guided: ${guidedReceipt?guidedReceipt.id:'none'} · library: ${library?library.id:'none'}`;
      el.grid.innerHTML=''; el.toggleKeeper.disabled=true; el.commitMemory.disabled=true; el.sendComposer.disabled=true; el.exportSession.disabled=true; el.exportLibrary.disabled=!memoryReceipt; el.exportMemory.disabled=!memoryReceipt;
      el.selected.textContent='none'; el.candidate.textContent=''; el.memory.textContent=memoryReceipt?JSON.stringify(memoryReceipt,null,2):''; return;
    }
    const summary=loop.loopSummary(session);
    el.summary.textContent=`${summary.variants} descendants · ${summary.rendered} complete renders · ${summary.keepers} explicit keepers · ${summary.state}`;
    el.grid.innerHTML='';
    session.evolution.candidates.forEach((candidate)=>{
      const button=document.createElement('button'); button.type='button';
      button.className=`loop-card${candidate.id===selectedCandidateId?' active':''}${candidate.kept?' kept':''}`;
      const url=previewById.get(candidate.id);
      button.innerHTML=`${url?`<img src="${url}" alt="descendant ${candidate.rank}">`:'<div class="loop-placeholder">no pixel preview</div>'}<div class="loop-card-head"><strong>#${candidate.rank}</strong><span>${candidate.technicalScore}</span></div><small>${candidate.recipe.layers.length} layers · ${candidate.kept?'KEEPER':'proposal'}</small>`;
      button.addEventListener('click',()=>{selectedCandidateId=candidate.id;renderState();}); el.grid.appendChild(button);
    });
    const candidate=selectedCandidate();
    el.toggleKeeper.disabled=!candidate || Boolean(memoryReceipt); el.commitMemory.disabled=summary.keepers===0 || Boolean(memoryReceipt); el.sendComposer.disabled=!candidate; el.exportSession.disabled=false;
    el.exportLibrary.disabled=!memoryReceipt; el.exportMemory.disabled=!memoryReceipt;
    if (candidate) {
      el.selected.textContent=`#${candidate.rank} · ${candidate.kept?'KEEPER':'proposal'} · score ${candidate.technicalScore}`;
      el.candidate.textContent=JSON.stringify({id:candidate.id,rank:candidate.rank,kept:candidate.kept,technicalScore:candidate.technicalScore,render:candidate.render,lineage:candidate.lineage,mutationReceipt:candidate.mutationReceipt,recipeFingerprint:candidate.recipeFingerprint},null,2);
    } else { el.selected.textContent='none'; el.candidate.textContent=''; }
    el.memory.textContent=memoryReceipt?JSON.stringify({id:memoryReceipt.id,keeperCount:memoryReceipt.keeperCount,previousLibraryId:memoryReceipt.previousLibraryId,updatedLibraryId:memoryReceipt.updatedLibraryId,patternDeltas:memoryReceipt.patternDeltas,truthBoundary:memoryReceipt.truthBoundary},null,2):'';
  }

  async function startLoop() {
    if (!guidedReceipt || !library) return;
    el.start.disabled=true; el.status.textContent='spawning deterministic descendants…';
    try {
      session=loop.createLoopSession(guidedReceipt,pack,el.seed.value,{strength:el.strength.value,variants:Number(el.variants.value),lockBase:el.lockBase.checked,allowFx:el.fx.checked,allowDecals:el.decals.checked,allowLayerCountChange:true,maxExtraLayers:8});
      memoryReceipt=null; previewById.clear(); selectedCandidateId=session.evolution.candidates[0]&&session.evolution.candidates[0].id||null;
      for (let i=0;i<session.evolution.candidates.length;i+=1) {
        const row=session.evolution.candidates[i]; el.status.textContent=`rendering descendant ${i+1}/${session.evolution.candidates.length}…`;
        const result=await renderRecipe(row.recipe); loop.attachRenderObservation(session,row.id,result.pixels,result.held.length,result.completed); previewById.set(row.id,result.canvas.toDataURL('image/png'));
      }
      selectedCandidateId=session.evolution.candidates[0]&&session.evolution.candidates[0].id||null;
      el.status.textContent='descendants evaluated — keeper decisions remain explicit'; renderState();
    } catch (error) { el.status.textContent=`loop failed: ${error.message}`; }
    finally { canStart(); }
  }

  el.useGuide.addEventListener('click',()=>{
    try {
      const bridge=window.AXMPremadeGuideBridge; if (!bridge||typeof bridge.getReceipt!=='function') throw new Error('no current v0.16 guided receipt');
      const receipt=bridge.getReceipt(); if (!receipt) throw new Error('generate a v0.16 guided recipe first');
      setGuided(receipt,'using current v0.16 guided receipt');
      if (!library&&typeof bridge.getLibrary==='function'&&bridge.getLibrary()) setLibrary(bridge.getLibrary(),'using current v0.16 pattern library');
    } catch (error) { el.status.textContent=`guide intake failed: ${error.message}`; }
  });
  el.guideInput.addEventListener('change',async()=>{ const file=el.guideInput.files&&el.guideInput.files[0]; if (!file) return; try{setGuided(JSON.parse(await file.text()),`loaded ${file.name}`);}catch(error){el.status.textContent=`guided import failed: ${error.message}`;} el.guideInput.value=''; });
  el.libraryInput.addEventListener('change',async()=>{ const file=el.libraryInput.files&&el.libraryInput.files[0]; if (!file) return; try{setLibrary(JSON.parse(await file.text()),`loaded ${file.name}`);}catch(error){el.status.textContent=`library import failed: ${error.message}`;} el.libraryInput.value=''; });
  el.loadLibrary.addEventListener('click',()=>{ try{const raw=localStorage.getItem(localPatternKey); if(!raw) throw new Error('no saved pattern library'); setLibrary(JSON.parse(raw),'loaded explicitly saved pattern library');}catch(error){el.status.textContent=`library load failed: ${error.message}`;} });
  el.start.addEventListener('click',startLoop);
  el.toggleKeeper.addEventListener('click',()=>{ const row=selectedCandidate(); if(!row||memoryReceipt) return; loop.decideKeeper(session,row.id,!row.kept,'browser-explicit-keeper-button'); el.status.textContent=row.kept?'keeper selected explicitly':'keeper removed explicitly'; renderState(); });
  el.commitMemory.addEventListener('click',()=>{
    if (!session||!library||memoryReceipt) return;
    try {
      memoryReceipt=loop.commitKeepersToMemory(session,library,pack,`${session.id} keepers`);
      library=memoryReceipt.updatedLibrary;
      localStorage.setItem(localPatternKey,JSON.stringify(library));
      window.dispatchEvent(new CustomEvent('axm-premade-pattern-library-updated',{detail:{library:loop.clone(library),source:'v0.17-closed-loop',memoryReceipt:loop.clone(memoryReceipt)}}));
      el.status.textContent=`memory committed explicitly: ${memoryReceipt.keeperCount} keeper(s) → ${library.id}`; renderState();
    } catch (error) { el.status.textContent=`memory commit failed: ${error.message}`; }
  });
  el.sendComposer.addEventListener('click',()=>{ const row=selectedCandidate(); if(!row) return; if(window.AXMPremadeComposerBridge&&typeof window.AXMPremadeComposerBridge.loadRecipe==='function') window.AXMPremadeComposerBridge.loadRecipe(composer.clone(row.recipe),{source:'v0.17-closed-loop',loopSessionId:session.id,candidateId:row.id}); else window.dispatchEvent(new CustomEvent('axm-premade-load-recipe',{detail:{recipe:composer.clone(row.recipe),source:'v0.17-closed-loop'}})); el.status.textContent=`sent descendant ${row.recipeFingerprint} to composer`; });
  el.exportSession.addEventListener('click',()=>session&&download(`${session.id}.json`,session));
  el.exportLibrary.addEventListener('click',()=>memoryReceipt&&download(`${library.id}.json`,library));
  el.exportMemory.addEventListener('click',()=>memoryReceipt&&download(`${memoryReceipt.id}.json`,memoryReceipt));

  window.AXMPremadeLoopBridge={getSession:()=>loop.clone(session),getUpdatedLibrary:()=>loop.clone(library),getMemoryReceipt:()=>loop.clone(memoryReceipt)};
  canStart(); renderState();
})();