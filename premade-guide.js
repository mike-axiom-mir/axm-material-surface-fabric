(function () {
  'use strict';

  const guide=window.AXMPremadeGuideCore;
  const patternCore=window.AXMPremadePatternCore;
  const composer=window.AXMPremadeComposerCore;
  const pack=window.AXMPremadePack;
  if (!guide || !patternCore || !composer || !pack) throw new Error('Pattern-Guided Creation requires guide, pattern, composer, and premade pack cores.');
  const workspaceGrid=document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  let library=null;
  let receipt=null;
  let renderEvidence=null;
  const imageCache=new Map();
  const localPatternKey='axm-premade-pattern-library-v0.15.0';

  const panel=document.createElement('section');
  panel.className='panel premade-guide-panel';
  panel.innerHTML=`
    <div class="panel-heading">
      <div><div class="panel-kicker">17</div><h2>Pattern-Guided Creation</h2></div>
      <span class="count-pill">v0.16</span>
    </div>
    <div class="truth-note">Combine one remembered pattern as the structural anchor with motifs from other explicit keeper-derived patterns. Donor “fit” is only deterministic category novelty/overlap; it is not beauty, taste, semantic intent, or physical-material truth.</div>

    <div class="guide-toolbar">
      <label class="button primary" for="guideLibraryInput">Import v0.15 pattern library</label>
      <input id="guideLibraryInput" type="file" accept="application/json,.json" hidden />
      <button class="button" id="guideLoadLocal">Load saved v0.15 library</button>
      <label>Seed<input id="guideSeed" value="guided-001" /></label>
      <label>Max layers<input id="guideMaxLayers" type="number" min="2" max="12" value="8" /></label>
      <label>Anchor extras<input id="guideAnchorExtras" type="number" min="0" max="8" value="2" /></label>
      <label>Auto donors<input id="guideAutoCount" type="number" min="0" max="4" value="2" /></label>
      <label><span>FX</span><input id="guideFx" type="checkbox" checked /></label>
      <label><span>Decals</span><input id="guideDecals" type="checkbox" checked /></label>
      <label><span>Reuse exact sprites</span><input id="guideSprites" type="checkbox" checked /></label>
      <span id="guideStatus">load a pattern library</span>
    </div>

    <div class="guide-layout">
      <section class="guide-subpanel">
        <div class="influence-subheading"><strong>Anchor pattern</strong><span id="guidePatternCount">0</span></div>
        <select id="guideAnchor" size="8"></select>
        <div class="guide-actions">
          <button class="button accent" id="guideAutoDonors" disabled>Choose donors structurally</button>
          <button class="button primary" id="guideGenerate" disabled>Generate guided recipe</button>
        </div>
        <hr />
        <div class="influence-subheading"><strong>Donor motifs</strong><span id="guideDonorCount">0 selected</span></div>
        <div id="guideDonors" class="guide-donor-list"></div>
      </section>

      <section class="guide-subpanel guide-preview-panel">
        <div class="influence-subheading"><strong>Transparent guided preview</strong><span id="guideFingerprint">--------</span></div>
        <div class="premade-canvas-wrap"><canvas id="guideCanvas" width="1024" height="1024"></canvas></div>
        <div class="guide-actions">
          <button class="button" id="guideRender" disabled>Render</button>
          <button class="button accent" id="guideSendComposer" disabled>Send → Composer</button>
          <button class="button" id="guideExportPng" disabled>Export PNG</button>
          <button class="button" id="guideExportReceipt" disabled>Export receipt</button>
        </div>
        <div id="guideRenderStatus" class="premade-status">idle</div>
      </section>

      <section class="guide-subpanel">
        <div class="influence-subheading"><strong>Lineage / evidence</strong><span>proposal only</span></div>
        <div id="guideSummary" class="guide-summary"></div>
        <pre id="guideOutput" class="state-output guide-output"></pre>
      </section>
    </div>
  `;
  workspaceGrid.appendChild(panel);

  const el={
    libraryInput:panel.querySelector('#guideLibraryInput'),loadLocal:panel.querySelector('#guideLoadLocal'),seed:panel.querySelector('#guideSeed'),
    maxLayers:panel.querySelector('#guideMaxLayers'),anchorExtras:panel.querySelector('#guideAnchorExtras'),autoCount:panel.querySelector('#guideAutoCount'),
    fx:panel.querySelector('#guideFx'),decals:panel.querySelector('#guideDecals'),sprites:panel.querySelector('#guideSprites'),status:panel.querySelector('#guideStatus'),
    patternCount:panel.querySelector('#guidePatternCount'),anchor:panel.querySelector('#guideAnchor'),autoDonors:panel.querySelector('#guideAutoDonors'),generate:panel.querySelector('#guideGenerate'),
    donorCount:panel.querySelector('#guideDonorCount'),donors:panel.querySelector('#guideDonors'),canvas:panel.querySelector('#guideCanvas'),fingerprint:panel.querySelector('#guideFingerprint'),
    render:panel.querySelector('#guideRender'),sendComposer:panel.querySelector('#guideSendComposer'),exportPng:panel.querySelector('#guideExportPng'),exportReceipt:panel.querySelector('#guideExportReceipt'),
    renderStatus:panel.querySelector('#guideRenderStatus'),summary:panel.querySelector('#guideSummary'),output:panel.querySelector('#guideOutput')
  };
  const BLEND={normal:'source-over',multiply:'multiply',screen:'screen',overlay:'overlay','soft-light':'soft-light','hard-light':'hard-light',lighter:'lighter',difference:'difference'};

  function escapeHtml(value) { return String(value==null?'':value).replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function download(name,value,type) {
    const blob=value instanceof Blob?value:new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:type||'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function policy() {
    return {
      maxLayers:Number(el.maxLayers.value)||8,anchorExtras:Number(el.anchorExtras.value)||0,autoDonors:Number(el.autoCount.value)||0,
      allowFx:el.fx.checked,allowDecals:el.decals.checked,reuseObservedSprites:el.sprites.checked,preferCategoryNovelty:true
    };
  }
  function patternLabel(pattern) {
    const categories=Array.from(new Set((pattern.slots||[]).slice(1).map((slot)=>slot.category).filter(Boolean))).slice(0,3);
    return `${pattern.id} · support ${pattern.support} · ${categories.join(' + ') || 'base only'}`;
  }
  function selectedAnchorId() { return el.anchor.value || null; }
  function selectedDonorIds() { return Array.from(el.donors.querySelectorAll('input[type="checkbox"]:checked')).map((node)=>node.value); }
  function updateDonorCount() { el.donorCount.textContent=`${selectedDonorIds().length} selected`; }

  function renderLibrary() {
    const patterns=library&&library.patterns||[];
    el.patternCount.textContent=String(patterns.length);
    el.anchor.innerHTML='';
    patterns.forEach((pattern)=>{ const option=document.createElement('option'); option.value=pattern.id; option.textContent=patternLabel(pattern); el.anchor.appendChild(option); });
    if (patterns.length) el.anchor.value=patterns[0].id;
    el.autoDonors.disabled=!patterns.length; el.generate.disabled=!patterns.length;
    renderDonors();
  }
  function renderDonors() {
    el.donors.innerHTML='';
    if (!library || !selectedAnchorId()) { updateDonorCount(); return; }
    const rows=guide.compatibleDonors(library,selectedAnchorId(),policy(),el.seed.value);
    rows.forEach((row)=>{
      const label=document.createElement('label'); label.className='guide-donor-row';
      label.innerHTML=`<input type="checkbox" value="${escapeHtml(row.patternId)}"><span><strong>${escapeHtml(row.patternId)}</strong><small>${row.motifSlots} motifs · support ${row.support} · novel ${row.structuralRelation.categoryNovelty} / overlap ${row.structuralRelation.categoryOverlap}</small><small>${escapeHtml(row.categories.join(' · '))}</small></span>`;
      label.querySelector('input').addEventListener('change',updateDonorCount);
      el.donors.appendChild(label);
    });
    updateDonorCount();
  }
  function setLibrary(next,status) {
    const validation=patternCore.validateLibrary(next); if (!validation.ok) throw new Error(validation.reason);
    library=next; receipt=null; renderEvidence=null;
    el.status.textContent=status||`loaded ${library.patterns.length} patterns`;
    renderLibrary(); clearReceipt();
  }
  function clearReceipt() {
    el.fingerprint.textContent='--------'; el.output.textContent=''; el.summary.innerHTML=''; el.renderStatus.textContent='idle';
    el.render.disabled=true; el.sendComposer.disabled=true; el.exportPng.disabled=true; el.exportReceipt.disabled=true;
    const ctx=el.canvas.getContext('2d'); ctx.clearRect(0,0,el.canvas.width,el.canvas.height);
  }
  function loadImage(path) {
    if (imageCache.has(path)) return imageCache.get(path);
    const promise=new Promise((resolve,reject)=>{ const image=new Image(); image.onload=()=>resolve(image); image.onerror=()=>reject(new Error(`missing runtime asset: ${path}`)); image.src=path; });
    imageCache.set(path,promise); return promise;
  }
  async function renderReceipt() {
    if (!receipt) return null;
    const plan=composer.compilePlan(receipt.recipe,pack);
    const width=plan.canvas.width,height=plan.canvas.height;
    el.canvas.width=width; el.canvas.height=height;
    const ctx=el.canvas.getContext('2d'); ctx.clearRect(0,0,width,height);
    const rendered=[],held=[];
    for (const layer of plan.layers) {
      if (!layer.visible) continue;
      try {
        const image=await loadImage(layer.resourcePath); const s=layer.sourceRect,t=layer.transform; const dw=t.width*width,dh=t.height*height;
        ctx.save(); ctx.globalAlpha=layer.opacity; ctx.globalCompositeOperation=BLEND[layer.blendMode]||'source-over';
        ctx.translate(t.x*width,t.y*height); ctx.rotate(t.rotation*Math.PI/180); ctx.scale(t.mirrorX?-1:1,t.mirrorY?-1:1);
        ctx.drawImage(image,s.x,s.y,s.width,s.height,-dw/2,-dh/2,dw,dh); ctx.restore();
        rendered.push(layer.id);
      } catch (error) { held.push({layerId:layer.id,assetId:layer.assetId,reason:error.message}); }
    }
    renderEvidence={completed:held.length===0,renderedLayers:rendered,heldLayers:held,transparentOutput:true};
    el.renderStatus.textContent=held.length?`rendered ${rendered.length}, HOLD ${held.length}`:`rendered ${rendered.length} layers`;
    el.exportPng.disabled=held.length>0;
    const enriched=Object.assign({},receipt,{browserRenderEvidence:renderEvidence});
    el.output.textContent=JSON.stringify(enriched,null,2);
    return renderEvidence;
  }
  function showReceipt() {
    if (!receipt) return;
    const summary=guide.guideSummary(receipt);
    el.fingerprint.textContent=receipt.recipeFingerprint;
    el.summary.innerHTML=`<div><span>Anchor</span><strong>${escapeHtml(receipt.anchorPatternId)}</strong></div><div><span>Donors</span><strong>${receipt.donorPatternIds.length}</strong></div><div><span>Layers</span><strong>${summary.layers}</strong></div><div><span>Sprites</span><strong>${summary.spriteLayers}</strong></div>`;
    el.output.textContent=JSON.stringify(receipt,null,2);
    el.render.disabled=false; el.sendComposer.disabled=false; el.exportReceipt.disabled=false; el.exportPng.disabled=true;
  }

  el.libraryInput.addEventListener('change',async()=>{
    const file=el.libraryInput.files&&el.libraryInput.files[0]; if (!file) return;
    try { setLibrary(JSON.parse(await file.text()),`loaded ${file.name}`); }
    catch (error) { el.status.textContent=`library import failed: ${error.message}`; }
    el.libraryInput.value='';
  });
  el.loadLocal.addEventListener('click',()=>{
    try { const raw=localStorage.getItem(localPatternKey); if (!raw) throw new Error('no v0.15 pattern library saved locally'); setLibrary(JSON.parse(raw),'loaded saved v0.15 pattern library'); }
    catch (error) { el.status.textContent=`local load failed: ${error.message}`; }
  });
  el.anchor.addEventListener('change',()=>{ receipt=null; renderEvidence=null; renderDonors(); clearReceipt(); });
  [el.fx,el.decals,el.sprites].forEach((node)=>node.addEventListener('change',()=>{ if (library) renderDonors(); }));
  el.seed.addEventListener('change',()=>{ if (library) renderDonors(); });
  el.autoDonors.addEventListener('click',()=>{
    if (!library || !selectedAnchorId()) return;
    const ids=guide.autoSelectDonors(library,selectedAnchorId(),Number(el.autoCount.value)||0,el.seed.value,policy());
    el.donors.querySelectorAll('input[type="checkbox"]').forEach((node)=>{ node.checked=ids.includes(node.value); }); updateDonorCount();
    el.status.textContent=`selected ${ids.length} structural donor pattern(s)`;
  });
  el.generate.addEventListener('click',async()=>{
    if (!library || !selectedAnchorId()) return;
    try {
      let donors=selectedDonorIds();
      if (!donors.length && Number(el.autoCount.value)>0) donors=guide.autoSelectDonors(library,selectedAnchorId(),Number(el.autoCount.value),el.seed.value,policy());
      receipt=guide.composeGuided(library,selectedAnchorId(),donors,pack,el.seed.value,policy()); renderEvidence=null; showReceipt(); await renderReceipt();
      el.status.textContent=`guided ${receipt.anchorPatternId} + ${receipt.donorPatternIds.length} donor(s)`;
    } catch (error) { el.status.textContent=`guide failed: ${error.message}`; }
  });
  el.render.addEventListener('click',renderReceipt);
  el.sendComposer.addEventListener('click',()=>{
    if (!receipt) return;
    if (window.AXMPremadeComposerBridge && typeof window.AXMPremadeComposerBridge.loadRecipe==='function') window.AXMPremadeComposerBridge.loadRecipe(composer.clone(receipt.recipe),{source:'v0.16-pattern-guide',receipt:composer.clone(receipt)});
    else window.dispatchEvent(new CustomEvent('axm-premade-load-recipe',{detail:{recipe:composer.clone(receipt.recipe),source:'v0.16-pattern-guide',receipt:composer.clone(receipt)}}));
    el.status.textContent=`sent ${receipt.recipeFingerprint} to composer`;
  });
  el.exportReceipt.addEventListener('click',()=>receipt&&download(`${receipt.id}.json`,Object.assign({},receipt,{browserRenderEvidence:renderEvidence})));
  el.exportPng.addEventListener('click',async()=>{
    if (!receipt) return; const evidence=await renderReceipt();
    if (!evidence || !evidence.completed) { el.status.textContent='PNG export held because one or more runtime assets are missing'; return; }
    el.canvas.toBlob((blob)=>blob&&download(`${receipt.recipe.id}.png`,blob,'image/png'),'image/png');
  });

  renderLibrary(); clearReceipt();
})();
