(function () {
  'use strict';

  const core = window.AXMAlphaSpriteCore;
  const pack = window.AXMPremadePack;
  if (!core || !pack) throw new Error('Alpha Sprite Lab requires AXMAlphaSpriteCore and AXMPremadePack.');
  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  const extractable = pack.assets.filter((asset) => !asset.grid && ['overlay-atlas','decal-atlas','fx-atlas'].includes(asset.kind));
  let sourceImage = null;
  let sourceImageData = null;
  let index = null;
  let selectedId = null;
  let importedCanonical = false;

  const panel = document.createElement('section');
  panel.className = 'panel premade-sprite-panel';
  panel.innerHTML = `
    <div class="panel-heading">
      <div><div class="panel-kicker">15</div><h2>Alpha Sprite Lab</h2></div>
      <span class="count-pill">v0.14</span>
    </div>
    <div class="truth-note">Observe alpha regions and turn transparent atlas content into stable sprite candidates. Runtime-WebP extraction is preview evidence; a source-PNG index created by the headless extractor is the stronger reusable index. Candidates are not automatic semantic object labels.</div>
    <div class="sprite-toolbar">
      <label>Atlas<select id="spriteAtlas"></select></label>
      <label>Alpha threshold<input id="spriteThreshold" type="number" min="1" max="254" value="128" /></label>
      <label>Min component<input id="spriteMinComponent" type="number" min="1" value="12" /></label>
      <label>Min sprite<input id="spriteMinSprite" type="number" min="1" value="40" /></label>
      <label>Merge gap<input id="spriteMergeGap" type="number" min="0" max="64" value="3" /></label>
      <label>Padding<input id="spritePadding" type="number" min="0" max="64" value="2" /></label>
      <button class="button primary" id="spriteAnalyze">Analyze alpha</button>
      <label class="button" for="spriteIndexImport">Import source index</label>
      <input id="spriteIndexImport" type="file" accept="application/json,.json" hidden />
      <button class="button" id="spriteExportIndex" disabled>Export index</button>
    </div>
    <div class="sprite-layout">
      <section class="sprite-subpanel">
        <div class="influence-subheading"><strong>Atlas observation</strong><span id="spriteStatus">idle</span></div>
        <div class="sprite-canvas-wrap"><canvas id="spriteCanvas" width="512" height="512"></canvas></div>
      </section>
      <section class="sprite-subpanel">
        <div class="influence-subheading"><strong>Sprite candidates</strong><span id="spriteCount">0</span></div>
        <div id="spriteList" class="sprite-list"></div>
      </section>
      <section class="sprite-subpanel">
        <div class="influence-subheading"><strong>Selected candidate</strong><span id="spriteSelected">none</span></div>
        <div id="spritePreview" class="sprite-preview checker"></div>
        <pre id="spriteMeta" class="state-output sprite-meta"></pre>
        <div class="sprite-actions">
          <button class="button" id="spriteExportPng" disabled>Export candidate PNG</button>
          <button class="button accent" id="spriteSendComposer" disabled>Send to composer</button>
        </div>
      </section>
    </div>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    atlas: panel.querySelector('#spriteAtlas'), threshold: panel.querySelector('#spriteThreshold'),
    minComponent: panel.querySelector('#spriteMinComponent'), minSprite: panel.querySelector('#spriteMinSprite'),
    mergeGap: panel.querySelector('#spriteMergeGap'), padding: panel.querySelector('#spritePadding'),
    analyze: panel.querySelector('#spriteAnalyze'), importIndex: panel.querySelector('#spriteIndexImport'), exportIndex: panel.querySelector('#spriteExportIndex'),
    status: panel.querySelector('#spriteStatus'), canvas: panel.querySelector('#spriteCanvas'), count: panel.querySelector('#spriteCount'),
    list: panel.querySelector('#spriteList'), selected: panel.querySelector('#spriteSelected'), preview: panel.querySelector('#spritePreview'),
    meta: panel.querySelector('#spriteMeta'), exportPng: panel.querySelector('#spriteExportPng'), sendComposer: panel.querySelector('#spriteSendComposer')
  };

  extractable.forEach((asset) => {
    const option = document.createElement('option');
    option.value = asset.id; option.textContent = `${asset.id} · ${asset.kind}`;
    el.atlas.appendChild(option);
  });

  function assetById(id) { return pack.assets.find((asset) => asset.id === id) || null; }
  function assetPath(asset) { return `${String(pack.rootPath || 'assets/premade/v0.11').replace(/\/$/,'')}/${asset.category}/${asset.file}`; }
  function download(name, blob) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function runtimeBounds(candidate) {
    const n = candidate.normalizedBounds;
    const width = el.canvas.width, height = el.canvas.height;
    const x = Math.floor(n.x * width), y = Math.floor(n.y * height);
    const x1 = Math.max(x + 1, Math.ceil((n.x + n.width) * width));
    const y1 = Math.max(y + 1, Math.ceil((n.y + n.height) * height));
    return { x, y, width: Math.min(width - x, x1 - x), height: Math.min(height - y, y1 - y) };
  }
  function selectedCandidate() { return index && index.candidates.find((candidate) => candidate.id === selectedId) || null; }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`missing runtime atlas: ${src}`)); image.src = src;
    });
  }

  function drawObservation() {
    const ctx = el.canvas.getContext('2d');
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    if (sourceImage) ctx.drawImage(sourceImage, 0, 0, el.canvas.width, el.canvas.height);
    if (!index) return;
    index.candidates.forEach((candidate) => {
      const b = runtimeBounds(candidate);
      ctx.save();
      ctx.lineWidth = candidate.id === selectedId ? 3 : 1;
      ctx.strokeStyle = candidate.id === selectedId ? '#ffffff' : '#55e6c1';
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, Math.max(1,b.width - 1), Math.max(1,b.height - 1));
      ctx.restore();
    });
  }

  function renderList() {
    el.list.innerHTML = '';
    el.count.textContent = index ? String(index.candidates.length) : '0';
    if (!index) return;
    index.candidates.forEach((candidate) => {
      const button = document.createElement('button');
      button.className = `sprite-row${candidate.id === selectedId ? ' active' : ''}`;
      button.innerHTML = `<strong>${candidate.id.split('/').pop()}</strong><span>${candidate.componentCount} comp · ${Math.round(candidate.alphaCoverage.thresholdShare * 100)}% α</span>`;
      button.addEventListener('click', () => { selectedId = candidate.id; renderList(); renderSelected(); drawObservation(); });
      el.list.appendChild(button);
    });
  }

  function renderSelected() {
    const candidate = selectedCandidate();
    el.preview.innerHTML = '';
    el.exportPng.disabled = !candidate || !sourceImageData;
    el.sendComposer.disabled = !candidate;
    if (!candidate) { el.selected.textContent = 'none'; el.meta.textContent = ''; return; }
    el.selected.textContent = candidate.id.split('/').pop();
    el.meta.textContent = JSON.stringify(candidate, null, 2);
    if (sourceImageData) {
      const b = runtimeBounds(candidate);
      const crop = core.cropRgba(sourceImageData.data, sourceImageData.width, sourceImageData.height, b);
      const canvas = document.createElement('canvas'); canvas.width = crop.width; canvas.height = crop.height;
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(crop.rgba), crop.width, crop.height), 0, 0);
      el.preview.appendChild(canvas);
    }
  }

  async function analyze() {
    const asset = assetById(el.atlas.value); if (!asset) return;
    importedCanonical = false; index = null; selectedId = null;
    el.status.textContent = 'loading…'; el.exportIndex.disabled = true;
    try {
      sourceImage = await loadImage(assetPath(asset));
      el.canvas.width = pack.binaryPack.runtimeDimensions[0]; el.canvas.height = pack.binaryPack.runtimeDimensions[1];
      const ctx = el.canvas.getContext('2d'); ctx.clearRect(0,0,el.canvas.width,el.canvas.height); ctx.drawImage(sourceImage,0,0,el.canvas.width,el.canvas.height);
      sourceImageData = ctx.getImageData(0,0,el.canvas.width,el.canvas.height);
      const config = {
        alphaThreshold:Number(el.threshold.value), minComponentPixels:Number(el.minComponent.value), minSpritePixels:Number(el.minSprite.value),
        mergeGap:Number(el.mergeGap.value), padding:Number(el.padding.value)
      };
      const candidates = core.extractCandidates(sourceImageData.data, sourceImageData.width, sourceImageData.height, asset.id, config);
      index = core.makeIndex({
        pack:{format:pack.format,version:pack.version,archiveSha256:pack.binaryPack.sha256}, atlas:asset,
        width:sourceImageData.width,height:sourceImageData.height,sourceBasis:'runtime-webp-observation',extraction:core.configFor(sourceImageData.width,sourceImageData.height,config),candidates
      });
      selectedId = candidates[0] && candidates[0].id || null;
      el.status.textContent = `${candidates.length} candidates · runtime preview`;
      el.exportIndex.disabled = false;
      renderList(); renderSelected(); drawObservation();
    } catch (error) {
      sourceImage = null; sourceImageData = null; index = null; el.status.textContent = `HOLD: ${error.message}`;
      renderList(); renderSelected(); drawObservation();
    }
  }

  el.analyze.addEventListener('click', analyze);
  el.atlas.addEventListener('change', () => { sourceImage = null; sourceImageData = null; index = null; selectedId = null; el.status.textContent = 'atlas changed'; renderList(); renderSelected(); drawObservation(); });
  el.exportIndex.addEventListener('click', () => {
    if (!index) return;
    download(`${index.atlas.id}.sprite-index-v0.14.json`, new Blob([JSON.stringify(index,null,2)], {type:'application/json'}));
  });
  el.importIndex.addEventListener('change', async () => {
    const file = el.importIndex.files && el.importIndex.files[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const validation = core.validateIndex(parsed); if (!validation.ok) throw new Error(validation.reason);
      const asset = assetById(parsed.atlas.id); if (!asset) throw new Error(`Index atlas ${parsed.atlas.id} is not in this pack.`);
      el.atlas.value = asset.id;
      sourceImage = await loadImage(assetPath(asset));
      el.canvas.width = pack.binaryPack.runtimeDimensions[0]; el.canvas.height = pack.binaryPack.runtimeDimensions[1];
      const ctx = el.canvas.getContext('2d'); ctx.clearRect(0,0,el.canvas.width,el.canvas.height); ctx.drawImage(sourceImage,0,0,el.canvas.width,el.canvas.height);
      sourceImageData = ctx.getImageData(0,0,el.canvas.width,el.canvas.height);
      index = parsed; importedCanonical = parsed.image && parsed.image.sourceBasis === 'v0.11-source-png';
      selectedId = parsed.candidates[0] && parsed.candidates[0].id || null;
      el.status.textContent = `${parsed.candidates.length} candidates · ${importedCanonical ? 'source index' : parsed.image.sourceBasis}`;
      el.exportIndex.disabled = false;
      renderList(); renderSelected(); drawObservation();
    } catch (error) { el.status.textContent = `import failed: ${error.message}`; }
    el.importIndex.value = '';
  });
  el.exportPng.addEventListener('click', () => {
    const candidate = selectedCandidate(); if (!candidate || !sourceImageData) return;
    const b = runtimeBounds(candidate); const crop = core.cropRgba(sourceImageData.data,sourceImageData.width,sourceImageData.height,b);
    const canvas = document.createElement('canvas'); canvas.width=crop.width; canvas.height=crop.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(crop.rgba),crop.width,crop.height),0,0);
    canvas.toBlob((blob)=>blob && download(`${candidate.id.split('/').pop()}.png`,blob),'image/png');
  });
  el.sendComposer.addEventListener('click', () => {
    const candidate = selectedCandidate(); if (!candidate) return;
    window.dispatchEvent(new CustomEvent('axm-premade-add-sprite', { detail: {
      atlasId:candidate.atlasId, spriteId:candidate.id, normalizedBounds:candidate.normalizedBounds,
      sourceIndexId:index.id, sourceBasis:index.image.sourceBasis, canonicalSourceIndex:importedCanonical
    }}));
    el.status.textContent = `sent ${candidate.id.split('/').pop()} → composer`;
  });

  if (extractable.length) el.atlas.value = extractable[0].id;
  renderList(); renderSelected(); drawObservation();
})();
