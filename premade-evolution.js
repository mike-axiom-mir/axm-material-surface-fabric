(function () {
  'use strict';

  const composer = window.AXMPremadeComposerCore;
  const evolution = window.AXMPremadeEvolutionCore;
  const pack = window.AXMPremadePack;
  if (!composer || !evolution || !pack) throw new Error('Premade Evolution Lab requires premade composer/evolution cores and premade pack.');
  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  const imageCache = new Map();
  let importedParent = null;
  let session = null;
  let selectedCandidateId = null;

  const panel = document.createElement('section');
  panel.className = 'panel premade-evolution-panel';
  panel.innerHTML = `
    <div class="panel-heading">
      <div><div class="panel-kicker">14</div><h2>Premade Evolution Lab</h2></div>
      <span class="count-pill">v0.13</span>
    </div>
    <div class="truth-note">Breed deterministic recipe families from the v0.12 composer. Ranking is bounded technical health only. Alpha stays required; no candidate is auto-promoted.</div>

    <div class="premade-evo-toolbar">
      <label>Parent seed<input id="evoSeed" value="axm-evo-001" /></label>
      <label>Base<select id="evoBase"><option value="mixed">mixed</option><option value="material">material</option><option value="weathered">weathered</option><option value="color">color</option><option value="energy">energy</option></select></label>
      <label>Parent layers<input id="evoParentLayers" type="number" min="0" max="8" value="4" /></label>
      <label>Variants<select id="evoVariants"><option>4</option><option selected>8</option><option>16</option></select></label>
      <label>Mutation<select id="evoStrength"><option>low</option><option selected>medium</option><option>high</option></select></label>
      <label><span>Lock base globe</span><input id="evoLockBase" type="checkbox" checked /></label>
      <label><span>Allow FX</span><input id="evoFx" type="checkbox" checked /></label>
      <label><span>Allow decals</span><input id="evoDecals" type="checkbox" checked /></label>
      <button class="button primary" id="evoGenerate">Generate + evaluate</button>
      <label class="button" for="evoImportParent">Import parent recipe</label>
      <input id="evoImportParent" type="file" accept="application/json,.json" hidden />
    </div>

    <div class="premade-evo-summary" id="evoSummary">No session yet.</div>
    <div class="premade-evo-grid" id="evoGrid"></div>

    <div class="premade-evo-actions">
      <button class="button" id="evoKeep" disabled>Keep / unkeep selected</button>
      <button class="button" id="evoExportSession" disabled>Export session</button>
      <button class="button accent" id="evoExportPack" disabled>Export keeper recipe pack</button>
      <button class="button" id="evoExportRecipe" disabled>Export selected recipe</button>
      <span id="evoStatus">idle</span>
    </div>

    <div class="premade-evo-detail">
      <section class="premade-subpanel">
        <div class="influence-subheading"><strong>Selected candidate</strong><span id="evoSelected">none</span></div>
        <pre id="evoReceipt" class="state-output premade-receipt"></pre>
      </section>
      <section class="premade-subpanel">
        <div class="influence-subheading"><strong>Parent → child changes</strong><span>lineage</span></div>
        <pre id="evoDiff" class="state-output premade-receipt"></pre>
      </section>
    </div>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    seed: panel.querySelector('#evoSeed'), base: panel.querySelector('#evoBase'), parentLayers: panel.querySelector('#evoParentLayers'),
    variants: panel.querySelector('#evoVariants'), strength: panel.querySelector('#evoStrength'), lockBase: panel.querySelector('#evoLockBase'),
    fx: panel.querySelector('#evoFx'), decals: panel.querySelector('#evoDecals'), generate: panel.querySelector('#evoGenerate'),
    importParent: panel.querySelector('#evoImportParent'), summary: panel.querySelector('#evoSummary'), grid: panel.querySelector('#evoGrid'),
    keep: panel.querySelector('#evoKeep'), exportSession: panel.querySelector('#evoExportSession'), exportPack: panel.querySelector('#evoExportPack'),
    exportRecipe: panel.querySelector('#evoExportRecipe'), status: panel.querySelector('#evoStatus'), selected: panel.querySelector('#evoSelected'),
    receipt: panel.querySelector('#evoReceipt'), diff: panel.querySelector('#evoDiff')
  };

  const BLEND_TO_CANVAS = { normal:'source-over', multiply:'multiply', screen:'screen', overlay:'overlay', 'soft-light':'soft-light', 'hard-light':'hard-light', lighter:'lighter', difference:'difference' };

  function download(name, value, type) {
    const blob = value instanceof Blob ? value : new Blob([value], { type: type || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function loadImage(path) {
    if (imageCache.has(path)) return imageCache.get(path);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`missing runtime asset: ${path}`));
      image.src = path;
    });
    imageCache.set(path, promise);
    return promise;
  }

  async function renderRecipe(recipe) {
    const plan = composer.compilePlan(recipe, pack);
    const canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = 384;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const held = [];
    let rendered = 0;
    for (const layer of plan.layers) {
      if (!layer.visible) continue;
      try {
        const image = await loadImage(layer.resourcePath);
        const s = layer.sourceRect, t = layer.transform;
        const dw = t.width * canvas.width, dh = t.height * canvas.height;
        const sxScale = image.naturalWidth / (pack.binaryPack.runtimeDimensions[0] || 512);
        const syScale = image.naturalHeight / (pack.binaryPack.runtimeDimensions[1] || 512);
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = BLEND_TO_CANVAS[layer.blendMode] || 'source-over';
        ctx.translate(t.x * canvas.width, t.y * canvas.height);
        ctx.rotate(t.rotation * Math.PI / 180);
        ctx.scale(t.mirrorX ? -1 : 1, t.mirrorY ? -1 : 1);
        ctx.drawImage(image, s.x * sxScale, s.y * syScale, s.width * sxScale, s.height * syScale, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
        rendered += 1;
      } catch (error) {
        held.push({ layerId: layer.id, assetId: layer.assetId, reason: error.message });
      }
    }
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = evolution.summarizePixels(imageData.data, canvas.width, canvas.height);
    return { canvas, pixels, held, rendered, completed: rendered > 0 && held.length === 0 };
  }

  function parentRecipe() {
    if (importedParent) return evolution.clone(importedParent);
    return composer.seededRecipe(el.seed.value, pack, {
      basePool: el.base.value,
      overlayCount: Number(el.parentLayers.value) || 0,
      includeFx: el.fx.checked,
      includeDecals: el.decals.checked
    });
  }

  function selectedCandidate() {
    return session && session.candidates.find((candidate) => candidate.id === selectedCandidateId) || null;
  }

  function refreshDetail() {
    const candidate = selectedCandidate();
    const active = Boolean(candidate);
    el.keep.disabled = !active;
    el.exportRecipe.disabled = !active;
    if (!candidate) {
      el.selected.textContent = 'none'; el.receipt.textContent = ''; el.diff.textContent = ''; return;
    }
    el.selected.textContent = `#${candidate.rank} · ${candidate.technicalScore}`;
    el.receipt.textContent = JSON.stringify({
      id: candidate.id, rank: candidate.rank, kept: candidate.kept, technicalScore: candidate.technicalScore,
      structure: candidate.structure, render: candidate.render, lineage: candidate.lineage, mutationReceipt: candidate.mutationReceipt
    }, null, 2);
    el.diff.textContent = JSON.stringify(evolution.compareRecipes(session.parent.recipe, candidate.recipe, pack), null, 2);
  }

  function candidateCard(candidate, previewUrl) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `premade-evo-card${candidate.id === selectedCandidateId ? ' active' : ''}${candidate.kept ? ' kept' : ''}`;
    const render = candidate.render || {};
    const held = render.heldLayers || 0;
    card.innerHTML = `
      <img src="${previewUrl}" alt="candidate ${candidate.rank} preview" />
      <div class="premade-evo-card-head"><strong>#${candidate.rank}</strong><span>${candidate.technicalScore}</span></div>
      <div class="premade-evo-card-meta">${candidate.recipe.layers.length} layers · HOLD ${held}</div>
      <div class="premade-evo-card-meta">${candidate.kept ? 'KEEPER' : candidate.lineage && candidate.lineage.policy && candidate.lineage.policy.strength || ''}</div>`;
    card.addEventListener('click', () => { selectedCandidateId = candidate.id; renderCards(); refreshDetail(); });
    return card;
  }

  const previewById = new Map();
  function renderCards() {
    if (!session) return;
    el.grid.innerHTML = '';
    session.candidates.forEach((candidate) => el.grid.appendChild(candidateCard(candidate, previewById.get(candidate.id) || '')));
    const kept = session.candidates.filter((candidate) => candidate.kept).length;
    const complete = session.candidates.filter((candidate) => candidate.render && candidate.render.completed).length;
    el.summary.textContent = `${session.candidates.length} variants · ${complete} complete renders · ${kept} keepers · parent ${session.parent.recipeFingerprint}`;
    el.exportSession.disabled = false;
    el.exportPack.disabled = kept === 0;
  }

  async function generate() {
    el.generate.disabled = true;
    el.status.textContent = 'generating variants…';
    try {
      const parent = parentRecipe();
      const policy = {
        strength: el.strength.value,
        variants: Number(el.variants.value),
        lockBase: el.lockBase.checked,
        allowFx: el.fx.checked,
        allowDecals: el.decals.checked,
        allowLayerCountChange: true,
        maxExtraLayers: 8
      };
      session = evolution.createSession(parent, pack, el.seed.value, policy);
      selectedCandidateId = session.candidates[0] && session.candidates[0].id || null;
      previewById.clear();
      for (let index = 0; index < session.candidates.length; index += 1) {
        const candidate = session.candidates[index];
        el.status.textContent = `rendering ${index + 1}/${session.candidates.length}…`;
        const result = await renderRecipe(candidate.recipe);
        evolution.attachRenderObservation(session, candidate.id, result.pixels, result.held.length, result.completed);
        previewById.set(candidate.id, result.canvas.toDataURL('image/png'));
      }
      selectedCandidateId = session.candidates[0] && session.candidates[0].id || null;
      renderCards(); refreshDetail();
      el.status.textContent = 'evolution batch complete';
    } catch (error) {
      el.status.textContent = `failed: ${error.message}`;
    } finally {
      el.generate.disabled = false;
    }
  }

  el.generate.addEventListener('click', generate);
  el.importParent.addEventListener('change', async () => {
    const file = el.importParent.files && el.importParent.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const validation = composer.validateRecipe(parsed, pack);
      if (!validation.ok) throw new Error(validation.reason);
      importedParent = parsed;
      el.status.textContent = `parent imported: ${parsed.id}`;
    } catch (error) {
      el.status.textContent = `parent import failed: ${error.message}`;
    }
    el.importParent.value = '';
  });
  el.seed.addEventListener('input', () => { importedParent = null; });
  el.keep.addEventListener('click', () => {
    const candidate = selectedCandidate(); if (!candidate) return;
    evolution.keepCandidate(session, candidate.id, !candidate.kept);
    renderCards(); refreshDetail();
  });
  el.exportSession.addEventListener('click', () => {
    if (!session) return;
    download(`${session.id}.json`, JSON.stringify(session, null, 2));
  });
  el.exportPack.addEventListener('click', () => {
    if (!session) return;
    const recipePack = evolution.recipePack(session, `${session.id} keepers`);
    download(`${recipePack.id}.json`, JSON.stringify(recipePack, null, 2));
  });
  el.exportRecipe.addEventListener('click', () => {
    const candidate = selectedCandidate(); if (!candidate) return;
    download(`${candidate.recipe.id}.json`, JSON.stringify(candidate.recipe, null, 2));
  });
})();
