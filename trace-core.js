(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTraceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.2.0';

  function fnv1aBytes(bytes) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i += 1) {
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

  function round(value, digits) {
    const p = 10 ** (digits == null ? 4 : digits);
    return Math.round(Number(value) * p) / p;
  }

  function hexPreview(bytes, count) {
    const max = Math.min(bytes.length, count == null ? 24 : count);
    const out = [];
    for (let i = 0; i < max; i += 1) out.push(bytes[i].toString(16).padStart(2, '0'));
    return out.join(' ');
  }

  function bitsPreview(bytes, count) {
    const max = Math.min(bytes.length, count == null ? 8 : count);
    const out = [];
    for (let i = 0; i < max; i += 1) out.push(bytes[i].toString(2).padStart(8, '0'));
    return out.join(' ');
  }

  function summarizePixels(rgba) {
    if (!rgba || typeof rgba.length !== 'number' || rgba.length % 4 !== 0) {
      throw new TypeError('RGBA byte data must have a length divisible by four.');
    }

    const pixelCount = rgba.length / 4;
    let transparent = 0;
    let translucent = 0;
    let opaque = 0;
    let visible = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumA = 0;
    let minAlpha = 255;
    let maxAlpha = 0;
    const lumaHistogram16 = Array(16).fill(0);
    const buckets = new Map();

    for (let i = 0; i < rgba.length; i += 4) {
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const a = rgba[i + 3];
      sumA += a;
      minAlpha = Math.min(minAlpha, a);
      maxAlpha = Math.max(maxAlpha, a);

      if (a === 0) {
        transparent += 1;
        continue;
      }
      visible += 1;
      if (a === 255) opaque += 1;
      else translucent += 1;

      sumR += r;
      sumG += g;
      sumB += b;
      const luma = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
      lumaHistogram16[Math.min(15, Math.floor(luma / 16))] += 1;

      const qr = r >> 4;
      const qg = g >> 4;
      const qb = b >> 4;
      const key = `${qr.toString(16)}${qg.toString(16)}${qb.toString(16)}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    const topColorBuckets = [...buckets.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([bucket, count]) => ({
        bucket,
        count,
        shareOfVisible: visible ? round(count / visible, 6) : 0
      }));

    return {
      pixelCount,
      byteCount: rgba.length,
      pixelHash: fnv1aBytes(rgba),
      alpha: {
        transparent,
        translucent,
        opaque,
        visible,
        coverage: pixelCount ? round(visible / pixelCount, 6) : 0,
        average: pixelCount ? round(sumA / pixelCount, 4) : 0,
        min: pixelCount ? minAlpha : 0,
        max: pixelCount ? maxAlpha : 0
      },
      averageVisibleRgb: visible ? {
        r: round(sumR / visible, 4),
        g: round(sumG / visible, 4),
        b: round(sumB / visible, 4)
      } : { r: 0, g: 0, b: 0 },
      lumaHistogram16,
      topColorBuckets
    };
  }

  function previewValue(value) {
    if (typeof value === 'string' && value.length > 180) return `${value.slice(0, 177)}...`;
    return value;
  }

  function diffValues(before, after, limit) {
    const diffs = [];
    const max = Number.isFinite(limit) ? Math.max(1, limit) : 300;

    function walk(a, b, path) {
      if (diffs.length >= max || a === b) return;
      const aObj = a !== null && typeof a === 'object';
      const bObj = b !== null && typeof b === 'object';
      if (!aObj || !bObj || Array.isArray(a) !== Array.isArray(b)) {
        diffs.push({ path: path || '$', before: previewValue(a), after: previewValue(b) });
        return;
      }
      if (Array.isArray(a)) {
        const length = Math.max(a.length, b.length);
        for (let i = 0; i < length && diffs.length < max; i += 1) walk(a[i], b[i], `${path}[${i}]`);
        return;
      }
      const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
      for (const key of [...keys].sort()) {
        if (diffs.length >= max) break;
        walk(a ? a[key] : undefined, b ? b[key] : undefined, path ? `${path}.${key}` : key);
      }
    }

    walk(before, after, '');
    return diffs;
  }

  return {
    VERSION,
    fnv1aBytes,
    fnv1aText,
    hexPreview,
    bitsPreview,
    summarizePixels,
    diffValues
  };
});
