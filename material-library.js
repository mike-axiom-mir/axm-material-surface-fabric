(function () {
  'use strict';

  const core = window.AXMMaterialLibraryCore;
  if (!core) throw new Error('AXMMaterialLibraryCore is required before material-library.js');

  const stateOutput = document.getElementById('stateOutput');
  const stateActions = document.querySelector('.state-actions');
  const assetGrid = document.getElementById('assetGrid');
  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!stateOutput || !stateActions || !assetGrid || !workspaceGrid) return;

  function nowIso() { return new Date().toISOString(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  let library = core.createLibrary(nowIso());
  let selected = new Set();
  let filter = '';

  const panel = document.createElement('section');
  panel.className = 'panel material-library-panel';
  panel.innerHTML = `
    <div class="panel-heading material-library-heading">
      <div><div class="panel-kicker">07</div><h2>Reusable Material Library</h2></div>
      <span class="count-pill" id="materialLibraryCount">0</span>
    </div>
    <div class="truth-note">
      Persistent local reuse layer. Exact image payloads and recorded source metadata are preserved when available. Channel labels are editable routing hints, not automatic physical-material recognition.
    </div>
    <div class="material-library-direction">
      <strong>Shared role</strong>
      <span>visual sources → material library → families / donor packs → explicit adapters in Universal Creation, Game Assets, FrameState and later visual systems</span>
    </div>

    <div class="material-library-toolbar">
      <button class="button accent" id="libraryIntakeShelf">Intake current shelf</button>
      <button class="button" id="librarySave">Save library</button>
      <button class="button" id="libraryLoad">Load library</button>
      <button class="button" id="libraryImportPack">Import donor pack</button>
      <button class="button primary" id="libraryExportPack">Export selected donor pack</button>
      <button class="button" id="libraryExportJson">Export library</button>
      <button class="button" id="libraryImportJson">Import library</button>
      <input id="libraryPackInput" type="file" accept="application/json,.json" hidden />
      <input id="libraryJsonInput" type="file" accept="application/json,.json" hidden />
    </div>

    <div class="material-library-controls">
      <input id="materialLibraryFilter" type="search" placeholder="Filter reusable materials…" autocomplete="off" />
      <button class="mini-button" id="librarySelectAll">Select visible</button>
      <button class="mini-button" id="librarySelectNone">Clear selection</button>
      <span id="librarySelectedCount">0 selected</span>
    </div>

    <div class="material-family-builder">
      <label>Family name<input id="materialFamilyName" placeholder="painted industrial metal" autocomplete="off" /></label>
      <label>Purpose<input id="materialFamilyPurpose" placeholder="base + wear + grime reusable together" autocomplete="off" /></label>
      <button class="button" id="materialFamilyCreate">Create family from selection</button>
    </div>

    <div class="material-library-grid" id="materialLibraryGrid"></div>

    <div class="material-families">
      <div class="material-family-title"><strong>Families</strong><span id="materialFamilyCount">0</span></div>
      <div id="materialFamilyList"></div>
    </div>

    <pre class="state-output material-library-output" id="materialLibraryOutput" tabindex="0"></pre>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    count: panel.querySelector('#materialLibraryCount'),
    intake: panel.querySelector('#libraryIntakeShelf'),
    save: panel.querySelector('#librarySave'),
    load: panel.querySelector('#libraryLoad'),
    importPack: panel.querySelector('#libraryImportPack'),
    exportPack: panel.querySelector('#libraryExportPack'),
    exportJson: panel.querySelector('#libraryExportJson'),
    importJson: panel.querySelector('#libraryImportJson'),
    packInput: panel.querySelector('#libraryPackInput'),
    jsonInput: panel.querySelector('#libraryJsonInput'),
    filter: panel.querySelector('#materialLibraryFilter'),
    selectAll: panel.querySelector('#librarySelectAll'),
    selectNone: panel.querySelector('#librarySelectNone'),
    selectedCount: panel.querySelector('#librarySelectedCount'),
    familyName: panel.querySelector('#materialFamilyName'),
    familyPurpose: panel.querySelector('#materialFamilyPurpose'),
    familyCreate: panel.querySelector('#materialFamilyCreate'),
    grid: panel.querySelector('#materialLibraryGrid'),
    familyCount: panel.querySelector('#materialFamilyCount'),
    familyList: panel.querySelector('#materialFamilyList'),
    output: panel.querySelector('#materialLibraryOutput')
  };

  function readLiveBuildState() {
    const active = stateActions.querySelector('[data-state-tab].active');
    const live = stateActions.querySelector('[data-state-tab="live"]');
    if (live && active !== live) live.click();
    let parsed;
    try { parsed = JSON.parse(stateOutput.textContent || '{}'); }
    catch (error) { parsed = { error: 'Live state parse failed.', assets: [], layers: [], workspace: {} }; }
    if (active && active !== live) active.click();
    return parsed;
  }

  function currentShelfEntries() {
    const live = readLiveBuildState();
    const metadata = new Map((live.assets || []).map((asset) => [asset.id, asset]));
    const entries = [];
    assetGrid.querySelectorAll('[data-asset-card]').forEach((card) => {
      const id = card.dataset.assetCard;
      const meta = clone(metadata.get(id) || { id });
      const image = card.querySelector('img');
      meta.dataUrl = image && image.src && image.src.startsWith('data:') ? image.src : null;
      meta.libraryId = core.stableEntryId(meta);
      meta.source = Object.assign({}, meta.source || {}, {
        intake: 'material-surface-fabric-v0.4',
        workspaceAssetId: id
      });
      entries.push(meta);
    });
    return { live, entries };
  }

  function visibleEntries() {
    const q = filter.trim().toLowerCase();
    return library.entries.filter((entry) => {
      if (!q) return true;
      const haystack = [entry.name, entry.kind, entry.usage && entry.usage.channelHint, ...(entry.tags || [])].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  function entryFamilyNames(entryId) {
    return library.families.filter((family) => family.entryIds.includes(entryId)).map((family) => family.name);
  }

  function renderEntries() {
    const entries = visibleEntries();
    el.count.textContent = String(library.entries.length);
    el.selectedCount.textContent = `${selected.size} selected`;
    el.grid.innerHTML = entries.map((entry) => {
      const families = entryFamilyNames(entry.id);
      const sourceMethod = entry.source && (entry.source.method || entry.source.intake) || 'unknown';
      const channelOptions = core.CHANNELS.map((channel) => `<option value="${channel}" ${entry.usage && entry.usage.channelHint === channel ? 'selected' : ''}>${channel}</option>`).join('');
      return `
        <article class="material-entry ${selected.has(entry.id) ? 'selected' : ''}" data-library-entry="${entry.id}">
          <label class="material-entry-select"><input type="checkbox" data-library-select="${entry.id}" ${selected.has(entry.id) ? 'checked' : ''} /> reuse</label>
          <div class="material-entry-preview checker">${entry.dataUrl ? `<img src="${entry.dataUrl}" alt="" />` : '<span>payload unavailable</span>'}</div>
          <div class="material-entry-body">
            <strong title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</strong>
            <small>${escapeHtml(entry.kind)} • ${entry.width}×${entry.height} • ${escapeHtml(sourceMethod)}</small>
            <small>${entry.payload.portable ? `payload ${entry.payload.hash}` : 'metadata-only entry'}</small>
            ${families.length ? `<small>families: ${escapeHtml(families.join(', '))}</small>` : ''}
            <label>Use as
              <select data-library-channel="${entry.id}">${channelOptions}</select>
            </label>
            <div class="material-entry-actions">
              <button class="mini-button" data-library-remove="${entry.id}">Remove</button>
            </div>
          </div>
        </article>`;
    }).join('') || '<div class="inspector-empty">The persistent library is empty. Intake the current visual shelf or import a donor pack.</div>';
  }

  function renderFamilies() {
    el.familyCount.textContent = String(library.families.length);
    const byId = new Map(library.entries.map((entry) => [entry.id, entry]));
    el.familyList.innerHTML = library.families.map((family) => {
      const preview = family.entryIds.map((id) => byId.get(id)).find((entry) => entry && entry.dataUrl);
      const members = family.entryIds.map((id) => byId.get(id)).filter(Boolean);
      return `<article class="material-family-card">
        ${preview ? `<img src="${preview.dataUrl}" alt="" />` : '<div class="material-family-placeholder">family</div>'}
        <div><strong>${escapeHtml(family.name)}</strong><small>${members.length} ingredients${family.purpose ? ` • ${escapeHtml(family.purpose)}` : ''}</small><small>${escapeHtml(members.map((entry) => entry.usage.channelHint).join(' + '))}</small></div>
      </article>`;
    }).join('') || '<div class="inspector-empty">No families yet. Select reusable ingredients and group them when a real reuse relationship exists.</div>';
  }

  function renderAll() {
    const valid = new Set(library.entries.map((entry) => entry.id));
    selected = new Set([...selected].filter((id) => valid.has(id)));
    renderEntries();
    renderFamilies();
  }

  function download(name, value) {
    const blob = value instanceof Blob ? value : new Blob([String(value)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function openDb() {
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

  async function saveLibrary() {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('libraries', 'readwrite');
      tx.objectStore('libraries').put(library, 'current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    el.output.textContent = JSON.stringify({ saved: true, libraryId: library.id, entries: library.entries.length, families: library.families.length }, null, 2);
  }

  async function loadLibrary() {
    const db = await openDb();
    const loaded = await new Promise((resolve, reject) => {
      const tx = db.transaction('libraries', 'readonly');
      const request = tx.objectStore('libraries').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!loaded) {
      el.output.textContent = JSON.stringify({ message: 'No explicitly saved v0.4 library exists in this browser.' }, null, 2);
      return;
    }
    const validation = core.validateLibrary(loaded);
    if (!validation.ok) throw new Error(validation.reason);
    library = loaded;
    selected = new Set();
    renderAll();
    el.output.textContent = JSON.stringify({ loaded: true, libraryId: library.id, entries: library.entries.length, families: library.families.length }, null, 2);
  }

  function intakeShelf() {
    const { entries } = currentShelfEntries();
    if (!entries.length) {
      el.output.textContent = JSON.stringify({ message: 'Current visual shelf contains no reusable entries.' }, null, 2);
      return;
    }
    const receipt = core.upsertEntries(library, entries, nowIso());
    receipt.added.forEach((id) => selected.add(id));
    renderAll();
    el.output.textContent = JSON.stringify({ intake: 'current visual shelf', ...receipt }, null, 2);
  }

  function createFamily() {
    const ids = [...selected];
    if (!ids.length) throw new Error('Select at least one reusable ingredient first.');
    const family = core.createFamily(library, {
      name: el.familyName.value,
      purpose: el.familyPurpose.value,
      entryIds: ids
    }, nowIso());
    el.familyName.value = '';
    el.familyPurpose.value = '';
    renderAll();
    el.output.textContent = JSON.stringify({ familyCreated: family }, null, 2);
  }

  function exportSelectedPack() {
    if (!library.entries.length) throw new Error('Material library is empty.');
    const live = readLiveBuildState();
    const ids = selected.size ? [...selected] : library.entries.map((entry) => entry.id);
    const pack = core.makeDonorPack({
      library,
      selectedEntryIds: ids,
      workspace: live.workspace || {},
      layers: live.layers || [],
      exportedAt: nowIso()
    });
    download('axm-material-donor-pack-v0.2.json', JSON.stringify(pack, null, 2));
    el.output.textContent = JSON.stringify({ exportedDonorPack: true, packId: pack.id, version: pack.version, entries: pack.library.entries.length, families: pack.library.families.length }, null, 2);
  }

  async function importPackFile(file) {
    const parsed = JSON.parse(await file.text());
    const imported = core.importDonorPack(parsed, nowIso());
    const raw = imported.entries.map((entry) => Object.assign({}, entry, { libraryId: entry.id }));
    const receipt = core.upsertEntries(library, raw, nowIso());
    imported.families.forEach((family) => core.createFamily(library, family, nowIso()));
    imported.entries.forEach((entry) => selected.add(entry.id));
    renderAll();
    el.output.textContent = JSON.stringify({ importedDonorPack: imported.receipt, libraryReceipt: receipt }, null, 2);
  }

  async function importLibraryFile(file) {
    const parsed = JSON.parse(await file.text());
    const validation = core.validateLibrary(parsed);
    if (!validation.ok) throw new Error(validation.reason);
    const receipt = core.upsertEntries(library, parsed.entries.map((entry) => Object.assign({}, entry, { libraryId: entry.id })), nowIso());
    parsed.families.forEach((family) => core.createFamily(library, family, nowIso()));
    renderAll();
    el.output.textContent = JSON.stringify({ importedLibrary: true, mergedEntries: receipt, families: library.families.length }, null, 2);
  }

  el.intake.addEventListener('click', () => {
    try { intakeShelf(); }
    catch (error) { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }
  });
  el.save.addEventListener('click', () => saveLibrary().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }));
  el.load.addEventListener('click', () => loadLibrary().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }));
  el.importPack.addEventListener('click', () => el.packInput.click());
  el.packInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try { await importPackFile(file); }
    catch (error) { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }
  });
  el.exportPack.addEventListener('click', () => {
    try { exportSelectedPack(); }
    catch (error) { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }
  });
  el.exportJson.addEventListener('click', () => download('axm-material-library-v0.4.json', JSON.stringify(library, null, 2)));
  el.importJson.addEventListener('click', () => el.jsonInput.click());
  el.jsonInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try { await importLibraryFile(file); }
    catch (error) { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }
  });

  el.filter.addEventListener('input', (event) => { filter = event.target.value; renderEntries(); });
  el.selectAll.addEventListener('click', () => { visibleEntries().forEach((entry) => selected.add(entry.id)); renderEntries(); });
  el.selectNone.addEventListener('click', () => { selected.clear(); renderEntries(); });
  el.familyCreate.addEventListener('click', () => {
    try { createFamily(); }
    catch (error) { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }
  });

  el.grid.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-library-select]');
    const channel = event.target.closest('[data-library-channel]');
    if (checkbox) {
      if (checkbox.checked) selected.add(checkbox.dataset.librarySelect);
      else selected.delete(checkbox.dataset.librarySelect);
      renderEntries();
      return;
    }
    if (channel) {
      try {
        const entry = core.setEntryChannel(library, channel.dataset.libraryChannel, channel.value, nowIso());
        renderEntries();
        el.output.textContent = JSON.stringify({ routingHintUpdated: { id: entry.id, channelHint: entry.usage.channelHint, basis: entry.usage.channelBasis } }, null, 2);
      } catch (error) {
        el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2);
      }
    }
  });

  el.grid.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-library-remove]');
    if (!remove) return;
    const id = remove.dataset.libraryRemove;
    if (!window.confirm('Remove this reusable entry from the local library? This does not remove the source shelf asset.')) return;
    core.removeEntry(library, id, nowIso());
    selected.delete(id);
    renderAll();
    el.output.textContent = JSON.stringify({ removedFromLibrary: id }, null, 2);
  });

  renderAll();
  el.output.textContent = JSON.stringify({
    message: 'Intake reusable visual ingredients from the current shelf, group real reuse relationships into families, then export explicit donor packs for downstream AXM adapters.',
    libraryFormat: core.LIBRARY_FORMAT,
    donorPackVersion: core.DONOR_VERSION,
    generationOwnedHere: false
  }, null, 2);
})();
