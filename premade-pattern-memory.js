(function () {
  'use strict';

  const core=window.AXMPremadePatternCore;
  const composer=window.AXMPremadeComposerCore;
  const pack=window.AXMPremadePack;
  if (!core || !composer || !pack) throw new Error('Recipe Pattern Memory requires pattern/composer cores and premade pack.');
  const workspaceGrid=document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  let sourcePacks=[];
  let library=null;
  let selectedPatternId=null;
  let lastInstance=null;
  const storageKey='axm-premade-pattern-library-v0.15.0';

  const panel=document.createElement('section');
  panel.className='panel premade-pattern-panel';
  panel.innerHTML=`
    <div class="panel-heading">
      <div><div class="panel-kicker">16</div><h2>Recipe Pattern Memory</h2></div>
      <span class="count-pill">v0.15</span>
    </div>
    <div class="truth-note">Learn recurring composition structure only from recipes already explicitly kept by v0.13. “Learning” here is deterministic aggregation/counting, not hidden model training, taste inference, or automatic promotion.</div>

    <div class="pattern-toolbar">
      <label class="button primary" for="patternPackInput">Import keeper packs</label>
      <input id="patternPackInput" type="file" accept="application/json,.json" multiple hidden />
      <button class="button accent" id="patternLearn" disabled>Build pattern library</button>
      <button class="button" id="patternExportLibrary" disabled>Export library</button>
      <button class="button" id="patternSaveLocal" disabled>Save local</button>
      <button class="button" id="patternLoadLocal">Load local</button>
      <span id="patternStatus">no keeper packs loaded</span>
    </div>

    <div class="pattern-layout">
      <section class="pattern-subpanel">
        <div class="influence-subheading"><strong>Observed keeper packs</strong><span id="patternPackCount">0</span></div>
        <div id="patternSourcePacks" class="pattern-source-list"></div>
        <hr />
        <div class="influence-subheading"><strong>Patterns</strong><span id="patternCount">0</span></div>
        <div id="patternList" class="pattern-list"></div>
      </section>

      <section class="pattern-subpanel">
        <div class="influence-subheading"><strong>Selected pattern</strong><span id="patternSelected">none</span></div>
        <div id="patternDetails" class="pattern-details"></div>
        <div class="pattern-instantiator">
          <label>Seed<input id="patternSeed" value="pattern-001" /></label>
          <label><span>Reuse observed exact sprites</span><input id="patternSpriteReuse" type="checkbox" checked /></label>
          <button class="button primary" id="patternInstantiate" disabled>Instantiate pattern</button>
          <button class="button accent" id="patternSendComposer" disabled>Send → Composer</button>
          <button class="button" id="patternExportInstance" disabled>Export instance</button>
        </div>
      </section>

      <section class="pattern-subpanel">
        <div class="influence-subheading"><strong>Instance receipt</strong><span>proposal only</span></div>
        <pre id="patternOutput" class="state-output pattern-output"></pre>
      </section>
    </div>
  `;
  workspaceGrid.appendChild(panel);

  const el={
    packInput:panel.querySelector('#patternPackInput'),learn:panel.querySelector('#patternLearn'),exportLibrary:panel.querySelector('#patternExportLibrary'),
    saveLocal:panel.querySelector('#patternSaveLocal'),loadLocal:panel.querySelector('#patternLoadLocal'),status:panel.querySelector('#patternStatus'),
    packCount:panel.querySelector('#patternPackCount'),sourcePacks:panel.querySelector('#patternSourcePacks'),count:panel.querySelector('#patternCount'),
    list:panel.querySelector('#patternList'),selected:panel.querySelector('#patternSelected'),details:panel.querySelector('#patternDetails'),
    seed:panel.querySelector('#patternSeed'),spriteReuse:panel.querySelector('#patternSpriteReuse'),instantiate:panel.querySelector('#patternInstantiate'),
    sendComposer:panel.querySelector('#patternSendComposer'),exportInstance:panel.querySelector('#patternExportInstance'),output:panel.querySelector('#patternOutput')
  };

  function escapeHtml(value) {
    return String(value==null?'':value).replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function download(name,value) {
    const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function renderSources() {
    el.packCount.textContent=String(sourcePacks.length);
    el.sourcePacks.innerHTML=sourcePacks.length ? sourcePacks.map((source,index)=>`<div class="pattern-source"><strong>${escapeHtml(source.id||`source-${index+1}`)}</strong><span>${source.recipes&&source.recipes.length||0} keepers</span></div>`).join('') : '<div class="pattern-empty">Import one or more v0.13 keeper recipe packs.</div>';
    el.learn.disabled=!sourcePacks.length;
  }
  function selectedPattern() { return library && library.patterns.find((item)=>item.id===selectedPatternId) || null; }
  function renderPatterns() {
    const patterns=library && library.patterns || [];
    el.count.textContent=String(patterns.length);
    el.exportLibrary.disabled=!library; el.saveLocal.disabled=!library;
    el.list.innerHTML=patterns.length ? patterns.map((pattern)=>`<button class="pattern-row${pattern.id===selectedPatternId?' active':''}" data-pattern="${escapeHtml(pattern.id)}"><span><strong>${escapeHtml(pattern.id)}</strong><small>${pattern.slots.length} layers · support ${pattern.support}</small></span><span class="pattern-support">${pattern.support}</span></button>`).join('') : '<div class="pattern-empty">No learned patterns yet.</div>';
    el.list.querySelectorAll('[data-pattern]').forEach((button)=>button.addEventListener('click',()=>{selectedPatternId=button.dataset.pattern;lastInstance=null;renderPatterns();renderDetails();}));
  }
  function renderDetails() {
    const pattern=selectedPattern();
    if (!pattern) {
      el.selected.textContent='none'; el.details.innerHTML='<div class="pattern-empty">Select a pattern.</div>';
      el.instantiate.disabled=true; el.sendComposer.disabled=true; el.exportInstance.disabled=true; el.output.textContent=''; return;
    }
    el.selected.textContent=`support ${pattern.support}`;
    const slots=pattern.slots.map((slot)=>`<div class="pattern-slot"><strong>${slot.order+1}. ${escapeHtml(slot.role)}</strong><span>${escapeHtml(slot.kind)} · ${escapeHtml(slot.category)}</span><small>${escapeHtml(Object.entries(slot.sourceTypeCounts||{}).map(([k,v])=>`${k}:${v}`).join(' · '))}</small></div>`).join('');
    el.details.innerHTML=`<div class="pattern-summary"><div><span>Support</span><strong>${pattern.support}</strong></div><div><span>Sources</span><strong>${pattern.sourcePackIds.length}</strong></div><div><span>Layers</span><strong>${pattern.slots.length}</strong></div><div><span>Score evidence</span><strong>${pattern.technicalScore?`${Math.round(pattern.technicalScore.mean)}`:'n/a'}</strong></div></div><div class="pattern-slots">${slots}</div><p class="pattern-boundary">Support is recurrence among explicit keepers only. It is not a taste or quality vote.</p>`;
    el.instantiate.disabled=false;
    el.sendComposer.disabled=!lastInstance;
    el.exportInstance.disabled=!lastInstance;
    el.output.textContent=lastInstance?JSON.stringify(lastInstance,null,2):'';
  }
  function setLibrary(next,status) {
    const validation=core.validateLibrary(next);
    if (!validation.ok) throw new Error(validation.reason);
    library=next; selectedPatternId=library.patterns[0]&&library.patterns[0].id||null; lastInstance=null;
    el.status.textContent=status || `${library.summary.keeperRecipes} keepers → ${library.patterns.length} patterns`;
    renderPatterns(); renderDetails();
  }

  el.packInput.addEventListener('change',async()=>{
    const files=Array.from(el.packInput.files||[]); if (!files.length) return;
    const accepted=[];
    try {
      for (const file of files) {
        const parsed=JSON.parse(await file.text());
        const validation=core.validateRecipePack(parsed,pack); if (!validation.ok) throw new Error(`${file.name}: ${validation.reason}`);
        accepted.push(parsed);
      }
      sourcePacks=sourcePacks.concat(accepted);
      el.status.textContent=`${accepted.length} keeper pack(s) added`;
      renderSources();
    } catch (error) { el.status.textContent=`import failed: ${error.message}`; }
    el.packInput.value='';
  });
  el.learn.addEventListener('click',()=>{
    try { setLibrary(core.learnPatternLibrary(sourcePacks,pack),`${sourcePacks.length} packs aggregated`); }
    catch (error) { el.status.textContent=`learn failed: ${error.message}`; }
  });
  el.instantiate.addEventListener('click',()=>{
    const pattern=selectedPattern(); if (!pattern || !library) return;
    try {
      lastInstance=core.instantiatePattern(library,pattern.id,pack,el.seed.value,{reuseObservedSprites:el.spriteReuse.checked});
      el.output.textContent=JSON.stringify(lastInstance,null,2); el.sendComposer.disabled=false; el.exportInstance.disabled=false;
      el.status.textContent=`instantiated ${pattern.id} → ${lastInstance.recipeFingerprint}`;
    } catch (error) { el.status.textContent=`instantiate failed: ${error.message}`; }
  });
  el.sendComposer.addEventListener('click',()=>{
    if (!lastInstance) return;
    window.dispatchEvent(new CustomEvent('axm-premade-load-recipe',{detail:{recipe:core.clone(lastInstance.recipe),source:'v0.15-pattern-memory',receipt:core.clone(lastInstance)}}));
    el.status.textContent=`sent ${lastInstance.recipeFingerprint} to composer`;
  });
  el.exportLibrary.addEventListener('click',()=>library&&download(`${library.id}.json`,library));
  el.exportInstance.addEventListener('click',()=>lastInstance&&download(`${lastInstance.id}.json`,lastInstance));
  el.saveLocal.addEventListener('click',()=>{
    if (!library) return;
    localStorage.setItem(storageKey,JSON.stringify(library)); el.status.textContent='pattern library explicitly saved locally';
  });
  el.loadLocal.addEventListener('click',()=>{
    try { const raw=localStorage.getItem(storageKey); if (!raw) throw new Error('no saved pattern library'); setLibrary(JSON.parse(raw),'loaded explicitly saved local pattern library'); }
    catch (error) { el.status.textContent=`load failed: ${error.message}`; }
  });

  renderSources(); renderPatterns(); renderDetails();
})();