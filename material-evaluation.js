(function () {
  'use strict';

  const evaluation = window.AXMMaterialEvaluationCore;
  const vocabulary = window.AXMMaterialVocabularyCore;
  const libraryCore = window.AXMMaterialLibraryCore;
  const influenceCore = window.AXMMaterialInfluenceCore;
  if (!evaluation || !vocabulary || !libraryCore || !influenceCore) {
    throw new Error('Material Evaluation Lab requires evaluation, vocabulary, library, and influence cores.');
  }

  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  let session = evaluation.createSession({
    source: { kind: 'vocabulary-family', familyId: vocabulary.FAMILIES[0] && vocabulary.FAMILIES[0].id },
    resolution: 64,
    mode: 'quick',
    geometries: ['sphere'],
    lightRigIds: influenceCore.LIGHT_RIGS.map((rig) => rig.id)
  });
  let selectedFamilyId = vocabulary.FAMILIES[0] && vocabulary.FAMILIES[0].id;
  let selectedCandidateId = null;
  let busy = false;
  let savedInfluenceBeforeRun = null;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso() { return new Date().toISOString(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  function yieldEventLoop() { return sleep(0); }

  const panel = document.createElement('section');
  panel.className = 'panel material-evaluation-panel';
  panel.innerHTML = `
    <div class="panel-heading evaluation-heading">
      <div><div class="panel-kicker">11</div><h2>Material Evaluation / Evolution</h2></div>
      <span class="count-pill">v0.8</span>
    </div>
    <div class="truth-note">
      Batch renderer-path evaluation and deterministic descriptor variation. Rankings measure technical render health/observability only — never beauty, realism, PBR correctness, physical truth, or human preference. Nothing is promoted into the material library automatically.
    </div>

    <div class="evaluation-toolbar">
      <label>Family<select id="evaluationFamily"></select></label>
      <label>Resolution<select id="evaluationResolution"><option value="64" selected>64</option><option value="128">128</option></select></label>
      <label>Mode<select id="evaluationMode"><option value="quick">Quick • sphere × all lights</option><option value="deep">Deep • sphere + plane + cube × all lights</option></select></label>
      <button class="button accent" id="evaluationBase">Evaluate base</button>
      <button class="button primary" id="evaluationEvolve">Evolve + evaluate 4</button>
      <button class="button" id="evaluationSaved">Evaluate saved lab recipe</button>
    </div>

    <div class="evaluation-actions">
      <button class="button" id="evaluationSave">Save session</button>
      <button class="button" id="evaluationLoad">Load session</button>
      <button class="button" id="evaluationExport">Export session JSON</button>
      <button class="button" id="evaluationImport">Import session JSON</button>
      <input id="evaluationImportInput" type="file" accept="application/json,.json" hidden />
      <button class="button" id="evaluationInstall" disabled>Install selected candidate</button>
      <span id="evaluationStatus">idle</span>
    </div>

    <div class="evaluation-layout">
      <section class="evaluation-candidates influence-subpanel">
        <div class="influence-subheading"><strong>Candidates</strong><span id="evaluationCandidateCount">0</span></div>
        <div id="evaluationCandidateList" class="evaluation-candidate-list"></div>
      </section>

      <section class="evaluation-detail influence-subpanel">
        <div class="influence-subheading"><strong>Selected result</strong><span id="evaluationSelectedId">none</span></div>
        <div id="evaluationRepresentative" class="evaluation-representative checker"></div>
        <div id="evaluationMetrics" class="evaluation-metrics"></div>
      </section>
    </div>

    <section class="evaluation-matrix influence-subpanel">
      <div class="influence-subheading"><strong>Renderer evidence matrix</strong><span>geometry × light rig</span></div>
      <div id="evaluationMatrix" class="evaluation-matrix-grid"></div>
    </section>

    <section class="evaluation-record influence-subpanel">
      <div class="influence-subheading"><strong>Session record</strong><span>observed / held / installed</span></div>
      <pre id="evaluationOutput" class="state-output evaluation-output" tabindex="0"></pre>
    </section>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    family: panel.querySelector('#evaluationFamily'),
    resolution: panel.querySelector('#evaluationResolution'),
    mode: panel.querySelector('#evaluationMode'),
    evaluateBase: panel.querySelector('#evaluationBase'),
    evolve: panel.querySelector('#evaluationEvolve'),
    saved: panel.querySelector('#evaluationSaved'),
    save: panel.querySelector('#evaluationSave'),
    load: panel.querySelector('#evaluationLoad'),
    export: panel.querySelector('#evaluationExport'),
    importButton: panel.querySelector('#evaluationImport'),
    importInput: panel.querySelector('#evaluationImportInput'),
    install: panel.querySelector('#evaluationInstall'),
    status: panel.querySelector('#evaluationStatus'),
    candidateCount: panel.querySelector('#evaluationCandidateCount'),
    candidateList: panel.querySelector('#evaluationCandidateList'),
    selectedId: panel.querySelector('#evaluationSelectedId'),
    representative: panel.querySelector('#evaluationRepresentative'),
    metrics: panel.querySelector('#evaluationMetrics'),
    matrix: panel.querySelector('#evaluationMatrix'),
    output: panel.querySelector('#evaluationOutput')
  };

  function selectedFamily() { return vocabulary.familyById(selectedFamilyId); }
  function resolution() { return Number(el.resolution.value) || 64; }
  function geometryList() { return el.mode.value === 'deep' ? ['sphere', 'plane', 'cube'] : ['sphere']; }

  function setBusy(value, message) {
    busy = Boolean(value);
    [el.evaluateBase, el.evolve, el.saved, el.install, el.family, el.resolution, el.mode].forEach((control) => { control.disabled = busy; });
    if (message) el.status.textContent = message;
  }

  function renderFamilyOptions() {
    const grouped = {};
    vocabulary.FAMILIES.forEach((family) => {
      if (!grouped[family.category]) grouped[family.category] = [];
      grouped[family.category].push(family);
    });
    el.family.innerHTML = Object.keys(grouped).sort().map((category) => `
      <optgroup label="${escapeHtml(category)}">${grouped[category].map((family) => `<option value="${escapeHtml(family.id)}" ${family.id === selectedFamilyId ? 'selected' : ''}>${escapeHtml(family.name)}</option>`).join('')}</optgroup>
    `).join('');
  }

  function newCanvas(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }

  function makeImageData(size, sample) {
    const bytes = new Uint8ClampedArray(size * size * 4);
    const step = 1 / size;
    let offset = 0;
    for (let y = 0; y < size; y += 1) {
      const v = (y + 0.5) / size;
      for (let x = 0; x < size; x += 1) {
        const u = (x + 0.5) / size;
        const rgba = sample(u, v, step);
        bytes[offset] = rgba[0];
        bytes[offset + 1] = rgba[1];
        bytes[offset + 2] = rgba[2];
        bytes[offset + 3] = rgba[3];
        offset += 4;
      }
    }
    return new ImageData(bytes, size, size);
  }

  function channelDataUrl(family, channel, size) {
    const canvas = newCanvas(size);
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.putImageData(makeImageData(size, (u, v, step) => vocabulary.sampleFamilyChannel(family, channel, u, v, step)), 0, 0);
    return canvas.toDataURL('image/png');
  }

  async function generateFamily(family, size, evaluationMeta) {
    const entries = [];
    const channels = vocabulary.familyChannels(family);
    for (let index = 0; index < channels.length; index += 1) {
      const channel = channels[index];
      const entry = vocabulary.makeFamilyEntry(family, channel, channelDataUrl(family, channel, size), size);
      entry.source = Object.assign({}, entry.source, {
        evaluationVersion: evaluation.VERSION,
        evaluationCandidateId: family.id,
        evaluationParentId: family.evaluationVariant && family.evaluationVariant.parentId || null,
        evaluationDescriptorHash: family.evaluationDescriptorHash || evaluation.fnv1a(evaluation.stableStringify(family)),
        evaluationMutation: family.evaluationVariant ? clone(family.evaluationVariant) : null,
        evaluationMeta: evaluationMeta ? clone(evaluationMeta) : null
      });
      entry.usage.note = `${entry.usage.note} Evaluated through v0.8 only as local renderer-path evidence.`;
      entry.tags = [...new Set([...(entry.tags || []), 'v0.8-evaluation', family.evaluationVariant ? 'evaluation-variant' : 'evaluation-base'])];
      entries.push(entry);
      if (index % 2 === 1) await yieldEventLoop();
    }
    const record = vocabulary.makeFamilyRecord(family, entries.map((entry) => entry.libraryId), nowIso());
    record.purpose += ' Evaluated/generated through v0.8; renderer-health is not an aesthetic or physical-quality certification.';
    record.tags = [...new Set([...(record.tags || []), 'v0.8-evaluation', family.evaluationVariant ? 'evaluation-variant' : 'evaluation-base'])];
    return { family: clone(family), entries, familyRecord: record, size };
  }

  function workspaceFromGenerated(generated) {
    const workspace = influenceCore.createWorkspace(nowIso());
    const recipe = influenceCore.activeRecipe(workspace);
    recipe.name = `${generated.family.name} — v0.8 evaluation`;
    recipe.familyIds = [generated.familyRecord.id];
    recipe.notes = 'Temporary v0.8 evaluation workspace. It exists to feed explicit declared channels through the existing v0.6 renderer; no physical-material certification is implied.';
    generated.entries.forEach((entry) => {
      influenceCore.addLayer(recipe, {
        entryId: entry.libraryId,
        targetChannel: entry.usage.channelHint,
        blendMode: 'normal',
        opacity: 1,
        visible: true,
        role: 'v0.8-evaluation-channel'
      }, nowIso());
    });
    workspace.librarySnapshot = {
      entries: generated.entries.map((entry) => libraryCore.normalizeEntry(entry, nowIso())),
      families: [clone(generated.familyRecord)],
      observedAt: nowIso(),
      source: 'v0.8-material-evaluation-temporary-workspace'
    };
    workspace.updatedAt = nowIso();
    const validation = influenceCore.validateWorkspace(workspace);
    if (!validation.ok) throw new Error(validation.reason);
    return workspace;
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

  async function readInfluenceWorkspace() {
    const db = await openInfluenceDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readonly');
      const request = tx.objectStore('workspaces').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  }

  async function writeInfluenceWorkspace(value) {
    const db = await openInfluenceDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite');
      if (value) tx.objectStore('workspaces').put(value, 'current');
      else tx.objectStore('workspaces').delete('current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  function rendererElements() {
    const rendererCanvas = document.getElementById('rendererCanvas');
    const loadSaved = document.getElementById('rendererLoadSaved');
    const geometry = document.getElementById('rendererGeometry');
    const normalStrength = document.getElementById('rendererNormalStrength');
    const output = document.getElementById('rendererOutput');
    const status = document.getElementById('rendererStatus');
    if (!rendererCanvas || !loadSaved || !geometry || !normalStrength || !output || !status) {
      throw new Error('v0.6 renderer UI is unavailable. Material Evaluation must load after renderer-bridge.js.');
    }
    return { rendererCanvas, loadSaved, geometry, normalStrength, output, status };
  }

  async function waitForRender(recipeId, previousText, timeoutMs) {
    const renderer = rendererElements();
    const started = Date.now();
    while (Date.now() - started < (timeoutMs || 30000)) {
      const text = renderer.output.textContent || '';
      if (text && text !== previousText) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.receipt && parsed.receipt.recipeId === recipeId && parsed.receipt.runtime && parsed.receipt.runtime.drawCompleted) return parsed;
        } catch (error) {
          if (error && error.message && !/^Unexpected token|^Unexpected end/.test(error.message)) throw error;
        }
      }
      await sleep(30);
    }
    throw new Error(`Timed out waiting for v0.6 renderer receipt for recipe ${recipeId}.`);
  }

  function readRendererPixels() {
    const canvas = rendererElements().rendererCanvas;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('Existing v0.6 WebGL context is unavailable.');
    const width = canvas.width;
    const height = canvas.height;
    const raw = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const flipped = new Uint8ClampedArray(raw.length);
    const stride = width * 4;
    for (let y = 0; y < height; y += 1) flipped.set(raw.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
    return { rgba: flipped, width, height };
  }

  function pixelsToDataUrl(frame) {
    const canvas = newCanvas(frame.width);
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(frame.rgba, frame.width, frame.height), 0, 0);
    return canvas.toDataURL('image/png');
  }

  async function renderObservation(workspace, recipeId, rig, geometry, candidate) {
    const renderer = rendererElements();
    const temp = clone(workspace);
    const recipe = temp.recipes.find((item) => item.id === recipeId) || temp.recipes[0];
    recipe.lightRig = clone(rig);
    temp.activeRecipeId = recipe.id;
    temp.updatedAt = nowIso();
    await writeInfluenceWorkspace(temp);
    renderer.geometry.value = geometry;
    renderer.normalStrength.value = String(candidate && Number(candidate.normalStrength) || 1);
    renderer.normalStrength.dispatchEvent(new Event('input', { bubbles: true }));
    const before = renderer.output.textContent || '';
    renderer.loadSaved.click();
    const parsed = await waitForRender(recipe.id, before, 30000);
    const frame = readRendererPixels();
    const summary = evaluation.summarizeFramebuffer(frame.rgba, frame.width, frame.height);
    const observation = evaluation.evaluateRenderObservation({
      id: `obs-${evaluation.fnv1a(`${candidate && candidate.id || recipe.id}|${geometry}|${rig.id}|${summary.pixelHash}`)}`,
      lightRigId: rig.id,
      lightRigName: rig.name,
      geometry,
      receipt: parsed.receipt,
      summary
    });
    return { observation, dataUrl: pixelsToDataUrl(frame) };
  }

  async function evaluateWorkspaceCandidate(workspace, candidate, sourceKind, descriptorHash, mode) {
    const recipe = workspace.recipes.find((item) => item.id === workspace.activeRecipeId) || workspace.recipes[0];
    const geometries = mode === 'deep' ? ['sphere', 'plane', 'cube'] : ['sphere'];
    const observations = [];
    let representative = null;
    for (let g = 0; g < geometries.length; g += 1) {
      for (let r = 0; r < influenceCore.LIGHT_RIGS.length; r += 1) {
        const geometry = geometries[g];
        const rig = influenceCore.LIGHT_RIGS[r];
        el.status.textContent = `${candidate && candidate.name || recipe.name} • ${geometry} • ${r + 1}/${influenceCore.LIGHT_RIGS.length} ${rig.name}`;
        const rendered = await renderObservation(workspace, recipe.id, rig, geometry, candidate);
        observations.push(rendered.observation);
        if (!representative && geometry === 'sphere' && rig.id === 'neutral-studio') {
          representative = { dataUrl: rendered.dataUrl, observationId: rendered.observation.id, geometry, lightRigId: rig.id };
        }
        await yieldEventLoop();
      }
    }
    const run = evaluation.aggregateEvaluationRun({
      candidateId: candidate && candidate.id || recipe.id,
      sourceKind,
      descriptorHash,
      observations
    });
    return { run, representative };
  }

  async function preserveInfluenceState() {
    if (savedInfluenceBeforeRun !== null) return;
    const current = await readInfluenceWorkspace();
    savedInfluenceBeforeRun = current ? { existed: true, value: clone(current) } : { existed: false, value: null };
  }

  async function restoreInfluenceState() {
    if (!savedInfluenceBeforeRun) return;
    await writeInfluenceWorkspace(savedInfluenceBeforeRun.existed ? savedInfluenceBeforeRun.value : null);
    savedInfluenceBeforeRun = null;
  }

  function createFreshSession(source) {
    session = evaluation.createSession({
      createdAt: nowIso(),
      source,
      resolution: resolution(),
      mode: el.mode.value,
      geometries: geometryList(),
      lightRigIds: influenceCore.LIGHT_RIGS.map((rig) => rig.id)
    });
    selectedCandidateId = null;
  }

  async function evaluateFamilyCandidate(family, sourceKind) {
    const generated = await generateFamily(family, resolution(), { sessionId: session.id, sourceKind });
    const workspace = workspaceFromGenerated(generated);
    const descriptorHash = family.evaluationDescriptorHash || evaluation.fnv1a(evaluation.stableStringify(family));
    const evaluated = await evaluateWorkspaceCandidate(workspace, family, sourceKind, descriptorHash, el.mode.value);
    evaluation.addCandidateRun(session, family, evaluated.run, evaluated.representative);
    selectedCandidateId = family.id;
    session.selectedCandidateId = selectedCandidateId;
    renderSession();
    return { generated, evaluated };
  }

  async function evaluateBase() {
    const family = selectedFamily();
    if (!family) return;
    setBusy(true, 'preparing base evaluation…');
    createFreshSession({ kind: 'vocabulary-family', familyId: family.id, familyName: family.name });
    await preserveInfluenceState();
    try {
      await evaluateFamilyCandidate(clone(family), 'v0.7-vocabulary-base');
      el.output.textContent = JSON.stringify({
        evaluationComplete: true,
        sessionId: session.id,
        candidate: family.id,
        run: session.candidates[0] && session.candidates[0].run,
        storageRestored: true,
        boundary: session.truthBoundary
      }, null, 2);
    } finally {
      await restoreInfluenceState();
      setBusy(false, 'base evaluation complete');
    }
  }

  async function evolveAndEvaluate() {
    const family = selectedFamily();
    if (!family) return;
    setBusy(true, 'preparing deterministic variants…');
    createFreshSession({ kind: 'deterministic-evolution', parentFamilyId: family.id, parentFamilyName: family.name, variantCount: 4 });
    await preserveInfluenceState();
    try {
      const candidates = [clone(family), ...evaluation.createDeterministicVariants(family, 4)];
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        el.status.textContent = `candidate ${index + 1}/${candidates.length} • ${candidate.name}`;
        await evaluateFamilyCandidate(candidate, candidate.id === family.id ? 'v0.7-vocabulary-parent' : 'v0.8-deterministic-variant');
      }
      const ranked = session.candidates.slice().sort((a, b) => (a.rank || 999) - (b.rank || 999));
      if (ranked.length) {
        selectedCandidateId = ranked[0].id;
        session.selectedCandidateId = selectedCandidateId;
      }
      renderSession();
      el.output.textContent = JSON.stringify({
        evolutionEvaluationComplete: true,
        sessionId: session.id,
        parent: family.id,
        candidates: ranked.map((row) => ({ id: row.id, rank: row.rank, technicalScore: row.run.technicalScore, minimumTechnicalScore: row.run.minimumTechnicalScore, completionShare: row.run.completionShare })),
        rankingBoundary: session.truthBoundary.ranking,
        mutationBoundary: session.truthBoundary.evolution,
        automaticPromotion: false
      }, null, 2);
    } finally {
      await restoreInfluenceState();
      setBusy(false, 'variant evaluation complete');
    }
  }

  async function evaluateSavedLab() {
    setBusy(true, 'loading saved influence workspace…');
    const saved = await readInfluenceWorkspace();
    if (!saved) { setBusy(false, 'no saved lab'); throw new Error('No explicitly saved v0.5 Influence Lab workspace exists.'); }
    const validation = influenceCore.validateWorkspace(saved);
    if (!validation.ok) { setBusy(false, 'invalid saved lab'); throw new Error(validation.reason); }
    const recipe = saved.recipes.find((item) => item.id === saved.activeRecipeId) || saved.recipes[0];
    createFreshSession({ kind: 'saved-influence-recipe', workspaceId: saved.id, recipeId: recipe.id, recipeName: recipe.name });
    await preserveInfluenceState();
    try {
      const descriptor = {
        id: recipe.id,
        name: recipe.name,
        category: 'external-or-composed-recipe',
        normalStrength: 1,
        savedWorkspaceId: saved.id
      };
      const evaluated = await evaluateWorkspaceCandidate(saved, descriptor, 'saved-v0.5-influence-workspace', influenceCore.recipeFingerprint(recipe), el.mode.value);
      evaluation.addCandidateRun(session, descriptor, evaluated.run, evaluated.representative);
      selectedCandidateId = descriptor.id;
      session.selectedCandidateId = selectedCandidateId;
      renderSession();
      el.output.textContent = JSON.stringify({
        savedRecipeEvaluationComplete: true,
        workspaceId: saved.id,
        recipeId: recipe.id,
        run: evaluated.run,
        note: 'This route allows externally sourced/imported material ingredients already represented in the Influence Lab to enter the same v0.8 evaluation path.'
      }, null, 2);
    } finally {
      await restoreInfluenceState();
      setBusy(false, 'saved recipe evaluation complete');
    }
  }

  function selectedCandidate() {
    return session.candidates.find((candidate) => candidate.id === selectedCandidateId) || null;
  }

  function renderSession() {
    const candidates = session.candidates.slice().sort((a, b) => (a.rank || 999) - (b.rank || 999));
    el.candidateCount.textContent = String(candidates.length);
    el.candidateList.innerHTML = candidates.map((candidate) => {
      const active = candidate.id === selectedCandidateId ? ' selected' : '';
      const run = candidate.run;
      return `<button class="evaluation-candidate${active}" data-evaluation-candidate="${escapeHtml(candidate.id)}">
        <span class="evaluation-rank">#${candidate.rank || '—'}</span>
        <div><strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml(candidate.id)}</small></div>
        <span class="evaluation-score">${Number(run.technicalScore || 0).toFixed(1)}<small>health</small></span>
        <span class="evaluation-complete">${Math.round(Number(run.completionShare || 0) * 100)}%</span>
      </button>`;
    }).join('') || '<div class="inspector-empty">No evaluation candidates yet.</div>';
    renderCandidateDetail();
  }

  function renderCandidateDetail() {
    const candidate = selectedCandidate();
    el.install.disabled = busy || !candidate || !candidate.descriptor || candidate.run.sourceKind === 'saved-v0.5-influence-workspace';
    if (!candidate) {
      el.selectedId.textContent = 'none';
      el.representative.innerHTML = '<span>No renderer result selected.</span>';
      el.metrics.innerHTML = '';
      el.matrix.innerHTML = '';
      return;
    }
    const run = candidate.run;
    el.selectedId.textContent = candidate.id;
    el.representative.innerHTML = candidate.representative && candidate.representative.dataUrl ? `<img src="${candidate.representative.dataUrl}" alt="Representative neutral studio render" />` : '<span>No neutral-studio representative image captured.</span>';
    el.metrics.innerHTML = `
      <div><span>Technical health</span><strong>${Number(run.technicalScore || 0).toFixed(2)}</strong></div>
      <div><span>Minimum</span><strong>${Number(run.minimumTechnicalScore || 0).toFixed(2)}</strong></div>
      <div><span>Completion</span><strong>${Math.round(Number(run.completionShare || 0) * 100)}%</strong></div>
      <div><span>Observations</span><strong>${run.observationCount}</strong></div>
      <div><span>Unique framebuffers</span><strong>${run.uniqueFramebufferHashes}</strong></div>
      <div><span>Cross-light luma range</span><strong>${Number(run.crossLightMeanLumaRange || 0).toFixed(3)}</strong></div>
      <div><span>Holds</span><strong>${run.holds}</strong></div>
      <div><span>Rank</span><strong>#${candidate.rank || '—'}</strong></div>
    `;
    el.matrix.innerHTML = (run.observations || []).map((observation) => `
      <article class="evaluation-observation ${observation.truthStatus === 'HOLD_RENDER_PATH' ? 'held' : ''}">
        <strong>${escapeHtml(observation.geometry)} • ${escapeHtml(observation.lightRigName || observation.lightRigId || '')}</strong>
        <span>${Number(observation.technicalScore || 0).toFixed(1)} health</span>
        <small>${escapeHtml(observation.summary && observation.summary.pixelHash || 'no hash')}</small>
        ${(observation.signals || []).length ? `<small>${escapeHtml(observation.signals.join(', '))}</small>` : ''}
        ${(observation.holds || []).length ? `<small class="held-text">${escapeHtml(observation.holds.join(', '))}</small>` : ''}
      </article>`).join('');
    el.output.textContent = JSON.stringify({
      selectedCandidate: candidate.id,
      rank: candidate.rank,
      descriptorHash: candidate.descriptorHash,
      run,
      boundary: session.truthBoundary
    }, null, 2);
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

  async function installSelectedCandidate() {
    const candidate = selectedCandidate();
    if (!candidate || !candidate.descriptor) throw new Error('Select an evaluated generated candidate first.');
    if (candidate.run.sourceKind === 'saved-v0.5-influence-workspace') throw new Error('Saved composed recipes are evaluated in place; this install action is for generated vocabulary-family descriptors only.');
    if (!window.confirm(`Install evaluated candidate “${candidate.name}” into the persistent material library? This is an explicit promotion based only on the evidence you reviewed; v0.8 does not claim the candidate is aesthetically or physically superior.`)) return;
    setBusy(true, 'generating selected candidate for explicit install…');
    try {
      const generated = await generateFamily(candidate.descriptor, resolution(), {
        sessionId: session.id,
        rank: candidate.rank,
        technicalScore: candidate.run.technicalScore,
        minimumTechnicalScore: candidate.run.minimumTechnicalScore,
        completionShare: candidate.run.completionShare,
        promotion: 'explicit-user-action'
      });
      const library = await readLibrary();
      const stamp = nowIso();
      const receipt = libraryCore.upsertEntries(library, generated.entries, stamp);
      libraryCore.createFamily(library, generated.familyRecord, stamp);
      await writeLibrary(library);
      const installReceipt = {
        installedAt: stamp,
        candidateId: candidate.id,
        candidateRank: candidate.rank,
        sessionId: session.id,
        added: receipt.added,
        updated: receipt.updated,
        libraryEntries: receipt.total,
        evidence: {
          technicalScore: candidate.run.technicalScore,
          minimumTechnicalScore: candidate.run.minimumTechnicalScore,
          completionShare: candidate.run.completionShare,
          scoreBoundary: candidate.run.scoreBoundary
        },
        authority: 'explicit-user-promotion',
        truthBoundary: 'Installation records that this candidate was explicitly selected after bounded renderer-path evaluation. It does not certify visual superiority or physical correctness.'
      };
      evaluation.recordInstall(session, installReceipt);
      el.output.textContent = JSON.stringify(installReceipt, null, 2);
    } finally { setBusy(false, 'candidate installed'); renderCandidateDetail(); }
  }

  function openEvaluationDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('axm-material-evaluation-v8', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveSession() {
    const db = await openEvaluationDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put(session, 'current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    el.output.textContent = JSON.stringify({ saved: true, sessionId: session.id, candidates: session.candidates.length, installs: session.installReceipts.length }, null, 2);
  }

  async function loadSession() {
    const db = await openEvaluationDb();
    const loaded = await new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const request = tx.objectStore('sessions').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!loaded) throw new Error('No explicitly saved v0.8 evaluation session exists in this browser.');
    const validation = evaluation.validateSession(loaded);
    if (!validation.ok) throw new Error(validation.reason);
    session = loaded;
    selectedCandidateId = session.selectedCandidateId || session.candidates[0] && session.candidates[0].id || null;
    renderSession();
    el.output.textContent = JSON.stringify({ loaded: true, sessionId: session.id, candidates: session.candidates.length, installs: session.installReceipts.length }, null, 2);
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

  function reportError(error) {
    restoreInfluenceState().catch(() => {});
    setBusy(false, 'error');
    el.output.textContent = JSON.stringify({ error: error && error.message ? error.message : String(error) }, null, 2);
  }

  el.family.addEventListener('change', () => { selectedFamilyId = el.family.value; });
  el.candidateList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-evaluation-candidate]');
    if (!button || busy) return;
    selectedCandidateId = button.dataset.evaluationCandidate;
    session.selectedCandidateId = selectedCandidateId;
    renderSession();
  });
  el.evaluateBase.addEventListener('click', () => evaluateBase().catch(reportError));
  el.evolve.addEventListener('click', () => evolveAndEvaluate().catch(reportError));
  el.saved.addEventListener('click', () => evaluateSavedLab().catch(reportError));
  el.install.addEventListener('click', () => installSelectedCandidate().catch(reportError));
  el.save.addEventListener('click', () => saveSession().catch(reportError));
  el.load.addEventListener('click', () => loadSession().catch(reportError));
  el.export.addEventListener('click', () => download('axm-material-evaluation-v0.8.json', session));
  el.importButton.addEventListener('click', () => el.importInput.click());
  el.importInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const validation = evaluation.validateSession(parsed);
      if (!validation.ok) throw new Error(validation.reason);
      session = parsed;
      selectedCandidateId = session.selectedCandidateId || session.candidates[0] && session.candidates[0].id || null;
      renderSession();
      el.output.textContent = JSON.stringify({ imported: true, file: file.name, sessionId: session.id, candidates: session.candidates.length }, null, 2);
    } catch (error) { reportError(error); }
  });

  renderFamilyOptions();
  renderSession();
  el.output.textContent = JSON.stringify({
    message: 'v0.8 Material Evaluation / Evolution is ready. Evaluate a vocabulary family or saved composed recipe through the existing v0.6 WebGL renderer. Deterministic variants can be compared and ranked by bounded renderer-path technical health, but installation remains an explicit reviewed action.',
    scoreBoundary: session.truthBoundary.ranking,
    evolutionBoundary: session.truthBoundary.evolution,
    automaticPromotion: false
  }, null, 2);
})();
