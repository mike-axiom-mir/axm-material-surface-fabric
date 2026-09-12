(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMDeltaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.3.0';

  function round(value, digits) {
    const p = 10 ** (digits == null ? 6 : digits);
    return Math.round(Number(value) * p) / p;
  }

  function validateRgbaPair(before, after, width, height) {
    if (!before || !after || typeof before.length !== 'number' || typeof after.length !== 'number') {
      throw new TypeError('Before and after RGBA buffers are required.');
    }
    if (before.length !== after.length || before.length % 4 !== 0) {
      throw new TypeError('RGBA buffers must be equal length and divisible by four.');
    }
    const pixels = before.length / 4;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width * height !== pixels) {
      throw new TypeError('Width and height must exactly match the RGBA buffers.');
    }
  }

  function normalizeGridSize(value) {
    const n = Math.floor(Number(value) || 4);
    return Math.max(1, Math.min(32, n));
  }

  function summarizePixelDelta(before, after, width, height, options) {
    validateRgbaPair(before, after, width, height);
    const opts = options || {};
    const threshold = Math.max(0, Math.min(255, Number(opts.threshold) || 0));
    const gridSize = normalizeGridSize(opts.gridSize);
    const pixelCount = width * height;
    const regions = Array.from({ length: gridSize * gridSize }, (_, index) => ({
      index,
      row: Math.floor(index / gridSize),
      column: index % gridSize,
      pixelCount: 0,
      changedPixels: 0,
      totalAbsChannelDelta: 0,
      maxChannelDelta: 0
    }));

    let changedPixels = 0;
    let totalAbsChannelDelta = 0;
    let changedAbsChannelDelta = 0;
    let maxChannelDelta = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let p = 0; p < pixelCount; p += 1) {
      const i = p * 4;
      const x = p % width;
      const y = Math.floor(p / width);
      const dr = Math.abs(before[i] - after[i]);
      const dg = Math.abs(before[i + 1] - after[i + 1]);
      const db = Math.abs(before[i + 2] - after[i + 2]);
      const da = Math.abs(before[i + 3] - after[i + 3]);
      const sum = dr + dg + db + da;
      const localMax = Math.max(dr, dg, db, da);
      totalAbsChannelDelta += sum;
      maxChannelDelta = Math.max(maxChannelDelta, localMax);

      const column = Math.min(gridSize - 1, Math.floor((x * gridSize) / width));
      const row = Math.min(gridSize - 1, Math.floor((y * gridSize) / height));
      const region = regions[row * gridSize + column];
      region.pixelCount += 1;
      region.totalAbsChannelDelta += sum;
      region.maxChannelDelta = Math.max(region.maxChannelDelta, localMax);

      if (localMax > threshold) {
        changedPixels += 1;
        changedAbsChannelDelta += sum;
        region.changedPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    const normalizedRegions = regions.map((region) => ({
      index: region.index,
      row: region.row,
      column: region.column,
      pixelCount: region.pixelCount,
      changedPixels: region.changedPixels,
      changedShare: region.pixelCount ? round(region.changedPixels / region.pixelCount) : 0,
      meanAbsChannelDelta: region.pixelCount ? round(region.totalAbsChannelDelta / (region.pixelCount * 4), 4) : 0,
      maxChannelDelta: region.maxChannelDelta
    }));

    return {
      width,
      height,
      pixelCount,
      threshold,
      gridSize,
      changedPixels,
      unchangedPixels: pixelCount - changedPixels,
      changedShare: pixelCount ? round(changedPixels / pixelCount) : 0,
      meanAbsChannelDelta: pixelCount ? round(totalAbsChannelDelta / (pixelCount * 4), 4) : 0,
      meanChangedPixelChannelDelta: changedPixels ? round(changedAbsChannelDelta / (changedPixels * 4), 4) : 0,
      maxChannelDelta,
      changedBounds: changedPixels ? {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        maxX,
        maxY
      } : null,
      regions: normalizedRegions
    };
  }

  function buildDifferenceRgba(before, after, width, height, options) {
    validateRgbaPair(before, after, width, height);
    const opts = options || {};
    const threshold = Math.max(0, Math.min(255, Number(opts.threshold) || 0));
    const out = new Uint8ClampedArray(before.length);
    for (let i = 0; i < before.length; i += 4) {
      const dr = Math.abs(before[i] - after[i]);
      const dg = Math.abs(before[i + 1] - after[i + 1]);
      const db = Math.abs(before[i + 2] - after[i + 2]);
      const da = Math.abs(before[i + 3] - after[i + 3]);
      const magnitude = Math.max(dr, dg, db, da);
      if (magnitude <= threshold) continue;
      out[i] = magnitude;
      out[i + 1] = magnitude;
      out[i + 2] = magnitude;
      out[i + 3] = 255;
    }
    return out;
  }

  function groupChangedPaths(diffs) {
    const groups = { top: 0, build: 0, pixels: 0, file: 0, lineage: 0, other: 0 };
    (diffs || []).forEach((item) => {
      const path = String(item && item.path || '');
      if (path.startsWith('topState')) groups.top += 1;
      else if (path.startsWith('buildState')) groups.build += 1;
      else if (path.startsWith('pixelState')) groups.pixels += 1;
      else if (path.startsWith('fileState')) groups.file += 1;
      else if (path.startsWith('lineage') || path.startsWith('declared')) groups.lineage += 1;
      else groups.other += 1;
    });
    return groups;
  }

  function makeTransition(parent, child, declaredAction, declaredParams, observed) {
    if (!parent || !child) throw new TypeError('Parent and child traces are required.');
    return {
      format: 'axm-material-transition',
      version: VERSION,
      fromTraceId: parent.id,
      toTraceId: child.id,
      declaredAction: String(declaredAction || '').trim() || null,
      declaredParams: declaredParams == null ? null : declaredParams,
      observed: observed || null,
      truthBoundary: 'Declared action is experiment intent. Observed deltas are measurements. This record does not claim hidden causal state.'
    };
  }

  return {
    VERSION,
    round,
    summarizePixelDelta,
    buildDifferenceRgba,
    groupChangedPaths,
    makeTransition
  };
});
