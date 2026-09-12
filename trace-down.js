(function () {
  'use strict';

  const traceCore = window.AXMTraceCore;
  if (!traceCore) throw new Error('AXMTraceCore is required before trace-down.js');

  const canvas = document.getElementById('surfaceCanvas');
  const stateOutput = document.getElementById('stateOutput');
  const stateActions = document.querySelector('.state-actions');
  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!canvas || !stateOutput || !stateActions || !workspaceGrid) return;

  const traces = [];
  let currentTrace = null;

  const panel = document.createElement('section');
  panel.className = 'panel trace-panel';
  panel.innerHTML = `
    <div class="panel-heading trace-heading">
      <div>
        <div class="panel-kicker">05</div>
        <h2>Trace Down</h2>
      </div>
      <span class="count-pill" id="traceCount">0</span>
    </div>

    <div class="truth-note trace-truth">
      Observable path only: this page can directly inspect its build metadata, rendered pixels, encoded PNG bytes and a short bit preview. It does not claim to recover hidden generator internals or original intent.
    </div>

    <div class="trace-path" aria-label="trace path">
      <span>IMAGE</span><b>→</b><span>BUILD</span><b>→</b><span>PIXELS</span><b>→</b><span>FILE</span><b>→</b><span>BITS</span>
    </div>

    <div class="trace-controls">
      <label class="trace-label">Variant label
        <input id="traceLabel" placeholder="e.g. clean metal" autocomplete="off" />
      </label>
      <div class="trace-presets" aria-label="controlled experiment labels">
        <button class="mini-button" data-trace-label="clean">Clean</button>
        <button class="mini-button" data-trace-label="painted">Painted</button>
        <button class="mini-button" data-trace-label="light wear">Light wear</button>
        <button class="mini-button" data-trace-label="heavy wear">Heavy wear</button>
      </div>
      <div class="trace-action-row">
        <button class="button" id="inspectTraceButton">Inspect current</button>
        <button class="button accent" id="captureTraceButton">Capture traced state</button>
        <button class="button" id="exportTraceButton">Export experiment</button>
        <button class="button danger subtle" id="clearTraceButton">Clear experiment</button>
      </div>
    </div>

    <div class="trace-compare">
      <label>A<select id="traceCompareA"></select></label>
      <label>B<select id="traceCompareB"></select></label>
      <button class="mini-button" id="compareTraceButton">Compare A → B</button>
    </div>

    <div class="trace-captures" id="traceCaptures"></div>
    <pre id="traceOutput" class="state-output trace-output" tabindex="0"></pre>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    label: panel.querySelector('#traceLabel'),
    inspect: panel.querySelector('#inspectTraceButton'),
    capture: panel.querySelector('#captureTraceButton'),
    export: panel.querySelector('#exportTraceButton'),
    clear: panel.querySelector('#clearTraceButton'),
    compare: panel.querySelector('#compareTraceButton'),
    compareA: panel.querySelector('#traceCompareA'),
    compareB: panel.querySelector('#traceCompareB'),
    captures: panel.querySelector('#traceCaptures'),
    output: panel.querySelector('#traceOutput'),
    count: panel.querySelector('#traceCount')
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeId() {
    return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

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
    try {
      parsed = JSON.parse(stateOutput.textContent || '{}');
    } catch (error) {
      parsed = { error: 'Live state could not be parsed.', rawPreview: (stateOutput.textContent || '').slice(0, 500) };
    }

    if (active && active !== live) active.click();
    return parsed;
  }

  function canvasBlob(type) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas could not be encoded.')), type || 'image/png');
    });
  }

  function makeThumbnail() {
    const thumb = document.createElement('canvas');
    const max = 192;
    const scale = Math.min(max / canvas.width, max / canvas.height, 1);
    thumb.width = Math.max(1, Math.round(canvas.width * scale));
    thumb.height = Math.max(1, Math.round(canvas.height * scale));
    const g = thumb.getContext('2d', { alpha: true });
    g.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    return thumb.toDataURL('image/png');
  }

  function buildStateSummary(live) {
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

  function pngSignature(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < signature.length) return false;
    return signature.every((value, index) => bytes[index] === value);
  }

  async function traceCurrent(label) {
    await waitFrames(2);
    const liveState = readLiveBuildState();
    await waitFrames(1);

    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixelState = traceCore.summarizePixels(imageData.data);
    pixelState.width = canvas.width;
    pixelState.height = canvas.height;

    const blob = await canvasBlob('image/png');
    const fileBytes = new Uint8Array(await blob.arrayBuffer());
    const buildState = buildStateSummary(liveState);
    const capturedAt = new Date().toISOString();
    const cleanLabel = String(label || '').trim() || `trace ${traces.length + 1}`;

    return {
      format: 'axm-visual-trace',
      version: traceCore.VERSION,
      id: makeId(),
      label: cleanLabel,
      capturedAt,
      path: ['image', 'build', 'pixels', 'file', 'bits'],
      topState: {
        kind: 'rendered-canvas',
        workspaceName: buildState.workspace && buildState.workspace.name || null,
        width: canvas.width,
        height: canvas.height,
        buildHash: traceCore.fnv1aText(JSON.stringify(buildState)),
        thumbnailPngDataUrl: makeThumbnail()
      },
      buildState,
      pixelState,
      fileState: {
        mime: blob.type || 'image/png',
        bytes: blob.size,
        byteHash: traceCore.fnv1aBytes(fileBytes),
        pngSignatureConfirmed: pngSignature(fileBytes),
        headerHex: traceCore.hexPreview(fileBytes, 32),
        first64Bits: traceCore.bitsPreview(fileBytes, 8)
      },
      truthBoundary: {
        directlyObserved: ['composer build metadata', 'rendered RGBA pixels', 'encoded PNG bytes', 'short binary preview'],
        notClaimed: ['hidden image-generator internals', 'latent states not exposed by a generator', 'original human intent', 'physical material correctness']
      }
    };
  }

  function comparableTrace(trace) {
    const copy = clone(trace);
    if (copy.topState) delete copy.topState.thumbnailPngDataUrl;
    return copy;
  }

  function diffSummary(a, b) {
    const diffs = traceCore.diffValues(comparableTrace(a), comparableTrace(b), 500);
    const groups = { top: 0, build: 0, pixels: 0, file: 0, other: 0 };
    diffs.forEach((item) => {
      if (item.path.startsWith('topState')) groups.top += 1;
      else if (item.path.startsWith('buildState')) groups.build += 1;
      else if (item.path.startsWith('pixelState')) groups.pixels += 1;
      else if (item.path.startsWith('fileState')) groups.file += 1;
      else groups.other += 1;
    });
    return {
      from: { id: a.id, label: a.label, capturedAt: a.capturedAt },
      to: { id: b.id, label: b.label, capturedAt: b.capturedAt },
      changeCounts: groups,
      totalChangedPaths: diffs.length,
      changedPaths: diffs
    };
  }

  function renderTrace(trace) {
    currentTrace = trace;
    el.output.textContent = JSON.stringify(comparableTrace(trace), null, 2);
  }

  function renderCaptures() {
    el.count.textContent = traces.length;
    el.captures.innerHTML = traces.map((trace, index) => `
      <button class="trace-card" data-trace-index="${index}" title="Inspect ${escapeHtml(trace.label)}">
        <img src="${trace.topState.thumbnailPngDataUrl}" alt="" />
        <span><strong>${escapeHtml(trace.label)}</strong><small>${trace.fileState.byteHash} • ${trace.pixelState.pixelHash}</small></span>
      </button>
    `).join('') || '<div class="inspector-empty">No traced states yet. Change the composition between captures to build a controlled sequence.</div>';

    const options = traces.map((trace, index) => `<option value="${index}">${index + 1}. ${escapeHtml(trace.label)}</option>`).join('');
    el.compareA.innerHTML = options || '<option value="">A</option>';
    el.compareB.innerHTML = options || '<option value="">B</option>';
    if (traces.length > 1) {
      el.compareA.value = '0';
      el.compareB.value = String(traces.length - 1);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function inspectCurrent() {
    el.inspect.disabled = true;
    el.capture.disabled = true;
    try {
      renderTrace(await traceCurrent(el.label.value));
    } catch (error) {
      console.error(error);
      el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2);
    } finally {
      el.inspect.disabled = false;
      el.capture.disabled = false;
    }
  }

  async function captureCurrent() {
    el.inspect.disabled = true;
    el.capture.disabled = true;
    try {
      const trace = await traceCurrent(el.label.value);
      traces.push(trace);
      renderCaptures();
      renderTrace(trace);
      el.label.value = '';
    } catch (error) {
      console.error(error);
      el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2);
    } finally {
      el.inspect.disabled = false;
      el.capture.disabled = false;
    }
  }

  panel.querySelector('.trace-presets').addEventListener('click', (event) => {
    const button = event.target.closest('[data-trace-label]');
    if (button) el.label.value = button.dataset.traceLabel;
  });

  el.inspect.addEventListener('click', inspectCurrent);
  el.capture.addEventListener('click', captureCurrent);

  el.captures.addEventListener('click', (event) => {
    const card = event.target.closest('[data-trace-index]');
    if (!card) return;
    const trace = traces[Number(card.dataset.traceIndex)];
    if (trace) renderTrace(trace);
  });

  el.compare.addEventListener('click', () => {
    const a = traces[Number(el.compareA.value)];
    const b = traces[Number(el.compareB.value)];
    if (!a || !b) {
      el.output.textContent = JSON.stringify({ message: 'Capture at least two traced states first.' }, null, 2);
      return;
    }
    currentTrace = null;
    el.output.textContent = JSON.stringify(diffSummary(a, b), null, 2);
  });

  el.export.addEventListener('click', () => {
    const payload = {
      format: 'axm-visual-trace-experiment',
      version: traceCore.VERSION,
      exportedAt: new Date().toISOString(),
      truthBoundary: 'Observed page/build/pixel/file state only. No hidden generator-state reconstruction is claimed.',
      traces
    };
    const text = JSON.stringify(payload, null, 2);
    download('axm-visual-trace-experiment.json', new Blob([text], { type: 'application/json' }));
  });

  el.clear.addEventListener('click', () => {
    if (traces.length && !window.confirm('Clear the in-memory trace experiment? Export first if you want to keep it.')) return;
    traces.splice(0, traces.length);
    currentTrace = null;
    renderCaptures();
    el.output.textContent = JSON.stringify({ message: 'Trace experiment is empty.' }, null, 2);
  });

  renderCaptures();
  el.output.textContent = JSON.stringify({
    message: 'Create or edit a surface, then inspect or capture it. For controlled experiments, change one visual direction between captures.',
    path: ['image', 'build', 'pixels', 'file', 'bits']
  }, null, 2);
})();
