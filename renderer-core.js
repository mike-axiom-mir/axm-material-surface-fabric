(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMMaterialRendererCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.6.0';
  const RECEIPT_FORMAT = 'axm-material-render-receipt';
  const GEOMETRIES = ['sphere', 'plane', 'cube'];
  const DIRECT_CHANNELS = [
    'base-color', 'normal', 'roughness', 'metallic', 'ambient-occlusion', 'emissive', 'opacity'
  ];
  const BASE_COLOR_OVERLAYS = ['decal', 'microdetail'];
  const PRESERVED_ONLY_CHANNELS = ['height', 'displacement', 'color-mask', 'unassigned'];

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
      const result = {};
      Object.keys(input).sort().forEach((key) => { result[key] = normalize(input[key]); });
      return result;
    }
    return JSON.stringify(normalize(value));
  }
  function fnv1a(text) {
    const input = String(text == null ? '' : text);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index);
      hash ^= code & 0xff;
      hash = Math.imul(hash, 0x01000193);
      hash ^= (code >>> 8) & 0xff;
      hash = Math.imul(hash, 0x01000193);
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }

  function normalizeRendererOptions(raw) {
    const source = raw || {};
    const geometry = GEOMETRIES.includes(source.geometry) ? source.geometry : 'sphere';
    return {
      geometry,
      normalStrength: clamp(source.normalStrength, 0, 3, 1),
      alphaCutoff: clamp(source.alphaCutoff, 0, 1, 0.02),
      textureSize: Math.round(clamp(source.textureSize, 64, 2048, 512)),
      background: /^#[0-9a-f]{6}$/i.test(String(source.background || '')) ? String(source.background).toLowerCase() : '#0a0d10'
    };
  }

  function classifyChannel(channel) {
    const name = String(channel || 'unassigned').trim().toLowerCase().replace(/_/g, '-');
    if (DIRECT_CHANNELS.includes(name)) return { channel: name, mode: 'direct' };
    if (BASE_COLOR_OVERLAYS.includes(name)) return { channel: 'base-color', mode: 'base-color-overlay', sourceChannel: name };
    if (PRESERVED_ONLY_CHANNELS.includes(name)) return { channel: name, mode: 'preserved-only' };
    return { channel: name || 'unassigned', mode: 'preserved-only' };
  }

  function compileRenderPlan(recipe, libraryEntries, options) {
    if (!recipe || typeof recipe !== 'object') throw new TypeError('Renderer requires one material recipe.');
    const entries = Array.isArray(libraryEntries) ? libraryEntries : [];
    const entryById = new Map(entries.map((entry) => [String(entry.id), entry]));
    const renderer = normalizeRendererOptions(options);
    const interpreted = {};
    DIRECT_CHANNELS.forEach((channel) => { interpreted[channel] = []; });
    const preservedOnly = [];
    const missingEntries = [];
    const heldLayers = [];

    (Array.isArray(recipe.stack) ? recipe.stack : []).forEach((layer, index) => {
      if (!layer || layer.visible === false) return;
      const entryId = String(layer.entryId || '');
      const entry = entryById.get(entryId);
      if (!entry) {
        missingEntries.push({ layerId: layer.id || null, entryId, targetChannel: layer.targetChannel || 'unassigned' });
        return;
      }
      const classification = classifyChannel(layer.targetChannel);
      const row = {
        order: index,
        layerId: String(layer.id || `layer-${index + 1}`),
        entryId,
        entryName: String(entry.name || entryId),
        targetChannel: String(layer.targetChannel || 'unassigned'),
        resolvedChannel: classification.channel,
        interpretationMode: classification.mode,
        blendMode: String(layer.blendMode || 'normal'),
        opacity: clamp(layer.opacity, 0, 1, 1),
        maskEntryId: layer.maskEntryId ? String(layer.maskEntryId) : null,
        transform: clone(layer.transform || {}),
        tiling: clone(layer.tiling || {}),
        portablePayload: typeof entry.dataUrl === 'string' && entry.dataUrl.startsWith('data:image/')
      };
      if (!row.portablePayload) {
        heldLayers.push(Object.assign({}, row, { reason: 'entry has no portable image payload' }));
        return;
      }
      if (classification.mode === 'preserved-only') preservedOnly.push(row);
      else interpreted[classification.channel].push(row);
    });

    const interpretedChannels = Object.keys(interpreted).filter((channel) => interpreted[channel].length);
    const normalLayers = interpreted.normal.length;
    const receiptBasis = {
      recipeId: recipe.id || null,
      recipeUpdatedAt: recipe.updatedAt || null,
      renderer,
      interpreted,
      preservedOnly,
      missingEntries,
      heldLayers
    };
    return {
      version: VERSION,
      renderer,
      recipeId: recipe.id || null,
      recipeName: recipe.name || 'unnamed material recipe',
      recipeFingerprint: fnv1a(stableStringify({
        id: recipe.id || null,
        name: recipe.name || null,
        stack: recipe.stack || [],
        lightRig: recipe.lightRig || {},
        viewRig: recipe.viewRig || {},
        shader: recipe.shader || {}
      })),
      interpreted,
      interpretedChannels,
      preservedOnly,
      preservedOnlyChannels: [...new Set(preservedOnly.map((row) => row.targetChannel))].sort(),
      missingEntries,
      heldLayers,
      warnings: [
        ...(normalLayers > 1 ? ['Multiple normal-map layers are RGBA-composited before tangent-space decode; this is not reoriented-normal-map blending.'] : []),
        ...(interpreted['base-color'].some((row) => row.interpretationMode === 'base-color-overlay') ? ['Decal/microdetail channels are explicitly mapped into the base-color composition for this renderer.'] : [])
      ],
      planHash: fnv1a(stableStringify(receiptBasis))
    };
  }

  function renderReceipt(plan, runtime) {
    if (!plan || typeof plan !== 'object') throw new TypeError('Render receipt requires a compiled plan.');
    const observed = runtime || {};
    return {
      format: RECEIPT_FORMAT,
      version: VERSION,
      planHash: plan.planHash,
      recipeId: plan.recipeId,
      recipeFingerprint: plan.recipeFingerprint,
      geometry: plan.renderer.geometry,
      interpretedChannels: clone(plan.interpretedChannels),
      preservedOnlyChannels: clone(plan.preservedOnlyChannels),
      missingEntries: clone(plan.missingEntries),
      heldLayers: clone(plan.heldLayers),
      warnings: clone(plan.warnings),
      framebuffer: {
        width: Number(observed.width) || 0,
        height: Number(observed.height) || 0,
        pixelHash: observed.pixelHash || null
      },
      runtime: {
        webglContext: observed.webglContext || null,
        shaderLinked: Boolean(observed.shaderLinked),
        drawCompleted: Boolean(observed.drawCompleted)
      },
      truthBoundary: {
        renderer: 'A local deterministic WebGL material preview interprets explicit texture channels and declared rig state.',
        pbr: 'The shader uses a bounded metallic/roughness lighting approximation; it is not engine parity, BRDF certification, HDRI truth, or physical-material validation.',
        normals: 'Normal maps are tangent-space decoded. Multiple normal layers use ordinary RGBA composition before decode rather than specialized normal-map blending.',
        shadows: 'The light-rig shadow control affects contrast only; no shadow map or geometric occlusion shadow is rendered.',
        preserved: 'Height, displacement, color-mask, unassigned, missing, and payload-less state remains visible in the receipt instead of being silently discarded.'
      }
    };
  }

  function lightDirection(lightRig) {
    const angle = clamp(lightRig && lightRig.angle, -3600, 3600, 315) * Math.PI / 180;
    const elevation = 45 * Math.PI / 180;
    const x = Math.cos(angle) * Math.cos(elevation);
    const y = -Math.sin(elevation);
    const z = Math.sin(angle) * Math.cos(elevation);
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
  }

  function viewState(viewRig, geometry) {
    const mode = viewRig && viewRig.mode || 'flat';
    const shape = GEOMETRIES.includes(geometry) ? geometry : 'sphere';
    const distance = shape === 'plane' ? 2.15 : 3.15;
    if (mode === 'micro-close') return { eye: [0, 0, distance * 0.72], target: [0, 0, 0], uvScale: 1, fov: 38 };
    if (mode === 'tile-2x2') return { eye: [0, 0, distance], target: [0, 0, 0], uvScale: 2, fov: 45 };
    if (mode === 'grazing-proxy') return { eye: [2.35, 0.28, distance * 0.58], target: [0, 0, 0], uvScale: 1, fov: 45 };
    return { eye: [0, 0, distance], target: [0, 0, 0], uvScale: 1, fov: 45 };
  }

  function pushVertex(target, position, normal, tangent, uv) {
    target.positions.push(...position);
    target.normals.push(...normal);
    target.tangents.push(...tangent);
    target.uvs.push(...uv);
  }

  function sphereGeometry(latSegments, lonSegments) {
    const lat = Math.max(4, Math.min(128, Math.round(latSegments || 32)));
    const lon = Math.max(6, Math.min(256, Math.round(lonSegments || 48)));
    const result = { positions: [], normals: [], tangents: [], uvs: [], indices: [] };
    for (let y = 0; y <= lat; y += 1) {
      const v = y / lat;
      const theta = v * Math.PI;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let x = 0; x <= lon; x += 1) {
        const u = x / lon;
        const phi = u * Math.PI * 2;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const normal = [sinTheta * cosPhi, cosTheta, sinTheta * sinPhi];
        const tangent = [-sinPhi, 0, cosPhi];
        pushVertex(result, normal, normal, tangent, [u, 1 - v]);
      }
    }
    for (let y = 0; y < lat; y += 1) {
      for (let x = 0; x < lon; x += 1) {
        const a = y * (lon + 1) + x;
        const b = a + lon + 1;
        result.indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return result;
  }

  function planeGeometry() {
    return {
      positions: [-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],
      normals: [0,0,1, 0,0,1, 0,0,1, 0,0,1],
      tangents: [1,0,0, 1,0,0, 1,0,0, 1,0,0],
      uvs: [0,0, 1,0, 1,1, 0,1],
      indices: [0,1,2, 0,2,3]
    };
  }

  function cubeGeometry() {
    const result = { positions: [], normals: [], tangents: [], uvs: [], indices: [] };
    const faces = [
      { n:[0,0,1], t:[1,0,0], p:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]] },
      { n:[0,0,-1], t:[-1,0,0], p:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]] },
      { n:[1,0,0], t:[0,0,-1], p:[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]] },
      { n:[-1,0,0], t:[0,0,1], p:[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]] },
      { n:[0,1,0], t:[1,0,0], p:[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]] },
      { n:[0,-1,0], t:[1,0,0], p:[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]] }
    ];
    faces.forEach((face, faceIndex) => {
      const base = faceIndex * 4;
      const uv = [[0,0],[1,0],[1,1],[0,1]];
      face.p.forEach((position, index) => pushVertex(result, position, face.n, face.t, uv[index]));
      result.indices.push(base,base+1,base+2, base,base+2,base+3);
    });
    return result;
  }

  function geometryFor(name) {
    if (name === 'plane') return planeGeometry();
    if (name === 'cube') return cubeGeometry();
    return sphereGeometry();
  }

  return {
    VERSION,
    RECEIPT_FORMAT,
    GEOMETRIES: GEOMETRIES.slice(),
    DIRECT_CHANNELS: DIRECT_CHANNELS.slice(),
    BASE_COLOR_OVERLAYS: BASE_COLOR_OVERLAYS.slice(),
    PRESERVED_ONLY_CHANNELS: PRESERVED_ONLY_CHANNELS.slice(),
    clone,
    clamp,
    stableStringify,
    fnv1a,
    normalizeRendererOptions,
    classifyChannel,
    compileRenderPlan,
    renderReceipt,
    lightDirection,
    viewState,
    sphereGeometry,
    planeGeometry,
    cubeGeometry,
    geometryFor
  };
});
