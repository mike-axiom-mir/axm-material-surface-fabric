(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMMaterialVocabularyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.7.0';
  const FORMAT = 'axm-material-vocabulary';
  const BASE_CHANNELS = ['base-color', 'normal', 'roughness', 'metallic', 'ambient-occlusion', 'height'];

  function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
  function lerp(a, b, t) { return a + (b - a) * clamp01(t); }
  function smoothstep(a, b, value) {
    const t = clamp01((value - a) / Math.max(1e-9, b - a));
    return t * t * (3 - 2 * t);
  }
  function fract(value) { return value - Math.floor(value); }
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
  function hash2(seed, x, y) {
    let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  function noise2(seed, x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = hash2(seed, x0, y0);
    const b = hash2(seed, x0 + 1, y0);
    const c = hash2(seed, x0, y0 + 1);
    const d = hash2(seed, x0 + 1, y0 + 1);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  }
  function fbm(seed, x, y, octaves) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let weight = 0;
    const count = Math.max(1, Math.min(8, Math.round(octaves || 4)));
    for (let i = 0; i < count; i += 1) {
      value += noise2(seed + i * 1013, x * frequency, y * frequency) * amplitude;
      weight += amplitude;
      amplitude *= 0.5;
      frequency *= 2.03;
    }
    return weight ? value / weight : 0;
  }
  function hexToRgb(hex) {
    const value = String(hex || '#000000').replace('#', '');
    const parsed = /^[0-9a-f]{6}$/i.test(value) ? parseInt(value, 16) : 0;
    return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
  }
  function mixRgb(a, b, t) {
    const f = clamp01(t);
    return [
      Math.round(lerp(a[0], b[0], f)),
      Math.round(lerp(a[1], b[1], f)),
      Math.round(lerp(a[2], b[2], f))
    ];
  }

  function material(id, name, category, pattern, palette, options) {
    const source = options || {};
    return {
      id,
      name,
      category,
      pattern,
      palette: palette.slice(),
      seed: Number.isFinite(source.seed) ? source.seed : parseInt(fnv1a(id), 16) | 0,
      scale: Number(source.scale) || 8,
      roughness: Array.isArray(source.roughness) ? source.roughness.slice(0, 2) : [0.35, 0.75],
      metallic: Number.isFinite(source.metallic) ? source.metallic : 0,
      metallicSpread: Number.isFinite(source.metallicSpread) ? source.metallicSpread : 0.05,
      aoStrength: Number.isFinite(source.aoStrength) ? source.aoStrength : 0.35,
      normalStrength: Number.isFinite(source.normalStrength) ? source.normalStrength : 1,
      heightContrast: Number.isFinite(source.heightContrast) ? source.heightContrast : 0.65,
      opacity: Array.isArray(source.opacity) ? source.opacity.slice(0, 2) : null,
      emissive: source.emissive ? Object.assign({}, source.emissive) : null,
      accentThreshold: Number.isFinite(source.accentThreshold) ? source.accentThreshold : 0.82,
      note: String(source.note || '')
    };
  }

  const FAMILIES = [
    material('brushed-steel', 'Brushed steel', 'metal', 'brushed', ['#555e65', '#aeb6bc', '#e5eaed'], { scale: 13, roughness: [0.22,0.48], metallic: 0.94, normalStrength: 0.45, heightContrast: 0.28, aoStrength: 0.16 }),
    material('painted-steel', 'Painted industrial steel', 'metal', 'painted', ['#203748', '#376982', '#8fb1bf'], { scale: 9, roughness: [0.32,0.62], metallic: 0.18, metallicSpread: 0.08, normalStrength: 0.75, heightContrast: 0.55, aoStrength: 0.28 }),
    material('rusted-steel', 'Rusted steel', 'metal', 'rust', ['#3d2820', '#8a4b27', '#d58a43'], { scale: 7, roughness: [0.58,0.94], metallic: 0.38, metallicSpread: 0.32, normalStrength: 1.35, heightContrast: 0.9, aoStrength: 0.58 }),
    material('galvanized-steel', 'Galvanized steel', 'metal', 'galvanized', ['#758087', '#aab3b8', '#d6dde0'], { scale: 14, roughness: [0.28,0.58], metallic: 0.88, normalStrength: 0.7, heightContrast: 0.48, aoStrength: 0.2 }),
    material('anodized-aluminum', 'Anodized aluminum', 'metal', 'brushed', ['#141a25', '#293a62', '#7588b1'], { scale: 18, roughness: [0.18,0.4], metallic: 0.9, normalStrength: 0.32, heightContrast: 0.22, aoStrength: 0.12 }),
    material('copper-patina', 'Copper patina', 'metal', 'patina', ['#305b55', '#4f9181', '#a56d48'], { scale: 6, roughness: [0.42,0.78], metallic: 0.6, metallicSpread: 0.28, normalStrength: 0.95, heightContrast: 0.72, aoStrength: 0.4 }),
    material('cast-iron', 'Cast iron', 'metal', 'hammered', ['#17191b', '#323638', '#606466'], { scale: 18, roughness: [0.52,0.86], metallic: 0.78, normalStrength: 1.15, heightContrast: 0.7, aoStrength: 0.45 }),
    material('chrome-scratched', 'Scratched chrome', 'metal', 'scratched', ['#71777b', '#c7cccf', '#ffffff'], { scale: 20, roughness: [0.08,0.34], metallic: 0.98, normalStrength: 0.7, heightContrast: 0.36, aoStrength: 0.14 }),

    material('hard-plastic', 'Hard molded plastic', 'polymer-composite', 'plastic', ['#182533', '#315b72', '#8bb0c0'], { scale: 8, roughness: [0.26,0.54], metallic: 0.02, normalStrength: 0.35, heightContrast: 0.25, aoStrength: 0.12 }),
    material('matte-plastic', 'Matte plastic', 'polymer-composite', 'plastic', ['#1a1b1d', '#3f4246', '#777c80'], { scale: 12, roughness: [0.58,0.86], metallic: 0, normalStrength: 0.3, heightContrast: 0.22, aoStrength: 0.16 }),
    material('soft-rubber', 'Soft rubber', 'polymer-composite', 'rubber', ['#0a0b0c', '#242729', '#464b4d'], { scale: 22, roughness: [0.68,0.95], metallic: 0, normalStrength: 0.8, heightContrast: 0.5, aoStrength: 0.34 }),
    material('tire-rubber', 'Tire rubber', 'polymer-composite', 'grooves', ['#060708', '#1b1d1e', '#343638'], { scale: 11, roughness: [0.72,0.97], metallic: 0, normalStrength: 1.3, heightContrast: 0.9, aoStrength: 0.6 }),
    material('carbon-fiber', 'Carbon fiber weave', 'polymer-composite', 'carbon', ['#07090a', '#22282b', '#4d5558'], { scale: 26, roughness: [0.2,0.46], metallic: 0.12, normalStrength: 0.85, heightContrast: 0.58, aoStrength: 0.25 }),
    material('closed-cell-foam', 'Closed-cell foam', 'polymer-composite', 'foam', ['#1c2125', '#4b555c', '#7d898f'], { scale: 24, roughness: [0.72,0.96], metallic: 0, normalStrength: 1.2, heightContrast: 0.82, aoStrength: 0.55 }),

    material('clear-glass', 'Clear glass', 'glass-ceramic', 'glass', ['#b9e4ea', '#dff7fa', '#ffffff'], { scale: 8, roughness: [0.04,0.16], metallic: 0, normalStrength: 0.12, heightContrast: 0.08, aoStrength: 0.04, opacity: [0.12,0.34] }),
    material('frosted-glass', 'Frosted glass', 'glass-ceramic', 'frost', ['#9fbcc0', '#d9e8e9', '#ffffff'], { scale: 30, roughness: [0.55,0.88], metallic: 0, normalStrength: 0.65, heightContrast: 0.42, aoStrength: 0.12, opacity: [0.48,0.78] }),
    material('dirty-glass', 'Dirty glass', 'glass-ceramic', 'dirty-glass', ['#657b77', '#a7b8ac', '#dfe9df'], { scale: 9, roughness: [0.28,0.72], metallic: 0, normalStrength: 0.55, heightContrast: 0.5, aoStrength: 0.2, opacity: [0.32,0.72] }),
    material('ceramic-glaze', 'Ceramic glaze', 'glass-ceramic', 'ceramic', ['#1e4161', '#4d88a7', '#c6e1e8'], { scale: 7, roughness: [0.12,0.34], metallic: 0, normalStrength: 0.35, heightContrast: 0.28, aoStrength: 0.12 }),
    material('porcelain', 'Porcelain', 'glass-ceramic', 'ceramic', ['#d6d1c6', '#eee9df', '#fffdf7'], { scale: 12, roughness: [0.16,0.38], metallic: 0, normalStrength: 0.18, heightContrast: 0.16, aoStrength: 0.08 }),

    material('concrete', 'Cast concrete', 'construction-mineral', 'concrete', ['#555752', '#85877f', '#b7b8ad'], { scale: 8, roughness: [0.66,0.94], metallic: 0, normalStrength: 1.05, heightContrast: 0.82, aoStrength: 0.48 }),
    material('asphalt', 'Road asphalt', 'construction-mineral', 'asphalt', ['#151719', '#303336', '#55595c'], { scale: 28, roughness: [0.72,0.98], metallic: 0, normalStrength: 1.25, heightContrast: 0.9, aoStrength: 0.58 }),
    material('granite', 'Granite', 'construction-mineral', 'granite', ['#252729', '#777270', '#c6c0bb'], { scale: 18, roughness: [0.42,0.72], metallic: 0.02, normalStrength: 0.85, heightContrast: 0.65, aoStrength: 0.3 }),
    material('marble', 'Veined marble', 'construction-mineral', 'marble', ['#20262b', '#c5c7c5', '#f2f0ea'], { scale: 5, roughness: [0.14,0.36], metallic: 0, normalStrength: 0.46, heightContrast: 0.38, aoStrength: 0.12 }),
    material('brick', 'Weathered brick', 'construction-mineral', 'brick', ['#4a241c', '#9c4a31', '#d08761'], { scale: 8, roughness: [0.64,0.94], metallic: 0, normalStrength: 1.4, heightContrast: 0.95, aoStrength: 0.62 }),
    material('sandstone', 'Layered sandstone', 'construction-mineral', 'sandstone', ['#7e5e38', '#b78a56', '#d8b37e'], { scale: 7, roughness: [0.62,0.9], metallic: 0, normalStrength: 1.0, heightContrast: 0.78, aoStrength: 0.42 }),
    material('plaster', 'Rough plaster', 'construction-mineral', 'plaster', ['#8a857b', '#c2bbb0', '#e3ded4'], { scale: 14, roughness: [0.58,0.88], metallic: 0, normalStrength: 0.8, heightContrast: 0.58, aoStrength: 0.28 }),

    material('oak', 'Oak wood', 'organic-textile', 'wood', ['#4b2d17', '#97643a', '#c89c62'], { scale: 8, roughness: [0.42,0.7], metallic: 0, normalStrength: 0.7, heightContrast: 0.55, aoStrength: 0.28 }),
    material('painted-wood', 'Painted wood', 'organic-textile', 'painted-wood', ['#233341', '#45677a', '#b0c2c7'], { scale: 9, roughness: [0.34,0.66], metallic: 0, normalStrength: 0.65, heightContrast: 0.52, aoStrength: 0.24 }),
    material('leather', 'Leather-like surface', 'organic-textile', 'leather', ['#2a1711', '#70402c', '#aa7355'], { scale: 24, roughness: [0.42,0.74], metallic: 0, normalStrength: 0.9, heightContrast: 0.62, aoStrength: 0.36 }),
    material('canvas', 'Canvas fabric', 'organic-textile', 'weave', ['#5f5545', '#9d9073', '#c7b995'], { scale: 32, roughness: [0.7,0.96], metallic: 0, normalStrength: 1.0, heightContrast: 0.7, aoStrength: 0.42 }),
    material('denim', 'Denim-like fabric', 'organic-textile', 'denim', ['#14243c', '#2e5274', '#6d8ca3'], { scale: 34, roughness: [0.64,0.92], metallic: 0, normalStrength: 0.9, heightContrast: 0.64, aoStrength: 0.36 }),
    material('woven-fabric', 'Woven synthetic fabric', 'organic-textile', 'weave', ['#24252a', '#595d65', '#9aa0a8'], { scale: 28, roughness: [0.62,0.9], metallic: 0, normalStrength: 0.86, heightContrast: 0.62, aoStrength: 0.34 }),

    material('wet-surface', 'Wet coated surface', 'environment-fx', 'wet', ['#111a1f', '#2f5362', '#7ca4ae'], { scale: 8, roughness: [0.04,0.28], metallic: 0.06, normalStrength: 0.55, heightContrast: 0.4, aoStrength: 0.2 }),
    material('ice', 'Cracked ice', 'environment-fx', 'ice', ['#6fa5bd', '#b8dce8', '#eefbff'], { scale: 9, roughness: [0.12,0.48], metallic: 0, normalStrength: 1.0, heightContrast: 0.66, aoStrength: 0.25, opacity: [0.62,0.92] }),
    material('mud', 'Wet mud', 'environment-fx', 'mud', ['#2d2218', '#5f4930', '#96724a'], { scale: 10, roughness: [0.42,0.88], metallic: 0, normalStrength: 1.25, heightContrast: 0.92, aoStrength: 0.56 }),
    material('dust-coated', 'Dust-coated surface', 'environment-fx', 'dust', ['#665d4c', '#9c927e', '#c5baa3'], { scale: 18, roughness: [0.76,0.98], metallic: 0, normalStrength: 0.52, heightContrast: 0.4, aoStrength: 0.24 }),
    material('emissive-panel', 'Sci-fi emissive panel', 'environment-fx', 'panel', ['#091017', '#19323d', '#4f6d78'], { scale: 10, roughness: [0.22,0.5], metallic: 0.42, normalStrength: 0.72, heightContrast: 0.5, aoStrength: 0.2, emissive: { color: '#56dcff', strength: 1.8 } }),
    material('holographic-film', 'Holographic film', 'environment-fx', 'holographic', ['#262448', '#4f72a4', '#cc7be8'], { scale: 8, roughness: [0.08,0.26], metallic: 0.26, normalStrength: 0.35, heightContrast: 0.22, aoStrength: 0.08, opacity: [0.72,0.96], emissive: { color: '#72d9ff', strength: 0.8 } }),
    material('bio-organic', 'Bio-organic tissue-like surface', 'environment-fx', 'bio', ['#241119', '#673047', '#bd6f7d'], { scale: 9, roughness: [0.34,0.7], metallic: 0, normalStrength: 1.1, heightContrast: 0.82, aoStrength: 0.48 })
  ];

  const OVERLAYS = [
    { id:'fine-scratches', name:'Fine scratches', channel:'microdetail', pattern:'scratches', color:'#d8e1e5', scale:28, density:0.38, seed:101 },
    { id:'deep-scratches', name:'Deep scratches', channel:'decal', pattern:'scratches', color:'#1a1b1c', scale:12, density:0.25, seed:102 },
    { id:'paint-chips', name:'Paint chips', channel:'decal', pattern:'chips', color:'#d8dde0', scale:11, density:0.32, seed:103 },
    { id:'rust-speckles', name:'Rust speckles', channel:'decal', pattern:'speckle', color:'#a95528', scale:18, density:0.42, seed:104 },
    { id:'grime-clouds', name:'Grime clouds', channel:'decal', pattern:'grime', color:'#25271f', scale:7, density:0.55, seed:105 },
    { id:'oil-smears', name:'Oil smears', channel:'decal', pattern:'smear', color:'#151715', scale:8, density:0.42, seed:106 },
    { id:'water-streaks', name:'Water streaks', channel:'decal', pattern:'streaks', color:'#9bc7d1', scale:15, density:0.34, seed:107 },
    { id:'dust-pass', name:'Dust pass', channel:'decal', pattern:'dust', color:'#c4b99d', scale:22, density:0.5, seed:108 },
    { id:'fingerprints', name:'Fingerprint-like arcs', channel:'microdetail', pattern:'fingerprint', color:'#b7c0c1', scale:13, density:0.32, seed:109 },
    { id:'edge-wear-mask', name:'Edge wear mask', channel:'color-mask', pattern:'edge', color:'#ffffff', scale:4, density:0.6, seed:110 },
    { id:'weld-seam', name:'Weld seam', channel:'decal', pattern:'weld', color:'#535b5e', scale:10, density:0.5, seed:111 },
    { id:'scorch-marks', name:'Scorch marks', channel:'decal', pattern:'scorch', color:'#15100f', scale:6, density:0.42, seed:112 },
    { id:'frost-pass', name:'Frost pass', channel:'decal', pattern:'frost', color:'#d9f2f7', scale:18, density:0.48, seed:113 },
    { id:'moss-pass', name:'Moss pass', channel:'decal', pattern:'moss', color:'#526b36', scale:10, density:0.48, seed:114 },
    { id:'mud-splatter', name:'Mud splatter', channel:'decal', pattern:'splatter', color:'#59442d', scale:15, density:0.45, seed:115 },
    { id:'hazard-stripes', name:'Hazard stripes', channel:'decal', pattern:'stripes', color:'#e6bd28', scale:10, density:0.65, seed:116 },
    { id:'circuit-lines', name:'Circuit lines', channel:'emissive', pattern:'circuit', color:'#55e9ff', scale:14, density:0.5, seed:117 },
    { id:'droplets', name:'Water droplets', channel:'microdetail', pattern:'droplets', color:'#d8f4fa', scale:20, density:0.38, seed:118 }
  ];

  function familyChannels(family) {
    const channels = BASE_CHANNELS.slice();
    if (family.opacity) channels.push('opacity');
    if (family.emissive) channels.push('emissive');
    return channels;
  }

  function patternValue(family, u, v) {
    const x = u * family.scale;
    const y = v * family.scale;
    const n = fbm(family.seed, x, y, 4);
    const n2 = fbm(family.seed + 771, x * 1.9, y * 1.9, 3);
    switch (family.pattern) {
      case 'brushed': return clamp01(0.45 * n + 0.55 * (0.5 + 0.5 * Math.sin((u * family.scale * 30 + n2 * 2) * Math.PI)));
      case 'painted': return clamp01(n * 0.78 + (hash2(family.seed + 5, Math.floor(x * 5), Math.floor(y * 5)) > 0.93 ? 0.18 : 0));
      case 'rust': return clamp01(Math.pow(n * 0.72 + n2 * 0.28, 1.7) * 1.35);
      case 'galvanized': return clamp01(0.45 + 0.32 * Math.sin(x * 2.1 + n * 4) * Math.sin(y * 1.8 - n2 * 3) + 0.23 * n);
      case 'patina': return clamp01(0.55 * n + 0.45 * smoothstep(0.56, 0.84, n2));
      case 'hammered': return clamp01(0.35 + Math.abs(n - n2) * 1.25);
      case 'scratched': {
        const scratches = smoothstep(0.88, 0.98, 0.5 + 0.5 * Math.sin((u * 160 + n * 11) * Math.PI));
        return clamp01(n * 0.52 + scratches * 0.48);
      }
      case 'plastic': return clamp01(0.42 + (n - 0.5) * 0.32 + (n2 - 0.5) * 0.12);
      case 'rubber': return clamp01(0.35 + n * 0.38 + smoothstep(0.78, 0.95, n2) * 0.28);
      case 'grooves': return clamp01(0.5 + 0.33 * Math.sin((u * family.scale * 3 + 0.4 * Math.sin(v * 9)) * Math.PI) + 0.17 * (n - 0.5));
      case 'carbon': {
        const a = 0.5 + 0.5 * Math.sin((u + v) * family.scale * Math.PI);
        const b = 0.5 + 0.5 * Math.sin((u - v) * family.scale * Math.PI);
        return clamp01(0.25 + 0.38 * a + 0.28 * b + 0.09 * (n - 0.5));
      }
      case 'foam': return clamp01(0.34 + 0.48 * n + 0.22 * smoothstep(0.77, 0.95, n2));
      case 'glass': return clamp01(0.48 + (n - 0.5) * 0.08);
      case 'frost': return clamp01(0.38 + n * 0.42 + n2 * 0.2);
      case 'dirty-glass': return clamp01(0.3 + 0.32 * n + 0.38 * smoothstep(0.6, 0.88, n2));
      case 'ceramic': return clamp01(0.48 + (n - 0.5) * 0.22 + 0.08 * Math.sin((x + y) * Math.PI));
      case 'concrete': return clamp01(0.23 + n * 0.55 + smoothstep(0.78, 0.96, n2) * 0.28);
      case 'asphalt': return clamp01(0.18 + n * 0.5 + hash2(family.seed + 17, Math.floor(x * 3), Math.floor(y * 3)) * 0.32);
      case 'granite': return clamp01(0.2 + 0.42 * n + 0.24 * smoothstep(0.72, 0.9, n2) + 0.18 * smoothstep(0.92, 0.985, hash2(family.seed + 33, Math.floor(x * 6), Math.floor(y * 6))));
      case 'marble': return clamp01(0.5 + 0.45 * Math.sin((u * family.scale * 1.5 + n * 2.2 + v * 0.6) * Math.PI));
      case 'brick': {
        const rows = family.scale;
        const row = Math.floor(v * rows);
        const bx = fract(u * rows * 1.7 + (row % 2) * 0.5);
        const by = fract(v * rows);
        const mortar = Math.min(bx, 1 - bx, by, 1 - by);
        return clamp01(smoothstep(0.035, 0.09, mortar) * (0.62 + n * 0.38));
      }
      case 'sandstone': return clamp01(0.42 + 0.24 * Math.sin((v * family.scale * 2 + n * 0.8) * Math.PI) + 0.34 * n2);
      case 'plaster': return clamp01(0.32 + n * 0.5 + (n2 - 0.5) * 0.2);
      case 'wood': {
        const warp = fbm(family.seed + 44, x * 0.45, y * 0.45, 3);
        return clamp01(0.5 + 0.42 * Math.sin((u * family.scale * 2.2 + warp * 3.8) * Math.PI));
      }
      case 'painted-wood': {
        const grain = 0.5 + 0.5 * Math.sin((u * family.scale * 2.4 + n * 3) * Math.PI);
        return clamp01(0.34 + grain * 0.3 + n2 * 0.36);
      }
      case 'leather': return clamp01(0.3 + n * 0.38 + Math.abs(n - n2) * 0.48);
      case 'weave': {
        const wx = 0.5 + 0.5 * Math.sin(u * family.scale * Math.PI * 2);
        const wy = 0.5 + 0.5 * Math.sin(v * family.scale * Math.PI * 2);
        return clamp01(0.18 + 0.42 * wx + 0.42 * wy + (n - 0.5) * 0.08);
      }
      case 'denim': {
        const a = 0.5 + 0.5 * Math.sin((u + v * 0.75) * family.scale * Math.PI * 2);
        const b = 0.5 + 0.5 * Math.sin((v - u * 0.25) * family.scale * Math.PI * 2);
        return clamp01(0.2 + a * 0.5 + b * 0.23 + n * 0.07);
      }
      case 'wet': return clamp01(0.26 + n * 0.32 + smoothstep(0.62, 0.9, n2) * 0.48);
      case 'ice': {
        const crackA = 1 - smoothstep(0.02, 0.06, Math.abs(Math.sin((x + n * 4) * 1.8)));
        const crackB = 1 - smoothstep(0.015, 0.05, Math.abs(Math.sin((y - n2 * 5) * 2.3)));
        return clamp01(0.54 + n * 0.22 - Math.max(crackA, crackB) * 0.48);
      }
      case 'mud': return clamp01(0.18 + n * 0.48 + smoothstep(0.58, 0.86, n2) * 0.42);
      case 'dust': return clamp01(0.34 + n * 0.3 + n2 * 0.22);
      case 'panel': {
        const gx = Math.min(fract(u * family.scale), 1 - fract(u * family.scale));
        const gy = Math.min(fract(v * family.scale), 1 - fract(v * family.scale));
        const grid = smoothstep(0.02, 0.11, Math.min(gx, gy));
        return clamp01(0.2 + grid * 0.52 + n * 0.28);
      }
      case 'holographic': return clamp01(0.5 + 0.34 * Math.sin((u * 2.5 + v * 1.2) * family.scale * Math.PI + n * 2.2) + (n2 - 0.5) * 0.22);
      case 'bio': return clamp01(0.36 + n * 0.34 + 0.3 * (0.5 + 0.5 * Math.sin((u * 1.4 + v + n2 * 1.8) * family.scale * Math.PI)));
      default: return n;
    }
  }

  function familySample(family, u, v) {
    const feature = patternValue(family, u, v);
    const detail = fbm(family.seed + 909, u * family.scale * 2.4, v * family.scale * 2.4, 3);
    const height = clamp01(0.5 + (feature - 0.5) * family.heightContrast);
    const roughness = clamp01(lerp(family.roughness[0], family.roughness[1], clamp01(feature * 0.62 + detail * 0.38)));
    const metallic = clamp01(family.metallic + (detail - 0.5) * family.metallicSpread);
    const ao = clamp01(1 - family.aoStrength * (1 - height) * 0.72 - family.aoStrength * Math.abs(feature - detail) * 0.28);
    const c0 = hexToRgb(family.palette[0]);
    const c1 = hexToRgb(family.palette[1] || family.palette[0]);
    const c2 = hexToRgb(family.palette[2] || family.palette[1] || family.palette[0]);
    let baseColor = mixRgb(c0, c1, clamp01(feature * 0.72 + detail * 0.28));
    if (detail > family.accentThreshold) baseColor = mixRgb(baseColor, c2, smoothstep(family.accentThreshold, 1, detail));
    const opacity = family.opacity ? clamp01(lerp(family.opacity[0], family.opacity[1], clamp01(0.4 * feature + 0.6 * detail))) : 1;
    let emissive = [0,0,0];
    if (family.emissive) {
      const ec = hexToRgb(family.emissive.color);
      const mask = family.pattern === 'panel'
        ? smoothstep(0.66, 0.86, feature)
        : family.pattern === 'holographic'
          ? clamp01(0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin((u + v) * family.scale * Math.PI), 2))
          : smoothstep(0.72, 0.9, detail);
      emissive = ec.map((value) => Math.round(value * clamp01(mask * family.emissive.strength)));
    }
    return { feature, detail, height, roughness, metallic, ao, baseColor, opacity, emissive };
  }

  function sampleHeight(family, u, v) {
    const uu = fract(u + 1000);
    const vv = fract(v + 1000);
    return familySample(family, uu, vv).height;
  }

  function sampleNormal(family, u, v, step) {
    const delta = Math.max(1e-5, Number(step) || 1 / 128);
    const left = sampleHeight(family, u - delta, v);
    const right = sampleHeight(family, u + delta, v);
    const down = sampleHeight(family, u, v - delta);
    const up = sampleHeight(family, u, v + delta);
    let nx = -(right - left) * family.normalStrength * 4;
    let ny = -(up - down) * family.normalStrength * 4;
    let nz = 1;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length; ny /= length; nz /= length;
    return [Math.round((nx * 0.5 + 0.5) * 255), Math.round((ny * 0.5 + 0.5) * 255), Math.round((nz * 0.5 + 0.5) * 255), 255];
  }

  function sampleFamilyChannel(family, channel, u, v, step) {
    if (!family) throw new TypeError('Family is required.');
    if (channel === 'normal') return sampleNormal(family, u, v, step);
    const sample = familySample(family, fract(u + 1000), fract(v + 1000));
    if (channel === 'base-color') return [sample.baseColor[0], sample.baseColor[1], sample.baseColor[2], 255];
    if (channel === 'roughness') { const x = Math.round(sample.roughness * 255); return [x,x,x,255]; }
    if (channel === 'metallic') { const x = Math.round(sample.metallic * 255); return [x,x,x,255]; }
    if (channel === 'ambient-occlusion') { const x = Math.round(sample.ao * 255); return [x,x,x,255]; }
    if (channel === 'height') { const x = Math.round(sample.height * 255); return [x,x,x,255]; }
    if (channel === 'opacity') { const x = Math.round(sample.opacity * 255); return [x,x,x,255]; }
    if (channel === 'emissive') return [sample.emissive[0], sample.emissive[1], sample.emissive[2], 255];
    return [0,0,0,255];
  }

  function overlayMask(overlay, u, v) {
    const x = u * overlay.scale;
    const y = v * overlay.scale;
    const n = fbm(overlay.seed, x, y, 4);
    const n2 = fbm(overlay.seed + 401, x * 2.1, y * 2.1, 3);
    let mask = 0;
    switch (overlay.pattern) {
      case 'scratches': mask = smoothstep(0.93 - overlay.density * 0.12, 0.99, 0.5 + 0.5 * Math.sin((u * overlay.scale * 19 + n * 5) * Math.PI)); break;
      case 'chips': mask = smoothstep(0.76 - overlay.density * 0.18, 0.92, n * 0.64 + n2 * 0.36); break;
      case 'speckle': mask = smoothstep(0.72 - overlay.density * 0.22, 0.94, hash2(overlay.seed, Math.floor(x * 5), Math.floor(y * 5)) * 0.7 + n * 0.3); break;
      case 'grime': mask = smoothstep(0.44 - overlay.density * 0.18, 0.8, n * 0.7 + n2 * 0.3); break;
      case 'smear': mask = smoothstep(0.55, 0.86, 0.65 * n + 0.35 * (0.5 + 0.5 * Math.sin((u * 2 + v * 0.4 + n2) * overlay.scale * Math.PI))); break;
      case 'streaks': mask = smoothstep(0.76 - overlay.density * 0.18, 0.96, 0.5 + 0.5 * Math.sin((u * overlay.scale * 1.7 + n * 1.2) * Math.PI)); break;
      case 'dust': mask = clamp01(0.18 + n * overlay.density * 0.9); break;
      case 'fingerprint': {
        const dx = u - 0.5; const dy = v - 0.5;
        const radius = Math.hypot(dx * 1.2, dy);
        mask = smoothstep(0.72, 0.94, 0.5 + 0.5 * Math.sin((radius * overlay.scale * 9 + n * 0.8) * Math.PI));
        mask *= smoothstep(0.5, 0.18, radius);
        break;
      }
      case 'edge': {
        const edge = Math.min(u, 1-u, v, 1-v);
        mask = 1 - smoothstep(0.015, 0.14 + overlay.density * 0.08, edge);
        mask = clamp01(mask * (0.55 + n * 0.45));
        break;
      }
      case 'weld': {
        const line = Math.abs(v - 0.5 - 0.04 * Math.sin(u * overlay.scale * Math.PI));
        mask = (1 - smoothstep(0.01, 0.055, line)) * (0.55 + 0.45 * n);
        break;
      }
      case 'scorch': {
        const dx = u - 0.5; const dy = v - 0.5;
        const radius = Math.hypot(dx, dy);
        mask = (1 - smoothstep(0.08, 0.46, radius)) * (0.45 + 0.55 * n);
        break;
      }
      case 'frost': mask = smoothstep(0.56 - overlay.density * 0.16, 0.88, n * 0.62 + n2 * 0.38); break;
      case 'moss': mask = smoothstep(0.58 - overlay.density * 0.18, 0.86, n) * smoothstep(0.18, 0.72, v); break;
      case 'splatter': mask = smoothstep(0.76 - overlay.density * 0.16, 0.96, hash2(overlay.seed, Math.floor(x * 4), Math.floor(y * 4)) * 0.6 + n * 0.4); break;
      case 'stripes': mask = smoothstep(0.42, 0.56, fract((u + v) * overlay.scale * 0.5)); break;
      case 'circuit': {
        const gx = Math.min(fract(x), 1 - fract(x));
        const gy = Math.min(fract(y), 1 - fract(y));
        mask = 1 - smoothstep(0.035, 0.11, Math.min(gx, gy));
        mask *= 0.55 + 0.45 * smoothstep(0.45, 0.75, n);
        break;
      }
      case 'droplets': mask = smoothstep(0.82 - overlay.density * 0.18, 0.97, n2); break;
      default: mask = n;
    }
    return clamp01(mask);
  }

  function sampleOverlay(overlay, u, v) {
    const mask = overlayMask(overlay, fract(u + 1000), fract(v + 1000));
    const color = hexToRgb(overlay.color);
    if (overlay.channel === 'color-mask') {
      const value = Math.round(mask * 255);
      return [value,value,value,255];
    }
    return [color[0], color[1], color[2], Math.round(mask * 255)];
  }

  function familyById(id) { return FAMILIES.find((family) => family.id === id) || null; }
  function overlayById(id) { return OVERLAYS.find((overlay) => overlay.id === id) || null; }

  function familyEntryId(familyId, channel) { return `material-vocab-${familyId}-${channel}`; }
  function overlayEntryId(overlayId) { return `material-vocab-overlay-${overlayId}`; }

  function makeFamilyEntry(family, channel, dataUrl, resolution) {
    if (!familyChannels(family).includes(channel)) throw new TypeError(`Channel ${channel} is not declared for ${family.id}.`);
    return {
      libraryId: familyEntryId(family.id, channel),
      name: `${family.name} — ${channel}`,
      kind: channel,
      mime: 'image/png',
      width: resolution,
      height: resolution,
      bytes: null,
      dataUrl,
      source: {
        method: 'local-deterministic-material-vocabulary',
        synthetic: true,
        vocabularyFormat: FORMAT,
        vocabularyVersion: VERSION,
        familyId: family.id,
        familyDescriptorHash: fnv1a(stableStringify(family)),
        generator: 'AXMMaterialVocabularyCore',
        seed: family.seed,
        note: 'Self-generated seed vocabulary for reuse/testing. It is not a measured scan or physically certified PBR material.'
      },
      usage: {
        channelHint: channel,
        channelBasis: 'declared-v0.7-family-definition',
        note: 'Channel meaning is declared by the deterministic family recipe.'
      },
      tags: ['axm-vocabulary', `v${VERSION}`, family.category, family.id, channel]
    };
  }

  function makeFamilyRecord(family, entryIds, at) {
    return {
      id: `family-vocab-${family.id}`,
      name: family.name,
      purpose: `Deterministic reusable seed family for ${family.category}; generated channels share one declared procedural field.`,
      entryIds: entryIds.slice().sort(),
      tags: ['axm-vocabulary', `v${VERSION}`, family.category, family.id],
      createdAt: at || new Date().toISOString(),
      updatedAt: at || new Date().toISOString()
    };
  }

  function makeOverlayEntry(overlay, dataUrl, resolution) {
    return {
      libraryId: overlayEntryId(overlay.id),
      name: overlay.name,
      kind: overlay.channel,
      mime: 'image/png',
      width: resolution,
      height: resolution,
      bytes: null,
      dataUrl,
      source: {
        method: 'local-deterministic-material-vocabulary-overlay',
        synthetic: true,
        vocabularyFormat: FORMAT,
        vocabularyVersion: VERSION,
        overlayId: overlay.id,
        overlayDescriptorHash: fnv1a(stableStringify(overlay)),
        generator: 'AXMMaterialVocabularyCore',
        seed: overlay.seed,
        note: 'Self-generated reusable influence overlay; not a measured physical surface.'
      },
      usage: {
        channelHint: overlay.channel,
        channelBasis: 'declared-v0.7-overlay-definition',
        note: 'Overlay channel is explicitly declared by the vocabulary descriptor.'
      },
      tags: ['axm-vocabulary', `v${VERSION}`, 'overlay', overlay.pattern, overlay.channel]
    };
  }

  function coverageSummary() {
    const categories = {};
    let familyEntryCount = 0;
    FAMILIES.forEach((family) => {
      const count = familyChannels(family).length;
      familyEntryCount += count;
      if (!categories[family.category]) categories[family.category] = { families: 0, entries: 0 };
      categories[family.category].families += 1;
      categories[family.category].entries += count;
    });
    const channels = {};
    FAMILIES.forEach((family) => familyChannels(family).forEach((channel) => { channels[channel] = (channels[channel] || 0) + 1; }));
    OVERLAYS.forEach((overlay) => { channels[overlay.channel] = (channels[overlay.channel] || 0) + 1; });
    return {
      families: FAMILIES.length,
      familyEntries: familyEntryCount,
      overlays: OVERLAYS.length,
      totalEntries: familyEntryCount + OVERLAYS.length,
      categories,
      channels
    };
  }

  function manifest() {
    return {
      format: FORMAT,
      version: VERSION,
      families: FAMILIES.map((family) => ({
        id: family.id,
        name: family.name,
        category: family.category,
        pattern: family.pattern,
        channels: familyChannels(family),
        descriptorHash: fnv1a(stableStringify(family))
      })),
      overlays: OVERLAYS.map((overlay) => ({
        id: overlay.id,
        name: overlay.name,
        channel: overlay.channel,
        pattern: overlay.pattern,
        descriptorHash: fnv1a(stableStringify(overlay))
      })),
      coverage: coverageSummary(),
      truthBoundary: {
        generation: 'These are deterministic synthetic seed materials and overlays, not photographed/scanned material measurements.',
        channels: 'Maps are procedurally correlated from shared family state, but channel labels do not certify physically correct PBR response.',
        quality: 'Breadth and reproducibility are proven structurally; artistic quality must be judged with actual renderer evidence.',
        use: 'The vocabulary is additive. External visual systems and image generators may supply stronger sources without changing this contract.'
      }
    };
  }

  return {
    VERSION,
    FORMAT,
    BASE_CHANNELS: BASE_CHANNELS.slice(),
    FAMILIES: FAMILIES.map((family) => Object.assign({}, family, { palette: family.palette.slice() })),
    OVERLAYS: OVERLAYS.map((overlay) => Object.assign({}, overlay)),
    clamp01,
    lerp,
    smoothstep,
    stableStringify,
    fnv1a,
    hash2,
    noise2,
    fbm,
    hexToRgb,
    familyChannels,
    familyById,
    overlayById,
    patternValue,
    familySample,
    sampleHeight,
    sampleNormal,
    sampleFamilyChannel,
    overlayMask,
    sampleOverlay,
    familyEntryId,
    overlayEntryId,
    makeFamilyEntry,
    makeFamilyRecord,
    makeOverlayEntry,
    coverageSummary,
    manifest
  };
});
