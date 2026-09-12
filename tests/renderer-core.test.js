'use strict';
const assert = require('assert');
const core = require('../renderer-core.js');

const entries = [
  { id: 'base', name: 'base', dataUrl: 'data:image/png;base64,AAAA' },
  { id: 'decal', name: 'decal', dataUrl: 'data:image/png;base64,BBBB' },
  { id: 'normal', name: 'normal', dataUrl: 'data:image/png;base64,CCCC' },
  { id: 'rough', name: 'rough', dataUrl: 'data:image/png;base64,DDDD' },
  { id: 'height', name: 'height', dataUrl: 'data:image/png;base64,EEEE' },
  { id: 'missing-payload', name: 'missing' }
];

const recipe = {
  id: 'recipe-test',
  name: 'test material',
  updatedAt: '2026-09-12T00:00:00Z',
  lightRig: { angle: 315, intensity: 0.8, ambient: 0.2, environment: 0.1, shadow: 0.3, color: '#ffffff' },
  viewRig: { id: 'flat', mode: 'flat' },
  shader: { exposure: 1, saturation: 1 },
  stack: [
    { id: 'l1', entryId: 'base', targetChannel: 'base-color', blendMode: 'normal', opacity: 1, visible: true },
    { id: 'l2', entryId: 'decal', targetChannel: 'decal', blendMode: 'overlay', opacity: 0.5, visible: true },
    { id: 'l3', entryId: 'normal', targetChannel: 'normal', blendMode: 'normal', opacity: 1, visible: true },
    { id: 'l4', entryId: 'rough', targetChannel: 'roughness', blendMode: 'normal', opacity: 1, visible: true },
    { id: 'l5', entryId: 'height', targetChannel: 'height', blendMode: 'normal', opacity: 1, visible: true },
    { id: 'l6', entryId: 'missing-payload', targetChannel: 'metallic', blendMode: 'normal', opacity: 1, visible: true },
    { id: 'l7', entryId: 'not-there', targetChannel: 'ambient-occlusion', blendMode: 'normal', opacity: 1, visible: true },
    { id: 'l8', entryId: 'base', targetChannel: 'opacity', blendMode: 'normal', opacity: 1, visible: false }
  ]
};

const plan = core.compileRenderPlan(recipe, entries, { geometry: 'cube', normalStrength: 1.4, alphaCutoff: 0.1 });
assert.strictEqual(plan.version, '0.6.0');
assert.strictEqual(plan.renderer.geometry, 'cube');
assert.strictEqual(plan.renderer.normalStrength, 1.4);
assert.strictEqual(plan.interpreted['base-color'].length, 2);
assert.strictEqual(plan.interpreted['base-color'][1].interpretationMode, 'base-color-overlay');
assert.strictEqual(plan.interpreted.normal.length, 1);
assert.strictEqual(plan.interpreted.roughness.length, 1);
assert.strictEqual(plan.interpreted.opacity.length, 0, 'hidden layers must not enter render plan');
assert.deepStrictEqual(plan.preservedOnlyChannels, ['height']);
assert.strictEqual(plan.missingEntries.length, 1);
assert.strictEqual(plan.heldLayers.length, 1);
assert.ok(plan.interpretedChannels.includes('base-color'));
assert.ok(plan.interpretedChannels.includes('normal'));
assert.ok(plan.planHash.length === 8);
assert.deepStrictEqual(core.classifyChannel('decal'), { channel: 'base-color', mode: 'base-color-overlay', sourceChannel: 'decal' });
assert.strictEqual(core.classifyChannel('height').mode, 'preserved-only');

const samePlan = core.compileRenderPlan(recipe, entries, { geometry: 'cube', normalStrength: 1.4, alphaCutoff: 0.1 });
assert.strictEqual(samePlan.planHash, plan.planHash, 'same explicit plan must replay to same hash');

const receipt = core.renderReceipt(plan, {
  width: 640,
  height: 640,
  pixelHash: 'deadbeef',
  webglContext: 'WebGL 1.0 test',
  shaderLinked: true,
  drawCompleted: true
});
assert.strictEqual(receipt.format, 'axm-material-render-receipt');
assert.strictEqual(receipt.framebuffer.pixelHash, 'deadbeef');
assert.strictEqual(receipt.runtime.drawCompleted, true);
assert.ok(receipt.truthBoundary.pbr.includes('not engine parity'));
assert.deepStrictEqual(receipt.preservedOnlyChannels, ['height']);

const light = core.lightDirection({ angle: 0 });
assert.strictEqual(light.length, 3);
assert.ok(Math.abs(Math.hypot(...light) - 1) < 1e-10);
const grazing = core.viewState({ mode: 'grazing-proxy' }, 'sphere');
assert.ok(grazing.eye[0] > 2);
assert.strictEqual(core.viewState({ mode: 'tile-2x2' }, 'plane').uvScale, 2);

const plane = core.planeGeometry();
assert.strictEqual(plane.positions.length, 12);
assert.strictEqual(plane.indices.length, 6);
assert.strictEqual(plane.tangents.length, 12);

const cube = core.cubeGeometry();
assert.strictEqual(cube.positions.length, 24 * 3);
assert.strictEqual(cube.normals.length, 24 * 3);
assert.strictEqual(cube.tangents.length, 24 * 3);
assert.strictEqual(cube.uvs.length, 24 * 2);
assert.strictEqual(cube.indices.length, 36);

const sphere = core.sphereGeometry(8, 12);
assert.strictEqual(sphere.positions.length, (8 + 1) * (12 + 1) * 3);
assert.strictEqual(sphere.normals.length, sphere.positions.length);
assert.strictEqual(sphere.tangents.length, sphere.positions.length);
assert.strictEqual(sphere.uvs.length, (8 + 1) * (12 + 1) * 2);
assert.strictEqual(sphere.indices.length, 8 * 12 * 6);
assert.ok(Math.max(...sphere.indices) < 65536, 'default renderer geometry must fit Uint16 indices');

assert.strictEqual(core.normalizeRendererOptions({ geometry: 'bad', normalStrength: 99, alphaCutoff: -1 }).geometry, 'sphere');
assert.strictEqual(core.normalizeRendererOptions({ normalStrength: 99 }).normalStrength, 3);
assert.strictEqual(core.normalizeRendererOptions({ alphaCutoff: -1 }).alphaCutoff, 0);

console.log('AXM material renderer core tests: PASS');
