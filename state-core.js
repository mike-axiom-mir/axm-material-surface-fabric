(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMStateCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.1.0';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}-${Date.now().toString(36)}-${random}`;
  }

  function createInitialState() {
    return {
      format: 'axm-material-surface-state',
      version: VERSION,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      workspace: {
        id: uid('workspace'),
        name: 'untitled-surface',
        width: 1024,
        height: 1024,
        previewBackground: '#11161b',
        exportBackground: false,
        checkerboard: true
      },
      assets: [],
      layers: [],
      selection: {
        assetId: null,
        layerId: null
      },
      snapshots: [],
      events: [],
      ui: {
        librarySearch: '',
        statePanel: 'live',
        inspectorPayloads: false
      },
      truth: {
        networkUsed: false,
        externalAssetsBundled: false,
        notes: 'State is captured from the working page. Material semantics are intentionally not pre-imposed in v0.1.0.'
      }
    };
  }

  function stableStringify(value) {
    const seen = new WeakSet();
    function normalize(input) {
      if (input === null || typeof input !== 'object') return input;
      if (seen.has(input)) throw new TypeError('Cannot stable-stringify circular data');
      seen.add(input);
      if (Array.isArray(input)) {
        const out = input.map(normalize);
        seen.delete(input);
        return out;
      }
      const out = {};
      Object.keys(input).sort().forEach((key) => {
        out[key] = normalize(input[key]);
      });
      seen.delete(input);
      return out;
    }
    return JSON.stringify(normalize(value));
  }

  function fnv1a(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }

  function payloadDescriptor(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    return {
      omitted: true,
      length: dataUrl.length,
      hash: fnv1a(dataUrl),
      prefix: dataUrl.slice(0, 32)
    };
  }

  function compactState(state, includePayloads) {
    const out = clone(state);
    out.assets = (out.assets || []).map((asset) => {
      if (!includePayloads && asset.dataUrl) asset.dataUrl = payloadDescriptor(asset.dataUrl);
      return asset;
    });
    out.snapshots = (out.snapshots || []).map((snap) => ({
      id: snap.id,
      label: snap.label,
      capturedAt: snap.capturedAt,
      hash: snap.hash,
      diffCount: Array.isArray(snap.diffFromPrevious) ? snap.diffFromPrevious.length : 0
    }));
    return out;
  }

  function hashState(state) {
    return fnv1a(stableStringify(compactState(state, false)));
  }

  function valuePreview(value) {
    if (typeof value === 'string' && value.length > 180) return `${value.slice(0, 177)}...`;
    return value;
  }

  function diffStates(before, after) {
    const diffs = [];
    function walk(a, b, path) {
      if (a === b) return;
      const aObj = a && typeof a === 'object';
      const bObj = b && typeof b === 'object';
      if (!aObj || !bObj || Array.isArray(a) !== Array.isArray(b)) {
        diffs.push({ path: path || '$', before: valuePreview(a), after: valuePreview(b) });
        return;
      }
      if (Array.isArray(a) && Array.isArray(b)) {
        const max = Math.max(a.length, b.length);
        for (let i = 0; i < max; i += 1) walk(a[i], b[i], `${path}[${i}]`);
        return;
      }
      const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
      [...keys].sort().forEach((key) => walk(a ? a[key] : undefined, b ? b[key] : undefined, path ? `${path}.${key}` : key));
    }
    walk(before, after, '');
    return diffs;
  }

  function captureSnapshot(state, label) {
    const observed = compactState(state, false);
    const previous = state.snapshots && state.snapshots.length ? state.snapshots[state.snapshots.length - 1] : null;
    const diff = previous && previous.observed ? diffStates(previous.observed, observed) : [];
    return {
      id: uid('snapshot'),
      label: (label || '').trim() || `Snapshot ${(state.snapshots || []).length + 1}`,
      capturedAt: nowIso(),
      hash: fnv1a(stableStringify(observed)),
      observed,
      diffFromPrevious: diff
    };
  }

  function recordEvent(state, type, detail) {
    const event = {
      id: uid('event'),
      at: nowIso(),
      type,
      detail: detail || null
    };
    state.events = Array.isArray(state.events) ? state.events : [];
    state.events.push(event);
    if (state.events.length > 100) state.events.splice(0, state.events.length - 100);
    state.updatedAt = event.at;
    return event;
  }

  function validateImportedState(value) {
    if (!value || typeof value !== 'object') return { ok: false, reason: 'State must be an object.' };
    if (value.format !== 'axm-material-surface-state') return { ok: false, reason: 'Not an AXM material/surface state file.' };
    if (!value.workspace || !Array.isArray(value.assets) || !Array.isArray(value.layers)) {
      return { ok: false, reason: 'Workspace, assets, or layers are missing.' };
    }
    return { ok: true };
  }

  return {
    VERSION,
    clone,
    uid,
    nowIso,
    createInitialState,
    stableStringify,
    fnv1a,
    compactState,
    hashState,
    diffStates,
    captureSnapshot,
    recordEvent,
    validateImportedState
  };
});
