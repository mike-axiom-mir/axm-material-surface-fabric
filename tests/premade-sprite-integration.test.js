'use strict';
const assert = require('assert');
const pack = require('../premade-pack.js');
const composer = require('../premade-composer-core.js');
const evolution = require('../premade-evolution-core.js');

const recipe = composer.createRecipe('sprite integration', 'sprite-test');
recipe.layers.push(composer.normalizeLayer({
  id:'base', assetId:'material-globes', cell:{row:0,column:0}, blendMode:'normal', opacity:1,
  transform:{x:.5,y:.5,width:.7,height:.7,rotation:0}
}, 0, pack));
recipe.layers.push(composer.normalizeLayer({
  id:'rust-sprite', assetId:'rust-corrosion',
  spriteCandidate:{
    id:'rust-corrosion/sprite-001-test', atlasId:'rust-corrosion',
    normalizedBounds:{x:.1,y:.2,width:.25,height:.3}, sourceIndexId:'sprite-index-test',
    sourceBasis:'v0.11-source-png', canonicalSourceIndex:true
  },
  blendMode:'overlay', opacity:.6,
  transform:{x:.52,y:.48,width:.4,height:.48,rotation:7},
  provenance:{rule:'v0.14-alpha-sprite-candidate',semanticObjectClaim:false}
}, 1, pack));

assert.strictEqual(composer.validateRecipe(recipe, pack).ok, true);
const plan = composer.compilePlan(recipe, pack);
assert.strictEqual(plan.layers[1].sourceType, 'sprite-candidate');
assert.strictEqual(plan.layers[1].spriteCandidate.id, 'rust-corrosion/sprite-001-test');
assert.strictEqual(plan.layers[1].spriteCandidate.atlasId, 'rust-corrosion');
assert.deepStrictEqual(plan.layers[1].sourceRect, {
  x:51,y:102,width:128,height:154,semanticCell:false,spriteCandidate:true,spriteId:'rust-corrosion/sprite-001-test'
});
assert.match(composer.stableStringify(plan.truthBoundary), /alpha regions/);

const changed = composer.clone(recipe);
changed.layers[1].spriteCandidate.normalizedBounds.x = .2;
assert.notStrictEqual(composer.recipeFingerprint(recipe, pack), composer.recipeFingerprint(changed, pack), 'sprite bounds must participate in recipe identity');

const child = evolution.mutateRecipe(recipe, pack, 'sprite-evolution-proof', 0, {
  strength:'medium', variants:1, lockBase:true, allowFx:true, allowDecals:true, allowLayerCountChange:false
});
assert.strictEqual(composer.validateRecipe(child, pack).ok, true, 'v0.13 must continue accepting recipes containing v0.14 sprite candidates');
const childPlan = composer.compilePlan(child, pack);
assert.ok(['sprite-candidate','atlas-window'].includes(childPlan.layers[1].sourceType), 'evolution may preserve the exact sprite or explicitly leave it for an atlas window after an asset swap');
if (childPlan.layers[1].sourceType === 'sprite-candidate') {
  assert.strictEqual(childPlan.layers[1].spriteCandidate.atlasId, childPlan.layers[1].assetId);
}
assert.strictEqual(child.canvas.transparent, true);
assert.strictEqual(child.lineage.parentFingerprint, composer.recipeFingerprint(recipe, pack));

console.log('AXM premade sprite composer/evolution integration tests: PASS');
