'use strict';
const assert = require('assert');
const core = require('../influence-core.js');

const t0 = '2026-09-12T00:00:00.000Z';
const t1 = '2026-09-12T00:01:00.000Z';
const t2 = '2026-09-12T00:02:00.000Z';

const workspace = core.createWorkspace(t0);
assert.strictEqual(workspace.format, 'axm-material-influence-workspace');
assert.strictEqual(workspace.version, '0.5.0');
assert.strictEqual(core.validateWorkspace(workspace).ok, true);

const recipe = core.activeRecipe(workspace);
assert.ok(recipe);
assert.strictEqual(recipe.stack.length, 0);
assert.strictEqual(recipe.lightRig.id, 'neutral-studio');
assert.strictEqual(recipe.viewRig.id, 'flat');
assert.strictEqual(recipe.shader.emissiveBoost.enabled, true);

const layerA = core.addLayer(recipe, {
  entryId: 'material-base',
  targetChannel: 'base-color',
  blendMode: 'normal',
  opacity: 1,
  transform: { scale: 1, rotation: 0, offsetX: 0, offsetY: 0 },
  tiling: { repeatX: 1, repeatY: 1 }
}, t1);
assert.strictEqual(recipe.stack.length, 1);
assert.strictEqual(layerA.targetChannel, 'base-color');

const layerB = core.addLayer(recipe, {
  entryId: 'scratch-overlay',
  targetChannel: 'decal',
  blendMode: 'overlay',
  opacity: 0.35,
  maskEntryId: 'scratch-mask',
  transform: { scale: 1.25, rotation: 12, offsetX: 4, offsetY: -8 },
  tiling: { repeatX: 2, repeatY: 2 }
}, t1);
assert.strictEqual(recipe.stack.length, 2);
assert.strictEqual(layerB.opacity, 0.35);
assert.strictEqual(layerB.maskEntryId, 'scratch-mask');

core.updateLayer(recipe, layerB.id, {
  opacity: 0.7,
  targetChannel: 'emissive',
  transform: { rotation: 33 }
}, t2);
assert.strictEqual(recipe.stack[1].opacity, 0.7);
assert.strictEqual(recipe.stack[1].targetChannel, 'emissive');
assert.strictEqual(recipe.stack[1].transform.rotation, 33);
assert.strictEqual(recipe.stack[1].transform.scale, 1.25, 'partial transform patch must preserve prior fields');

assert.strictEqual(core.moveLayer(recipe, layerB.id, -1, t2), true);
assert.strictEqual(recipe.stack[0].id, layerB.id);
assert.strictEqual(core.moveLayer(recipe, layerB.id, -1, t2), false, 'moving first layer upward is bounded');

core.setLightPreset(recipe, 'cold-scifi', t2);
assert.strictEqual(recipe.lightRig.id, 'cold-scifi');
core.patchLightRig(recipe, { intensity: 99, ambient: -2 }, t2);
assert.strictEqual(recipe.lightRig.intensity, 2, 'light intensity is bounded');
assert.strictEqual(recipe.lightRig.ambient, 0, 'ambient is bounded');

core.setViewRig(recipe, 'grazing-proxy', t2);
assert.strictEqual(recipe.viewRig.id, 'grazing-proxy');
assert.match(recipe.viewRig.truth, /not a 3D/i);

core.patchShader(recipe, {
  exposure: 1.4,
  saturation: 0.8,
  clearcoatLike: { enabled: true, strength: 0.7 },
  roughnessResponse: { enabled: true, value: 0.2 }
}, t2);
assert.strictEqual(recipe.shader.clearcoatLike.enabled, true);
assert.strictEqual(recipe.shader.clearcoatLike.strength, 0.7);
assert.strictEqual(recipe.shader.roughnessResponse.value, 0.2);

const fingerprintA = core.recipeFingerprint(recipe);
const copy = core.duplicateRecipe(workspace, recipe.id, '2026-09-12T00:03:00.000Z');
assert.notStrictEqual(copy.id, recipe.id);
assert.strictEqual(copy.stack.length, recipe.stack.length);
assert.notStrictEqual(copy.stack[0].id, recipe.stack[0].id, 'copied recipe gets independent layer identities');
assert.strictEqual(workspace.activeRecipeId, copy.id);

const comparisonBefore = core.compareRecipeStates(recipe, copy);
assert.strictEqual(comparisonBefore.changed, true, 'copy name/id are intentionally distinct recipe state');
core.patchShader(copy, { emissiveBoost: { enabled: true, strength: 3 } }, '2026-09-12T00:04:00.000Z');
const comparison = core.compareRecipeStates(recipe, copy);
assert.strictEqual(comparison.changed, true);
assert.ok(comparison.counts.shader > 0);
assert.notStrictEqual(comparison.beforeFingerprint, comparison.afterFingerprint);
assert.strictEqual(fingerprintA, core.recipeFingerprint(recipe), 'mutating copy must not mutate original recipe');

assert.strictEqual(core.removeLayer(copy, copy.stack[0].id, t2), true);
assert.strictEqual(copy.stack.length, 1);
assert.strictEqual(core.removeLayer(copy, 'missing', t2), false);

assert.strictEqual(core.validateWorkspace(workspace).ok, true);
const invalid = core.clone(workspace);
invalid.activeRecipeId = 'missing';
assert.strictEqual(core.validateWorkspace(invalid).ok, false);

const normalized = core.normalizeLayer({
  entryId: 'x',
  targetChannel: 'not-real',
  blendMode: 'not-real',
  opacity: 9,
  transform: { scale: 0, rotation: 99999 },
  tiling: { repeatX: 0, repeatY: 100 }
}, 0);
assert.strictEqual(normalized.targetChannel, 'unassigned');
assert.strictEqual(normalized.blendMode, 'normal');
assert.strictEqual(normalized.opacity, 1);
assert.strictEqual(normalized.transform.scale, 0.05);
assert.strictEqual(normalized.transform.rotation, 3600);
assert.strictEqual(normalized.tiling.repeatX, 0.125);
assert.strictEqual(normalized.tiling.repeatY, 32);

console.log('AXM Material Influence core tests: PASS');
