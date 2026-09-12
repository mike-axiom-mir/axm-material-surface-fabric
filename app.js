(function () {
  'use strict';

  const core = window.AXMStateCore;
  if (!core) throw new Error('AXMStateCore is required before app.js');

  let state = core.createInitialState();
  let imageCache = new Map();
  let toastTimer = null;
  let lastDiff = [];

  const el = {};
  [
    'assetInput','stateInput','seedDemoButton','captureButton','exportPngButton','exportStateButton',
    'saveLocalButton','loadLocalButton','resetButton','dropZone','librarySearch','assetGrid','assetCount',
    'surfaceCanvas','canvasWrap','emptyStage','workspaceSizeLabel','stateHashLabel','workspaceName',
    'workspaceWidth','workspaceHeight','exportBackground','previewBackground','layerList','layerCount',
    'layerInspector','stateOutput','copyStateButton','toast'
  ].forEach((id) => { el[id] = document.getElementById(id); });

  const ctx = el.surfaceCanvas.getContext('2d', { alpha: true });
  const blendModes = [
    ['source-over','Normal'],['multiply','Multiply'],['screen','Screen'],['overlay','Overlay'],
    ['soft-light','Soft light'],['hard-light','Hard light'],['lighten','Lighten'],['darken','Darken'],
    ['color-dodge','Color dodge'],['color-burn','Color burn'],['difference','Difference']
  ];

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2400);
  }

  function mutate(type, detail, fn) {
    fn();
    core.recordEvent(state, type, detail);
    renderAll();
  }

  function getAsset(id) {
    return state.assets.find((asset) => asset.id === id) || null;
  }

  function getLayer(id) {
    return state.layers.find((layer) => layer.id === id) || null;
  }

  function selectedLayer() {
    return getLayer(state.selection.layerId);
  }

  function classifyName(name) {
    const n = String(name || '').toLowerCase();
    if (/normal|nrm/.test(n)) return 'normal-map';
    if (/rough/.test(n)) return 'roughness';
    if (/metal|metallic/.test(n)) return 'metallic';
    if (/height|disp/.test(n)) return 'height';
    if (/ao|ambient/.test(n)) return 'ao';
    if (/mask/.test(n)) return 'mask';
    if (/decal|label|sign/.test(n)) return 'decal';
    if (/scratch|grime|wear|dirt|rust|overlay/.test(n)) return 'overlay';
    return 'texture';
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('File read failed'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image could not be decoded'));
      image.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }

  async function importFiles(files) {
    const imageFiles = [...files].filter((file) => /^image\/(png|jpeg|webp)$/i.test(file.type));
    if (!imageFiles.length) {
      toast('No supported images found.');
      return;
    }

    for (const file of imageFiles) {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(dataUrl);
      state.assets.push({
        id: core.uid('asset'),
        name: file.name,
        kind: classifyName(file.name),
        mime: file.type,
        width: image.naturalWidth,
        height: image.naturalHeight,
        bytes: file.size,
        addedAt: core.nowIso(),
        source: {
          method: 'local-file',
          originalName: file.name,
          originalBytes: file.size
        },
        dataUrl
      });
    }
    core.recordEvent(state, 'assets.imported', { count: imageFiles.length, names: imageFiles.map((file) => file.name) });
    renderAll();
    toast(`Imported ${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'}.`);
  }

  function xorshift(seed) {
    let x = seed >>> 0 || 1;
    return function () {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  }

  function makeProceduralBase(seed) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    const rand = xorshift(seed);
    g.fillStyle = '#9f4435';
    g.fillRect(0, 0, 512, 512);

    const grad = g.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, 'rgba(255,170,120,.13)');
    grad.addColorStop(.45, 'rgba(0,0,0,.03)');
    grad.addColorStop(1, 'rgba(0,0,0,.24)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 1250; i += 1) {
      const x = rand() * 512;
      const y = rand() * 512;
      const r = 0.35 + rand() * 2.6;
      const light = rand() > 0.84;
      g.fillStyle = light ? `rgba(255,210,180,${0.02 + rand() * 0.09})` : `rgba(30,18,15,${0.025 + rand() * 0.1})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    for (let i = 0; i < 50; i += 1) {
      const x = rand() * 512;
      const y = rand() * 512;
      const len = 6 + rand() * 70;
      const angle = rand() * Math.PI * 2;
      g.strokeStyle = `rgba(35,24,21,${0.06 + rand() * 0.15})`;
      g.lineWidth = 0.5 + rand() * 1.7;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      g.stroke();
    }
    return c.toDataURL('image/png');
  }

  function makeProceduralOverlay(seed) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    const rand = xorshift(seed);

    for (let i = 0; i < 170; i += 1) {
      const x = rand() * 512;
      const y = rand() * 512;
      const len = 4 + rand() * 95;
      const angle = (rand() - 0.5) * 0.9;
      g.strokeStyle = rand() > 0.45 ? `rgba(220,225,220,${0.08 + rand() * 0.34})` : `rgba(20,18,17,${0.08 + rand() * 0.25})`;
      g.lineWidth = 0.4 + rand() * 2.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      g.stroke();
    }

    for (let i = 0; i < 90; i += 1) {
      const x = rand() * 512;
      const y = rand() * 512;
      const r = 1 + rand() * 9;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(46,30,17,${0.08 + rand() * 0.16})`);
      grd.addColorStop(1, 'rgba(46,30,17,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return c.toDataURL('image/png');
  }

  async function seedDemo() {
    if (state.assets.some((asset) => asset.source && asset.source.method === 'procedural-seed')) {
      toast('Demo already exists in this workspace.');
      return;
    }
    const baseSeed = 104729;
    const overlaySeed = 130363;
    const baseUrl = makeProceduralBase(baseSeed);
    const overlayUrl = makeProceduralOverlay(overlaySeed);
    const now = core.nowIso();
    const base = {
      id: core.uid('asset'), name: 'procedural-painted-metal.png', kind: 'texture', mime: 'image/png',
      width: 512, height: 512, bytes: null, addedAt: now,
      source: { method: 'procedural-seed', seed: baseSeed, generator: 'painted-metal-v0.1' }, dataUrl: baseUrl
    };
    const overlay = {
      id: core.uid('asset'), name: 'procedural-wear-overlay.png', kind: 'overlay', mime: 'image/png',
      width: 512, height: 512, bytes: null, addedAt: now,
      source: { method: 'procedural-seed', seed: overlaySeed, generator: 'wear-overlay-v0.1' }, dataUrl: overlayUrl
    };
    state.assets.push(base, overlay);
    state.layers.push(makeLayer(base, 'source-over'), makeLayer(overlay, 'screen'));
    state.selection.layerId = state.layers[state.layers.length - 1].id;
    state.selection.assetId = overlay.id;
    core.recordEvent(state, 'demo.seeded', { seeds: [baseSeed, overlaySeed], assets: [base.id, overlay.id] });
    renderAll();
    toast('Seeded two self-made deterministic demo assets.');
  }

  function makeLayer(asset, blendMode) {
    const fit = Math.min(state.workspace.width / asset.width, state.workspace.height / asset.height) * 0.84;
    return {
      id: core.uid('layer'),
      assetId: asset.id,
      name: asset.name,
      visible: true,
      opacity: 1,
      blendMode: blendMode || 'source-over',
      x: state.workspace.width / 2,
      y: state.workspace.height / 2,
      scale: fit,
      rotationDeg: 0,
      addedAt: core.nowIso()
    };
  }

  function addAssetToLayers(assetId) {
    const asset = getAsset(assetId);
    if (!asset) return;
    mutate('layer.added', { assetId }, () => {
      const layer = makeLayer(asset, asset.kind === 'overlay' ? 'screen' : 'source-over');
      state.layers.push(layer);
      state.selection.assetId = assetId;
      state.selection.layerId = layer.id;
    });
  }

  async function drawCanvas() {
    const { width, height, exportBackground: bake, previewBackground } = state.workspace;
    if (el.surfaceCanvas.width !== width) el.surfaceCanvas.width = width;
    if (el.surfaceCanvas.height !== height) el.surfaceCanvas.height = height;
    ctx.clearRect(0, 0, width, height);
    if (bake) {
      ctx.fillStyle = previewBackground;
      ctx.fillRect(0, 0, width, height);
    }

    for (const layer of state.layers) {
      if (!layer.visible) continue;
      const asset = getAsset(layer.assetId);
      if (!asset || !asset.dataUrl) continue;
      try {
        const image = await loadImage(asset.dataUrl);
        ctx.save();
        ctx.globalAlpha = Number(layer.opacity);
        ctx.globalCompositeOperation = layer.blendMode || 'source-over';
        ctx.translate(Number(layer.x), Number(layer.y));
        ctx.rotate(Number(layer.rotationDeg) * Math.PI / 180);
        const w = image.naturalWidth * Number(layer.scale);
        const h = image.naturalHeight * Number(layer.scale);
        ctx.drawImage(image, -w / 2, -h / 2, w, h);
        ctx.restore();
      } catch (error) {
        console.error(error);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function renderAssets() {
    const query = String(state.ui.librarySearch || '').trim().toLowerCase();
    const assets = state.assets.filter((asset) => !query || asset.name.toLowerCase().includes(query) || asset.kind.includes(query));
    el.assetGrid.innerHTML = assets.map((asset) => `
      <article class="asset-card ${state.selection.assetId === asset.id ? 'selected' : ''}" data-asset-card="${asset.id}">
        <img class="asset-preview" src="${asset.dataUrl}" alt="" />
        <div class="asset-body">
          <div class="asset-name" title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</div>
          <div class="asset-meta">${escapeHtml(asset.kind)} • ${asset.width}×${asset.height}</div>
          <div class="asset-actions">
            <button class="mini-button" data-use-asset="${asset.id}">Use</button>
            <button class="mini-button" data-remove-asset="${asset.id}">×</button>
          </div>
        </div>
      </article>`).join('');
    el.assetCount.textContent = state.assets.length;
  }

  function renderLayers() {
    const rows = [...state.layers].reverse().map((layer) => {
      const asset = getAsset(layer.assetId);
      return `
        <div class="layer-row ${state.selection.layerId === layer.id ? 'selected' : ''}" data-layer-row="${layer.id}">
          <button class="icon-button mini-button" data-toggle-layer="${layer.id}" title="toggle visibility">${layer.visible ? '◉' : '○'}</button>
          <img class="layer-thumb" src="${asset ? asset.dataUrl : ''}" alt="" />
          <div class="layer-title">
            <strong>${escapeHtml(layer.name)}</strong>
            <span>${escapeHtml(layer.blendMode)} • ${Math.round(layer.opacity * 100)}%</span>
          </div>
          <div class="layer-tools">
            <button class="icon-button mini-button" data-layer-up="${layer.id}" title="move up">↑</button>
            <button class="icon-button mini-button" data-layer-down="${layer.id}" title="move down">↓</button>
            <button class="icon-button mini-button" data-remove-layer="${layer.id}" title="remove">×</button>
          </div>
        </div>`;
    }).join('');
    el.layerList.innerHTML = rows || '<div class="inspector-empty">No composition layers yet.</div>';
    el.layerCount.textContent = state.layers.length;
  }

  function renderInspector() {
    const layer = selectedLayer();
    if (!layer) {
      el.layerInspector.innerHTML = '<div class="inspector-empty">Select a layer to inspect the exact parameters driving its render.</div>';
      return;
    }
    const asset = getAsset(layer.assetId);
    const blendOptions = blendModes.map(([value, label]) => `<option value="${value}" ${layer.blendMode === value ? 'selected' : ''}>${label}</option>`).join('');
    el.layerInspector.innerHTML = `
      <div class="control-grid">
        <div class="control full"><label>Layer name<input data-layer-field="name" value="${escapeAttr(layer.name)}" /></label></div>
        <div class="control full"><label>Blend mode<select data-layer-field="blendMode">${blendOptions}</select></label></div>
        <div class="control full"><label>Opacity<div class="range-row"><input data-layer-field="opacity" type="range" min="0" max="1" step="0.01" value="${layer.opacity}" /><input data-layer-field="opacity" type="number" min="0" max="1" step="0.01" value="${layer.opacity}" /></div></label></div>
        <div class="control"><label>X<input data-layer-field="x" type="number" step="1" value="${round(layer.x, 2)}" /></label></div>
        <div class="control"><label>Y<input data-layer-field="y" type="number" step="1" value="${round(layer.y, 2)}" /></label></div>
        <div class="control"><label>Scale<input data-layer-field="scale" type="number" min="0.01" max="20" step="0.01" value="${round(layer.scale, 4)}" /></label></div>
        <div class="control"><label>Rotation °<input data-layer-field="rotationDeg" type="number" step="1" value="${round(layer.rotationDeg, 2)}" /></label></div>
        <div class="control full"><label>Source asset<input readonly value="${escapeAttr(asset ? asset.name : layer.assetId)}" /></label></div>
      </div>
      <div class="inspector-actions">
        <button class="mini-button" data-center-layer="${layer.id}">Center</button>
        <button class="mini-button" data-fit-layer="${layer.id}">Fit</button>
        <button class="mini-button" data-duplicate-layer="${layer.id}">Duplicate</button>
      </div>`;
  }

  function renderStatePanel() {
    const tab = state.ui.statePanel || 'live';
    document.querySelectorAll('[data-state-tab]').forEach((button) => button.classList.toggle('active', button.dataset.stateTab === tab));
    let output;
    if (tab === 'diff') {
      output = lastDiff.length ? lastDiff : [{ message: 'No captured-state diff yet. Capture two states to compare them.' }];
    } else if (tab === 'snapshots') {
      output = state.snapshots.map((snap, index) => ({
        index: index + 1,
        id: snap.id,
        label: snap.label,
        capturedAt: snap.capturedAt,
        hash: snap.hash,
        changedPathsFromPrevious: (snap.diffFromPrevious || []).map((item) => item.path)
      }));
      if (!output.length) output = [{ message: 'No snapshots captured yet.' }];
    } else {
      output = core.compactState(state, !!state.ui.inspectorPayloads);
    }
    el.stateOutput.textContent = JSON.stringify(output, null, 2);
  }

  function renderWorkspaceControls() {
    const w = state.workspace;
    el.workspaceName.value = w.name;
    el.workspaceWidth.value = w.width;
    el.workspaceHeight.value = w.height;
    el.exportBackground.checked = !!w.exportBackground;
    el.previewBackground.value = w.previewBackground;
    el.canvasWrap.style.backgroundColor = w.previewBackground;
    el.workspaceSizeLabel.textContent = `${w.width} × ${w.height}`;
    el.stateHashLabel.textContent = `state ${core.hashState(state)}`;
    el.emptyStage.classList.toggle('hidden', state.layers.length > 0);
  }

  function renderAll() {
    renderAssets();
    renderLayers();
    renderInspector();
    renderWorkspaceControls();
    renderStatePanel();
    drawCanvas();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }
  function escapeAttr(value) { return escapeHtml(value); }
  function round(value, digits) { const p = 10 ** digits; return Math.round(Number(value) * p) / p; }

  function reorderLayer(id, delta) {
    const index = state.layers.findIndex((layer) => layer.id === id);
    if (index < 0) return;
    const next = Math.max(0, Math.min(state.layers.length - 1, index + delta));
    if (next === index) return;
    mutate('layer.reordered', { layerId: id, from: index, to: next }, () => {
      const [layer] = state.layers.splice(index, 1);
      state.layers.splice(next, 0, layer);
    });
  }

  function removeLayer(id) {
    mutate('layer.removed', { layerId: id }, () => {
      state.layers = state.layers.filter((layer) => layer.id !== id);
      if (state.selection.layerId === id) state.selection.layerId = null;
    });
  }

  function removeAsset(id) {
    const inUse = state.layers.some((layer) => layer.assetId === id);
    if (inUse) {
      toast('Remove its composition layers first.');
      return;
    }
    mutate('asset.removed', { assetId: id }, () => {
      state.assets = state.assets.filter((asset) => asset.id !== id);
      if (state.selection.assetId === id) state.selection.assetId = null;
    });
  }

  function setLayerField(field, rawValue) {
    const layer = selectedLayer();
    if (!layer) return;
    const numeric = ['opacity','x','y','scale','rotationDeg'].includes(field);
    const value = numeric ? Number(rawValue) : rawValue;
    if (numeric && !Number.isFinite(value)) return;
    layer[field] = field === 'opacity' ? Math.max(0, Math.min(1, value)) : value;
    core.recordEvent(state, 'layer.changed', { layerId: layer.id, field, value: layer[field] });
    renderAll();
  }

  function captureState() {
    const label = `Snapshot ${state.snapshots.length + 1}`;
    const snapshot = core.captureSnapshot(state, label);
    state.snapshots.push(snapshot);
    lastDiff = snapshot.diffFromPrevious || [];
    core.recordEvent(state, 'state.captured', { snapshotId: snapshot.id, hash: snapshot.hash, diffCount: lastDiff.length });
    state.ui.statePanel = state.snapshots.length > 1 ? 'diff' : 'snapshots';
    renderAll();
    toast(`Captured ${snapshot.hash}${lastDiff.length ? ` • ${lastDiff.length} changed paths` : ''}`);
  }

  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function exportPng() {
    await drawCanvas();
    el.surfaceCanvas.toBlob((blob) => {
      if (!blob) return;
      const safe = (state.workspace.name || 'surface').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'surface';
      download(`${safe}.png`, blob);
      core.recordEvent(state, 'png.exported', { name: `${safe}.png`, width: state.workspace.width, height: state.workspace.height });
      renderAll();
      toast('PNG exported locally.');
    }, 'image/png');
  }

  function exportState() {
    const safe = (state.workspace.name || 'surface').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'surface';
    const payload = JSON.stringify(state, null, 2);
    download(`${safe}.axm-surface-state.json`, new Blob([payload], { type: 'application/json' }));
    core.recordEvent(state, 'state.exported', { bytesApprox: payload.length });
    renderAll();
    toast('Full state exported with image payloads.');
  }

  async function importStateFile(file) {
    const text = await file.text();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (error) { toast('State file is not valid JSON.'); return; }
    const validation = core.validateImportedState(parsed);
    if (!validation.ok) { toast(validation.reason); return; }
    state = parsed;
    state.events = Array.isArray(state.events) ? state.events : [];
    state.snapshots = Array.isArray(state.snapshots) ? state.snapshots : [];
    state.ui = state.ui || { librarySearch: '', statePanel: 'live', inspectorPayloads: false };
    imageCache = new Map();
    core.recordEvent(state, 'state.imported', { sourceName: file.name });
    lastDiff = [];
    renderAll();
    toast('State restored from file.');
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('axm-material-surface-fabric', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('workspaces')) db.createObjectStore('workspaces');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveLocal() {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('workspaces', 'readwrite');
        tx.objectStore('workspaces').put(state, 'current');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      core.recordEvent(state, 'state.saved-local', { store: 'IndexedDB/current' });
      renderAll();
      toast('Saved explicitly to this browser.');
    } catch (error) {
      console.error(error);
      toast('Browser-local save failed. Export state JSON instead.');
    }
  }

  async function loadLocal() {
    try {
      const db = await openDb();
      const loaded = await new Promise((resolve, reject) => {
        const tx = db.transaction('workspaces', 'readonly');
        const request = tx.objectStore('workspaces').get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (!loaded) { toast('No browser-local workspace exists yet.'); return; }
      const validation = core.validateImportedState(loaded);
      if (!validation.ok) { toast(validation.reason); return; }
      state = loaded;
      imageCache = new Map();
      core.recordEvent(state, 'state.loaded-local', { store: 'IndexedDB/current' });
      lastDiff = [];
      renderAll();
      toast('Loaded browser-local workspace.');
    } catch (error) {
      console.error(error);
      toast('Browser-local load failed.');
    }
  }

  async function copyVisibleState() {
    try {
      await navigator.clipboard.writeText(el.stateOutput.textContent);
      toast('Visible state copied.');
    } catch (error) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el.stateOutput);
      selection.removeAllRanges();
      selection.addRange(range);
      toast('Clipboard permission blocked; state text selected instead.');
    }
  }

  function resetWorkspace() {
    if (!window.confirm('Reset this workspace? Export state first if you want to keep it.')) return;
    state = core.createInitialState();
    imageCache = new Map();
    lastDiff = [];
    renderAll();
    toast('Workspace reset.');
  }

  el.assetInput.addEventListener('change', (event) => { importFiles(event.target.files); event.target.value = ''; });
  el.stateInput.addEventListener('change', (event) => { if (event.target.files[0]) importStateFile(event.target.files[0]); event.target.value = ''; });
  el.seedDemoButton.addEventListener('click', seedDemo);
  el.captureButton.addEventListener('click', captureState);
  el.exportPngButton.addEventListener('click', exportPng);
  el.exportStateButton.addEventListener('click', exportState);
  el.saveLocalButton.addEventListener('click', saveLocal);
  el.loadLocalButton.addEventListener('click', loadLocal);
  el.resetButton.addEventListener('click', resetWorkspace);
  el.copyStateButton.addEventListener('click', copyVisibleState);

  ['dragenter','dragover'].forEach((type) => el.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropZone.classList.add('dragging');
  }));
  ['dragleave','drop'].forEach((type) => el.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropZone.classList.remove('dragging');
  }));
  el.dropZone.addEventListener('drop', (event) => importFiles(event.dataTransfer.files));

  el.librarySearch.addEventListener('input', (event) => {
    state.ui.librarySearch = event.target.value;
    renderAssets();
  });

  el.assetGrid.addEventListener('click', (event) => {
    const use = event.target.closest('[data-use-asset]');
    const remove = event.target.closest('[data-remove-asset]');
    const card = event.target.closest('[data-asset-card]');
    if (use) { addAssetToLayers(use.dataset.useAsset); return; }
    if (remove) { removeAsset(remove.dataset.removeAsset); return; }
    if (card) {
      state.selection.assetId = card.dataset.assetCard;
      renderAssets();
      renderStatePanel();
    }
  });

  el.layerList.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle-layer]');
    const up = event.target.closest('[data-layer-up]');
    const down = event.target.closest('[data-layer-down]');
    const remove = event.target.closest('[data-remove-layer]');
    const row = event.target.closest('[data-layer-row]');
    if (toggle) {
      const layer = getLayer(toggle.dataset.toggleLayer);
      if (layer) mutate('layer.visibility', { layerId: layer.id, visible: !layer.visible }, () => { layer.visible = !layer.visible; });
      return;
    }
    if (up) { reorderLayer(up.dataset.layerUp, +1); return; }
    if (down) { reorderLayer(down.dataset.layerDown, -1); return; }
    if (remove) { removeLayer(remove.dataset.removeLayer); return; }
    if (row) {
      state.selection.layerId = row.dataset.layerRow;
      const layer = getLayer(state.selection.layerId);
      if (layer) state.selection.assetId = layer.assetId;
      renderAll();
    }
  });

  el.layerInspector.addEventListener('input', (event) => {
    const field = event.target.dataset.layerField;
    if (field) setLayerField(field, event.target.value);
  });
  el.layerInspector.addEventListener('change', (event) => {
    const field = event.target.dataset.layerField;
    if (field) setLayerField(field, event.target.value);
  });
  el.layerInspector.addEventListener('click', (event) => {
    const center = event.target.closest('[data-center-layer]');
    const fit = event.target.closest('[data-fit-layer]');
    const duplicate = event.target.closest('[data-duplicate-layer]');
    if (center) {
      const layer = getLayer(center.dataset.centerLayer);
      if (layer) mutate('layer.centered', { layerId: layer.id }, () => { layer.x = state.workspace.width / 2; layer.y = state.workspace.height / 2; });
    }
    if (fit) {
      const layer = getLayer(fit.dataset.fitLayer);
      const asset = layer && getAsset(layer.assetId);
      if (layer && asset) mutate('layer.fit', { layerId: layer.id }, () => { layer.scale = Math.min(state.workspace.width / asset.width, state.workspace.height / asset.height) * 0.84; });
    }
    if (duplicate) {
      const layer = getLayer(duplicate.dataset.duplicateLayer);
      if (layer) mutate('layer.duplicated', { sourceLayerId: layer.id }, () => {
        const copy = core.clone(layer);
        copy.id = core.uid('layer');
        copy.name = `${layer.name} copy`;
        copy.x += 20;
        copy.y += 20;
        copy.addedAt = core.nowIso();
        state.layers.push(copy);
        state.selection.layerId = copy.id;
      });
    }
  });

  document.querySelector('.state-actions').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-state-tab]');
    if (!tab) return;
    state.ui.statePanel = tab.dataset.stateTab;
    renderStatePanel();
  });

  el.workspaceName.addEventListener('change', (event) => mutate('workspace.name', { value: event.target.value }, () => { state.workspace.name = event.target.value.trim() || 'untitled-surface'; }));
  el.workspaceWidth.addEventListener('change', (event) => resizeWorkspace('width', event.target.value));
  el.workspaceHeight.addEventListener('change', (event) => resizeWorkspace('height', event.target.value));
  el.exportBackground.addEventListener('change', (event) => mutate('workspace.export-background', { value: event.target.checked }, () => { state.workspace.exportBackground = event.target.checked; }));
  el.previewBackground.addEventListener('input', (event) => {
    state.workspace.previewBackground = event.target.value;
    core.recordEvent(state, 'workspace.preview-background', { value: event.target.value });
    renderAll();
  });

  function resizeWorkspace(field, raw) {
    const next = Math.max(64, Math.min(4096, Number(raw) || 1024));
    const oldW = state.workspace.width;
    const oldH = state.workspace.height;
    mutate('workspace.resized', { field, value: next }, () => {
      if (field === 'width') state.workspace.width = next;
      if (field === 'height') state.workspace.height = next;
      const rx = state.workspace.width / oldW;
      const ry = state.workspace.height / oldH;
      state.layers.forEach((layer) => {
        layer.x *= rx;
        layer.y *= ry;
      });
    });
  }

  renderAll();
})();
