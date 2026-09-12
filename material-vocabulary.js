(function () {
  'use strict';

  const vocabulary = window.AXMMaterialVocabularyCore;
  const libraryCore = window.AXMMaterialLibraryCore;
  const influenceCore = window.AXMMaterialInfluenceCore;
  if (!vocabulary || !libraryCore || !influenceCore) throw new Error('Material vocabulary requires vocabulary, library, and influence cores.');

  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  const coverage = vocabulary.coverageSummary();
  const generatedFamilies = new Map();
  const generatedOverlayPacks = new Map();
  let selectedFamilyId = vocabulary.FAMILIES[0] && vocabulary.FAMILIES[0].id;
  let busy = false;

  function nowIso() { return new Date().toISOString(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }
  function yieldEventLoop() { return new Promise((resolve) => setTimeout(resolve, 0)); }

  const panel = document.createElement('section');
  panel.className = 'panel vocabulary-panel';
  panel.innerHTML = `
    <div class="panel-heading vocabulary-heading">
      <div><div class="panel-kicker">10</div><h2>Material Vocabulary Expansion</h2></div>
      <span class="count-pill">v0.7</span>
    </div>
    <div class="truth-note">
      Deterministic synthetic seed vocabulary for breadth, reuse and renderer testing. These maps are locally generated from declared procedural family state; they are not measured scans, PBR certification, artistic-quality claims, or replacements for stronger external material sources.
    </div>

    <div class="vocabulary-stats">
      <span><strong>${coverage.families}</strong> families</span>
      <span><strong>${Object.keys(coverage.categories).length}</strong> categories</span>
      <span><strong>${coverage.familyEntries}</strong> family maps</span>
      <span><strong>${coverage.overlays}</strong> overlays</span>
      <span><strong>${coverage.totalEntries}</strong> reusable entries</span>
    </div>

    <div class="vocabulary-toolbar">
      <label>Resolution
        <select id="vocabularyResolution">
          <option value="64">64</option>
          <option value="128" selected>128</option>
          <option value="256">256</option>
        </select>
      </label>
      <button class="button accent" id="vocabularyGenerate">Generate selected</button>
      <button class="button primary" id="vocabularyInstall">Generate + install selected</button>
      <button class="button" id="vocabularyStage">Stage selected → renderer</button>
      <button class="button" id="vocabularyInstallOverlays">Install overlay pack</button>
      <button class="button" id="vocabularyInstallAll">Generate + install all ${coverage.totalEntries}</button>
      <button class="button" id="vocabularyManifest">Export vocabulary manifest</button>
    </div>

    <div class="vocabulary-layout">
      <section class="vocabulary-browser influence-subpanel">
        <div class="influence-subheading"><strong>Families</strong><span id="vocabularyFilteredCount">${coverage.families}</span></div>
        <div class="vocabulary-filters">
          <input id="vocabularySearch" type="search" placeholder="Filter families…" autocomplete="off" />
          <select id="vocabularyCategory"><option value="">All categories</option></select>
        </div>
        <div id="vocabularyFamilies" class="vocabulary-family-list"></div>
      </section>

      <section class="vocabulary-detail influence-subpanel">
        <div class="influence-subheading"><strong>Selected family</strong><span id="vocabularyFamilyId"></span></div>
        <div id="vocabularyDetail"></div>
        <div id="vocabularyPreviewGrid" class="vocabulary-preview-grid"></div>
      </section>
    </div>

    <section class="vocabulary-overlays influence-subpanel">
      <div class="influence-subheading"><strong>Reusable influence overlays</strong><span>${coverage.overlays}</span></div>
      <div id="vocabularyOverlayList" class="vocabulary-overlay-list"></div>
    </section>

    <section class="vocabulary-coverage influence-subpanel">
      <div class="influence-subheading"><strong>Coverage</strong><span>declared seed breadth</span></div>
      <div id="vocabularyCoverage" class="vocabulary-coverage-grid"></div>
      <pre id="vocabularyOutput" class="state-output vocabulary-output" tabindex="0"></pre>
    </section>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    resolution: panel.querySelector('#vocabularyResolution'),
    generate: panel.querySelector('#vocabularyGenerate'),
    install: panel.querySelector('#vocabularyInstall'),
    stage: panel.querySelector('#vocabularyStage'),
    installOverlays: panel.querySelector('#vocabularyInstallOverlays'),
    installAll: panel.querySelector('#vocabularyInstallAll'),
    manifest: panel.querySelector('#vocabularyManifest'),
    search: panel.querySelector('#vocabularySearch'),
    category: panel.querySelector('#vocabularyCategory'),
    filteredCount: panel.querySelector('#vocabularyFilteredCount'),
    families: panel.querySelector('#vocabularyFamilies'),
    familyId: panel.querySelector('#vocabularyFamilyId'),
    detail: panel.querySelector('#vocabularyDetail'),
    previewGrid: panel.querySelector('#vocabularyPreviewGrid'),
    overlayList: panel.querySelector('#vocabularyOverlayList'),
    coverage: panel.querySelector('#vocabularyCoverage'),
    output: panel.querySelector('#vocabularyOutput')
  };

  function selectedFamily() { return vocabulary.familyById(selectedFamilyId); }
  function resolution() { return Number(el.resolution.value) || 128; }

  function setBusy(value, message) {
    busy = Boolean(value);
    [el.generate, el.install, el.stage, el.installOverlays, el.installAll].forEach((button) => { button.disabled = busy; });
    if (message) el.output.textContent = JSON.stringify({ status: message }, null, 2);
  }

  function categories() {
    return Object.keys(coverage.categories).sort();
  }

  function renderCategoryOptions() {
    el.category.innerHTML = '<option value="">All categories</option>' + categories().map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  }

  function visibleFamilies() {
    const query = el.search.value.trim().toLowerCase();
    const category = el.category.value;
    return vocabulary.FAMILIES.filter((family) => {
      if (category && family.category !== category) return false;
      if (!query) return true;
      return [family.id, family.name, family.category, family.pattern, family.note].join(' ').toLowerCase().includes(query);
    });
  }

  function renderFamilyList() {
    const families = visibleFamilies();
    el.filteredCount.textContent = `${families.length}/${coverage.families}`;
    el.families.innerHTML = families.map((family) => {
      const channels = vocabulary.familyChannels(family);
      const active = family.id === selectedFamilyId ? ' selected' : '';
      return `<button class="vocabulary-family${active}" data-vocabulary-family="${escapeHtml(family.id)}">
        <strong>${escapeHtml(family.name)}</strong>
        <small>${escapeHtml(family.category)} • ${escapeHtml(family.pattern)}</small>
        <span>${channels.length} maps</span>
      </button>`;
    }).join('') || '<div class="inspector-empty">No family matches the current filters.</div>';
  }

  function renderSelected() {
    const family = selectedFamily();
    if (!family) return;
    const channels = vocabulary.familyChannels(family);
    el.familyId.textContent = family.id;
    el.detail.innerHTML = `
      <div class="vocabulary-family-detail">
        <div><span>Category</span><strong>${escapeHtml(family.category)}</strong></div>
        <div><span>Pattern</span><strong>${escapeHtml(family.pattern)}</strong></div>
        <div><span>Scale</span><strong>${family.scale}</strong></div>
        <div><span>Metallic seed</span><strong>${family.metallic.toFixed(2)}</strong></div>
        <div><span>Roughness range</span><strong>${family.roughness.map((value) => value.toFixed(2)).join(' → ')}</strong></div>
        <div><span>Normal strength</span><strong>${family.normalStrength.toFixed(2)}</strong></div>
      </div>
      <div class="vocabulary-palette">${family.palette.map((color) => `<span title="${color}" style="background:${color}"></span>`).join('')}</div>
      <div class="vocabulary-channel-row">${channels.map((channel) => `<span>${escapeHtml(channel)}</span>`).join('')}</div>
      ${family.opacity ? '<div class="vocabulary-extra">Includes explicit opacity map.</div>' : ''}
      ${family.emissive ? `<div class="vocabulary-extra">Includes emissive map • ${escapeHtml(family.emissive.color)}</div>` : ''}
    `;
    const key = `${family.id}@${resolution()}`;
    const generated = generatedFamilies.get(key);
    if (generated) renderGeneratedPreview(generated);
    else el.previewGrid.innerHTML = '<div class="inspector-empty">Generate this family to inspect its actual locally produced map set.</div>';
  }

  function renderOverlayList() {
    el.overlayList.innerHTML = vocabulary.OVERLAYS.map((overlay) => `
      <article class="vocabulary-overlay">
        <span class="vocabulary-overlay-swatch" style="background:${escapeHtml(overlay.color)}"></span>
        <div><strong>${escapeHtml(overlay.name)}</strong><small>${escapeHtml(overlay.channel)} • ${escapeHtml(overlay.pattern)}</small></div>
      </article>
    `).join('');
  }

  function renderCoverage() {
    const categoryRows = Object.entries(coverage.categories).sort((a, b) => a[0].localeCompare(b[0]));
    const channelRows = Object.entries(coverage.channels).sort((a, b) => a[0].localeCompare(b[0]));
    el.coverage.innerHTML = `
      <div><strong>Categories</strong>${categoryRows.map(([name, row]) => `<span>${escapeHtml(name)} <b>${row.families}</b> families • <b>${row.entries}</b> maps</span>`).join('')}</div>
      <div><strong>Channels</strong>${channelRows.map(([name, count]) => `<span>${escapeHtml(name)} <b>${count}</b></span>`).join('')}</div>
    `;
  }

  function newCanvas(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }

  function makeImageData(size, sample) {
    const data = new Uint8ClampedArray(size * size * 4);
    const step = 1 / size;
    let offset = 0;
    for (let y = 0; y < size; y += 1) {
      const v = (y + 0.5) / size;
      for (let x = 0; x < size; x += 1) {
        const u = (x + 0.5) / size;
        const rgba = sample(u, v, step);
        data[offset] = rgba[0];
        data[offset + 1] = rgba[1];
        data[offset + 2] = rgba[2];
        data[offset + 3] = rgba[3];
        offset += 4;
      }
    }
    return new ImageData(data, size, size);
  }

  function canvasDataUrl(size, sample) {
    const canvas = newCanvas(size);
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.putImageData(makeImageData(size, sample), 0, 0);
    return canvas.toDataURL('image/png');
  }

  async function generateFamily(family, size) {
    const key = `${family.id}@${size}`;
    if (generatedFamilies.has(key)) return generatedFamilies.get(key);
    const channels = vocabulary.familyChannels(family);
    const entries = [];
    for (let index = 0; index < channels.length; index += 1) {
      const channel = channels[index];
      const dataUrl = canvasDataUrl(size, (u, v, step) => vocabulary.sampleFamilyChannel(family, channel, u, v, step));
      entries.push(vocabulary.makeFamilyEntry(family, channel, dataUrl, size));
      if (index % 2 === 1) await yieldEventLoop();
    }
    const familyRecord = vocabulary.makeFamilyRecord(family, entries.map((entry) => entry.libraryId), nowIso());
    const result = { family, size, entries, familyRecord };
    generatedFamilies.set(key, result);
    return result;
  }

  async function generateOverlays(size) {
    const key = String(size);
    if (generatedOverlayPacks.has(key)) return generatedOverlayPacks.get(key);
    const entries = [];
    for (let index = 0; index < vocabulary.OVERLAYS.length; index += 1) {
      const overlay = vocabulary.OVERLAYS[index];
      const dataUrl = canvasDataUrl(size, (u, v) => vocabulary.sampleOverlay(overlay, u, v));
      entries.push(vocabulary.makeOverlayEntry(overlay, dataUrl, size));
      if (index % 3 === 2) await yieldEventLoop();
    }
    generatedOverlayPacks.set(key, entries);
    return entries;
  }

  function renderGeneratedPreview(generated) {
    el.previewGrid.innerHTML = generated.entries.map((entry) => `
      <figure>
        <div class="checker"><img src="${entry.dataUrl}" alt="" /></div>
        <figcaption>${escapeHtml(entry.usage.channelHint)}</figcaption>
      </figure>
    `).join('');
  }

  function openLibraryDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('axm-material-library-v4', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('libraries')) db.createObjectStore('libraries');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readLibrary() {
    const db = await openLibraryDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction('libraries', 'readonly');
      const request = tx.objectStore('libraries').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (value && libraryCore.validateLibrary(value).ok) return value;
    return libraryCore.createLibrary(nowIso());
  }

  async function writeLibrary(library) {
    const db = await openLibraryDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('libraries', 'readwrite');
      tx.objectStore('libraries').put(library, 'current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    const reload = document.getElementById('libraryLoad');
    if (reload) reload.click();
  }

  async function installGeneratedFamily(generated, library) {
    const target = library || await readLibrary();
    const stamp = nowIso();
    const receipt = libraryCore.upsertEntries(target, generated.entries, stamp);
    libraryCore.createFamily(target, generated.familyRecord, stamp);
    if (!library) await writeLibrary(target);
    return { receipt, familyId: generated.familyRecord.id, library: target };
  }

  async function installOverlayEntries(entries, library) {
    const target = library || await readLibrary();
    const receipt = libraryCore.upsertEntries(target, entries, nowIso());
    if (!library) await writeLibrary(target);
    return { receipt, library: target };
  }

  function openInfluenceDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('axm-material-influence-v5', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function stageFamily(generated) {
    const workspace = influenceCore.createWorkspace(nowIso());
    const recipe = influenceCore.activeRecipe(workspace);
    recipe.name = `${generated.family.name} — v0.7 seed`;
    recipe.familyIds = [generated.familyRecord.id];
    recipe.notes = 'Staged from the deterministic v0.7 material vocabulary. Channel routing is declared seed state, not physical-material certification.';
    generated.entries.forEach((entry) => {
      influenceCore.addLayer(recipe, {
        entryId: entry.libraryId,
        targetChannel: entry.usage.channelHint,
        blendMode: 'normal',
        opacity: 1,
        visible: true,
        role: 'v0.7-vocabulary-channel'
      }, nowIso());
    });
    workspace.librarySnapshot = {
      entries: generated.entries.map((entry) => libraryCore.normalizeEntry(entry, nowIso())),
      families: [clone(generated.familyRecord)],
      observedAt: nowIso(),
      source: 'v0.7-material-vocabulary-staging'
    };
    workspace.updatedAt = nowIso();
    const validation = influenceCore.validateWorkspace(workspace);
    if (!validation.ok) throw new Error(validation.reason);

    const db = await openInfluenceDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite');
      tx.objectStore('workspaces').put(workspace, 'current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    const rendererLoad = document.getElementById('rendererLoadSaved');
    if (rendererLoad) rendererLoad.click();
    return workspace;
  }

  function download(name, value) {
    const blob = new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function generateSelected() {
    const family = selectedFamily();
    if (!family) return;
    setBusy(true, `Generating ${family.name} at ${resolution()}×${resolution()}…`);
    try {
      const generated = await generateFamily(family, resolution());
      renderGeneratedPreview(generated);
      el.output.textContent = JSON.stringify({
        generated: family.id,
        resolution: generated.size,
        entries: generated.entries.map((entry) => ({ id: entry.libraryId, channel: entry.usage.channelHint, payloadChars: entry.dataUrl.length })),
        truthBoundary: 'Generated bytes are deterministic synthetic seed maps. No physical/PBR quality claim is made.'
      }, null, 2);
    } finally { setBusy(false); }
  }

  async function installSelected() {
    const family = selectedFamily();
    if (!family) return;
    setBusy(true, `Generating and installing ${family.name}…`);
    try {
      const generated = await generateFamily(family, resolution());
      const installed = await installGeneratedFamily(generated);
      renderGeneratedPreview(generated);
      el.output.textContent = JSON.stringify({
        installed: family.id,
        familyId: installed.familyId,
        resolution: generated.size,
        added: installed.receipt.added.length,
        updated: installed.receipt.updated.length,
        libraryEntries: installed.receipt.total,
        next: 'The family is now in the persistent v0.4 material library and can be staged into v0.5/v0.6.'
      }, null, 2);
    } finally { setBusy(false); }
  }

  async function stageSelected() {
    const family = selectedFamily();
    if (!family) return;
    setBusy(true, `Staging ${family.name} into the influence/render path…`);
    try {
      const generated = await generateFamily(family, resolution());
      await installGeneratedFamily(generated);
      const workspace = await stageFamily(generated);
      el.output.textContent = JSON.stringify({
        staged: family.id,
        workspaceId: workspace.id,
        recipeId: workspace.activeRecipeId,
        channels: generated.entries.map((entry) => entry.usage.channelHint),
        rendererLoaded: Boolean(document.getElementById('rendererLoadSaved')),
        next: 'Use Render material / Cross-light sweep in the v0.6 renderer to observe the family under real WebGL channel interpretation.'
      }, null, 2);
    } finally { setBusy(false); }
  }

  async function installOverlays() {
    setBusy(true, `Generating ${coverage.overlays} reusable overlays…`);
    try {
      const entries = await generateOverlays(resolution());
      const installed = await installOverlayEntries(entries);
      el.output.textContent = JSON.stringify({
        overlayPackInstalled: true,
        resolution: resolution(),
        entries: entries.length,
        added: installed.receipt.added.length,
        updated: installed.receipt.updated.length,
        libraryEntries: installed.receipt.total,
        channels: [...new Set(entries.map((entry) => entry.usage.channelHint))].sort()
      }, null, 2);
    } finally { setBusy(false); }
  }

  async function installAll() {
    if (!window.confirm(`Generate and install the complete v0.7 seed vocabulary (${coverage.totalEntries} entries) at ${resolution()}×${resolution()}? This is explicit local generation and may take a while.`)) return;
    setBusy(true, 'Starting complete vocabulary generation…');
    try {
      const library = await readLibrary();
      const familyReceipts = [];
      for (let index = 0; index < vocabulary.FAMILIES.length; index += 1) {
        const family = vocabulary.FAMILIES[index];
        el.output.textContent = JSON.stringify({
          status: 'generating-complete-vocabulary',
          family: `${index + 1}/${coverage.families}`,
          current: family.name,
          resolution: resolution()
        }, null, 2);
        const generated = await generateFamily(family, resolution());
        const installed = await installGeneratedFamily(generated, library);
        familyReceipts.push({ family: family.id, added: installed.receipt.added.length, updated: installed.receipt.updated.length });
        await yieldEventLoop();
      }
      const overlays = await generateOverlays(resolution());
      const overlayReceipt = await installOverlayEntries(overlays, library);
      await writeLibrary(library);
      el.output.textContent = JSON.stringify({
        completeVocabularyInstalled: true,
        resolution: resolution(),
        families: familyReceipts.length,
        overlays: overlays.length,
        expectedReusableEntries: coverage.totalEntries,
        libraryEntries: library.entries.length,
        overlayAdded: overlayReceipt.receipt.added.length,
        truthBoundary: 'This establishes deterministic breadth and portable bytes, not visual superiority or PBR certification. Use v0.6 cross-light rendering to evaluate actual output.'
      }, null, 2);
    } finally { setBusy(false); }
  }

  el.families.addEventListener('click', (event) => {
    const button = event.target.closest('[data-vocabulary-family]');
    if (!button || busy) return;
    selectedFamilyId = button.dataset.vocabularyFamily;
    renderFamilyList();
    renderSelected();
  });
  el.search.addEventListener('input', renderFamilyList);
  el.category.addEventListener('change', renderFamilyList);
  el.resolution.addEventListener('change', renderSelected);
  el.generate.addEventListener('click', () => generateSelected().catch(reportError));
  el.install.addEventListener('click', () => installSelected().catch(reportError));
  el.stage.addEventListener('click', () => stageSelected().catch(reportError));
  el.installOverlays.addEventListener('click', () => installOverlays().catch(reportError));
  el.installAll.addEventListener('click', () => installAll().catch(reportError));
  el.manifest.addEventListener('click', () => download('axm-material-vocabulary-v0.7-manifest.json', vocabulary.manifest()));

  function reportError(error) {
    setBusy(false);
    el.output.textContent = JSON.stringify({ error: error && error.message ? error.message : String(error) }, null, 2);
  }

  renderCategoryOptions();
  renderFamilyList();
  renderSelected();
  renderOverlayList();
  renderCoverage();
  el.output.textContent = JSON.stringify({
    message: 'v0.7 material vocabulary ready. Generate one family for inspection, install selected families explicitly, or install the complete deterministic seed vocabulary. Stronger external visual sources remain welcome and additive.',
    coverage,
    truthBoundary: vocabulary.manifest().truthBoundary
  }, null, 2);
})();
