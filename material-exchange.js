(function () {
  'use strict';

  const exchange = window.AXMMaterialExchangeCore;
  const libraryCore = window.AXMMaterialLibraryCore;
  const influenceCore = window.AXMMaterialInfluenceCore;
  if (!exchange || !libraryCore || !influenceCore) throw new Error('Material Exchange requires exchange, library, and influence cores.');

  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  const RECORD_FORMAT = 'axm-material-exchange-workspace';
  let record = freshRecord();
  let busy = false;

  function nowIso() { return new Date().toISOString(); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  function freshRecord() {
    return {
      format: RECORD_FORMAT,
      version: exchange.VERSION,
      id: `exchange-${exchange.fnv1a(nowIso())}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      offer: null,
      verification: {},
      selectedFamilyId: null,
      evaluationSession: null,
      installReceipts: [],
      feedbackHistory: [],
      manualStageBackup: null,
      truthBoundary: {
        transport: 'Cross-machine packets preserve declared identity and bytes; importing a packet does not make its semantic or quality claims true.',
        evaluation: 'Renderer feedback is bounded technical evidence, not beauty, realism or physical-material certification.',
        authority: 'No offer, score or feedback packet grants automatic install/adoption authority.'
      }
    };
  }

  const panel = document.createElement('section');
  panel.className = 'panel material-exchange-panel';
  panel.innerHTML = `
    <div class="panel-heading exchange-heading">
      <div><div class="panel-kicker">12</div><h2>Cross-Machine Material Exchange</h2></div>
      <span class="count-pill">v0.9</span>
    </div>
    <div class="truth-note">
      Portable interchange floor for materials created by Game Asset Forge, FrameState, Universal Creation, image generators, authored tools, or later AXM machines. Producer declarations, receiver byte verification, renderer evidence and adoption authority remain separate.
    </div>

    <div class="exchange-toolbar">
      <button class="button accent" id="exchangeImport">Import material offer</button>
      <input id="exchangeImportInput" type="file" accept="application/json,.json" hidden />
      <button class="button" id="exchangeExportOffer" disabled>Export normalized offer</button>
      <button class="button" id="exchangeSave">Save exchange</button>
      <button class="button" id="exchangeLoad">Load exchange</button>
      <button class="button" id="exchangeExportRecord">Export exchange record</button>
    </div>

    <div class="exchange-layout">
      <section class="exchange-offer influence-subpanel">
        <div class="influence-subheading"><strong>Producer / offer</strong><span id="exchangeOfferStatus">none</span></div>
        <div id="exchangeProducer" class="exchange-producer"></div>
        <label>Family<select id="exchangeFamily"></select></label>
        <div id="exchangeFamilyState" class="exchange-family-state"></div>
      </section>

      <section class="exchange-entries influence-subpanel">
        <div class="influence-subheading"><strong>Payload verification</strong><span id="exchangeEntryCount">0</span></div>
        <div id="exchangeEntryList" class="exchange-entry-list"></div>
      </section>
    </div>

    <div class="exchange-actions">
      <button class="button" id="exchangeVerify" disabled>Verify portable bytes</button>
      <button class="button" id="exchangeInstall" disabled>Install selected family</button>
      <button class="button" id="exchangeStage" disabled>Stage selected → Influence Lab</button>
      <button class="button" id="exchangeRestoreStage" disabled>Restore previous lab</button>
      <button class="button primary" id="exchangeEvaluate" disabled>Evaluate selected family</button>
      <button class="button" id="exchangeFeedback" disabled>Export feedback</button>
      <span id="exchangeActionStatus">idle</span>
    </div>

    <section class="exchange-feedback influence-subpanel">
      <div class="influence-subheading"><strong>Feedback / continuity</strong><span>offer → evaluation → receipt</span></div>
      <div id="exchangeFeedbackSummary" class="exchange-feedback-summary"></div>
      <pre id="exchangeOutput" class="state-output exchange-output" tabindex="0"></pre>
    </section>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    importButton: panel.querySelector('#exchangeImport'),
    importInput: panel.querySelector('#exchangeImportInput'),
    exportOffer: panel.querySelector('#exchangeExportOffer'),
    save: panel.querySelector('#exchangeSave'),
    load: panel.querySelector('#exchangeLoad'),
    exportRecord: panel.querySelector('#exchangeExportRecord'),
    offerStatus: panel.querySelector('#exchangeOfferStatus'),
    producer: panel.querySelector('#exchangeProducer'),
    family: panel.querySelector('#exchangeFamily'),
    familyState: panel.querySelector('#exchangeFamilyState'),
    entryCount: panel.querySelector('#exchangeEntryCount'),
    entryList: panel.querySelector('#exchangeEntryList'),
    verify: panel.querySelector('#exchangeVerify'),
    install: panel.querySelector('#exchangeInstall'),
    stage: panel.querySelector('#exchangeStage'),
    restoreStage: panel.querySelector('#exchangeRestoreStage'),
    evaluate: panel.querySelector('#exchangeEvaluate'),
    feedback: panel.querySelector('#exchangeFeedback'),
    actionStatus: panel.querySelector('#exchangeActionStatus'),
    feedbackSummary: panel.querySelector('#exchangeFeedbackSummary'),
    output: panel.querySelector('#exchangeOutput')
  };

  function offer() { return record.offer ? exchange.normalizeOffer(record.offer) : null; }
  function selectedFamily() {
    const current = offer();
    return current && current.families.find((family) => family.id === record.selectedFamilyId) || null;
  }

  function setBusy(value, status) {
    busy = Boolean(value);
    [el.importButton, el.verify, el.install, el.stage, el.restoreStage, el.evaluate, el.feedback, el.family].forEach((control) => { control.disabled = busy || control.dataset.exchangePermanentlyDisabled === 'true'; });
    if (status) el.actionStatus.textContent = status;
    updateButtons();
  }

  function updateButtons() {
    const current = offer();
    const family = selectedFamily();
    el.exportOffer.disabled = busy || !current;
    el.verify.disabled = busy || !current;
    el.install.disabled = busy || !family;
    el.stage.disabled = busy || !family;
    el.restoreStage.disabled = busy || !record.manualStageBackup;
    el.evaluate.disabled = busy || !family || !document.getElementById('evaluationSaved');
    el.feedback.disabled = busy || !family || !record.evaluationSession;
  }

  function render() {
    const current = offer();
    if (!current) {
      el.offerStatus.textContent = 'no offer';
      el.producer.innerHTML = '<div class="inspector-empty">Import one `axm-material-offer/v0.9.0` packet. Nothing is connected or uploaded automatically.</div>';
      el.family.innerHTML = '<option value="">No offer</option>';
      el.familyState.innerHTML = '';
      el.entryCount.textContent = '0';
      el.entryList.innerHTML = '<div class="inspector-empty">No material entries.</div>';
      el.feedbackSummary.innerHTML = '';
      updateButtons();
      return;
    }

    const plan = exchange.intakePlan(current, record.verification);
    const producer = current.producer;
    el.offerStatus.textContent = `${current.id} • ${plan.offerFingerprint}`;
    el.producer.innerHTML = `
      <div><span>System</span><strong>${escapeHtml(producer.system)}</strong></div>
      <div><span>Repository</span><strong>${escapeHtml(producer.repo || 'not declared')}</strong></div>
      <div><span>Source</span><strong>${escapeHtml(producer.sourceId || 'not declared')}</strong></div>
      <div><span>Source digest</span><strong>${escapeHtml(producer.sourceDigest || 'not declared')}</strong></div>
      <div><span>Portable</span><strong>${plan.summary.portable}/${plan.summary.entries}</strong></div>
      <div><span>Held</span><strong>${plan.summary.held}</strong></div>
    `;
    el.family.innerHTML = current.families.map((family) => `<option value="${escapeHtml(family.id)}" ${family.id === record.selectedFamilyId ? 'selected' : ''}>${escapeHtml(family.name)}</option>`).join('');

    const family = selectedFamily();
    const familyPlan = family && plan.families.find((item) => item.id === family.id);
    el.familyState.innerHTML = familyPlan ? `
      <span class="exchange-state ${escapeHtml(familyPlan.state)}">${escapeHtml(familyPlan.state)}</span>
      <span>${familyPlan.portable}/${familyPlan.entries} portable</span>
      <span>${familyPlan.holds} held</span>
      <span>${familyPlan.pending} awaiting hash verification</span>
    ` : '';

    const selectedIds = new Set(family ? family.entryIds : current.entries.map((entry) => entry.id));
    const stateById = new Map(plan.entries.map((state) => [state.entryId, state]));
    const rows = current.entries.filter((entry) => selectedIds.has(entry.id));
    el.entryCount.textContent = String(rows.length);
    el.entryList.innerHTML = rows.map((entry) => {
      const state = stateById.get(entry.id);
      const verification = record.verification[entry.id] || {};
      return `<article class="exchange-entry ${state && state.state === 'hold' ? 'held' : ''}">
        <div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.id)}</small></div>
        <span>${escapeHtml(entry.channel)}</span>
        <span>${entry.width || '?'}×${entry.height || '?'}</span>
        <span class="exchange-state ${escapeHtml(state && state.state || 'unknown')}">${escapeHtml(state && state.state || 'unknown')}</span>
        <small>${entry.sha256 ? `declared ${escapeHtml(entry.sha256.slice(0, 20))}…` : 'no producer SHA-256'}</small>
        <small>${verification.observedSha256 ? `observed ${escapeHtml(verification.observedSha256.slice(0, 20))}…` : state && state.reason ? escapeHtml(state.reason) : ''}</small>
      </article>`;
    }).join('');

    const evaluation = record.evaluationSession && exchange.summarizeEvaluationSession(record.evaluationSession);
    const installs = record.installReceipts.filter((receipt) => receipt.offerId === current.id && receipt.familyId === record.selectedFamilyId);
    el.feedbackSummary.innerHTML = `
      <div><span>Evaluation</span><strong>${evaluation ? escapeHtml(evaluation.id || 'recorded') : 'not run'}</strong></div>
      <div><span>Mode</span><strong>${evaluation ? escapeHtml(evaluation.mode || 'unknown') : '—'}</strong></div>
      <div><span>Candidates</span><strong>${evaluation ? evaluation.candidates.length : 0}</strong></div>
      <div><span>Explicit installs</span><strong>${installs.length}</strong></div>
      <div><span>Feedback packets</span><strong>${record.feedbackHistory.length}</strong></div>
    `;
    updateButtons();
  }

  function dataUrlBytes(dataUrl) {
    const comma = String(dataUrl).indexOf(',');
    if (comma < 0) throw new Error('Invalid data URL.');
    const header = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    if (!/;base64$/i.test(header)) throw new Error('Only base64 image data URLs are accepted by v0.9 verification.');
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  async function sha256(bytes) {
    if (!window.crypto || !window.crypto.subtle) throw new Error('Web Crypto SHA-256 is unavailable in this browser context.');
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return `sha256:${hex}`;
  }

  async function verifyOffer() {
    const current = offer();
    if (!current) return;
    setBusy(true, 'verifying portable bytes…');
    try {
      const verification = {};
      for (let index = 0; index < current.entries.length; index += 1) {
        const entry = current.entries[index];
        if (!entry.dataUrl) {
          verification[entry.id] = { portable: false, sha256Match: null, observedSha256: null, verifiedAt: nowIso() };
          continue;
        }
        el.actionStatus.textContent = `verifying ${index + 1}/${current.entries.length} • ${entry.name}`;
        const observedSha256 = await sha256(dataUrlBytes(entry.dataUrl));
        verification[entry.id] = {
          portable: true,
          observedSha256,
          declaredSha256: entry.sha256,
          sha256Match: entry.sha256 ? observedSha256.toLowerCase() === entry.sha256.toLowerCase() : null,
          verifiedAt: nowIso()
        };
        await sleep(0);
      }
      record.verification = verification;
      record.updatedAt = nowIso();
      render();
      const plan = exchange.intakePlan(current, verification);
      el.output.textContent = JSON.stringify({ verified: true, offerId: current.id, summary: plan.summary, verification }, null, 2);
    } finally { setBusy(false, 'verification complete'); }
  }

  function openLibraryDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('axm-material-library-v4', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('libraries')) request.result.createObjectStore('libraries');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readLibrary() {
    const db = await openLibraryDb();
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction('libraries', 'readonly').objectStore('libraries').get('current');
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

  async function installFamily() {
    const current = offer();
    const family = selectedFamily();
    if (!current || !family) return;
    const plan = exchange.intakePlan(current, record.verification);
    const mismatches = plan.entries.filter((state) => state.reason === 'sha256-mismatch' && family.entryIds.includes(state.entryId));
    if (mismatches.length) throw new Error(`Installation blocked: ${mismatches.length} selected payload(s) fail producer SHA-256 verification.`);
    const familyPlan = plan.families.find((item) => item.id === family.id);
    if (familyPlan.holds && !window.confirm(`This family contains ${familyPlan.holds} held/metadata-only entr${familyPlan.holds === 1 ? 'y' : 'ies'}. Install the family while preserving those HOLD states?`)) return;
    setBusy(true, 'installing selected family…');
    try {
      const stamp = nowIso();
      const bundle = exchange.toLibraryBundle(current, family.id, record.verification, stamp);
      const library = await readLibrary();
      const receipt = libraryCore.upsertEntries(library, bundle.entries, stamp);
      libraryCore.createFamily(library, bundle.family, stamp);
      await writeLibrary(library);
      const installReceipt = {
        installedAt: stamp,
        offerId: current.id,
        offerFingerprint: exchange.offerFingerprint(current),
        familyId: family.id,
        libraryFamilyId: bundle.family.id,
        added: receipt.added,
        updated: receipt.updated,
        libraryEntries: receipt.total,
        intakeSummary: bundle.intake.summary,
        authority: 'explicit-local-install-action',
        truthBoundary: 'Installation preserves producer declarations and receiver verification state; it does not certify material quality or physical correctness.'
      };
      record.installReceipts.push(installReceipt);
      record.updatedAt = stamp;
      render();
      el.output.textContent = JSON.stringify(installReceipt, null, 2);
    } finally { setBusy(false, 'family installed'); }
  }

  function openInfluenceDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('axm-material-influence-v5', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('workspaces')) request.result.createObjectStore('workspaces');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readInfluence() {
    const db = await openInfluenceDb();
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction('workspaces', 'readonly').objectStore('workspaces').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  }

  async function writeInfluence(value) {
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

  function workspaceForSelectedFamily() {
    const current = offer();
    const family = selectedFamily();
    if (!current || !family) throw new Error('Import an offer and select a family first.');
    const bundle = exchange.toLibraryBundle(current, family.id, record.verification, nowIso());
    const workspace = influenceCore.createWorkspace(nowIso());
    const recipe = influenceCore.activeRecipe(workspace);
    recipe.name = `${family.name} — ${current.producer.system}`;
    recipe.familyIds = [bundle.family.id];
    recipe.notes = `v0.9 cross-machine staging from offer ${current.id}. Producer-declared material channels remain declarations; receiver rendering/evaluation is separate evidence.`;
    bundle.entries.forEach((entry) => {
      influenceCore.addLayer(recipe, {
        entryId: entry.libraryId,
        targetChannel: entry.usage.channelHint,
        blendMode: entry.usage.channelHint === 'decal' || entry.usage.channelHint === 'microdetail' ? 'overlay' : 'normal',
        opacity: 1,
        visible: true,
        role: 'v0.9-cross-machine-material'
      }, nowIso());
    });
    workspace.librarySnapshot = {
      entries: bundle.entries.map((entry) => libraryCore.normalizeEntry(entry, nowIso())),
      families: [clone(bundle.family)],
      observedAt: nowIso(),
      source: `v0.9-offer:${current.id}`
    };
    workspace.updatedAt = nowIso();
    const validation = influenceCore.validateWorkspace(workspace);
    if (!validation.ok) throw new Error(validation.reason);
    return workspace;
  }

  async function stageFamilyManually() {
    if (!window.confirm('Stage this cross-machine family as the current saved Influence Lab workspace? v0.9 will retain the previous workspace so you can restore it with “Restore previous lab”.')) return;
    setBusy(true, 'staging selected family…');
    try {
      if (!record.manualStageBackup) {
        const previous = await readInfluence();
        record.manualStageBackup = { existed: Boolean(previous), value: previous ? clone(previous) : null, capturedAt: nowIso() };
      }
      const workspace = workspaceForSelectedFamily();
      await writeInfluence(workspace);
      const rendererLoad = document.getElementById('rendererLoadSaved');
      if (rendererLoad) rendererLoad.click();
      record.updatedAt = nowIso();
      render();
      el.output.textContent = JSON.stringify({ staged: true, workspaceId: workspace.id, recipeId: workspace.activeRecipeId, previousWorkspaceRetained: true, rendererLoadRequested: Boolean(rendererLoad) }, null, 2);
    } finally { setBusy(false, 'family staged'); }
  }

  async function restoreManualStage() {
    if (!record.manualStageBackup) return;
    setBusy(true, 'restoring previous lab…');
    try {
      await writeInfluence(record.manualStageBackup.existed ? record.manualStageBackup.value : null);
      const restored = clone(record.manualStageBackup);
      record.manualStageBackup = null;
      record.updatedAt = nowIso();
      render();
      el.output.textContent = JSON.stringify({ restored: true, previousWorkspaceExisted: restored.existed, capturedAt: restored.capturedAt }, null, 2);
    } finally { setBusy(false, 'previous lab restored'); }
  }

  function openEvaluationDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('axm-material-evaluation-v8', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('sessions')) request.result.createObjectStore('sessions');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readEvaluationSession() {
    const db = await openEvaluationDb();
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction('sessions', 'readonly').objectStore('sessions').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  }

  async function waitForEvaluation(recipeId, before, timeoutMs) {
    const output = document.getElementById('evaluationOutput');
    const started = Date.now();
    while (Date.now() - started < (timeoutMs || 180000)) {
      const text = output && output.textContent || '';
      if (text && text !== before) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.savedRecipeEvaluationComplete && parsed.recipeId === recipeId) return parsed;
        } catch (error) {
          if (error && error.message && !/^Unexpected token|^Unexpected end/.test(error.message)) throw error;
        }
      }
      await sleep(100);
    }
    throw new Error(`Timed out waiting for v0.8 evaluation of recipe ${recipeId}.`);
  }

  async function waitForSavedEvaluation(recipeId, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < (timeoutMs || 30000)) {
      const session = await readEvaluationSession();
      if (session && session.source && session.source.recipeId === recipeId) return session;
      await sleep(100);
    }
    throw new Error(`Timed out waiting for v0.8 session persistence for recipe ${recipeId}.`);
  }

  async function evaluateSelectedFamily() {
    const evaluationButton = document.getElementById('evaluationSaved');
    const saveButton = document.getElementById('evaluationSave');
    const output = document.getElementById('evaluationOutput');
    if (!evaluationButton || !saveButton || !output) throw new Error('v0.8 Material Evaluation UI is unavailable.');
    const previous = await readInfluence();
    const staged = workspaceForSelectedFamily();
    const recipeId = staged.activeRecipeId;
    setBusy(true, 'staging temporary evaluation workspace…');
    try {
      await writeInfluence(staged);
      const before = output.textContent || '';
      evaluationButton.click();
      el.actionStatus.textContent = 'v0.8 renderer evaluation running…';
      const result = await waitForEvaluation(recipeId, before, 180000);
      saveButton.click();
      const session = await waitForSavedEvaluation(recipeId, 30000);
      record.evaluationSession = clone(session);
      record.updatedAt = nowIso();
      render();
      el.output.textContent = JSON.stringify({
        crossMachineEvaluationComplete: true,
        offerId: offer().id,
        familyId: record.selectedFamilyId,
        stagedRecipeId: recipeId,
        evaluationResult: result,
        evaluationSessionId: session.id,
        previousInfluenceWorkspaceRestored: true,
        boundary: 'This is receiver-side v0.8 renderer-path evidence. It does not certify producer semantics, aesthetics, PBR correctness or physical behavior.'
      }, null, 2);
    } finally {
      await writeInfluence(previous || null);
      setBusy(false, 'cross-machine evaluation complete');
    }
  }

  function latestInstallReceipt() {
    const current = offer();
    if (!current) return null;
    return record.installReceipts.slice().reverse().find((receipt) => receipt.offerId === current.id && receipt.familyId === record.selectedFamilyId) || null;
  }

  function buildFeedback() {
    const current = offer();
    const family = selectedFamily();
    if (!current || !family) throw new Error('No selected offer family.');
    if (!record.evaluationSession) throw new Error('Run or load an evaluation before exporting feedback.');
    return exchange.makeFeedback({
      offer: current,
      familyId: family.id,
      evaluationSession: record.evaluationSession,
      verification: record.verification,
      installReceipt: latestInstallReceipt(),
      createdAt: nowIso(),
      notes: 'Generated by the receiving Material / Surface Fabric. Producer adoption remains a separate explicit decision.'
    });
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

  function exportFeedback() {
    const feedback = buildFeedback();
    record.feedbackHistory.push({ id: feedback.id, createdAt: feedback.createdAt, offer: feedback.offer, evaluationSessionId: feedback.evaluation && feedback.evaluation.id });
    record.updatedAt = nowIso();
    download(`axm-material-feedback-${feedback.offer.familyId}-v0.9.json`, feedback);
    render();
    el.output.textContent = JSON.stringify(feedback, null, 2);
  }

  function openExchangeDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('axm-material-exchange-v9', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveRecord() {
    const db = await openExchangeDb();
    record.updatedAt = nowIso();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      tx.objectStore('records').put(record, 'current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    el.output.textContent = JSON.stringify({ saved: true, exchangeId: record.id, offerId: record.offer && record.offer.id, feedbackPackets: record.feedbackHistory.length }, null, 2);
  }

  async function loadRecord() {
    const db = await openExchangeDb();
    const loaded = await new Promise((resolve, reject) => {
      const request = db.transaction('records', 'readonly').objectStore('records').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!loaded) throw new Error('No explicitly saved v0.9 exchange record exists in this browser.');
    if (loaded.format !== RECORD_FORMAT || loaded.version !== exchange.VERSION) throw new Error(`Expected ${RECORD_FORMAT}/${exchange.VERSION}.`);
    if (loaded.offer && !exchange.validateOffer(loaded.offer).ok) throw new Error(exchange.validateOffer(loaded.offer).reason);
    record = loaded;
    render();
    el.output.textContent = JSON.stringify({ loaded: true, exchangeId: record.id, offerId: record.offer && record.offer.id, familyId: record.selectedFamilyId }, null, 2);
  }

  function reportError(error) {
    setBusy(false, 'error');
    el.output.textContent = JSON.stringify({ error: error && error.message ? error.message : String(error) }, null, 2);
  }

  el.importButton.addEventListener('click', () => el.importInput.click());
  el.importInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const validation = exchange.validateOffer(parsed);
      if (!validation.ok) throw new Error(validation.reason);
      const normalized = exchange.normalizeOffer(parsed);
      record = freshRecord();
      record.offer = normalized;
      record.selectedFamilyId = normalized.families[0].id;
      record.updatedAt = nowIso();
      render();
      el.output.textContent = JSON.stringify({ imported: true, file: file.name, offerId: normalized.id, fingerprint: exchange.offerFingerprint(normalized), producer: normalized.producer, intake: exchange.intakePlan(normalized, {}) }, null, 2);
    } catch (error) { reportError(error); }
  });
  el.family.addEventListener('change', () => {
    record.selectedFamilyId = el.family.value;
    record.evaluationSession = null;
    record.updatedAt = nowIso();
    render();
  });
  el.verify.addEventListener('click', () => verifyOffer().catch(reportError));
  el.install.addEventListener('click', () => installFamily().catch(reportError));
  el.stage.addEventListener('click', () => stageFamilyManually().catch(reportError));
  el.restoreStage.addEventListener('click', () => restoreManualStage().catch(reportError));
  el.evaluate.addEventListener('click', () => evaluateSelectedFamily().catch(reportError));
  el.feedback.addEventListener('click', () => { try { exportFeedback(); } catch (error) { reportError(error); } });
  el.exportOffer.addEventListener('click', () => { const current = offer(); if (current) download(`axm-material-offer-${current.id}-v0.9.json`, current); });
  el.save.addEventListener('click', () => saveRecord().catch(reportError));
  el.load.addEventListener('click', () => loadRecord().catch(reportError));
  el.exportRecord.addEventListener('click', () => download('axm-material-exchange-workspace-v0.9.json', record));

  render();
  el.output.textContent = JSON.stringify({
    message: 'v0.9 Cross-Machine Material Exchange is ready. Import an explicit material offer, verify portable bytes, install or stage a selected family, run it through the existing v0.8 evaluation path, then return a feedback packet. No producer repository is contacted automatically.',
    offerFormat: `${exchange.OFFER_FORMAT}/${exchange.VERSION}`,
    feedbackFormat: `${exchange.FEEDBACK_FORMAT}/${exchange.VERSION}`,
    truthBoundary: record.truthBoundary
  }, null, 2);
})();
