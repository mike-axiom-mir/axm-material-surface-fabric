'use strict';
const assert = require('assert');
const composer = require('../premade-composer-core.js');
const evolution = require('../premade-evolution-core.js');
const pack = require('../premade-pack.js');

assert.strictEqual(evolution.VERSION, '0.13.0');
assert.strictEqual(evolution.SESSION_FORMAT, 'axm-premade-evolution-session');
assert.strictEqual(evolution.PACK_FORMAT, 'axm-premade-recipe-pack');

const parent = composer.seededRecipe('parent-seed', pack, { basePool:'weathered', overlayCount:4, includeFx:true, includeDecals:true });
const parentFp = composer.recipeFingerprint(parent, pack);
const policy = { variants:8, strength:'medium', lockBase:true, allowFx:true, allowDecals:true, allowLayerCountChange:true };
const sessionA = evolution.createSession(parent, pack, 'evo-seed', policy);
const sessionB = evolution.createSession(parent, pack, 'evo-seed', policy);
assert.deepStrictEqual(sessionA, sessionB, 'same parent + seed + policy must reproduce the same evolution session');
assert.strictEqual(sessionA.candidates.length, 8);
assert.strictEqual(sessionA.parent.recipeFingerprint, parentFp);
assert.strictEqual(sessionA.pack.archiveSha256, pack.binaryPack.sha256);
assert.strictEqual(sessionA.keepers.length, 0);
assert.match(JSON.stringify(sessionA.truthBoundary), /Ranking never automatically promotes/i);

const fingerprints = new Set();
for (const candidate of sessionA.candidates) {
  assert.strictEqual(candidate.recipe.canvas.transparent, true, 'alpha/transparent state is mandatory');
  assert.strictEqual(candidate.lineage.parentFingerprint, parentFp);
  assert.strictEqual(candidate.lineage.policy.lockBase, true);
  assert.strictEqual(candidate.recipe.layers[0].assetId, parent.layers[0].assetId, 'locked base keeps atlas identity');
  assert.deepStrictEqual(candidate.recipe.layers[0].cell, parent.layers[0].cell, 'locked base keeps declared globe cell');
  assert.ok(candidate.structure.score >= 0 && candidate.structure.score <= 100);
  fingerprints.add(candidate.recipeFingerprint);
  for (const layer of candidate.recipe.layers) {
    if (layer.crop) {
      assert.ok(layer.crop.x >= 0 && layer.crop.x <= 1);
      assert.ok(layer.crop.y >= 0 && layer.crop.y <= 1);
      assert.ok(layer.crop.width > 0 && layer.crop.width <= 1);
      assert.ok(layer.crop.height > 0 && layer.crop.height <= 1);
    }
  }
}
assert.ok(fingerprints.size > 1, 'variant batch should contain more than one recipe state');

const low = evolution.createSession(parent, pack, 'low-seed', { variants:4, strength:'low', lockBase:true });
const high = evolution.createSession(parent, pack, 'high-seed', { variants:4, strength:'high', lockBase:true });
assert.strictEqual(low.policy.strength, 'low');
assert.strictEqual(high.policy.strength, 'high');
assert.strictEqual(evolution.normalizePolicy({ variants:999 }).variants, 32);
assert.strictEqual(evolution.normalizePolicy({ variants:0 }).variants, 8);

const rgba = new Uint8Array([
  0,0,0,0,
  255,255,255,255,
  128,128,128,128,
  10,20,30,255
]);
const summary = evolution.summarizePixels(rgba, 2, 2);
assert.strictEqual(summary.totalPixels, 4);
assert.strictEqual(summary.visiblePixels, 3);
assert.strictEqual(summary.alphaCoverage, 0.75);
assert.ok(summary.pixelHash);
const health = evolution.pixelHealth(summary, 0);
assert.ok(health.score >= 0 && health.score <= 100);
assert.match(health.boundary, /not beauty/i);
const heldHealth = evolution.pixelHealth(summary, 2);
assert.ok(heldHealth.score < health.score);

const top = sessionA.candidates[0];
evolution.attachRenderObservation(sessionA, top.id, summary, 0, true);
const updated = sessionA.candidates.find((candidate) => candidate.id === top.id);
assert.strictEqual(updated.render.completed, true);
assert.strictEqual(updated.render.pixels.pixelHash, summary.pixelHash);
assert.ok(updated.technicalScore >= 0 && updated.technicalScore <= 100);

const kept = sessionA.candidates[0];
evolution.keepCandidate(sessionA, kept.id, true);
assert.strictEqual(sessionA.keepers.includes(kept.id), true);
const recipePack = evolution.recipePack(sessionA, 'keeper pack');
assert.strictEqual(recipePack.format, evolution.PACK_FORMAT);
assert.strictEqual(recipePack.recipes.length, 1);
assert.strictEqual(recipePack.recipes[0].recipe.canvas.transparent, true);
assert.match(JSON.stringify(recipePack.truthBoundary), /explicitly kept/i);

evolution.keepCandidate(sessionA, kept.id, false);
assert.strictEqual(sessionA.keepers.includes(kept.id), false);

const comparison = evolution.compareRecipes(parent, sessionA.candidates[0].recipe, pack);
assert.strictEqual(comparison.parentFingerprint, parentFp);
assert.ok(comparison.changedLayerCount >= 0);
assert.ok(comparison.mutationReceipt);

const structure = evolution.structuralObservation(parent, pack);
assert.strictEqual(structure.kind, 'bounded-structure-health');
assert.match(structure.boundary, /does not inspect rendered pixels/i);

console.log('AXM premade evolution tests: PASS');
