(function () {
  'use strict';

  const rendererCore = window.AXMMaterialRendererCore;
  const influenceCore = window.AXMMaterialInfluenceCore;
  const deltaCore = window.AXMMaterialDeltaCore;
  if (!rendererCore || !influenceCore) throw new Error('Renderer bridge requires renderer-core.js and influence-core.js');

  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

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
  const CHANNEL_DEFAULTS = {
    'base-color': '#7f8387',
    normal: '#8080ff',
    roughness: '#999999',
    metallic: '#000000',
    'ambient-occlusion': '#ffffff',
    emissive: '#000000',
    opacity: '#ffffff'
  };
  const TEXTURE_UNITS = {
    'base-color': 0,
    normal: 1,
    roughness: 2,
    metallic: 3,
    'ambient-occlusion': 4,
    emissive: 5,
    opacity: 6
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso() { return new Date().toISOString(); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }

  let workspace = null;
  let recipe = null;
  let libraryEntries = [];
  let lastPlan = null;
  let lastReceipt = null;
  let snapshots = { A: null, B: null };
  let glState = null;
  const imageCache = new Map();
  let renderSerial = 0;

  const panel = document.createElement('section');
  panel.className = 'panel renderer-bridge-panel';
  panel.innerHTML = `
    <div class="panel-heading renderer-heading">
      <div><div class="panel-kicker">09</div><h2>Real Material Renderer</h2></div>
      <span class="count-pill">v0.6</span>
    </div>
    <div class="truth-note">
      Local WebGL material preview. It samples explicit base-color, normal, roughness, metallic, ambient-occlusion, emissive and opacity state. The lighting model is a bounded metallic/roughness approximation — not Unreal/Unity/Blender parity, PBR certification, HDRI truth or physical-material proof.
    </div>

    <div class="renderer-toolbar">
      <button class="button accent" id="rendererLoadSaved">Load saved v0.5 lab</button>
      <button class="button" id="rendererImport">Import lab JSON</button>
      <input id="rendererImportInput" type="file" accept="application/json,.json" hidden />
      <button class="button primary" id="rendererRender">Render material</button>
      <button class="button" id="rendererExportReceipt" disabled>Export render receipt</button>
    </div>

    <div class="renderer-layout">
      <section class="renderer-controls influence-subpanel">
        <div class="influence-subheading"><strong>Render state</strong><span id="rendererSourceStatus">no workspace</span></div>
        <label>Recipe<select id="rendererRecipe"></select></label>
        <label>Geometry<select id="rendererGeometry"><option value="sphere">Sphere</option><option value="plane">Plane</option><option value="cube">Cube</option></select></label>
        <label>Normal strength<input id="rendererNormalStrength" type="range" min="0" max="3" step="0.01" value="1" /></label>
        <label>Alpha cutoff<input id="rendererAlphaCutoff" type="range" min="0" max="1" step="0.01" value="0.02" /></label>
        <label>Background<input id="rendererBackground" type="color" value="#0a0d10" /></label>
        <div class="renderer-value-row"><span>normal</span><strong id="rendererNormalValue">1.00</strong><span>alpha</span><strong id="rendererAlphaValue">0.02</strong></div>
        <div id="rendererChannelStatus" class="renderer-channel-status"></div>
      </section>

      <section class="renderer-canvas-panel influence-subpanel">
        <div class="influence-subheading"><strong>WebGL framebuffer</strong><span id="rendererStatus">idle</span></div>
        <div class="renderer-canvas-wrap checker"><canvas id="rendererCanvas" width="640" height="640" aria-label="WebGL material renderer"></canvas></div>
        <div class="renderer-capture-actions">
          <button class="mini-button" id="rendererCaptureA">Capture A</button>
          <button class="mini-button" id="rendererCaptureB">Capture B</button>
          <button class="mini-button" id="rendererCompare">Compare A → B</button>
          <span id="rendererCaptureStatus">A — • B —</span>
        </div>
      </section>

      <section class="renderer-receipt-panel influence-subpanel">
        <div class="influence-subheading"><strong>Render receipt</strong><span>observed vs preserved</span></div>
        <pre id="rendererOutput" class="state-output renderer-output" tabindex="0"></pre>
      </section>
    </div>

    <section class="renderer-sweep influence-subpanel">
      <div class="influence-subheading"><strong>Cross-light sweep</strong><span>same recipe • different declared rigs</span></div>
      <div class="renderer-sweep-actions">
        <button class="button" id="rendererSweep">Render all light rigs</button>
        <span id="rendererSweepStatus">not run</span>
      </div>
      <div id="rendererSweepGallery" class="renderer-sweep-gallery"></div>
    </section>

    <section class="renderer-compare influence-subpanel">
      <div class="influence-subheading"><strong>WebGL A/B evidence</strong><span>framebuffer pixels + receipts</span></div>
      <div id="rendererComparePreview" class="influence-compare-preview"></div>
      <pre id="rendererCompareOutput" class="state-output renderer-output" tabindex="0"></pre>
    </section>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    loadSaved: panel.querySelector('#rendererLoadSaved'),
    importButton: panel.querySelector('#rendererImport'),
    importInput: panel.querySelector('#rendererImportInput'),
    render: panel.querySelector('#rendererRender'),
    exportReceipt: panel.querySelector('#rendererExportReceipt'),
    sourceStatus: panel.querySelector('#rendererSourceStatus'),
    recipe: panel.querySelector('#rendererRecipe'),
    geometry: panel.querySelector('#rendererGeometry'),
    normalStrength: panel.querySelector('#rendererNormalStrength'),
    alphaCutoff: panel.querySelector('#rendererAlphaCutoff'),
    background: panel.querySelector('#rendererBackground'),
    normalValue: panel.querySelector('#rendererNormalValue'),
    alphaValue: panel.querySelector('#rendererAlphaValue'),
    channelStatus: panel.querySelector('#rendererChannelStatus'),
    canvas: panel.querySelector('#rendererCanvas'),
    status: panel.querySelector('#rendererStatus'),
    output: panel.querySelector('#rendererOutput'),
    captureA: panel.querySelector('#rendererCaptureA'),
    captureB: panel.querySelector('#rendererCaptureB'),
    compare: panel.querySelector('#rendererCompare'),
    captureStatus: panel.querySelector('#rendererCaptureStatus'),
    comparePreview: panel.querySelector('#rendererComparePreview'),
    compareOutput: panel.querySelector('#rendererCompareOutput'),
    sweep: panel.querySelector('#rendererSweep'),
    sweepStatus: panel.querySelector('#rendererSweepStatus'),
    sweepGallery: panel.querySelector('#rendererSweepGallery')
  };

  function rendererOptions() {
    return rendererCore.normalizeRendererOptions({
      geometry: el.geometry.value,
      normalStrength: Number(el.normalStrength.value),
      alphaCutoff: Number(el.alphaCutoff.value),
      background: el.background.value,
      textureSize: 512
    });
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

  async function readSavedWorkspace() {
    const db = await openInfluenceDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readonly');
      const request = tx.objectStore('workspaces').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  }

  function acceptWorkspace(value, sourceLabel) {
    const validation = influenceCore.validateWorkspace(value);
    if (!validation.ok) throw new Error(validation.reason);
    workspace = clone(value);
    libraryEntries = clone(workspace.librarySnapshot && workspace.librarySnapshot.entries || []);
    if (!workspace.recipes.length) throw new Error('Influence workspace contains no recipes.');
    recipe = clone(workspace.recipes.find((item) => item.id === workspace.activeRecipeId) || workspace.recipes[0]);
    snapshots = { A: null, B: null };
    renderRecipeOptions();
    el.sourceStatus.textContent = `${sourceLabel} • ${workspace.recipes.length} recipe${workspace.recipes.length === 1 ? '' : 's'} • ${libraryEntries.length} entries`;
    el.output.textContent = JSON.stringify({
      loaded: true,
      source: sourceLabel,
      workspaceId: workspace.id,
      workspaceVersion: workspace.version,
      activeRecipeId: recipe.id,
      libraryEntries: libraryEntries.length,
      note: 'Renderer reads a copied workspace. It does not rewrite the v0.5 lab or material library.'
    }, null, 2);
  }

  function renderRecipeOptions() {
    if (!workspace) {
      el.recipe.innerHTML = '<option value="">No workspace</option>';
      return;
    }
    el.recipe.innerHTML = workspace.recipes.map((item) => `<option value="${escapeHtml(item.id)}" ${recipe && item.id === recipe.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
  }

  function loadImage(entry) {
    if (!entry || typeof entry.dataUrl !== 'string') return Promise.resolve(null);
    const key = `${entry.id}|${entry.dataUrl.length}|${entry.dataUrl.slice(-24)}`;
    if (imageCache.has(key)) return imageCache.get(key);
    const promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = entry.dataUrl;
    });
    imageCache.set(key, promise);
    return promise;
  }

  function channelCanvas(size, fill) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }

  function drawTiled(ctx, image, row, size) {
    const repeatX = Math.max(1, Math.min(32, Math.round(Number(row.tiling && row.tiling.repeatX) || 1)));
    const repeatY = Math.max(1, Math.min(32, Math.round(Number(row.tiling && row.tiling.repeatY) || 1)));
    const cellW = size / repeatX;
    const cellH = size / repeatY;
    const transform = row.transform || {};
    ctx.save();
    ctx.translate(size / 2 + (Number(transform.offsetX) || 0) * size / 512, size / 2 + (Number(transform.offsetY) || 0) * size / 512);
    ctx.rotate((Number(transform.rotation) || 0) * Math.PI / 180);
    const scale = Number(transform.scale) || 1;
    ctx.scale(scale, scale);
    for (let y = 0; y < repeatY; y += 1) {
      for (let x = 0; x < repeatX; x += 1) {
        ctx.drawImage(image, -size / 2 + x * cellW, -size / 2 + y * cellH, cellW, cellH);
      }
    }
    ctx.restore();
  }

  async function layerCanvas(row, size, entryMap) {
    const entry = entryMap.get(row.entryId);
    const image = await loadImage(entry);
    if (!image) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: true });
    drawTiled(ctx, image, row, size);
    if (row.maskEntryId) {
      const maskEntry = entryMap.get(row.maskEntryId);
      const maskImage = await loadImage(maskEntry);
      if (maskImage) {
        const mask = document.createElement('canvas');
        mask.width = size;
        mask.height = size;
        const maskCtx = mask.getContext('2d', { alpha: true });
        drawTiled(maskCtx, maskImage, row, size);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mask, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    return canvas;
  }

  async function composeChannel(channel, plan, size) {
    const canvas = channelCanvas(size, CHANNEL_DEFAULTS[channel]);
    const ctx = canvas.getContext('2d', { alpha: true });
    const entryMap = new Map(libraryEntries.map((entry) => [String(entry.id), entry]));
    for (const row of plan.interpreted[channel] || []) {
      const layer = await layerCanvas(row, size, entryMap);
      if (!layer) continue;
      ctx.save();
      ctx.globalCompositeOperation = BLEND_TO_CANVAS[row.blendMode] || 'source-over';
      ctx.globalAlpha = row.opacity;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
    return canvas;
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`WebGL shader compile failed: ${log}`);
    }
    return shader;
  }

  function createProgram(gl) {
    const vertex = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec3 aTangent;
      attribute vec2 aUv;
      uniform mat4 uModel;
      uniform mat4 uView;
      uniform mat4 uProjection;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vTangent;
      varying vec2 vUv;
      void main() {
        vec4 world = uModel * vec4(aPosition, 1.0);
        vWorldPos = world.xyz;
        vNormal = normalize(mat3(uModel) * aNormal);
        vTangent = normalize(mat3(uModel) * aTangent);
        vUv = aUv;
        gl_Position = uProjection * uView * world;
      }
    `;
    const fragment = `
      precision highp float;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vTangent;
      varying vec2 vUv;
      uniform sampler2D uBaseColor;
      uniform sampler2D uNormalMap;
      uniform sampler2D uRoughness;
      uniform sampler2D uMetallic;
      uniform sampler2D uAO;
      uniform sampler2D uEmissive;
      uniform sampler2D uOpacity;
      uniform vec3 uCameraPos;
      uniform vec3 uLightDirection;
      uniform vec3 uLightColor;
      uniform float uLightIntensity;
      uniform float uAmbient;
      uniform float uEnvironment;
      uniform float uShadowContrast;
      uniform float uExposure;
      uniform float uSaturation;
      uniform float uNormalStrength;
      uniform float uAlphaCutoff;
      uniform float uUvScale;
      uniform float uClearcoatEnabled;
      uniform float uClearcoatStrength;
      uniform float uFresnelEnabled;
      uniform float uFresnelStrength;
      uniform float uEmissiveEnabled;
      uniform float uEmissiveStrength;
      uniform float uRoughnessOverrideEnabled;
      uniform float uRoughnessOverride;
      const float PI = 3.14159265359;
      float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      vec3 fresnelSchlick(float cosTheta, vec3 F0) {
        return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
      }
      float distributionGGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float ndh = max(dot(N, H), 0.0);
        float denom = ndh * ndh * (a2 - 1.0) + 1.0;
        return a2 / max(PI * denom * denom, 0.0001);
      }
      float geometrySchlickGGX(float ndv, float roughness) {
        float r = roughness + 1.0;
        float k = (r * r) / 8.0;
        return ndv / max(ndv * (1.0 - k) + k, 0.0001);
      }
      float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
        return geometrySchlickGGX(max(dot(N, V), 0.0), roughness) * geometrySchlickGGX(max(dot(N, L), 0.0), roughness);
      }
      void main() {
        vec2 uv = vUv * uUvScale;
        vec4 baseSample = texture2D(uBaseColor, uv);
        vec3 albedo = pow(max(baseSample.rgb, vec3(0.0)), vec3(2.2));
        vec3 normalSample = texture2D(uNormalMap, uv).xyz * 2.0 - 1.0;
        normalSample.xy *= uNormalStrength;
        normalSample = normalize(normalSample);
        vec3 N0 = normalize(vNormal);
        vec3 T = normalize(vTangent - N0 * dot(N0, vTangent));
        vec3 B = normalize(cross(N0, T));
        vec3 N = normalize(mat3(T, B, N0) * normalSample);
        vec3 V = normalize(uCameraPos - vWorldPos);
        vec3 L = normalize(uLightDirection);
        vec3 H = normalize(V + L);
        float roughness = clamp(luminance(texture2D(uRoughness, uv).rgb), 0.04, 1.0);
        roughness = mix(roughness, clamp(uRoughnessOverride, 0.04, 1.0), uRoughnessOverrideEnabled);
        float metallic = clamp(luminance(texture2D(uMetallic, uv).rgb), 0.0, 1.0);
        float ao = clamp(luminance(texture2D(uAO, uv).rgb), 0.0, 1.0);
        vec3 emissive = pow(max(texture2D(uEmissive, uv).rgb, vec3(0.0)), vec3(2.2));
        float opacity = baseSample.a * clamp(luminance(texture2D(uOpacity, uv).rgb), 0.0, 1.0);
        if (opacity < uAlphaCutoff) discard;

        float ndl = max(dot(N, L), 0.0);
        float ndv = max(dot(N, V), 0.001);
        float vdh = max(dot(V, H), 0.0);
        vec3 F0 = mix(vec3(0.04), albedo, metallic);
        vec3 F = fresnelSchlick(vdh, F0);
        float D = distributionGGX(N, H, roughness);
        float G = geometrySmith(N, V, L, roughness);
        vec3 specular = (D * G * F) / max(4.0 * ndv * max(ndl, 0.001), 0.001);
        vec3 kD = (vec3(1.0) - F) * (1.0 - metallic);
        vec3 radiance = uLightColor * uLightIntensity;
        float shadowContrast = 1.0 - uShadowContrast * (1.0 - ndl) * 0.35;
        vec3 direct = (kD * albedo / PI + specular) * radiance * ndl * shadowContrast;
        vec3 ambient = albedo * uAmbient * ao;
        vec3 environment = fresnelSchlick(ndv, F0) * uEnvironment * (1.0 - roughness * 0.72) * ao;

        float clearcoatPower = mix(180.0, 18.0, roughness);
        float clearcoatLobe = pow(max(dot(N, H), 0.0), clearcoatPower) * uClearcoatStrength * uClearcoatEnabled;
        vec3 clearcoat = vec3(clearcoatLobe) * radiance;
        float edge = pow(1.0 - ndv, 5.0) * uFresnelStrength * uFresnelEnabled;
        vec3 edgeLight = uLightColor * edge;
        vec3 emission = emissive * uEmissiveStrength * uEmissiveEnabled;

        vec3 color = direct + ambient + environment + clearcoat + edgeLight + emission;
        color *= uExposure;
        float lum = luminance(color);
        color = vec3(lum) + (color - vec3(lum)) * uSaturation;
        color = color / (color + vec3(1.0));
        color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
        gl_FragColor = vec4(color, opacity);
      }
    `;
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertex);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`WebGL program link failed: ${log}`);
    }
    return program;
  }

  function vec3Normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  }
  function vec3Cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function vec3Subtract(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function vec3Dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }

  function mat4Identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  function mat4Perspective(fovDegrees, aspect, near, far) {
    const f = 1 / Math.tan((fovDegrees * Math.PI / 180) / 2);
    const nf = 1 / (near - far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  }
  function mat4LookAt(eye, target, up) {
    const z = vec3Normalize(vec3Subtract(eye, target));
    const x = vec3Normalize(vec3Cross(up, z));
    const y = vec3Cross(z, x);
    return [
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -vec3Dot(x, eye), -vec3Dot(y, eye), -vec3Dot(z, eye), 1
    ];
  }
  function mat4RotationY(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
  }
  function mat4RotationX(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];
  }
  function mat4Multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        for (let k = 0; k < 4; k += 1) out[column*4+row] += a[k*4+row] * b[column*4+k];
      }
    }
    return out;
  }

  function hexRgb01(hex) {
    const value = parseInt(String(hex || '#ffffff').slice(1), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  }

  function initGl() {
    if (glState) return glState;
    const gl = el.canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL is unavailable in this browser/device.');
    const program = createProgram(gl);
    glState = { gl, program, buffers: {}, textures: new Map(), geometryName: null };
    return glState;
  }

  function uploadBuffer(gl, target, data, usage) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, usage || gl.STATIC_DRAW);
    return buffer;
  }

  function setGeometry(state, name) {
    if (state.geometryName === name) return;
    const gl = state.gl;
    Object.values(state.buffers).forEach((buffer) => { if (buffer) gl.deleteBuffer(buffer); });
    const geometry = rendererCore.geometryFor(name);
    state.buffers = {
      position: uploadBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.positions)),
      normal: uploadBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.normals)),
      tangent: uploadBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.tangents)),
      uv: uploadBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.uvs)),
      index: uploadBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices)),
      indexCount: geometry.indices.length
    };
    state.geometryName = name;
  }

  function uploadTexture(gl, canvas, unit) {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
  }

  function attribute(gl, program, name, buffer, size) {
    const location = gl.getAttribLocation(program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }
  function uniform1f(gl, program, name, value) { gl.uniform1f(gl.getUniformLocation(program, name), value); }
  function uniform1i(gl, program, name, value) { gl.uniform1i(gl.getUniformLocation(program, name), value); }
  function uniform3fv(gl, program, name, value) { gl.uniform3fv(gl.getUniformLocation(program, name), new Float32Array(value)); }
  function uniformMat4(gl, program, name, value) { gl.uniformMatrix4fv(gl.getUniformLocation(program, name), false, new Float32Array(value)); }

  function hashBytes(bytes) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i += 1) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }

  function framebufferRgba() {
    const state = initGl();
    const gl = state.gl;
    const width = el.canvas.width, height = el.canvas.height;
    const raw = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const flipped = new Uint8ClampedArray(raw.length);
    const stride = width * 4;
    for (let y = 0; y < height; y += 1) flipped.set(raw.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
    return flipped;
  }

  function dataUrlFromPixels(rgba) {
    const canvas = document.createElement('canvas');
    canvas.width = el.canvas.width;
    canvas.height = el.canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(rgba, canvas.width, canvas.height), 0, 0);
    return canvas.toDataURL('image/png');
  }

  async function renderRecipe(targetRecipe, optionsOverride) {
    if (!targetRecipe) throw new Error('Load an influence workspace first.');
    const serial = ++renderSerial;
    const options = rendererCore.normalizeRendererOptions(optionsOverride || rendererOptions());
    const plan = rendererCore.compileRenderPlan(targetRecipe, libraryEntries, options);
    const channels = {};
    for (const channel of rendererCore.DIRECT_CHANNELS) {
      channels[channel] = await composeChannel(channel, plan, options.textureSize);
      if (serial !== renderSerial) throw new Error('Render superseded by a newer render request.');
    }

    const state = initGl();
    const gl = state.gl;
    const program = state.program;
    setGeometry(state, options.geometry);
    state.textures.forEach((texture) => gl.deleteTexture(texture));
    state.textures.clear();
    Object.keys(TEXTURE_UNITS).forEach((channel) => {
      const texture = uploadTexture(gl, channels[channel], TEXTURE_UNITS[channel]);
      state.textures.set(channel, texture);
    });

    gl.viewport(0, 0, el.canvas.width, el.canvas.height);
    const background = hexRgb01(options.background);
    gl.clearColor(background[0], background[1], background[2], 1);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);

    attribute(gl, program, 'aPosition', state.buffers.position, 3);
    attribute(gl, program, 'aNormal', state.buffers.normal, 3);
    attribute(gl, program, 'aTangent', state.buffers.tangent, 3);
    attribute(gl, program, 'aUv', state.buffers.uv, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.buffers.index);

    const view = rendererCore.viewState(targetRecipe.viewRig, options.geometry);
    let model = mat4Identity();
    if (options.geometry === 'cube') model = mat4Multiply(mat4RotationY(0.58), mat4RotationX(-0.18));
    if (options.geometry === 'plane' && targetRecipe.viewRig && targetRecipe.viewRig.mode === 'grazing-proxy') model = mat4RotationY(-0.1);
    const viewMatrix = mat4LookAt(view.eye, view.target, [0,1,0]);
    const projection = mat4Perspective(view.fov, el.canvas.width / el.canvas.height, 0.05, 100);
    uniformMat4(gl, program, 'uModel', model);
    uniformMat4(gl, program, 'uView', viewMatrix);
    uniformMat4(gl, program, 'uProjection', projection);
    uniform3fv(gl, program, 'uCameraPos', view.eye);
    uniform3fv(gl, program, 'uLightDirection', rendererCore.lightDirection(targetRecipe.lightRig));
    uniform3fv(gl, program, 'uLightColor', hexRgb01(targetRecipe.lightRig && targetRecipe.lightRig.color || '#ffffff'));
    uniform1f(gl, program, 'uLightIntensity', Number(targetRecipe.lightRig && targetRecipe.lightRig.intensity) || 0);
    uniform1f(gl, program, 'uAmbient', Number(targetRecipe.lightRig && targetRecipe.lightRig.ambient) || 0);
    uniform1f(gl, program, 'uEnvironment', Number(targetRecipe.lightRig && targetRecipe.lightRig.environment) || 0);
    uniform1f(gl, program, 'uShadowContrast', Number(targetRecipe.lightRig && targetRecipe.lightRig.shadow) || 0);
    uniform1f(gl, program, 'uExposure', Number(targetRecipe.shader && targetRecipe.shader.exposure) || 1);
    uniform1f(gl, program, 'uSaturation', Number(targetRecipe.shader && targetRecipe.shader.saturation) || 1);
    uniform1f(gl, program, 'uNormalStrength', options.normalStrength);
    uniform1f(gl, program, 'uAlphaCutoff', options.alphaCutoff);
    uniform1f(gl, program, 'uUvScale', view.uvScale);
    uniform1f(gl, program, 'uClearcoatEnabled', targetRecipe.shader && targetRecipe.shader.clearcoatLike && targetRecipe.shader.clearcoatLike.enabled ? 1 : 0);
    uniform1f(gl, program, 'uClearcoatStrength', Number(targetRecipe.shader && targetRecipe.shader.clearcoatLike && targetRecipe.shader.clearcoatLike.strength) || 0);
    uniform1f(gl, program, 'uFresnelEnabled', targetRecipe.shader && targetRecipe.shader.fresnelLike && targetRecipe.shader.fresnelLike.enabled ? 1 : 0);
    uniform1f(gl, program, 'uFresnelStrength', Number(targetRecipe.shader && targetRecipe.shader.fresnelLike && targetRecipe.shader.fresnelLike.strength) || 0);
    uniform1f(gl, program, 'uEmissiveEnabled', targetRecipe.shader && targetRecipe.shader.emissiveBoost && targetRecipe.shader.emissiveBoost.enabled ? 1 : 0);
    uniform1f(gl, program, 'uEmissiveStrength', Number(targetRecipe.shader && targetRecipe.shader.emissiveBoost && targetRecipe.shader.emissiveBoost.strength) || 0);
    uniform1f(gl, program, 'uRoughnessOverrideEnabled', targetRecipe.shader && targetRecipe.shader.roughnessResponse && targetRecipe.shader.roughnessResponse.enabled ? 1 : 0);
    uniform1f(gl, program, 'uRoughnessOverride', Number(targetRecipe.shader && targetRecipe.shader.roughnessResponse && targetRecipe.shader.roughnessResponse.value) || 0.5);
    uniform1i(gl, program, 'uBaseColor', TEXTURE_UNITS['base-color']);
    uniform1i(gl, program, 'uNormalMap', TEXTURE_UNITS.normal);
    uniform1i(gl, program, 'uRoughness', TEXTURE_UNITS.roughness);
    uniform1i(gl, program, 'uMetallic', TEXTURE_UNITS.metallic);
    uniform1i(gl, program, 'uAO', TEXTURE_UNITS['ambient-occlusion']);
    uniform1i(gl, program, 'uEmissive', TEXTURE_UNITS.emissive);
    uniform1i(gl, program, 'uOpacity', TEXTURE_UNITS.opacity);

    gl.drawElements(gl.TRIANGLES, state.buffers.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.finish();
    const pixels = framebufferRgba();
    const receipt = rendererCore.renderReceipt(plan, {
      width: el.canvas.width,
      height: el.canvas.height,
      pixelHash: hashBytes(pixels),
      webglContext: gl.getParameter(gl.VERSION),
      shaderLinked: true,
      drawCompleted: true
    });
    return { plan, receipt, pixels, dataUrl: dataUrlFromPixels(pixels) };
  }

  function showPlan(result) {
    lastPlan = result.plan;
    lastReceipt = result.receipt;
    el.exportReceipt.disabled = false;
    el.status.textContent = `${result.receipt.geometry} • ${result.receipt.framebuffer.pixelHash}`;
    const interpreted = result.plan.interpretedChannels;
    const preserved = result.plan.preservedOnlyChannels;
    el.channelStatus.innerHTML = `
      <div><strong>WebGL interpreted</strong>${interpreted.length ? interpreted.map((name) => `<span>${escapeHtml(name)}</span>`).join('') : '<span>defaults only</span>'}</div>
      <div><strong>Preserved only</strong>${preserved.length ? preserved.map((name) => `<span class="held">${escapeHtml(name)}</span>`).join('') : '<span>none</span>'}</div>
      ${result.plan.missingEntries.length ? `<div><strong>Missing</strong><span class="held">${result.plan.missingEntries.length} unresolved entry refs</span></div>` : ''}
      ${result.plan.heldLayers.length ? `<div><strong>Held</strong><span class="held">${result.plan.heldLayers.length} payload-less layers</span></div>` : ''}
    `;
    el.output.textContent = JSON.stringify({
      receipt: result.receipt,
      channelSources: Object.fromEntries(Object.entries(result.plan.interpreted).map(([channel, rows]) => [channel, rows.map((row) => ({ layerId: row.layerId, entryId: row.entryId, targetChannel: row.targetChannel, mode: row.interpretationMode }))])),
      preservedOnly: result.plan.preservedOnly,
      warnings: result.plan.warnings
    }, null, 2);
  }

  async function renderCurrent() {
    if (!recipe) throw new Error('Load or import a v0.5 influence workspace first.');
    el.status.textContent = 'rendering…';
    const result = await renderRecipe(recipe, rendererOptions());
    showPlan(result);
    return result;
  }

  function captureSlot(slot) {
    if (!lastReceipt) {
      el.compareOutput.textContent = JSON.stringify({ message: 'Render the material before capturing.' }, null, 2);
      return;
    }
    const pixels = framebufferRgba();
    snapshots[slot] = {
      capturedAt: nowIso(),
      pixels,
      dataUrl: dataUrlFromPixels(pixels),
      receipt: clone(lastReceipt),
      plan: clone(lastPlan)
    };
    el.captureStatus.textContent = `A ${snapshots.A ? snapshots.A.receipt.framebuffer.pixelHash : '—'} • B ${snapshots.B ? snapshots.B.receipt.framebuffer.pixelHash : '—'}`;
  }

  function compareSnapshots() {
    if (!snapshots.A || !snapshots.B) {
      el.compareOutput.textContent = JSON.stringify({ message: 'Capture both WebGL A and B first.' }, null, 2);
      return;
    }
    const width = el.canvas.width, height = el.canvas.height;
    let pixelDelta = null, diffUrl = null;
    if (deltaCore) {
      const delta = deltaCore.summarizePixelDelta(snapshots.A.pixels, snapshots.B.pixels, width, height, { gridSize: 8, threshold: 0 });
      pixelDelta = {
        changedShare: delta.changedShare,
        changedPixelCount: delta.changedPixelCount,
        meanAbsChannelDelta: delta.meanAbsChannelDelta,
        maxChannelDelta: delta.maxChannelDelta,
        changedBounds: delta.changedBounds,
        regions: delta.regions
      };
      diffUrl = dataUrlFromPixels(deltaCore.buildDifferenceRgba(snapshots.A.pixels, snapshots.B.pixels, width, height, { threshold: 0 }));
    }
    el.comparePreview.innerHTML = `
      <figure><img src="${snapshots.A.dataUrl}" alt=""><figcaption>A • ${snapshots.A.receipt.framebuffer.pixelHash}</figcaption></figure>
      <figure><img src="${snapshots.B.dataUrl}" alt=""><figcaption>B • ${snapshots.B.receipt.framebuffer.pixelHash}</figcaption></figure>
      ${diffUrl ? `<figure><img src="${diffUrl}" alt=""><figcaption>WebGL framebuffer delta</figcaption></figure>` : ''}
    `;
    el.compareOutput.textContent = JSON.stringify({
      truthStatus: 'OBSERVED_V0_6_WEBGL_FRAMEBUFFER_COMPARISON',
      a: snapshots.A.receipt,
      b: snapshots.B.receipt,
      pixelDelta: pixelDelta || { unavailable: true },
      boundary: 'The A/B difference is exact framebuffer evidence for this renderer path. It is not physical-material validation or cross-engine equivalence.'
    }, null, 2);
  }

  async function runLightSweep() {
    if (!recipe) throw new Error('Load a workspace first.');
    el.sweep.disabled = true;
    el.sweepGallery.innerHTML = '';
    const outputs = [];
    try {
      for (let index = 0; index < influenceCore.LIGHT_RIGS.length; index += 1) {
        const rig = influenceCore.LIGHT_RIGS[index];
        el.sweepStatus.textContent = `${index + 1}/${influenceCore.LIGHT_RIGS.length} • ${rig.name}`;
        const candidate = clone(recipe);
        candidate.lightRig = clone(rig);
        const result = await renderRecipe(candidate, rendererOptions());
        outputs.push({ rig: clone(rig), receipt: clone(result.receipt), dataUrl: result.dataUrl });
      }
      el.sweepGallery.innerHTML = outputs.map((item) => `<figure><img src="${item.dataUrl}" alt=""><figcaption>${escapeHtml(item.rig.name)}<small>${item.receipt.framebuffer.pixelHash}</small></figcaption></figure>`).join('');
      el.sweepStatus.textContent = `${outputs.length} rigs rendered • same recipe ${rendererCore.fnv1a(rendererCore.stableStringify({ id: recipe.id, stack: recipe.stack }))}`;
      if (outputs.length) {
        lastReceipt = outputs[outputs.length - 1].receipt;
        el.exportReceipt.disabled = false;
      }
      el.output.textContent = JSON.stringify({
        truthStatus: 'OBSERVED_V0_6_CROSS_LIGHT_SWEEP',
        recipeId: recipe.id,
        geometry: rendererOptions().geometry,
        renders: outputs.map((item) => ({ lightRig: item.rig, framebuffer: item.receipt.framebuffer, interpretedChannels: item.receipt.interpretedChannels })),
        boundary: 'Each image is the same recipe rendered by the same local shader under a different declared light rig. This measures renderer response, not universal real-world material response.'
      }, null, 2);
    } finally {
      el.sweep.disabled = false;
    }
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

  el.loadSaved.addEventListener('click', () => {
    readSavedWorkspace().then((saved) => {
      if (!saved) throw new Error('No explicitly saved v0.5 influence workspace exists in this browser. Save the Influence Lab first or import its JSON here.');
      acceptWorkspace(saved, 'saved-v0.5-indexeddb');
      return renderCurrent();
    }).catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); el.status.textContent = 'load/render error'; });
  });
  el.importButton.addEventListener('click', () => el.importInput.click());
  el.importInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      acceptWorkspace(JSON.parse(await file.text()), `import:${file.name}`);
      await renderCurrent();
    } catch (error) {
      el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2);
      el.status.textContent = 'import/render error';
    }
  });
  el.recipe.addEventListener('change', () => {
    if (!workspace) return;
    recipe = clone(workspace.recipes.find((item) => item.id === el.recipe.value) || workspace.recipes[0]);
    snapshots = { A: null, B: null };
    el.captureStatus.textContent = 'A — • B —';
    renderCurrent().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); });
  });
  el.render.addEventListener('click', () => renderCurrent().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); el.status.textContent = 'render error'; }));
  [el.geometry, el.normalStrength, el.alphaCutoff, el.background].forEach((control) => control.addEventListener('input', () => {
    el.normalValue.textContent = Number(el.normalStrength.value).toFixed(2);
    el.alphaValue.textContent = Number(el.alphaCutoff.value).toFixed(2);
  }));
  el.captureA.addEventListener('click', () => captureSlot('A'));
  el.captureB.addEventListener('click', () => captureSlot('B'));
  el.compare.addEventListener('click', compareSnapshots);
  el.sweep.addEventListener('click', () => runLightSweep().catch((error) => { el.output.textContent = JSON.stringify({ error: error.message || String(error) }, null, 2); el.sweepStatus.textContent = 'sweep error'; }));
  el.exportReceipt.addEventListener('click', () => {
    if (!lastReceipt) return;
    download('axm-material-render-receipt-v0.6.json', JSON.stringify({ receipt: lastReceipt, plan: lastPlan }, null, 2));
  });

  renderRecipeOptions();
  el.channelStatus.innerHTML = '<span>Load a saved or exported v0.5 Influence Lab workspace to render explicit channel state.</span>';
  el.output.textContent = JSON.stringify({
    message: 'v0.6 renderer bridge is ready. It is read-only toward the v0.5 lab: load its explicitly saved state or import its JSON, then render exact declared material channels through local WebGL.',
    interpretedChannels: rendererCore.DIRECT_CHANNELS,
    preservedOnlyChannels: rendererCore.PRESERVED_ONLY_CHANNELS,
    baseColorOverlayChannels: rendererCore.BASE_COLOR_OVERLAYS
  }, null, 2);
})();
