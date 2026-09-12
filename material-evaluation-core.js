(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMMaterialEvaluationCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.8.0';
  const FORMAT = 'axm-material-evaluation-session';
  const TECHNICAL_SCORE_LABEL = 'bounded-renderer-health';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max, fallback) {
    const parsed = Number(value);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, base));
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
  function fnv1a(text) {
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
  function hashBytes(bytes) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i += 1) {
      hash ^= bytes[i] & 255;
      hash = Math.imul(hash, 0x01000193);
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }

  function summarizeFramebuffer(rgba, width, height, options) {
    if (!(rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray)) throw new TypeError('Framebuffer RGBA must be a typed byte array.');
    const w = Math.max(1, Math.round(Number(width) || 0));
    const h = Math.max(1, Math.round(Number(height) || 0));
    if (rgba.length !== w * h * 4) throw new TypeError('Framebuffer RGBA length does not match width × height × 4.');
    const opts = options || {};
    const visibleAlpha = Math.round(clamp(opts.visibleAlpha, 0, 255, 8));
    const blackThreshold = clamp(opts.blackThreshold, 0, 1, 0.03);
    const whiteThreshold = clamp(opts.whiteThreshold, 0, 1, 0.97);
    const pixelCount = w * h;
    let visiblePixels = 0;
    let transparentPixels = 0;
    let nearBlack = 0;
    let nearWhite = 0;
    let sumLuma = 0;
    let sumLuma2 = 0;
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
    let minLuma = 1, maxLuma = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      const r = rgba[i] / 255;
      const g = rgba[i + 1] / 255;
      const b = rgba[i + 2] / 255;
      const a = rgba[i + 3] / 255;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumR += r; sumG += g; sumB += b; sumA += a;
      sumLuma += luma;
      sumLuma2 += luma * luma;
      minLuma = Math.min(minLuma, luma);
      maxLuma = Math.max(maxLuma, luma);
      if (rgba[i + 3] >= visibleAlpha) visiblePixels += 1;
      else transparentPixels += 1;
      if (luma <= blackThreshold) nearBlack += 1;
      if (luma >= whiteThreshold) nearWhite += 1;
    }
    const meanLuma = sumLuma / pixelCount;
    const variance = Math.max(0, sumLuma2 / pixelCount - meanLuma * meanLuma);
    return {
      width: w,
      height: h,
      pixelCount,
      pixelHash: hashBytes(rgba),
      visibleAlpha,
      visiblePixels,
      visibleShare: visiblePixels / pixelCount,
      transparentPixels,
      transparentShare: transparentPixels / pixelCount,
      meanRgb: [sumR / pixelCount, sumG / pixelCount, sumB / pixelCount],
      meanAlpha: sumA / pixelCount,
      meanLuma,
      lumaStdDev: Math.sqrt(variance),
      lumaRange: maxLuma - minLuma,
      minLuma,
      maxLuma,
      nearBlackShare: nearBlack / pixelCount,
      nearWhiteShare: nearWhite / pixelCount
    };
  }

  function evaluateRenderObservation(raw) {
    if (!raw || typeof raw !== 'object') throw new TypeError('Render observation must be an object.');
    const receipt = raw.receipt || {};
    const summary = raw.summary || {};
    const signals = [];
    const holds = [];
    let score = 100;

    if (!receipt.runtime || receipt.runtime.drawCompleted !== true) {
      holds.push('draw-not-completed');
      score -= 45;
    }
    if (!receipt.runtime || receipt.runtime.shaderLinked !== true) {
      holds.push('shader-not-linked');
      score -= 35;
    }
    const missing = Array.isArray(receipt.missingEntries) ? receipt.missingEntries.length : 0;
    const held = Array.isArray(receipt.heldLayers) ? receipt.heldLayers.length : 0;
    if (missing) { holds.push(`missing-entry-refs:${missing}`); score -= Math.min(30, missing * 8); }
    if (held) { holds.push(`held-layers:${held}`); score -= Math.min(30, held * 8); }

    const visibleShare = clamp(summary.visibleShare, 0, 1, 0);
    const nearBlack = clamp(summary.nearBlackShare, 0, 1, 0);
    const nearWhite = clamp(summary.nearWhiteShare, 0, 1, 0);
    const lumaStdDev = clamp(summary.lumaStdDev, 0, 1, 0);
    const lumaRange = clamp(summary.lumaRange, 0, 1, 0);

    if (visibleShare < 0.01) { holds.push('almost-no-visible-output'); score -= 45; }
    else if (visibleShare < 0.15) { signals.push('low-visible-coverage'); score -= 12; }
    if (nearBlack > 0.97) { signals.push('near-black-collapse'); score -= 24; }
    else if (nearBlack > 0.85) { signals.push('mostly-near-black'); score -= 10; }
    if (nearWhite > 0.97) { signals.push('near-white-collapse'); score -= 24; }
    else if (nearWhite > 0.85) { signals.push('mostly-near-white'); score -= 10; }
    if (lumaStdDev < 0.006 && lumaRange < 0.04) { signals.push('very-low-render-signal'); score -= 18; }
    else if (lumaStdDev < 0.015) { signals.push('low-render-contrast'); score -= 7; }

    const warnings = Array.isArray(receipt.warnings) ? receipt.warnings.slice() : [];
    const truthStatus = holds.length ? 'HOLD_RENDER_PATH' : 'OBSERVED_RENDER_PATH';
    return {
      id: String(raw.id || `observation-${fnv1a(stableStringify({ light: raw.lightRigId, geometry: raw.geometry, hash: summary.pixelHash }))}`),
      lightRigId: raw.lightRigId || null,
      lightRigName: raw.lightRigName || null,
      geometry: raw.geometry || receipt.geometry || null,
      truthStatus,
      technicalScore: Math.max(0, Math.min(100, Math.round(score * 100) / 100)),
      scoreLabel: TECHNICAL_SCORE_LABEL,
      scoreBoundary: 'This score measures bounded renderer-path technical health/observability only. It is not an aesthetic, realism, PBR, or physical-quality score.',
      holds,
      signals,
      warnings,
      summary: clone(summary),
      receipt: clone(receipt)
    };
  }

  function aggregateEvaluationRun(raw) {
    if (!raw || typeof raw !== 'object') throw new TypeError('Evaluation run must be an object.');
    const observations = Array.isArray(raw.observations) ? raw.observations.map(clone) : [];
    const scores = observations.map((row) => Number(row.technicalScore)).filter(Number.isFinite);
    const completed = observations.filter((row) => row.truthStatus === 'OBSERVED_RENDER_PATH').length;
    const holds = observations.length - completed;
    const uniqueHashes = new Set(observations.map((row) => row.summary && row.summary.pixelHash).filter(Boolean));
    const lumas = observations.map((row) => row.summary && Number(row.summary.meanLuma)).filter(Number.isFinite);
    const geometries = [...new Set(observations.map((row) => row.geometry).filter(Boolean))].sort();
    const lightRigs = [...new Set(observations.map((row) => row.lightRigId).filter(Boolean))].sort();
    const meanScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const minScore = scores.length ? Math.min(...scores) : 0;
    const maxScore = scores.length ? Math.max(...scores) : 0;
    const minLuma = lumas.length ? Math.min(...lumas) : 0;
    const maxLuma = lumas.length ? Math.max(...lumas) : 0;
    const signalCounts = {};
    observations.forEach((row) => (row.signals || []).forEach((signal) => { signalCounts[signal] = (signalCounts[signal] || 0) + 1; }));
    const holdReasons = {};
    observations.forEach((row) => (row.holds || []).forEach((reason) => { holdReasons[reason] = (holdReasons[reason] || 0) + 1; }));
    return {
      id: String(raw.id || `run-${fnv1a(stableStringify({ candidateId: raw.candidateId, observations: observations.map((row) => row.id) }))}`),
      candidateId: raw.candidateId || null,
      sourceKind: raw.sourceKind || null,
      descriptorHash: raw.descriptorHash || null,
      observationCount: observations.length,
      completed,
      holds,
      completionShare: observations.length ? completed / observations.length : 0,
      technicalScore: Math.round(meanScore * 100) / 100,
      minimumTechnicalScore: Math.round(minScore * 100) / 100,
      maximumTechnicalScore: Math.round(maxScore * 100) / 100,
      scoreLabel: TECHNICAL_SCORE_LABEL,
      scoreBoundary: 'Aggregate ranking measures bounded renderer-path health and signal stability, not beauty, realism, material truth, or user preference.',
      uniqueFramebufferHashes: uniqueHashes.size,
      crossLightMeanLumaRange: maxLuma - minLuma,
      geometries,
      lightRigs,
      signalCounts,
      holdReasons,
      observations,
      truthStatus: holds ? 'PARTIAL_EVALUATION_WITH_HOLDS' : observations.length ? 'OBSERVED_EVALUATION_COMPLETE' : 'HOLD_NO_OBSERVATIONS'
    };
  }

  function rgbToHex(rgb) {
    const values = rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))));
    return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }
  function hexToRgb(hex) {
    const value = String(hex || '#000000').replace('#', '');
    const parsed = /^[0-9a-f]{6}$/i.test(value) ? parseInt(value, 16) : 0;
    return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
  }
  function mutateColor(hex, brightnessDelta, saturationScale) {
    const rgb = hexToRgb(hex);
    const mean = (rgb[0] + rgb[1] + rgb[2]) / 3;
    const out = rgb.map((value) => {
      const saturated = mean + (value - mean) * saturationScale;
      return saturated + brightnessDelta * 255;
    });
    return rgbToHex(out);
  }

  function createDeterministicVariants(baseFamily, count) {
    if (!baseFamily || typeof baseFamily !== 'object' || !baseFamily.id) throw new TypeError('A base material family descriptor is required.');
    const total = Math.max(1, Math.min(12, Math.round(Number(count) || 4)));
    const variants = [];
    for (let index = 0; index < total; index += 1) {
      const seedHash = parseInt(fnv1a(`${baseFamily.id}|v0.8|${index}`), 16) >>> 0;
      const signed = (shift) => (((seedHash >>> shift) & 255) / 255) * 2 - 1;
      const roughShift = signed(0) * 0.14;
      const roughWidth = 0.82 + ((seedHash >>> 8) & 255) / 255 * 0.42;
      const normalScale = 0.72 + ((seedHash >>> 16) & 255) / 255 * 0.78;
      const scaleMultiplier = 0.68 + ((seedHash >>> 24) & 255) / 255 * 1.15;
      const aoScale = 0.78 + ((seedHash >>> 4) & 255) / 255 * 0.48;
      const heightScale = 0.72 + ((seedHash >>> 12) & 255) / 255 * 0.72;
      const brightnessDelta = signed(20) * 0.065;
      const saturationScale = 0.86 + ((seedHash >>> 2) & 255) / 255 * 0.32;
      const roughness = Array.isArray(baseFamily.roughness) ? baseFamily.roughness.slice(0, 2) : [0.35, 0.75];
      const midpoint = clamp((roughness[0] + roughness[1]) / 2 + roughShift, 0.03, 0.97, 0.5);
      const half = Math.max(0.02, (roughness[1] - roughness[0]) * 0.5 * roughWidth);
      const nextRoughness = [clamp(midpoint - half, 0.02, 0.97, roughness[0]), clamp(midpoint + half, 0.03, 0.99, roughness[1])];
      if (nextRoughness[1] < nextRoughness[0]) nextRoughness.reverse();
      const descriptor = clone(baseFamily);
      descriptor.id = `${baseFamily.id}--eval-${index + 1}-${fnv1a(`${baseFamily.id}|${seedHash}`).slice(0, 6)}`;
      descriptor.name = `${baseFamily.name} — evaluated variant ${index + 1}`;
      descriptor.seed = (Number(baseFamily.seed) || 0) ^ seedHash;
      descriptor.scale = clamp((Number(baseFamily.scale) || 8) * scaleMultiplier, 1.5, 64, 8);
      descriptor.roughness = nextRoughness;
      descriptor.normalStrength = clamp((Number(baseFamily.normalStrength) || 1) * normalScale, 0.05, 3, 1);
      descriptor.heightContrast = clamp((Number(baseFamily.heightContrast) || 0.65) * heightScale, 0.05, 1.5, 0.65);
      descriptor.aoStrength = clamp((Number(baseFamily.aoStrength) || 0.35) * aoScale, 0, 1.2, 0.35);
      descriptor.palette = (baseFamily.palette || ['#777777']).map((color) => mutateColor(color, brightnessDelta, saturationScale));
      descriptor.note = `${String(baseFamily.note || '')}${baseFamily.note ? ' ' : ''}v0.8 deterministic evaluation variant; parent=${baseFamily.id}; mutationIndex=${index + 1}.`;
      descriptor.evaluationVariant = {
        version: VERSION,
        parentId: baseFamily.id,
        mutationIndex: index + 1,
        mutationSeed: seedHash,
        changes: {
          roughShift,
          roughWidth,
          normalScale,
          scaleMultiplier,
          aoScale,
          heightScale,
          brightnessDelta,
          saturationScale
        }
      };
      descriptor.evaluationDescriptorHash = fnv1a(stableStringify(descriptor));
      variants.push(descriptor);
    }
    return variants;
  }

  function rankCandidateRuns(runs) {
    const rows = (Array.isArray(runs) ? runs : []).map(clone);
    rows.sort((a, b) => {
      const completionDelta = Number(b.completionShare || 0) - Number(a.completionShare || 0);
      if (Math.abs(completionDelta) > 1e-9) return completionDelta > 0 ? 1 : -1;
      const scoreDelta = Number(b.technicalScore || 0) - Number(a.technicalScore || 0);
      if (Math.abs(scoreDelta) > 1e-9) return scoreDelta > 0 ? 1 : -1;
      const minDelta = Number(b.minimumTechnicalScore || 0) - Number(a.minimumTechnicalScore || 0);
      if (Math.abs(minDelta) > 1e-9) return minDelta > 0 ? 1 : -1;
      return String(a.candidateId || '').localeCompare(String(b.candidateId || ''));
    });
    return rows.map((row, index) => Object.assign({}, row, {
      rank: index + 1,
      rankingBasis: 'Completion share, mean bounded-renderer-health score, then minimum bounded-renderer-health score. This is a technical renderer-path ranking only, not aesthetic/material quality.'
    }));
  }

  function createSession(options) {
    const input = options || {};
    const createdAt = String(input.createdAt || new Date().toISOString());
    const source = clone(input.source || { kind: 'unknown' });
    return {
      format: FORMAT,
      version: VERSION,
      id: String(input.id || `evaluation-${fnv1a(`${createdAt}|${stableStringify(source)}`)}`),
      createdAt,
      updatedAt: createdAt,
      source,
      settings: {
        resolution: Math.max(32, Math.min(512, Math.round(Number(input.resolution) || 64))),
        mode: String(input.mode || 'quick'),
        geometries: Array.isArray(input.geometries) ? [...new Set(input.geometries.map(String))] : ['sphere'],
        lightRigIds: Array.isArray(input.lightRigIds) ? [...new Set(input.lightRigIds.map(String))] : []
      },
      candidates: [],
      selectedCandidateId: null,
      installReceipts: [],
      truthBoundary: {
        ranking: 'Candidate ranking is bounded renderer-path technical health only. It does not score beauty, realism, taste, PBR correctness, or real-world material truth.',
        evolution: 'Variants are deterministic declared mutations of known descriptor fields; no hidden optimizer or model preference is used.',
        evidence: 'Framebuffer observations are evidence for this local renderer path only and may vary across GPU/browser implementations.',
        agency: 'No candidate is installed or promoted automatically; persistence into the material library remains an explicit action.'
      }
    };
  }

  function addCandidateRun(session, candidate, run, representative) {
    if (!session || session.format !== FORMAT) throw new TypeError('Valid evaluation session required.');
    const candidateId = String(candidate && candidate.id || run && run.candidateId || 'unknown');
    const row = {
      id: candidateId,
      name: String(candidate && candidate.name || candidateId),
      parentId: candidate && candidate.evaluationVariant && candidate.evaluationVariant.parentId || null,
      descriptorHash: candidate && (candidate.evaluationDescriptorHash || fnv1a(stableStringify(candidate))) || run && run.descriptorHash || null,
      descriptor: candidate ? clone(candidate) : null,
      run: clone(run),
      representative: representative ? clone(representative) : null,
      addedAt: new Date().toISOString()
    };
    session.candidates = session.candidates.filter((item) => item.id !== candidateId);
    session.candidates.push(row);
    const ranked = rankCandidateRuns(session.candidates.map((item) => item.run));
    const rankById = new Map(ranked.map((item) => [item.candidateId, item.rank]));
    session.candidates.forEach((item) => { item.rank = rankById.get(item.id) || null; });
    session.candidates.sort((a, b) => (a.rank || 999) - (b.rank || 999) || a.id.localeCompare(b.id));
    if (!session.selectedCandidateId && session.candidates.length) session.selectedCandidateId = session.candidates[0].id;
    session.updatedAt = new Date().toISOString();
    return clone(row);
  }

  function recordInstall(session, receipt) {
    if (!session || session.format !== FORMAT) throw new TypeError('Valid evaluation session required.');
    session.installReceipts.push(clone(receipt || {}));
    session.updatedAt = new Date().toISOString();
    return session.installReceipts.length;
  }

  function validateSession(value) {
    if (!value || typeof value !== 'object') return { ok: false, reason: 'Evaluation session must be an object.' };
    if (value.format !== FORMAT || value.version !== VERSION) return { ok: false, reason: `Expected ${FORMAT}/${VERSION}.` };
    if (!value.settings || !Array.isArray(value.settings.geometries) || !Array.isArray(value.settings.lightRigIds)) return { ok: false, reason: 'Evaluation settings are incomplete.' };
    if (!Array.isArray(value.candidates) || !Array.isArray(value.installReceipts)) return { ok: false, reason: 'Evaluation candidates/install receipts are missing.' };
    const ids = new Set();
    for (const candidate of value.candidates) {
      if (!candidate || !candidate.id || !candidate.run) return { ok: false, reason: 'Evaluation candidate is invalid.' };
      if (ids.has(candidate.id)) return { ok: false, reason: `Duplicate candidate id: ${candidate.id}` };
      ids.add(candidate.id);
    }
    if (value.selectedCandidateId && !ids.has(value.selectedCandidateId)) return { ok: false, reason: 'selectedCandidateId does not resolve.' };
    return { ok: true };
  }

  return {
    VERSION,
    FORMAT,
    TECHNICAL_SCORE_LABEL,
    clone,
    clamp,
    stableStringify,
    fnv1a,
    hashBytes,
    summarizeFramebuffer,
    evaluateRenderObservation,
    aggregateEvaluationRun,
    createDeterministicVariants,
    rankCandidateRuns,
    createSession,
    addCandidateRun,
    recordInstall,
    validateSession
  };
});
