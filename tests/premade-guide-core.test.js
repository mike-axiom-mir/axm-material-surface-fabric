'use strict';
const assert = require('assert');
const pack = require('../premade-pack.js');
const composer = require('../premade-composer-core.js');
const patternCore = require('../premade-pattern-core.js');
const guide = require('../premade-guide-core.js');

function baseLayer(assetId, row, column) {
  return { assetId, cell:{row,column}, blendMode:'normal', opacity:1, transform:{x:.5,y:.5,width:.78,height:.78,rotation:0} };
}
function windowLayer(assetId, crop, blendMode, opacity, transform) {
  return { assetId, crop, blendMode, opacity, transform:Object.assign({x:.5,y:.5,width:.62,height:.62,rotation:0},transform||{}) };
}
function spriteLayer(assetId, id, bounds, blendMode, opacity, transform) {
  return {
    assetId,
    spriteCandidate:{id,atlasId:assetId,normalizedBounds:bounds,sourceIndexId:`index-${assetId}`,sourceBasis:'test-source',canonicalSourceIndex:true},
    blendMode,opacity,transform:Object.assign({x:.5,y:.5,width:.55,height:.55,rotation:0},transform||{}),
    provenance:{rule:'test-v0.14-sprite',semanticObjectClaim:false}
  };
}
function recipe(name, layers) {
  const r = composer.createRecipe(name,name);
  r.layers = layers.map((layer,index)=>composer.normalizeLayer(Object.assign({id:`${name}-${index}`},layer),index,pack));
  r.canvas.transparent = true;
  return r;
}
function row(candidateId, recipeValue, technicalScore) {
  return {candidateId,technicalScore,recipeFingerprint:composer.recipeFingerprint(recipeValue,pack),recipe:recipeValue};
}

const anchorA = recipe('anchor-a',[
  baseLayer('weathered-globes',0,0),
  spriteLayer('rust-corrosion','rust-corrosion/sprite-guide',{x:.08,y:.10,width:.25,height:.30},'overlay',.46,{x:.42,y:.48,width:.48,height:.50,rotation:8}),
  windowLayer('metal-wear',{x:0,y:0,width:.25,height:.25},'soft-light',.38,{x:.56,y:.52,width:.66,height:.58,rotation:-5})
]);
const anchorB = JSON.parse(JSON.stringify(anchorA));
anchorB.id='anchor-b'; anchorB.seed='anchor-b'; anchorB.name='anchor-b'; anchorB.layers[1].opacity=.49;

const holo = recipe('holo-donor',[
  baseLayer('energy-globes',0,0),
  windowLayer('holographic-grids',{x:0,y:0,width:1/6,height:1/6},'screen',.62,{x:.5,y:.5,width:.72,height:.72,rotation:0}),
  windowLayer('radial-holograms',{x:1/6,y:1/6,width:1/6,height:1/6},'lighter',.54,{x:.5,y:.5,width:.58,height:.58,rotation:14})
]);
const grime = recipe('grime-donor',[
  baseLayer('material-globes',0,0),
  windowLayer('mud-dirt',{x:.25,y:0,width:.25,height:.25},'multiply',.42,{x:.48,y:.56,width:.70,height:.48,rotation:-8}),
  windowLayer('oil-grease',{x:.5,y:.25,width:.25,height:.25},'overlay',.35,{x:.55,y:.44,width:.50,height:.56,rotation:5}),
  windowLayer('hazard-decals',{x:0,y:.5,width:.25,height:.25},'normal',.70,{x:.5,y:.60,width:.65,height:.28,rotation:0})
]);

const keeperPack = {
  format:'axm-premade-recipe-pack',version:'0.13.0',id:'guide-keepers',
  pack:{format:pack.format,version:pack.version,archiveSha256:pack.binaryPack.sha256},
  recipes:[row('anchor-a',anchorA,82),row('anchor-b',anchorB,84),row('holo',holo,78),row('grime',grime,73)]
};
const library = patternCore.learnPatternLibrary([keeperPack],pack,'guide library');
assert.strictEqual(patternCore.validateLibrary(library).ok,true);
assert.strictEqual(guide.VERSION,'0.16.0');

const anchorPattern = library.patterns.find((pattern)=>pattern.slots.some((slot)=>slot.category==='overlays/corrosion'));
const holoPattern = library.patterns.find((pattern)=>pattern.slots.some((slot)=>slot.category==='fx/holographic-grids'));
const grimePattern = library.patterns.find((pattern)=>pattern.slots.some((slot)=>slot.category==='overlays/dirt'));
assert.ok(anchorPattern && holoPattern && grimePattern,'expected three learned test patterns');
assert.strictEqual(anchorPattern.support,2);

const donorRows = guide.compatibleDonors(library,anchorPattern.id,{allowFx:true,allowDecals:true},'donor-seed');
assert.ok(donorRows.some((row)=>row.patternId===holoPattern.id));
assert.ok(donorRows.some((row)=>row.patternId===grimePattern.id));
assert.match(JSON.stringify(donorRows[0].structuralRelation),/not an aesthetic compatibility score/);
const autoA = guide.autoSelectDonors(library,anchorPattern.id,2,'auto-seed',{allowFx:true,allowDecals:true});
const autoB = guide.autoSelectDonors(library,anchorPattern.id,2,'auto-seed',{allowFx:true,allowDecals:true});
assert.deepStrictEqual(autoA,autoB,'auto donor selection must be deterministic');
assert.strictEqual(new Set(autoA).size,autoA.length);

const policy = {maxLayers:7,anchorExtras:1,allowFx:true,allowDecals:true,reuseObservedSprites:true};
const guidedA = guide.composeGuided(library,anchorPattern.id,[holoPattern.id,grimePattern.id],pack,'guided-seed',policy);
const guidedB = guide.composeGuided(library,anchorPattern.id,[holoPattern.id,grimePattern.id],pack,'guided-seed',policy);
const guidedC = guide.composeGuided(library,anchorPattern.id,[holoPattern.id,grimePattern.id],pack,'guided-other',policy);
assert.deepStrictEqual(guidedA,guidedB,'same library/patterns/seed/policy must reproduce identical guided state');
assert.notStrictEqual(guidedA.recipeFingerprint,guidedC.recipeFingerprint,'different seed should alter guided recipe identity');
assert.strictEqual(guidedA.format,'axm-premade-guided-composition-receipt');
assert.strictEqual(guidedA.recipe.canvas.transparent,true);
assert.ok(guidedA.recipe.layers.length<=7);
assert.strictEqual(guidedA.recipe.layers.length,guidedA.selection.length);
assert.strictEqual(guidedA.selection[0].sourceRole,'anchor');
assert.ok(guidedA.selection.some((row)=>row.sourcePatternId===holoPattern.id),'holographic donor must contribute');
assert.ok(guidedA.selection.some((row)=>row.sourcePatternId===grimePattern.id),'grime donor must contribute');
assert.ok(guidedA.recipe.layers.every((layer)=>layer.provenance && layer.provenance.rule==='v0.16-pattern-guided-composition'));
assert.ok(guidedA.recipe.layers.every((layer)=>layer.provenance.supportIsQualityClaim===false));
assert.strictEqual(composer.validateRecipe(guidedA.recipe,pack).ok,true);
assert.strictEqual(guide.validateReceipt(guidedA,pack).ok,true);
assert.match(JSON.stringify(guidedA.truthBoundary),/not a quality or preference score/);
assert.match(JSON.stringify(guidedA.truthBoundary),/never automatically kept/);

const summary = guide.guideSummary(guidedA);
assert.strictEqual(summary.layers,guidedA.recipe.layers.length);
assert.ok(summary.sourcePatterns.length>=3);
assert.ok(summary.spriteLayers>=1,'anchor sprite candidate should survive when selected');

const noFx = guide.composeGuided(library,anchorPattern.id,[holoPattern.id,grimePattern.id],pack,'no-fx',{maxLayers:7,anchorExtras:1,allowFx:false,allowDecals:true});
assert.ok(noFx.recipe.layers.every((layer)=>composer.byId(pack,layer.assetId).kind!=='fx-atlas'),'allowFx:false must exclude FX donor motifs');

const automatic = guide.autoComposeGuided(library,anchorPattern.id,pack,'automatic',{maxLayers:6,anchorExtras:1,autoDonors:2});
assert.strictEqual(guide.validateReceipt(automatic,pack).ok,true);
assert.ok(automatic.donorPatternIds.length<=2);

const bad = JSON.parse(JSON.stringify(guidedA));
bad.recipe.canvas.transparent=false;
assert.strictEqual(guide.validateReceipt(bad,pack).ok,false);

console.log('AXM premade pattern-guided composition tests: PASS');
