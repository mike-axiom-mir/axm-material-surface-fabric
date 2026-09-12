(function () {
  'use strict';

  const core = window.AXMMaterialInfluenceCore;
  const deltaCore = window.AXMMaterialDeltaCore;
  if (!core) throw new Error('AXMMaterialInfluenceCore is required before influence-lab.js');

  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  const SIZE = 512;
  const COLOR_CHANNELS = new Set(['base-color', 'decal', 'microdetail', 'unassigned']);
  const BLEND_TO_CANVAS = {
    normal: 'source-over',
    multiply: 'multiply',
    screen: 'screen',
    overlay: 'overlay',
    'soft-light': 'soft-light',
    'hard-light': 'hard-light',
    add: 'lighter',
    subtract: 'difference'
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso() { return new Date().toISOString(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function optionRows(items, selected, labelKey) {
    return items.map((item) => `<option value="${escapeHtml(item.id || item)}" ${(item.id || item) === selected ? 'selected' : ''}>${escapeHtml(item[labelKey || 'name'] || item)}</option>`).join('');
  }
  function hexToRgb(hex) {
    const text = String(hex || '#ffffff').replace('#', '');
    const value = parseInt(text, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  let state = core.createWorkspace(nowIso());
  let library = { entries: [], families: [], observedAt: null, source: 'none' };
  let snapshots = { A: null, B: null };
  const imageCache = new Map();
  let renderToken = 0;

  const panel = document.createElement('section');
  panel.className = 'panel influence-lab-panel';
  panel.innerHTML = `
    <div class="panel-heading influence-heading">
      <div><div class="panel-kicker">08</div><h2>Material Influence Lab</h2></div>
      <span class="count-pill">v0.5</span>
    </div>
    <div class="truth-note">
      Stack reusable material ingredients, channel routing, masks, bounded shader-like preview controls, light rigs and view rigs. Lighting/shader output here is a 2D influence preview — not a physically based renderer or proof of PBR correctness.
    </div>

    <div class="influence-topbar">
      <button class="button accent" id="influenceRefreshLibrary">Refresh material library</button>
      <button class="button" id="influenceSave">Save lab</button>
      <button class="button" id="influenceLoad">Load lab</button>
      <button class="button" id="influenceExport">Export lab JSON</button>
      <button class="button" id="influenceImport">Import lab JSON</button>
      <input id="influenceImportInput" type="file" accept="application/json,.json" hidden />
    </div>

    <div class="influence-grid">
      <section class="influence-subpanel influence-library">
        <div class="influence-subheading"><strong>Ingredients</strong><span id="influenceLibraryStatus">0 available</span></div>
        <input id="influenceLibraryFilter" type="search" placeholder="Filter reusable ingredients…" autocomplete="off" />
        <div id="influenceIngredientList" class="influence-ingredient-list"></div>
      </section>

      <section class="influence-subpanel influence-recipe">
        <div class="influence-subheading"><strong>Recipe / stack</strong><span id="influenceRecipeHash">--------</span></div>
        <div class="influence-recipe-actions">
          <select id="influenceRecipeSelect"></select>
          <button class="mini-button" id="influenceNewRecipe">New</button>
          <button class="mini-button" id="influenceDuplicateRecipe">Duplicate</button>
          <input id="influenceRecipeName" placeholder="recipe name" autocomplete="off" />
        </div>
        <div id="influenceStack" class="influence-stack"></div>
      </section>

      <section class="influence-subpanel influence-preview-panel">
        <div class="influence-subheading"><strong>Observed preview</strong><span id="influencePreviewStatus">idle</span></div>
        <div class="influence-canvas-wrap checker">
          <canvas id="influenceCanvas" width="512" height="512" aria-label="Material influence preview"></canvas>
        </div>
        <div id="influenceChannelSummary" class="influence-channel-summary"></div>
      </section>

      <section class="influence-subpanel influence-rigs">
        <div class="influence-subheading"><strong>Influence rigs</strong><span>declared controls</span></div>
        <div class="influence-control-grid">
          <label>Light preset<select id="influenceLightPreset"></select></label>
          <label>View preset<select id="influenceViewPreset"></select></label>
          <label>Light angle<input id="influenceLightAngle" type="range" min="0" max="360" step="1" /></label>
          <label>Light intensity<input id="influenceLightIntensity" type="range" min="0" max="2" step="0.01" /></label>
          <label>Ambient<input id="influenceAmbient" type="range" min="0" max="1" step="0.01" /></label>
          <label>Environment<input id="influenceEnvironment" type="range" min="0" max="1" step="0.01" /></label>
          <label>Shadow<input id="influenceShadow" type="range" min="0" max="1" step="0.01" /></label>
          <label>Light color<input id="influenceLightColor" type="color" /></label>
        </div>

        <div class="influence-shader-grid">
          <label>Exposure<input id="influenceExposure" type="range" min="0.1" max="4" step="0.01" /></label>
          <label>Saturation<input id="influenceSaturation" type="range" min="0" max="3" step="0.01" /></label>
          <label class="influence-toggle"><input id="influenceClearcoatEnabled" type="checkbox" /> Clearcoat-like highlight</label>
          <label>Clearcoat strength<input id="influenceClearcoatStrength" type="range" min="0" max="1" step="0.01" /></label>
          <label class="influence-toggle"><input id="influenceFresnelEnabled" type="checkbox" /> Fresnel-like edge</label>
          <label>Fresnel strength<input id="influenceFresnelStrength" type="range" min="0" max="1" step="0.01" /></label>
          <label class="influence-toggle"><input id="influenceEmissiveEnabled" type="checkbox" /> Emissive preview</label>
          <label>Emissive boost<input id="influenceEmissiveStrength" type="range" min="0" max="4" step="0.01" /></label>
          <label class="influence-toggle"><input id="influenceRoughnessEnabled" type="checkbox" /> Roughness-response proxy</label>
          <label>Roughness proxy<input id="influenceRoughnessValue" type="range" min="0" max="1" step="0.01" /></label>
        </div>
      </section>
    </div>

    <section class="influence-subpanel influence-compare">
      <div class="influence-subheading"><strong>Influence compare</strong><span>recipe state + preview delta</span></div>
      <div class="influence-compare-actions">
        <button class="button" id="influenceCaptureA">Capture A</button>
        <button class="button" id="influenceCaptureB">Capture B</button>
        <button class="button primary" id="influenceCompare">Compare A → B</button>
        <span id="influenceCaptureStatus">A — • B —</span>
      </div>
      <div id="influenceComparePreview" class="influence-compare-preview"></div>
      <pre id="influenceOutput" class="state-output influence-output" tabindex="0"></pre>
    </section>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    refreshLibrary: panel.querySelector('#influenceRefreshLibrary'),
    save: panel.querySelector('#influenceSave'),
    load: panel.querySelector('#influenceLoad'),
    export: panel.querySelector('#influenceExport'),
    import: panel.querySelector('#influenceImport'),
    importInput: panel.querySelector('#influenceImportInput'),
    libraryStatus: panel.querySelector('#influenceLibraryStatus'),
    filter: panel.querySelector('#influenceLibraryFilter'),
    ingredientList: panel.querySelector('#influenceIngredientList'),
    recipeHash: panel.querySelector('#influenceRecipeHash'),
    recipeSelect: panel.querySelector('#influenceRecipeSelect'),
    newRecipe: panel.querySelector('#influenceNewRecipe'),
    duplicateRecipe: panel.querySelector('#influenceDuplicateRecipe'),
    recipeName: panel.querySelector('#influenceRecipeName'),
    stack: panel.querySelector('#influenceStack'),
    canvas: panel.querySelector('#influenceCanvas'),
    previewStatus: panel.querySelector('#influencePreviewStatus'),
    channelSummary: panel.querySelector('#influenceChannelSummary'),
    lightPreset: panel.querySelector('#influenceLightPreset'),
    viewPreset: panel.querySelector('#influenceViewPreset'),
    lightAngle: panel.querySelector('#influenceLightAngle'),
    lightIntensity: panel.querySelector('#influenceLightIntensity'),
    ambient: panel.querySelector('#influenceAmbient'),
    environment: panel.querySelector('#influenceEnvironment'),
    shadow: panel.querySelector('#influenceShadow'),
    lightColor: panel.querySelector('#influenceLightColor'),
    exposure: panel.querySelector('#influenceExposure'),
    saturation: panel.querySelector('#influenceSaturation'),
    clearcoatEnabled: panel.querySelector('#influenceClearcoatEnabled'),
    clearcoatStrength: panel.querySelector('#influenceClearcoatStrength'),
    fresnelEnabled: panel.querySelector('#influenceFresnelEnabled'),
    fresnelStrength: panel.querySelector('#influenceFresnelStrength'),
    emissiveEnabled: panel.querySelector('#influenceEmissiveEnabled'),
    emissiveStrength: panel.querySelector('#influenceEmissiveStrength'),
    roughnessEnabled: panel.querySelector('#influenceRoughnessEnabled'),
    roughnessValue: panel.querySelector('#influenceRoughnessValue'),
    captureA: panel.querySelector('#influenceCaptureA'),
    captureB: panel.querySelector('#influenceCaptureB'),
    compare: panel.querySelector('#influenceCompare'),
    captureStatus: panel.querySelector('#influenceCaptureStatus'),
    comparePreview: panel.querySelector('#influenceComparePreview'),
    output: panel.querySelector('#influenceOutput')
  };

  function currentRecipe() { return core.activeRecipe(state); }
  function entryById(id) { return library.entries.find((entry) => entry.id === id) || null; }

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

  async function persistedLibrary() {
    const db = await openLibraryDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction('libraries', 'readonly');
      const request = tx.objectStore('libraries').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  }

  function scrapeVisibleLibrary() {
    const entries = [];
    document.querySelectorAll('[data-library-entry]').forEach((card) => {
      const id = card.dataset.libraryEntry;
      const img = card.querySelector('img');
      const strong = card.querySelector('strong');
      const select = card.querySelector('[data-library-channel]');
      if (!id) return;
      entries.push({
        id,
        name: strong ? strong.textContent.trim() : id,
        kind: 'texture',
        mime: img && img.src && img.src.startsWith('data:image/webp') ? 'image/webp' : img && img.src && img.src.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
        width: 0,
        height: 0,
        dataUrl: img && img.src && img.src.startsWith('data:') ? img.src : null,
        usage: { channelHint: select ? select.value : 'unassigned', channelBasis: 'observed-from-v0.4-library-ui' },
        source: { method: 'v0.4-library-ui-observation' },
        tags: []
      });
    });
    const families = [];
    return entries.length ? { entries, families, observedAt: nowIso(), source: 'current-library-ui' } : null;
  }

  async function refreshLibrary() {
    let observed = null;
    try {
      const saved = await persistedLibrary();
      if (saved && Array.isArray(saved.entries)) {
        observed = { entries: clone(saved.entries), families: clone(saved.families || []), observedAt: nowIso(), source: 'explicitly-saved-v0.4-library' };
      }
    } catch (error) {
      console.warn('Material library IndexedDB read failed:', error);
    }
    if (!observed) observed = scrapeVisibleLibrary();
    if (!observed) observed = { entries: [], families: [], observedAt: nowIso(), source: 'none' };
    library = observed;
    state.librarySnapshot = clone(observed);
    state.updatedAt = nowIso();
    renderLibrary();
    renderStack();
    requestPreview();
    el.output.textContent = JSON.stringify({
      refreshedLibrary: true,
      source: observed.source,
      entries: observed.entries.length,
      families: observed.families.length,
      note: observed.entries.length ? 'Recipes can now reference these stable material-library entry IDs.' : 'Save the v0.4 material library or intake shelf ingredients there first.'
    }, null, 2);
  }

  function renderLibrary() {
    const query = el.filter.value.trim().toLowerCase();
    const entries = library.entries.filter((entry) => !query || [entry.name, entry.kind, entry.usage && entry.usage.channelHint, ...(entry.tags || [])].join(' ').toLowerCase().includes(query));
    el.libraryStatus.textContent = `${library.entries.length} available • ${library.source}`;
    el.ingredientList.innerHTML = entries.map((entry) => `
      <article class="influence-ingredient" data-influence-entry="${escapeHtml(entry.id)}">
        <div class="influence-thumb checker">${entry.dataUrl ? `<img src="${entry.dataUrl}" alt="" />` : '<span>no payload</span>'}</div>
        <div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.usage && entry.usage.channelHint || 'unassigned')}</small></div>
        <button class="mini-button" data-influence-add="${escapeHtml(entry.id)}" ${entry.dataUrl ? '' : 'disabled'}>Add</button>
      </article>`).join('') || '<div class="inspector-empty">No reusable entries observed. Use the v0.4 Material Library, save it, then refresh here.</div>';
  }

  function renderRecipes() {
    const recipe = currentRecipe();
    el.recipeSelect.innerHTML = state.recipes.map((item) => `<option value="${escapeHtml(item.id)}" ${recipe && item.id === recipe.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
    el.recipeName.value = recipe ? recipe.name : '';
    el.recipeHash.textContent = recipe ? core.recipeFingerprint(recipe) : '--------';
  }

  function maskOptions(selected) {
    return `<option value="" ${!selected ? 'selected' : ''}>No mask</option>` + library.entries.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === selected ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('');
  }

  function renderStack() {
    const recipe = currentRecipe();
    if (!recipe) { el.stack.innerHTML = ''; return; }
    el.stack.innerHTML = recipe.stack.map((layer, index) => {
      const entry = entryById(layer.entryId);
      return `
        <article class="influence-layer" data-influence-layer="${escapeHtml(layer.id)}">
          <div class="influence-layer-head">
            <span>${index + 1}</span>
            <strong>${escapeHtml(entry ? entry.name : layer.entryId)}</strong>
            <label class="influence-inline-check"><input type="checkbox" data-layer-field="visible" ${layer.visible ? 'checked' : ''} /> visible</label>
            <button class="mini-button" data-layer-up="${escapeHtml(layer.id)}">↑</button>
            <button class="mini-button" data-layer-down="${escapeHtml(layer.id)}">↓</button>
            <button class="mini-button" data-layer-remove="${escapeHtml(layer.id)}">×</button>
          </div>
          <div class="influence-layer-controls">
            <label>Channel<select data-layer-field="targetChannel">${core.CHANNELS.map((channel) => `<option value="${channel}" ${layer.targetChannel === channel ? 'selected' : ''}>${channel}</option>`).join('')}</select></label>
            <label>Blend<select data-layer-field="blendMode">${core.BLEND_MODES.map((mode) => `<option value="${mode}" ${layer.blendMode === mode ? 'selected' : ''}>${mode}</option>`).join('')}</select></label>
            <label>Opacity<input data-layer-field="opacity" type="range" min="0" max="1" step="0.01" value="${layer.opacity}" /></label>
            <label>Mask<select data-layer-field="maskEntryId">${maskOptions(layer.maskEntryId)}</select></label>
            <label>Scale<input data-layer-transform="scale" type="number" min="0.05" max="16" step="0.05" value="${layer.transform.scale}" /></label>
            <label>Rotation<input data-layer-transform="rotation" type="number" min="-3600" max="3600" step="1" value="${layer.transform.rotation}" /></label>
            <label>Offset X<input data-layer-transform="offsetX" type="number" min="-4096" max="4096" step="1" value="${layer.transform.offsetX}" /></label>
            <label>Offset Y<input data-layer-transform="offsetY" type="number" min="-4096" max="4096" step="1" value="${layer.transform.offsetY}" /></label>
            <label>Repeat X<input data-layer-tiling="repeatX" type="number" min="1" max="16" step="1" value="${Math.max(1, Math.round(layer.tiling.repeatX))}" /></label>
            <label>Repeat Y<input data-layer-tiling="repeatY" type="number" min="1" max="16" step="1" value="${Math.max(1, Math.round(layer.tiling.repeatY))}" /></label>
          </div>
        </article>`;
    }).join('') || '<div class="inspector-empty">Add reusable ingredients from the library. Stack order is bottom → top.</div>';
    renderRecipes();
    renderRigs();
  }

  function renderRigs() {
    const recipe = currentRecipe();
    if (!recipe) return;
    el.lightPreset.innerHTML = optionRows(core.LIGHT_RIGS, recipe.lightRig.id);
    el.viewPreset.innerHTML = optionRows(core.VIEW_RIGS, recipe.viewRig.id);
    el.lightAngle.value = String(((recipe.lightRig.angle % 360) + 360) % 360);
    el.lightIntensity.value = String(recipe.lightRig.intensity);
    el.ambient.value = String(recipe.lightRig.ambient);
    el.environment.value = String(recipe.lightRig.environment);
    el.shadow.value = String(recipe.lightRig.shadow);
    el.lightColor.value = recipe.lightRig.color;
    el.exposure.value = String(recipe.shader.exposure);
    el.saturation.value = String(recipe.shader.saturation);
    el.clearcoatEnabled.checked = recipe.shader.clearcoatLike.enabled;
    el.clearcoatStrength.value = String(recipe.shader.clearcoatLike.strength);
    el.fresnelEnabled.checked = recipe.shader.fresnelLike.enabled;
    el.fresnelStrength.value = String(recipe.shader.fresnelLike.strength);
    el.emissiveEnabled.checked = recipe.shader.emissiveBoost.enabled;
    el.emissiveStrength.value = String(recipe.shader.emissiveBoost.strength);
    el.roughnessEnabled.checked = recipe.shader.roughnessResponse.enabled;
    el.roughnessValue.value = String(recipe.shader.roughnessResponse.value);
  }

  function loadImage(entry) {
    if (!entry || !entry.dataUrl) return Promise.resolve(null);
    if (imageCache.has(entry.id)) return imageCache.get(entry.id);
    const promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = entry.dataUrl;
    });
    imageCache.set(entry.id, promise);
    return promise;
  }

  function newCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    return canvas;
  }

  function drawTiled(ctx, image, layer) {
    const repeatX = Math.max(1, Math.min(16, Math.round(layer.tiling.repeatX || 1)));
    const repeatY = Math.max(1, Math.min(16, Math.round(layer.tiling.repeatY || 1)));
    const cellW = SIZE / repeatX;
    const cellH = SIZE / repeatY;
    ctx.save();
    ctx.translate(SIZE / 2 + layer.transform.offsetX, SIZE / 2 + layer.transform.offsetY);
    ctx.rotate((layer.transform.rotation || 0) * Math.PI / 180);
    ctx.scale(layer.transform.scale || 1, layer.transform.scale || 1);
    const startX = -SIZE / 2;
    const startY = -SIZE / 2;
    for (let y = 0; y < repeatY; y += 1) {
      for (let x = 0; x < repeatX; x += 1) {
        ctx.drawImage(image, startX + x * cellW, startY + y * cellH, cellW, cellH);
      }
    }
    ctx.restore();
  }

  async function layerCanvas(layer) {
    const entry = entryById(layer.entryId);
    const image = await loadImage(entry);
    if (!image) return null;
    const canvas = newCanvas();
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    drawTiled(ctx, image, layer);
    if (layer.maskEntryId) {
      const maskEntry = entryById(layer.maskEntryId);
      const maskImage = await loadImage(maskEntry);
      if (maskImage) {
        const maskCanvas = newCanvas();
        const maskCtx = maskCanvas.getContext('2d', { alpha: true });
        drawTiled(maskCtx, maskImage, Object.assign({}, layer, { transform: clone(layer.transform), tiling: clone(layer.tiling) }));
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    return canvas;
  }

  function applyExposureSaturation(canvas, shader) {
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    const data = imageData.data;
    const exposure = shader.exposure;
    const saturation = shader.saturation;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] * exposure;
      let g = data[i + 1] * exposure;
      let b = data[i + 2] * exposure;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * saturation;
      g = lum + (g - lum) * saturation;
      b = lum + (b - lum) * saturation;
      data[i] = Math.max(0, Math.min(255, Math.round(r)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function applyLight(canvas, light, shader) {
    const ctx = canvas.getContext('2d', { alpha: true });
    const radians = light.angle * Math.PI / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);
    const x0 = SIZE / 2 - dx * SIZE * 0.72;
    const y0 = SIZE / 2 - dy * SIZE * 0.72;
    const x1 = SIZE / 2 + dx * SIZE * 0.72;
    const y1 = SIZE / 2 + dy * SIZE * 0.72;
    const rgb = hexToRgb(light.color);

    if (light.ambient > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(0.45, light.ambient * 0.35);
      ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.restore();
    }

    const highlight = ctx.createLinearGradient(x0, y0, x1, y1);
    highlight.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(0.9, light.intensity * 0.72)})`);
    highlight.addColorStop(0.52, `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(0.35, light.intensity * 0.20)})`);
    highlight.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = highlight;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();

    const shadow = ctx.createLinearGradient(x0, y0, x1, y1);
    shadow.addColorStop(0, 'rgba(0,0,0,0)');
    shadow.addColorStop(0.55, `rgba(0,0,0,${light.shadow * 0.16})`);
    shadow.addColorStop(1, `rgba(0,0,0,${light.shadow * 0.7})`);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();

    if (shader.clearcoatLike.enabled) {
      const rough = shader.roughnessResponse.enabled ? shader.roughnessResponse.value : 0.5;
      const strength = shader.clearcoatLike.strength * (1 - rough * 0.68);
      const band = ctx.createLinearGradient(x0, y0, x1, y1);
      const width = 0.04 + rough * 0.20;
      band.addColorStop(Math.max(0, 0.34 - width), 'rgba(255,255,255,0)');
      band.addColorStop(0.34, `rgba(255,255,255,${Math.min(0.82, strength)})`);
      band.addColorStop(Math.min(1, 0.34 + width), 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.restore();
    }

    if (shader.fresnelLike.enabled) {
      const radial = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.12, SIZE / 2, SIZE / 2, SIZE * 0.72);
      radial.addColorStop(0, 'rgba(255,255,255,0)');
      radial.addColorStop(0.7, 'rgba(255,255,255,0)');
      radial.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},${shader.fresnelLike.strength * 0.7})`);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.restore();
    }

    if (light.environment > 0) {
      const environment = ctx.createLinearGradient(0, 0, SIZE, SIZE);
      environment.addColorStop(0, `rgba(255,255,255,${light.environment * 0.16})`);
      environment.addColorStop(0.48, 'rgba(255,255,255,0)');
      environment.addColorStop(1, `rgba(165,205,255,${light.environment * 0.12})`);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = environment;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.restore();
    }
  }

  function applyView(source, viewRig, target) {
    const ctx = target.getContext('2d', { alpha: true });
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (viewRig.mode === 'tile-2x2') {
      for (let y = 0; y < 2; y += 1) for (let x = 0; x < 2; x += 1) ctx.drawImage(source, x * SIZE / 2, y * SIZE / 2, SIZE / 2, SIZE / 2);
      return;
    }
    if (viewRig.mode === 'micro-close') {
      ctx.drawImage(source, SIZE * 0.25, SIZE * 0.25, SIZE * 0.5, SIZE * 0.5, 0, 0, SIZE, SIZE);
      return;
    }
    if (viewRig.mode === 'grazing-proxy') {
      ctx.fillStyle = '#090c0f';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.translate(SIZE * 0.12, SIZE * 0.40);
      ctx.transform(1, 0, -0.24, 0.42, 0, 0);
      ctx.drawImage(source, 0, 0, SIZE * 0.78, SIZE);
      ctx.restore();
      return;
    }
    ctx.drawImage(source, 0, 0);
  }

  async function renderPreview() {
    const token = ++renderToken;
    const recipe = currentRecipe();
    if (!recipe) return;
    el.previewStatus.textContent = 'rendering…';
    const material = newCanvas();
    const materialCtx = material.getContext('2d', { alpha: true });
    const emissive = newCanvas();
    const emissiveCtx = emissive.getContext('2d', { alpha: true });
    const activeChannels = new Map();
    let renderedColorLayers = 0;

    for (const layer of recipe.stack) {
      if (!layer.visible) continue;
      activeChannels.set(layer.targetChannel, (activeChannels.get(layer.targetChannel) || 0) + 1);
      const rendered = await layerCanvas(layer);
      if (!rendered || token !== renderToken) continue;
      const operation = BLEND_TO_CANVAS[layer.blendMode] || 'source-over';
      if (layer.targetChannel === 'emissive') {
        emissiveCtx.save();
        emissiveCtx.globalCompositeOperation = operation;
        emissiveCtx.globalAlpha = layer.opacity;
        emissiveCtx.drawImage(rendered, 0, 0);
        emissiveCtx.restore();
      } else if (COLOR_CHANNELS.has(layer.targetChannel)) {
        materialCtx.save();
        materialCtx.globalCompositeOperation = operation;
        materialCtx.globalAlpha = layer.opacity;
        materialCtx.drawImage(rendered, 0, 0);
        materialCtx.restore();
        renderedColorLayers += 1;
      }
    }

    if (!renderedColorLayers) {
      materialCtx.fillStyle = '#161c21';
      materialCtx.fillRect(0, 0, SIZE, SIZE);
    }

    applyExposureSaturation(material, recipe.shader);
    applyLight(material, recipe.lightRig, recipe.shader);
    if (recipe.shader.emissiveBoost.enabled) {
      materialCtx.save();
      materialCtx.globalCompositeOperation = 'screen';
      materialCtx.globalAlpha = Math.min(1, recipe.shader.emissiveBoost.strength / 2);
      materialCtx.drawImage(emissive, 0, 0);
      if (recipe.shader.emissiveBoost.strength > 2) {
        materialCtx.globalAlpha = Math.min(1, (recipe.shader.emissiveBoost.strength - 2) / 2);
        materialCtx.drawImage(emissive, 0, 0);
      }
      materialCtx.restore();
    }

    applyView(material, recipe.viewRig, el.canvas);
    el.recipeHash.textContent = core.recipeFingerprint(recipe);
    const channelRows = [...activeChannels.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    el.channelSummary.innerHTML = channelRows.map(([name, count]) => `<span>${escapeHtml(name)} <strong>${count}</strong></span>`).join('') || '<span>no active layers</span>';
    el.previewStatus.textContent = `${renderedColorLayers} color layer${renderedColorLayers === 1 ? '' : 's'} • ${recipe.viewRig.name}`;
  }

  function requestPreview() {
    renderPreview().catch((error) => {
      console.error(error);
      el.previewStatus.textContent = 'preview error';
      el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2);
    });
  }

  function addIngredient(entryId) {
    const recipe = currentRecipe();
    const entry = entryById(entryId);
    if (!recipe || !entry) return;
    core.addLayer(recipe, {
      entryId,
      targetChannel: entry.usage && entry.usage.channelHint || 'unassigned',
      blendMode: entry.usage && entry.usage.channelHint === 'decal' ? 'overlay' : 'normal',
      opacity: 1
    }, nowIso());
    state.updatedAt = nowIso();
    renderStack();
    requestPreview();
  }

  function updateLayerFromControl(control) {
    const card = control.closest('[data-influence-layer]');
    const recipe = currentRecipe();
    if (!card || !recipe) return;
    const layerId = card.dataset.influenceLayer;
    let patch = {};
    if (control.dataset.layerField) {
      const field = control.dataset.layerField;
      let value = control.type === 'checkbox' ? control.checked : control.value;
      if (field === 'opacity') value = Number(value);
      if (field === 'maskEntryId') value = value || null;
      patch[field] = value;
    } else if (control.dataset.layerTransform) {
      patch = { transform: { [control.dataset.layerTransform]: Number(control.value) } };
    } else if (control.dataset.layerTiling) {
      patch = { tiling: { [control.dataset.layerTiling]: Number(control.value) } };
    }
    core.updateLayer(recipe, layerId, patch, nowIso());
    state.updatedAt = nowIso();
    renderRecipes();
    requestPreview();
  }

  function updateLightFromControls() {
    const recipe = currentRecipe();
    if (!recipe) return;
    core.patchLightRig(recipe, {
      angle: Number(el.lightAngle.value),
      intensity: Number(el.lightIntensity.value),
      ambient: Number(el.ambient.value),
      environment: Number(el.environment.value),
      shadow: Number(el.shadow.value),
      color: el.lightColor.value
    }, nowIso());
    state.updatedAt = nowIso();
    renderRecipes();
    requestPreview();
  }

  function updateShaderFromControls() {
    const recipe = currentRecipe();
    if (!recipe) return;
    core.patchShader(recipe, {
      exposure: Number(el.exposure.value),
      saturation: Number(el.saturation.value),
      clearcoatLike: { enabled: el.clearcoatEnabled.checked, strength: Number(el.clearcoatStrength.value) },
      fresnelLike: { enabled: el.fresnelEnabled.checked, strength: Number(el.fresnelStrength.value) },
      emissiveBoost: { enabled: el.emissiveEnabled.checked, strength: Number(el.emissiveStrength.value) },
      roughnessResponse: { enabled: el.roughnessEnabled.checked, value: Number(el.roughnessValue.value) }
    }, nowIso());
    state.updatedAt = nowIso();
    renderRecipes();
    requestPreview();
  }

  function imageDataClone() {
    const ctx = el.canvas.getContext('2d', { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, SIZE, SIZE);
    return new Uint8ClampedArray(data.data);
  }

  function capture(slot) {
    const recipe = currentRecipe();
    if (!recipe) return;
    snapshots[slot] = {
      recipe: clone(recipe),
      fingerprint: core.recipeFingerprint(recipe),
      rgba: imageDataClone(),
      dataUrl: el.canvas.toDataURL('image/png'),
      capturedAt: nowIso()
    };
    el.captureStatus.textContent = `A ${snapshots.A ? snapshots.A.fingerprint : '—'} • B ${snapshots.B ? snapshots.B.fingerprint : '—'}`;
    el.output.textContent = JSON.stringify({ captured: slot, fingerprint: snapshots[slot].fingerprint, at: snapshots[slot].capturedAt }, null, 2);
  }

  function diffDataUrl(rgba) {
    const canvas = newCanvas();
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.putImageData(new ImageData(rgba, SIZE, SIZE), 0, 0);
    return canvas.toDataURL('image/png');
  }

  function compareSnapshots() {
    if (!snapshots.A || !snapshots.B) {
      el.output.textContent = JSON.stringify({ message: 'Capture both A and B first.' }, null, 2);
      return;
    }
    const stateDelta = core.compareRecipeStates(snapshots.A.recipe, snapshots.B.recipe);
    let pixel = null;
    let differencePng = null;
    if (deltaCore) {
      pixel = deltaCore.summarizePixelDelta(snapshots.A.rgba, snapshots.B.rgba, SIZE, SIZE, { gridSize: 8, threshold: 0 });
      differencePng = diffDataUrl(deltaCore.buildDifferenceRgba(snapshots.A.rgba, snapshots.B.rgba, SIZE, SIZE, { threshold: 0 }));
    }
    el.comparePreview.innerHTML = `
      <figure><img src="${snapshots.A.dataUrl}" alt=""><figcaption>A • ${snapshots.A.fingerprint}</figcaption></figure>
      <figure><img src="${snapshots.B.dataUrl}" alt=""><figcaption>B • ${snapshots.B.fingerprint}</figcaption></figure>
      ${differencePng ? `<figure><img src="${differencePng}" alt=""><figcaption>Observed preview delta</figcaption></figure>` : ''}
    `;
    const report = {
      truthStatus: 'OBSERVED_V0_5_INFLUENCE_COMPARISON',
      stateDelta,
      pixelDelta: pixel ? {
        changedShare: pixel.changedShare,
        changedPixelCount: pixel.changedPixelCount,
        meanAbsChannelDelta: pixel.meanAbsChannelDelta,
        maxChannelDelta: pixel.maxChannelDelta,
        changedBounds: pixel.changedBounds,
        gridSize: pixel.gridSize,
        regions: pixel.regions
      } : { unavailable: true },
      boundary: 'State controls and preview pixels are observed in this tool. The comparison is not a physical-material causality proof.'
    };
    state.experiments.push({
      id: `compare-${core.fnv1a(`${snapshots.A.fingerprint}|${snapshots.B.fingerprint}|${nowIso()}`)}`,
      capturedAt: nowIso(),
      a: { fingerprint: snapshots.A.fingerprint, recipe: clone(snapshots.A.recipe) },
      b: { fingerprint: snapshots.B.fingerprint, recipe: clone(snapshots.B.recipe) },
      observed: clone(report.pixelDelta),
      stateDelta: clone(stateDelta)
    });
    state.updatedAt = nowIso();
    el.output.textContent = JSON.stringify(report, null, 2);
  }

  function download(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
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

  async function saveLab() {
    const db = await openInfluenceDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite');
      tx.objectStore('workspaces').put(state, 'current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    el.output.textContent = JSON.stringify({ saved: true, workspaceId: state.id, recipes: state.recipes.length, experiments: state.experiments.length }, null, 2);
  }

  async function loadLab() {
    const db = await openInfluenceDb();
    const loaded = await new Promise((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readonly');
      const request = tx.objectStore('workspaces').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!loaded) throw new Error('No explicitly saved v0.5 influence workspace exists in this browser.');
    const validation = core.validateWorkspace(loaded);
    if (!validation.ok) throw new Error(validation.reason);
    state = loaded;
    library = clone(loaded.librarySnapshot || { entries: [], families: [], observedAt: null, source: 'workspace-import' });
    snapshots = { A: null, B: null };
    renderAll();
    el.output.textContent = JSON.stringify({ loaded: true, workspaceId: state.id, recipes: state.recipes.length }, null, 2);
  }

  function importLab(parsed) {
    const validation = core.validateWorkspace(parsed);
    if (!validation.ok) throw new Error(validation.reason);
    state = parsed;
    library = clone(parsed.librarySnapshot || { entries: [], families: [], observedAt: null, source: 'workspace-import' });
    snapshots = { A: null, B: null };
    imageCache.clear();
    renderAll();
  }

  function newRecipe() {
    const recipe = core.createRecipe(`material recipe ${state.recipes.length + 1}`, nowIso());
    state.recipes.push(recipe);
    state.activeRecipeId = recipe.id;
    state.updatedAt = nowIso();
    renderAll();
  }

  function renderAll() {
    renderLibrary();
    renderRecipes();
    renderStack();
    requestPreview();
    el.captureStatus.textContent = `A ${snapshots.A ? snapshots.A.fingerprint : '—'} • B ${snapshots.B ? snapshots.B.fingerprint : '—'}`;
  }

  el.refreshLibrary.addEventListener('click', () => refreshLibrary().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }));
  el.filter.addEventListener('input', renderLibrary);
  el.ingredientList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-influence-add]');
    if (button) addIngredient(button.dataset.influenceAdd);
  });

  el.recipeSelect.addEventListener('change', () => {
    state.activeRecipeId = el.recipeSelect.value;
    state.updatedAt = nowIso();
    renderAll();
  });
  el.newRecipe.addEventListener('click', newRecipe);
  el.duplicateRecipe.addEventListener('click', () => {
    const recipe = currentRecipe();
    if (!recipe) return;
    core.duplicateRecipe(state, recipe.id, nowIso());
    renderAll();
  });
  el.recipeName.addEventListener('change', () => {
    const recipe = currentRecipe();
    if (!recipe) return;
    recipe.name = el.recipeName.value.trim() || recipe.name;
    recipe.updatedAt = nowIso();
    state.updatedAt = recipe.updatedAt;
    renderRecipes();
  });

  el.stack.addEventListener('input', (event) => {
    if (event.target.matches('[data-layer-field],[data-layer-transform],[data-layer-tiling]')) updateLayerFromControl(event.target);
  });
  el.stack.addEventListener('change', (event) => {
    if (event.target.matches('select[data-layer-field],input[type="checkbox"][data-layer-field]')) {
      updateLayerFromControl(event.target);
      renderStack();
    }
  });
  el.stack.addEventListener('click', (event) => {
    const recipe = currentRecipe();
    if (!recipe) return;
    const remove = event.target.closest('[data-layer-remove]');
    const up = event.target.closest('[data-layer-up]');
    const down = event.target.closest('[data-layer-down]');
    if (remove) core.removeLayer(recipe, remove.dataset.layerRemove, nowIso());
    else if (up) core.moveLayer(recipe, up.dataset.layerUp, -1, nowIso());
    else if (down) core.moveLayer(recipe, down.dataset.layerDown, 1, nowIso());
    else return;
    state.updatedAt = nowIso();
    renderStack();
    requestPreview();
  });

  el.lightPreset.addEventListener('change', () => {
    const recipe = currentRecipe();
    if (!recipe) return;
    core.setLightPreset(recipe, el.lightPreset.value, nowIso());
    state.updatedAt = nowIso();
    renderRigs(); renderRecipes(); requestPreview();
  });
  el.viewPreset.addEventListener('change', () => {
    const recipe = currentRecipe();
    if (!recipe) return;
    core.setViewRig(recipe, el.viewPreset.value, nowIso());
    state.updatedAt = nowIso();
    renderRigs(); renderRecipes(); requestPreview();
  });
  [el.lightAngle, el.lightIntensity, el.ambient, el.environment, el.shadow, el.lightColor].forEach((control) => control.addEventListener('input', updateLightFromControls));
  [el.exposure, el.saturation, el.clearcoatEnabled, el.clearcoatStrength, el.fresnelEnabled, el.fresnelStrength, el.emissiveEnabled, el.emissiveStrength, el.roughnessEnabled, el.roughnessValue].forEach((control) => control.addEventListener('input', updateShaderFromControls));

  el.captureA.addEventListener('click', () => capture('A'));
  el.captureB.addEventListener('click', () => capture('B'));
  el.compare.addEventListener('click', compareSnapshots);

  el.save.addEventListener('click', () => saveLab().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }));
  el.load.addEventListener('click', () => loadLab().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); }));
  el.export.addEventListener('click', () => download('axm-material-influence-workspace-v0.5.json', JSON.stringify(state, null, 2)));
  el.import.addEventListener('click', () => el.importInput.click());
  el.importInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      importLab(JSON.parse(await file.text()));
      el.output.textContent = JSON.stringify({ imported: true, workspaceId: state.id, recipes: state.recipes.length }, null, 2);
    } catch (error) {
      el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2);
    }
  });

  renderAll();
  refreshLibrary().catch(() => {});
  el.output.textContent = JSON.stringify({
    message: 'v0.5 Material Influence Lab is active. Build recipes from reusable library entries, stack/mask/route them, vary light/view/shader preview influences, then capture A/B to measure the observed state + pixel delta.',
    truthBoundary: state.truthBoundary
  }, null, 2);
})();
