(function () {
  'use strict';

  const deltaCore = window.AXMDeltaCore;
  const traceCore = window.AXMTraceCore;
  if (!deltaCore || !traceCore) throw new Error('AXMDeltaCore and AXMTraceCore are required before material-delta.js');

  const canvas = document.getElementById('surfaceCanvas');
  const stateOutput = document.getElementById('stateOutput');
  const stateActions = document.querySelector('.state-actions');
  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!canvas || !stateOutput || !stateActions || !workspaceGrid) return;

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function nowIso() { return new Date().toISOString(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function createExperiment() {
    const now = nowIso();
    return {
      format: 'axm-material-delta-experiment',
      version: deltaCore.VERSION,
      id: uid('experiment'),
      name: 'material-surface-experiment',
      createdAt: now,
      updatedAt: now,
      purpose: 'Increase the reusable material/texture library and expose how controlled material edits change observable state for downstream visual systems.',
      settings: { gridSize: 4, threshold: 0 },
      captures: [],
      transitions: [],
      truthBoundary: {
        declaredAction: 'Experiment intent supplied by the operator; not inferred causality.',
        observedDelta: 'Measured from composer state, rendered RGBA pixels and encoded PNG output.',
        notClaimed: ['hidden generator state', 'physical material correctness', 'semantic material recognition', 'unrecorded causal state']
      }
    };
  }

  let experiment = createExperiment();
  let currentComparison = null;

  const panel = document.createElement('section');
  panel.className = 'panel delta-panel';
  panel.innerHTML = `
    <div class="panel-heading delta-heading">
      <div><div class="panel-kicker">06</div><h2>Material Delta Bridge</h2></div>
      <span class="count-pill" id="deltaCount">0</span>
    </div>
    <div class="truth-note">
      This machine does not need to generate the visuals. It strengthens reusable materials and textures made elsewhere by capturing controlled edits, spatial deltas, lineage and portable donor packs.
    </div>
    <div class="delta-purpose">
      <strong>Direction</strong>
      <span>source visual → material/texture intake → controlled edit → observed delta → reusable donor pack</span>
    </div>

    <div class="delta-controls">
      <label>Capture label<input id="deltaLabel" placeholder="painted metal" autocomplete="off" /></label>
      <label>Parent<select id="deltaParent"><option value="">No parent / base state</option></select></label>
      <label>Declared action<input id="deltaAction" placeholder="add scratch overlay" autocomplete="off" /></label>
      <label>Declared parameters<textarea id="deltaParams" rows="2" placeholder="opacity 0.25; same base material"></textarea></label>
      <div class="delta-mini-row">
        <label>Grid<select id="deltaGrid"><option>4</option><option>8</option><option>16</option></select></label>
        <label>Pixel threshold<input id="deltaThreshold" type="number" min="0" max="255" step="1" value="0" /></label>
      </div>
      <div class="delta-action-row">
        <button class="button accent" id="deltaCapture">Capture material state</button>
        <button class="button" id="deltaSave">Save experiment</button>
        <button class="button" id="deltaLoad">Load experiment</button>
        <button class="button" id="deltaExport">Export experiment</button>
        <button class="button" id="deltaImport">Import experiment</button>
        <button class="button primary" id="donorExport">Export donor pack</button>
        <input id="deltaImportInput" type="file" accept="application/json,.json" hidden />
      </div>
    </div>

    <div class="delta-compare-row">
      <label>A<select id="deltaA"></select></label>
      <label>B<select id="deltaB"></select></label>
      <button class="mini-button" id="deltaCompare">Compare A → B</button>
    </div>

    <div class="delta-lineage" id="deltaLineage"></div>
    <div class="delta-preview" id="deltaPreview"></div>
    <div class="delta-regions" id="deltaRegions"></div>
    <pre class="state-output delta-output" id="deltaOutput" tabindex="0"></pre>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    count: panel.querySelector('#deltaCount'),
    label: panel.querySelector('#deltaLabel'),
    parent: panel.querySelector('#deltaParent'),
    action: panel.querySelector('#deltaAction'),
    params: panel.querySelector('#deltaParams'),
    grid: panel.querySelector('#deltaGrid'),
    threshold: panel.querySelector('#deltaThreshold'),
    capture: panel.querySelector('#deltaCapture'),
    save: panel.querySelector('#deltaSave'),
    load: panel.querySelector('#deltaLoad'),
    export: panel.querySelector('#deltaExport'),
    import: panel.querySelector('#deltaImport'),
    importInput: panel.querySelector('#deltaImportInput'),
    donorExport: panel.querySelector('#donorExport'),
    a: panel.querySelector('#deltaA'),
    b: panel.querySelector('#deltaB'),
    compare: panel.querySelector('#deltaCompare'),
    lineage: panel.querySelector('#deltaLineage'),
    preview: panel.querySelector('#deltaPreview'),
    regions: panel.querySelector('#deltaRegions'),
    output: panel.querySelector('#deltaOutput')
  };

  function waitFrames(count) {
    let left = count == null ? 2 : count;
    return new Promise((resolve) => {
      function step() {
        left -= 1;
        if (left <= 0) resolve();
        else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  function readLiveBuildState() {
    const active = stateActions.querySelector('[data-state-tab].active');
    const live = stateActions.querySelector('[data-state-tab="live"]');
    if (live && active !== live) live.click();
    let parsed;
    try { parsed = JSON.parse(stateOutput.textContent || '{}'); }
    catch (error) { parsed = { error: 'Live state parse failed.', rawPreview: (stateOutput.textContent || '').slice(0, 500) }; }
    if (active && active !== live) active.click();
    return parsed;
  }

  function compactBuildState(live) {
    const state = live && typeof live === 'object' ? live : {};
    return {
      format: state.format || null,
      version: state.version || null,
      workspace: clone(state.workspace || {}),
      assets: clone(state.assets || []),
      layers: clone(state.layers || []),
      selection: clone(state.selection || {}),
      truth: clone(state.truth || {})
    };
  }

  function canvasBlob(type) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas encoding failed.')), type || 'image/png');
    });
  }

  function pngSignature(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }

  async function captureMaterialState() {
    await waitFrames(2);
    const live = readLiveBuildState();
    await waitFrames(1);
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixelState = traceCore.summarizePixels(imageData.data);
    pixelState.width = canvas.width;
    pixelState.height = canvas.height;
    const blob = await canvasBlob('image/png');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const buildState = compactBuildState(live);
    const parentTraceId = el.parent.value || null;
    const capture = {
      format: 'axm-material-observation',
      version: deltaCore.VERSION,
      id: uid('material'),
      label: el.label.value.trim() || `material ${experiment.captures.length + 1}`,
      capturedAt: nowIso(),
      parentTraceId,
      declaredAction: el.action.value.trim() || null,
      declaredParams: el.params.value.trim() || null,
      topState: {
        kind: 'rendered-material-surface',
        width: canvas.width,
        height: canvas.height,
        buildHash: traceCore.fnv1aText(JSON.stringify(buildState)),
        renderPngDataUrl: canvas.toDataURL('image/png')
      },
      buildState,
      pixelState,
      fileState: {
        mime: blob.type || 'image/png',
        bytes: blob.size,
        byteHash: traceCore.fnv1aBytes(bytes),
        pngSignatureConfirmed: pngSignature(bytes),
        headerHex: traceCore.hexPreview(bytes, 32)
      }
    };
    experiment.captures.push(capture);
    experiment.updatedAt = nowIso();
    el.label.value = '';
    el.action.value = '';
    el.params.value = '';
    renderAll();
    if (parentTraceId) {
      const parent = experiment.captures.find((item) => item.id === parentTraceId);
      if (parent) await compareCaptures(parent, capture, true);
    } else {
      el.output.textContent = JSON.stringify({ captured: summarizeCapture(capture), message: 'Base material state captured.' }, null, 2);
    }
  }

  function summarizeCapture(capture) {
    return {
      id: capture.id,
      label: capture.label,
      capturedAt: capture.capturedAt,
      parentTraceId: capture.parentTraceId,
      declaredAction: capture.declaredAction,
      declaredParams: capture.declaredParams,
      buildHash: capture.topState.buildHash,
      pixelHash: capture.pixelState.pixelHash,
      fileHash: capture.fileState.byteHash
    };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Stored material render could not be decoded.'));
      image.src = src;
    });
  }

  async function rgbaFromCapture(capture) {
    const image = await loadImage(capture.topState.renderPngDataUrl);
    const c = document.createElement('canvas');
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    const g = c.getContext('2d', { alpha: true, willReadFrequently: true });
    g.drawImage(image, 0, 0);
    return { width: c.width, height: c.height, rgba: g.getImageData(0, 0, c.width, c.height).data };
  }

  function differenceDataUrl(rgba, width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d', { alpha: true });
    g.putImageData(new ImageData(rgba, width, height), 0, 0);
    return c.toDataURL('image/png');
  }

  async function compareCaptures(a, b, persistTransition) {
    if (!a || !b) return;
    const [aa, bb] = await Promise.all([rgbaFromCapture(a), rgbaFromCapture(b)]);
    if (aa.width !== bb.width || aa.height !== bb.height) {
      currentComparison = { hold: true, reason: 'Canvas dimensions differ; pixel-local delta is not claimed.', from: summarizeCapture(a), to: summarizeCapture(b) };
      renderComparison(a, b, null, currentComparison);
      return currentComparison;
    }

    const gridSize = Number(el.grid.value) || experiment.settings.gridSize || 4;
    const threshold = Number(el.threshold.value) || 0;
    experiment.settings.gridSize = gridSize;
    experiment.settings.threshold = threshold;
    const spatial = deltaCore.summarizePixelDelta(aa.rgba, bb.rgba, aa.width, aa.height, { gridSize, threshold });
    const diffRgba = deltaCore.buildDifferenceRgba(aa.rgba, bb.rgba, aa.width, aa.height, { threshold });
    const buildDiffs = traceCore.diffValues(a.buildState, b.buildState, 500);
    const pixelSummaryDiffs = traceCore.diffValues(a.pixelState, b.pixelState, 200);
    const fileDiffs = traceCore.diffValues(a.fileState, b.fileState, 100);
    const observed = {
      build: { changedPaths: buildDiffs, count: buildDiffs.length },
      pixels: { summaryChangedPaths: pixelSummaryDiffs, spatial },
      file: { changedPaths: fileDiffs, count: fileDiffs.length }
    };
    const transition = deltaCore.makeTransition(a, b, b.declaredAction, b.declaredParams, observed);
    transition.id = `${a.id}->${b.id}`;
    transition.comparedAt = nowIso();
    transition.differencePngDataUrl = differenceDataUrl(diffRgba, aa.width, aa.height);
    currentComparison = transition;

    if (persistTransition) {
      experiment.transitions = experiment.transitions.filter((item) => item.id !== transition.id);
      experiment.transitions.push(transition);
      experiment.updatedAt = nowIso();
    }
    renderComparison(a, b, transition.differencePngDataUrl, transition);
    renderLineage();
    return transition;
  }

  function renderComparison(a, b, diffUrl, payload) {
    el.preview.innerHTML = `
      <figure><img src="${a.topState.renderPngDataUrl}" alt=""><figcaption>A • ${escapeHtml(a.label)}</figcaption></figure>
      <figure><img src="${b.topState.renderPngDataUrl}" alt=""><figcaption>B • ${escapeHtml(b.label)}</figcaption></figure>
      ${diffUrl ? `<figure><img src="${diffUrl}" alt=""><figcaption>Observed pixel difference</figcaption></figure>` : ''}
    `;
    renderRegions(payload && payload.observed && payload.observed.pixels && payload.observed.pixels.spatial);
    el.output.textContent = JSON.stringify(stripLargeImages(payload), null, 2);
  }

  function stripLargeImages(value) {
    const copy = clone(value);
    if (copy && copy.differencePngDataUrl) copy.differencePngDataUrl = { omittedFromViewer: true, length: copy.differencePngDataUrl.length };
    return copy;
  }

  function renderRegions(spatial) {
    if (!spatial || !Array.isArray(spatial.regions)) {
      el.regions.innerHTML = '';
      return;
    }
    el.regions.style.setProperty('--delta-grid-size', spatial.gridSize);
    el.regions.innerHTML = spatial.regions.map((region) => {
      const pct = Math.round(region.changedShare * 1000) / 10;
      return `<div class="delta-region" title="row ${region.row + 1}, column ${region.column + 1}; mean channel delta ${region.meanAbsChannelDelta}"><strong>${pct}%</strong><span>changed</span></div>`;
    }).join('');
  }

  function renderLineage() {
    el.count.textContent = experiment.captures.length;
    if (!experiment.captures.length) {
      el.lineage.innerHTML = '<div class="inspector-empty">Capture a base material, make one controlled edit, then capture a child state.</div>';
      el.parent.innerHTML = '<option value="">No parent / base state</option>';
      el.a.innerHTML = '<option value="">A</option>';
      el.b.innerHTML = '<option value="">B</option>';
      return;
    }
    const byId = new Map(experiment.captures.map((capture) => [capture.id, capture]));
    el.lineage.innerHTML = experiment.captures.map((capture, index) => {
      const parent = capture.parentTraceId ? byId.get(capture.parentTraceId) : null;
      return `<button class="delta-node" data-delta-capture="${capture.id}">
        <span>${index + 1}</span><strong>${escapeHtml(capture.label)}</strong>
        <small>${parent ? `from ${escapeHtml(parent.label)}` : 'base'}${capture.declaredAction ? ` • ${escapeHtml(capture.declaredAction)}` : ''}</small>
      </button>`;
    }).join('');
    const options = experiment.captures.map((capture, index) => `<option value="${capture.id}">${index + 1}. ${escapeHtml(capture.label)}</option>`).join('');
    el.parent.innerHTML = `<option value="">No parent / base state</option>${options}`;
    el.a.innerHTML = options;
    el.b.innerHTML = options;
    if (experiment.captures.length > 1) {
      el.a.value = experiment.captures[0].id;
      el.b.value = experiment.captures[experiment.captures.length - 1].id;
      el.parent.value = experiment.captures[experiment.captures.length - 1].id;
    }
  }

  function renderAll() {
    el.grid.value = String(experiment.settings.gridSize || 4);
    el.threshold.value = String(experiment.settings.threshold || 0);
    renderLineage();
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('axm-material-delta-v3', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('experiments')) db.createObjectStore('experiments');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveExperiment() {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('experiments', 'readwrite');
      tx.objectStore('experiments').put(experiment, 'current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    el.output.textContent = JSON.stringify({ saved: true, experimentId: experiment.id, captures: experiment.captures.length, transitions: experiment.transitions.length }, null, 2);
  }

  async function loadExperiment() {
    const db = await openDb();
    const loaded = await new Promise((resolve, reject) => {
      const tx = db.transaction('experiments', 'readonly');
      const request = tx.objectStore('experiments').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!loaded) {
      el.output.textContent = JSON.stringify({ message: 'No explicitly saved v0.3 material experiment exists in this browser.' }, null, 2);
      return;
    }
    if (loaded.format !== 'axm-material-delta-experiment') throw new Error('Saved object is not an AXM material delta experiment.');
    experiment = loaded;
    currentComparison = null;
    renderAll();
    el.output.textContent = JSON.stringify({ loaded: true, experimentId: experiment.id, captures: experiment.captures.length, transitions: experiment.transitions.length }, null, 2);
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

  function exportExperiment() {
    const text = JSON.stringify(experiment, null, 2);
    download('axm-material-delta-experiment.json', new Blob([text], { type: 'application/json' }));
  }

  function collectDonorAssets(live) {
    const metadata = new Map((live.assets || []).map((asset) => [asset.id, asset]));
    const assets = [];
    document.querySelectorAll('[data-asset-card]').forEach((card) => {
      const id = card.dataset.assetCard;
      const image = card.querySelector('img');
      const meta = metadata.get(id) || { id };
      assets.push(Object.assign({}, clone(meta), {
        id,
        dataUrl: image && image.src && image.src.startsWith('data:') ? image.src : null
      }));
    });
    return assets;
  }

  function exportDonorPack() {
    const live = readLiveBuildState();
    const pack = {
      format: 'axm-material-donor-pack',
      version: '0.1.0',
      exportedAt: nowIso(),
      purpose: 'Portable reusable material/texture ingredients for AXM visual creation, game asset, FrameState and other visual systems. This pack does not imply generator ownership or physical-material correctness.',
      workspace: clone(live.workspace || {}),
      assets: collectDonorAssets(live),
      layers: clone(live.layers || []),
      experiment: {
        format: experiment.format,
        version: experiment.version,
        id: experiment.id,
        captures: experiment.captures.map(summarizeCapture),
        transitions: experiment.transitions.map((transition) => ({
          id: transition.id,
          fromTraceId: transition.fromTraceId,
          toTraceId: transition.toTraceId,
          declaredAction: transition.declaredAction,
          declaredParams: transition.declaredParams,
          observed: transition.observed ? {
            buildChangedPaths: transition.observed.build.count,
            changedPixelShare: transition.observed.pixels.spatial.changedShare,
            changedBounds: transition.observed.pixels.spatial.changedBounds,
            fileChangedPaths: transition.observed.file.count
          } : null
        }))
      },
      truthBoundary: {
        provenance: 'Asset source metadata is preserved from the current workspace when present.',
        reuse: 'Consumers must preserve asset identity/provenance and may interpret or convert the pack through their own explicit adapters.',
        notClaimed: ['PBR correctness', 'semantic material recognition', 'generator lineage beyond recorded source metadata']
      }
    };
    const text = JSON.stringify(pack, null, 2);
    download('axm-material-donor-pack.json', new Blob([text], { type: 'application/json' }));
    el.output.textContent = JSON.stringify({ exportedDonorPack: true, assets: pack.assets.length, captures: pack.experiment.captures.length, transitions: pack.experiment.transitions.length }, null, 2);
  }

  async function importExperimentFile(file) {
    const text = await file.text();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (error) { throw new Error('Experiment file is not valid JSON.'); }
    if (!parsed || parsed.format !== 'axm-material-delta-experiment' || !Array.isArray(parsed.captures) || !Array.isArray(parsed.transitions)) {
      throw new Error('Not an AXM v0.3 material delta experiment.');
    }
    experiment = parsed;
    experiment.settings = experiment.settings || { gridSize: 4, threshold: 0 };
    currentComparison = null;
    renderAll();
    el.output.textContent = JSON.stringify({ imported: true, captures: experiment.captures.length, transitions: experiment.transitions.length }, null, 2);
  }

  el.capture.addEventListener('click', async () => {
    el.capture.disabled = true;
    try { await captureMaterialState(); }
    catch (error) { console.error(error); el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }
    finally { el.capture.disabled = false; }
  });

  el.compare.addEventListener('click', async () => {
    const a = experiment.captures.find((capture) => capture.id === el.a.value);
    const b = experiment.captures.find((capture) => capture.id === el.b.value);
    if (!a || !b) return;
    el.compare.disabled = true;
    try { await compareCaptures(a, b, false); }
    catch (error) { console.error(error); el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }
    finally { el.compare.disabled = false; }
  });

  el.lineage.addEventListener('click', (event) => {
    const node = event.target.closest('[data-delta-capture]');
    if (!node) return;
    const capture = experiment.captures.find((item) => item.id === node.dataset.deltaCapture);
    if (capture) el.output.textContent = JSON.stringify(summarizeCapture(capture), null, 2);
  });

  el.grid.addEventListener('change', () => { experiment.settings.gridSize = Number(el.grid.value) || 4; experiment.updatedAt = nowIso(); });
  el.threshold.addEventListener('change', () => { experiment.settings.threshold = Math.max(0, Math.min(255, Number(el.threshold.value) || 0)); experiment.updatedAt = nowIso(); });
  el.save.addEventListener('click', () => saveExperiment().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }));
  el.load.addEventListener('click', () => loadExperiment().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }));
  el.export.addEventListener('click', exportExperiment);
  el.import.addEventListener('click', () => el.importInput.click());
  el.importInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try { await importExperimentFile(file); }
    catch (error) { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }
  });
  el.donorExport.addEventListener('click', exportDonorPack);

  renderAll();
  el.output.textContent = JSON.stringify({
    message: 'Capture a base material, make one controlled edit, then capture a child. This workspace strengthens reusable material/texture evidence; generation can happen in other AXM visual systems.',
    next: ['capture base', 'edit one direction', 'capture child with parent/action', 'inspect spatial delta', 'export donor pack']
  }, null, 2);
})();
