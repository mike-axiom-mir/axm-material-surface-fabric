(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMAlphaSpriteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.14.0';
  const INDEX_FORMAT = 'axm-premade-sprite-index';

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) {
    const number = Number(value);
    const safe = Number.isFinite(number) ? number : min;
    return Math.max(min, Math.min(max, safe));
  }
  function stableStringify(value) {
    function normalize(input) {
      if (input === null || typeof input !== 'object') return input;
      if (Array.isArray(input)) return input.map(normalize);
      const out = {};
      Object.keys(input).sort().forEach((key) => { out[key] = normalize(input[key]); });
      return out;
    }
    return JSON.stringify(normalize(value));
  }
  function fnv1aBytes(bytes, start, end) {
    let hash = 0x811c9dc5;
    const a = Math.max(0, start || 0);
    const b = Math.min(bytes.length, end == null ? bytes.length : end);
    for (let i = a; i < b; i += 1) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }
  function fnv1aText(text) {
    const input = String(text == null ? '' : text);
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      const code = input.charCodeAt(i);
      hash ^= code & 0xff;
      hash = Math.imul(hash, 0x01000193);
      hash ^= (code >>> 8) & 0xff;
      hash = Math.imul(hash, 0x01000193);
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }
  function configFor(width, height, raw) {
    const source = raw || {};
    const area = Math.max(1, Number(width) * Number(height));
    const scale = Math.max(1, Math.min(width, height));
    return {
      alphaThreshold: Math.round(clamp(source.alphaThreshold == null ? 128 : source.alphaThreshold, 1, 254)),
      minComponentPixels: Math.max(1, Math.round(Number(source.minComponentPixels) || Math.max(8, area * 0.00004))),
      minSpritePixels: Math.max(1, Math.round(Number(source.minSpritePixels) || Math.max(24, area * 0.00015))),
      mergeGap: Math.max(0, Math.round(Number(source.mergeGap) || Math.max(2, scale * 0.006))),
      padding: Math.max(0, Math.round(Number(source.padding) || Math.max(1, scale * 0.003))),
      connectivity: source.connectivity === 4 ? 4 : 8,
      maxSprites: Math.max(1, Math.min(4096, Math.round(Number(source.maxSprites) || 512)))
    };
  }

  function assertRgba(rgba, width, height) {
    const w = Math.round(Number(width));
    const h = Math.round(Number(height));
    if (!rgba || !Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) throw new TypeError('RGBA bytes and positive integer width/height are required.');
    if (rgba.length < w * h * 4) throw new TypeError('RGBA byte length is smaller than width*height*4.');
    return { width: w, height: h };
  }

  function rawComponents(rgba, width, height, rawConfig) {
    const dims = assertRgba(rgba, width, height);
    const cfg = configFor(dims.width, dims.height, rawConfig);
    const pixels = dims.width * dims.height;
    const occupied = new Uint8Array(pixels);
    const visited = new Uint8Array(pixels);
    const stack = new Int32Array(pixels);
    for (let p = 0, i = 3; p < pixels; p += 1, i += 4) occupied[p] = rgba[i] >= cfg.alphaThreshold ? 1 : 0;

    const components = [];
    const neighbors4 = [[-1,0],[1,0],[0,-1],[0,1]];
    const neighbors8 = neighbors4.concat([[-1,-1],[1,-1],[-1,1],[1,1]]);
    const neighbors = cfg.connectivity === 4 ? neighbors4 : neighbors8;

    for (let start = 0; start < pixels; start += 1) {
      if (!occupied[start] || visited[start]) continue;
      let top = 0;
      stack[top++] = start;
      visited[start] = 1;
      let count = 0;
      let alphaSum = 0;
      let minX = dims.width, minY = dims.height, maxX = -1, maxY = -1;
      while (top > 0) {
        const index = stack[--top];
        const x = index % dims.width;
        const y = Math.floor(index / dims.width);
        count += 1;
        alphaSum += rgba[index * 4 + 3];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        for (let n = 0; n < neighbors.length; n += 1) {
          const nx = x + neighbors[n][0];
          const ny = y + neighbors[n][1];
          if (nx < 0 || nx >= dims.width || ny < 0 || ny >= dims.height) continue;
          const ni = ny * dims.width + nx;
          if (occupied[ni] && !visited[ni]) {
            visited[ni] = 1;
            stack[top++] = ni;
          }
        }
      }
      if (count >= cfg.minComponentPixels) components.push({
        pixelCount: count,
        alphaSum,
        minX, minY, maxX, maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      });
    }
    return { components, config: cfg };
  }

  function boxGap(a, b) {
    const dx = a.maxX < b.minX ? b.minX - a.maxX - 1 : b.maxX < a.minX ? a.minX - b.maxX - 1 : 0;
    const dy = a.maxY < b.minY ? b.minY - a.maxY - 1 : b.maxY < a.minY ? a.minY - b.maxY - 1 : 0;
    return Math.max(dx, dy);
  }
  function mergeBoxes(a, b) {
    return {
      pixelCount: a.pixelCount + b.pixelCount,
      alphaSum: a.alphaSum + b.alphaSum,
      minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
      width: Math.max(a.maxX, b.maxX) - Math.min(a.minX, b.minX) + 1,
      height: Math.max(a.maxY, b.maxY) - Math.min(a.minY, b.minY) + 1,
      componentCount: (a.componentCount || 1) + (b.componentCount || 1)
    };
  }

  function groupComponents(components, mergeGap) {
    const groups = components.map((item) => Object.assign({ componentCount: 1 }, item));
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < groups.length; i += 1) {
        for (let j = i + 1; j < groups.length; j += 1) {
          if (boxGap(groups[i], groups[j]) <= mergeGap) {
            groups[i] = mergeBoxes(groups[i], groups[j]);
            groups.splice(j, 1);
            changed = true;
            break outer;
          }
        }
      }
    }
    return groups;
  }

  function paddedBounds(group, width, height, padding) {
    const x0 = Math.max(0, group.minX - padding);
    const y0 = Math.max(0, group.minY - padding);
    const x1 = Math.min(width - 1, group.maxX + padding);
    const y1 = Math.min(height - 1, group.maxY + padding);
    return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  }
  function normalizedBounds(bounds, width, height) {
    return {
      x: bounds.x / width,
      y: bounds.y / height,
      width: bounds.width / width,
      height: bounds.height / height
    };
  }
  function rgbaHashForBounds(rgba, imageWidth, bounds) {
    let hash = 0x811c9dc5;
    for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
      let offset = (y * imageWidth + bounds.x) * 4;
      const end = offset + bounds.width * 4;
      for (; offset < end; offset += 1) {
        hash ^= rgba[offset]; hash = Math.imul(hash, 0x01000193);
      }
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }
  function alphaStats(rgba, imageWidth, bounds, threshold) {
    let nonzero = 0, thresholded = 0, alphaSum = 0;
    const total = bounds.width * bounds.height;
    for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
        const alpha = rgba[(y * imageWidth + x) * 4 + 3];
        if (alpha > 0) nonzero += 1;
        if (alpha >= threshold) thresholded += 1;
        alphaSum += alpha;
      }
    }
    return {
      nonzeroShare: total ? nonzero / total : 0,
      thresholdShare: total ? thresholded / total : 0,
      meanAlpha: total ? alphaSum / total / 255 : 0
    };
  }

  function extractCandidates(rgba, width, height, atlasId, rawConfig) {
    const dims = assertRgba(rgba, width, height);
    const raw = rawComponents(rgba, dims.width, dims.height, rawConfig);
    const cfg = raw.config;
    let groups = groupComponents(raw.components, cfg.mergeGap)
      .filter((group) => group.pixelCount >= cfg.minSpritePixels)
      .sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX) || (b.pixelCount - a.pixelCount))
      .slice(0, cfg.maxSprites);
    const idBase = String(atlasId || 'atlas').trim() || 'atlas';
    return groups.map((group, index) => {
      const bounds = paddedBounds(group, dims.width, dims.height, cfg.padding);
      const norm = normalizedBounds(bounds, dims.width, dims.height);
      const rgbaHash = rgbaHashForBounds(rgba, dims.width, bounds);
      const stats = alphaStats(rgba, dims.width, bounds, cfg.alphaThreshold);
      const identity = fnv1aText(stableStringify({ atlasId: idBase, bounds, norm, rgbaHash, threshold: cfg.alphaThreshold, mergeGap: cfg.mergeGap }));
      return {
        id: `${idBase}/sprite-${String(index + 1).padStart(3, '0')}-${identity}`,
        atlasId: idBase,
        ordinal: index + 1,
        bounds,
        normalizedBounds: norm,
        pixelCount: group.pixelCount,
        componentCount: group.componentCount || 1,
        alphaCoverage: stats,
        rgbaHash: `fnv1a32:${rgbaHash}`,
        extraction: clone(cfg),
        truth: 'Deterministic alpha-region sprite candidate; category/provenance may be known, but object semantics are not inferred from pixels.'
      };
    });
  }

  function cropRgba(rgba, imageWidth, imageHeight, bounds) {
    assertRgba(rgba, imageWidth, imageHeight);
    const x = Math.max(0, Math.min(imageWidth - 1, Math.round(bounds.x)));
    const y = Math.max(0, Math.min(imageHeight - 1, Math.round(bounds.y)));
    const width = Math.max(1, Math.min(imageWidth - x, Math.round(bounds.width)));
    const height = Math.max(1, Math.min(imageHeight - y, Math.round(bounds.height)));
    const out = new Uint8Array(width * height * 4);
    for (let row = 0; row < height; row += 1) {
      const sourceStart = ((y + row) * imageWidth + x) * 4;
      const targetStart = row * width * 4;
      for (let i = 0; i < width * 4; i += 1) out[targetStart + i] = rgba[sourceStart + i];
    }
    return { rgba: out, width, height };
  }

  function makeIndex(options) {
    const source = options || {};
    const atlas = source.atlas || {};
    const candidates = Array.isArray(source.candidates) ? source.candidates.map(clone) : [];
    const width = Math.round(Number(source.width));
    const height = Math.round(Number(source.height));
    if (!atlas.id || !width || !height) throw new TypeError('atlas.id, width and height are required.');
    const basis = {
      pack: clone(source.pack || {}), atlasId: atlas.id, width, height,
      sourceBasis: source.sourceBasis || 'unknown',
      extraction: clone(source.extraction || (candidates[0] && candidates[0].extraction) || {}),
      candidateIds: candidates.map((item) => item.id)
    };
    return {
      format: INDEX_FORMAT,
      version: VERSION,
      id: `sprite-index-${fnv1aText(stableStringify(basis))}`,
      pack: clone(source.pack || {}),
      atlas: {
        id: String(atlas.id), kind: atlas.kind || null, category: atlas.category || null,
        file: atlas.file || null, tags: clone(atlas.tags || [])
      },
      image: { width, height, sourceBasis: source.sourceBasis || 'unknown', sourceSha256: source.sourceSha256 || null },
      extraction: clone(basis.extraction),
      candidates,
      summary: {
        spriteCandidates: candidates.length,
        totalCandidatePixels: candidates.reduce((sum, item) => sum + (Number(item.pixelCount) || 0), 0)
      },
      truthBoundary: {
        alpha: 'Candidate geometry comes from observed alpha state at the recorded threshold/configuration.',
        semantics: 'A candidate is not automatically a semantic object; nearby fragments may be grouped conservatively and disconnected semantics are not guessed.',
        source: 'Normalized bounds preserve atlas-relative location so source-PNG extraction can be reused against scaled runtime derivatives.',
        authority: 'Extraction creates reusable candidates only; it does not automatically install, promote, or rewrite canonical material state.'
      }
    };
  }

  function validateIndex(index) {
    try {
      if (!index || index.format !== INDEX_FORMAT || index.version !== VERSION) return { ok: false, reason: `Expected ${INDEX_FORMAT}/${VERSION}.` };
      if (!index.atlas || !index.atlas.id) return { ok: false, reason: 'atlas.id is required.' };
      if (!index.image || !Number.isInteger(index.image.width) || !Number.isInteger(index.image.height) || index.image.width <= 0 || index.image.height <= 0) return { ok: false, reason: 'positive integer image dimensions are required.' };
      if (!Array.isArray(index.candidates)) return { ok: false, reason: 'candidates must be an array.' };
      const ids = new Set();
      for (const candidate of index.candidates) {
        if (!candidate || !candidate.id) return { ok: false, reason: 'candidate.id is required.' };
        if (ids.has(candidate.id)) return { ok: false, reason: `duplicate sprite id: ${candidate.id}` };
        ids.add(candidate.id);
        if (candidate.atlasId !== index.atlas.id) return { ok: false, reason: `candidate ${candidate.id} atlasId mismatch.` };
        const b = candidate.bounds || {};
        if (![b.x,b.y,b.width,b.height].every(Number.isFinite) || b.width <= 0 || b.height <= 0 || b.x < 0 || b.y < 0 || b.x + b.width > index.image.width || b.y + b.height > index.image.height) return { ok: false, reason: `candidate ${candidate.id} bounds are outside source image.` };
        const n = candidate.normalizedBounds || {};
        if (![n.x,n.y,n.width,n.height].every(Number.isFinite) || n.x < 0 || n.y < 0 || n.width <= 0 || n.height <= 0 || n.x + n.width > 1.000001 || n.y + n.height > 1.000001) return { ok: false, reason: `candidate ${candidate.id} normalized bounds are invalid.` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error && error.message ? error.message : String(error) };
    }
  }

  return {
    VERSION, INDEX_FORMAT,
    clone, clamp, stableStringify, fnv1aBytes, fnv1aText, configFor,
    rawComponents, groupComponents, extractCandidates, cropRgba,
    normalizedBounds, makeIndex, validateIndex
  };
});
