'use strict';
const assert = require('assert');
const pack = require('../premade-pack.js');
const composer = require('../premade-composer-core.js');
const patterns = require('../premade-pattern-core.js');

function keptRow(seed, score, changeOpacity) {
  const recipe = composer.seededRecipe(seed, pack, {basePool:'weathered', overlayCount:3, includeFx:true, includeDecals:true});
  if (changeOpacity != null) recipe.layers[1].opacity = changeOpacity;
  return {
    candidateId:`candidate-${seed}`,
    technicalScore:score,
    recipeFingerprint:composer.recipeFingerprint(recipe,pack),
    recipe
  };
}

const rowA = keptRow('pattern-a', 82, .45);
const rowB = JSON.parse(JSON.stringify(rowA));
rowB.candidateId = 'candidate-pattern-b';
rowB.recipe.id = 'pattern-b-recipe';
rowB.recipe.seed = 'pattern-b';
rowB.recipe.layers[1].opacity = .49;
rowB.recipeFingerprint = composer.recipeFingerprint(rowB.recipe,pack);
const rowC = keptRow('pattern-c', 67, .82);

const packA = {
  format:'axm-premade-recipe-pack', version:'0.13.0', id:'keeper-pack-a',
  pack:{format:pack.format,version:pack.version,archiveSha256:pack.binaryPack.sha256},
  recipes:[rowA,rowB]
};
const packB = {
  format:'axm-premade-recipe-pack', version:'0.13.0', id:'keeper-pack-b',
  pack:{format:pack.format,version:pack.version,archiveSha256:pack.binaryPack.sha256},
  recipes:[rowC]
};

assert.strictEqual(patterns.VERSION,'0.15.0');
assert.strictEqual(patterns.validateRecipePack(packA,pack).ok,true);
assert.strictEqual(patterns.validateRecipePack({format:'wrong',version:'0'},pack).ok,false);

const skeletonA = patterns.recipeSkeleton(rowA.recipe,pack);
const skeletonB = patterns.recipeSkeleton(rowB.recipe,pack);
assert.strictEqual(patterns.skeletonSignature(skeletonA),patterns.skeletonSignature(skeletonB),'quantized near-identical kept recipes should aggregate');

const library = patterns.learnPatternLibrary([packA,packB],pack,'test patterns');
assert.strictEqual(library.format,'axm-premade-pattern-library');
assert.strictEqual(library.version,'0.15.0');
assert.strictEqual(library.summary.keeperRecipes,3);
assert.ok(library.patterns.length >= 2);
assert.ok(library.patterns.some((pattern)=>pattern.support===2),'repeated kept structure should produce support 2');
assert.match(JSON.stringify(library.truthBoundary),/no hidden model training/);
assert.match(JSON.stringify(library.truthBoundary),/not artistic authority/);
assert.strictEqual(patterns.validateLibrary(library).ok,true);

const repeated = library.patterns.find((pattern)=>pattern.support===2);
assert.ok(repeated.slots.length >= 2);
assert.ok(repeated.sourceRecipeFingerprints.length===2);
assert.ok(repeated.technicalScore && repeated.technicalScore.min===82 && repeated.technicalScore.max===82);

const instanceA = patterns.instantiatePattern(library,repeated.id,pack,'same-seed');
const instanceB = patterns.instantiatePattern(library,repeated.id,pack,'same-seed');
const instanceC = patterns.instantiatePattern(library,repeated.id,pack,'other-seed');
assert.deepStrictEqual(instanceA,instanceB,'same pattern + same seed must instantiate identical recipe state');
assert.notStrictEqual(instanceA.recipeFingerprint,instanceC.recipeFingerprint,'different seed should change instantiated recipe state');
assert.strictEqual(instanceA.recipe.canvas.transparent,true);
assert.strictEqual(instanceA.recipe.patternLineage.patternId,repeated.id);
assert.strictEqual(instanceA.patternSupport,2);
assert.strictEqual(composer.validateRecipe(instanceA.recipe,pack).ok,true);
assert.match(JSON.stringify(instanceA.truthBoundary),/not automatically kept or promoted/);

const summary = patterns.librarySummary(library);
assert.strictEqual(summary.keeperRecipes,3);
assert.strictEqual(summary.maxSupport,2);
assert.ok(summary.repeatedPatterns>=1);

const bad = JSON.parse(JSON.stringify(library));
bad.patterns.push(JSON.parse(JSON.stringify(bad.patterns[0])));
assert.strictEqual(patterns.validateLibrary(bad).ok,false,'duplicate pattern ids must fail');

console.log('AXM premade pattern memory tests: PASS');
