'use strict';
const assert = require('assert');
const libraryCore = require('../library-core.js');
const composer = require('../premade-composer-core.js');
const patterns = require('../premade-pattern-core.js');
const spriteCore = require('../alpha-sprite-core.js');
const pack = require('../premade-pack.js');
const core = require('../capability-exchange-core.js');

assert.strictEqual(core.VERSION, '0.18.0');
assert.strictEqual(core.PACK_FORMAT, 'axm-material-capability-pack');
assert.strictEqual(core.FEEDBACK_FORMAT, 'axm-material-use-feedback');
assert.strictEqual(core.LEDGER_FORMAT, 'axm-material-use-ledger');

const library = libraryCore.createLibrary('2026-09-12T00:00:00Z');
libraryCore.upsertEntries(library, [{
  id:'texture-rust-test', name:'Rust Test', kind:'texture', mime:'image/png', width:2, height:2,
  dataUrl:'data:image/png;base64,iVBORw0KGgo=',
  source:{method:'synthetic-test'}, usage:{channelHint:'base-color',channelBasis:'operator-declared'}, tags:['rust','test']
}], '2026-09-12T00:00:01Z');
libraryCore.createFamily(library, { id:'family-rust-test', name:'Rust Family', entryIds:[library.entries[0].id], tags:['test'] }, '2026-09-12T00:00:02Z');

const rgba = new Uint8Array(8 * 8 * 4);
for (let y=2;y<5;y+=1) for (let x=1;x<4;x+=1) { const i=(y*8+x)*4; rgba[i]=200; rgba[i+1]=80; rgba[i+2]=20; rgba[i+3]=255; }
const candidates = spriteCore.extractCandidates(rgba, 8, 8, 'atlas-test', { alphaThreshold:128, minComponentPixels:1, minSpritePixels:1, mergeGap:0, padding:0 });
assert.strictEqual(candidates.length, 1);
const spriteIndex = spriteCore.makeIndex({
  pack:{format:pack.format,version:pack.version,archiveSha256:pack.binaryPack.sha256},
  atlas:{id:'atlas-test',kind:'overlay-atlas',category:'overlays/test',file:'atlas-test.webp',tags:['test']},
  width:8,height:8,sourceBasis:'synthetic-test',sourceSha256:'sha256:test',
  extraction:candidates[0].extraction,candidates
});
assert.strictEqual(spriteCore.validateIndex(spriteIndex).ok, true);

function recipe(name, seed, extraAsset) {
  const r = composer.createRecipe(name, seed);
  r.layers.push(composer.normalizeLayer({ id:`${name}-base`, assetId:'material-globes', cell:{row:0,column:0}, blendMode:'normal', opacity:1, transform:{x:.5,y:.5,width:.75,height:.75,rotation:0} },0,pack));
  r.layers.push(composer.normalizeLayer({ id:`${name}-extra`, assetId:extraAsset || 'rust-corrosion', crop:{x:0,y:0,width:.25,height:.25}, blendMode:'overlay', opacity:.5, transform:{x:.5,y:.5,width:.5,height:.5,rotation:0} },1,pack));
  return r;
}
const recipeA = recipe('cap-a','cap-a','rust-corrosion');
const recipeB = JSON.parse(JSON.stringify(recipeA));
recipeB.id='cap-b'; recipeB.seed='cap-b'; recipeB.layers[1].opacity=.49;
const keeperPack = {
  format:'axm-premade-recipe-pack', version:'0.13.0', id:'cap-keepers',
  pack:{format:pack.format,version:pack.version,archiveSha256:pack.binaryPack.sha256},
  recipes:[recipeA,recipeB].map((r,index)=>({candidateId:`candidate-${index}`,technicalScore:80+index,recipeFingerprint:composer.recipeFingerprint(r,pack),recipe:r}))
};
const patternLibrary = patterns.learnPatternLibrary([keeperPack], pack, 'capability patterns');
assert.strictEqual(patterns.validateLibrary(patternLibrary).ok, true);

const capabilityPack = core.createCapabilityPack([library, spriteIndex, recipeA, patternLibrary], pack, { name:'test capabilities' });
assert.strictEqual(core.validateCapabilityPack(capabilityPack).ok, true);
assert.ok(capabilityPack.capabilities.some((item)=>item.kind==='material-entry'));
assert.ok(capabilityPack.capabilities.some((item)=>item.kind==='material-family'));
assert.ok(capabilityPack.capabilities.some((item)=>item.kind==='sprite-candidate'));
assert.ok(capabilityPack.capabilities.some((item)=>item.kind==='recipe'));
assert.ok(capabilityPack.capabilities.some((item)=>item.kind==='pattern'));
assert.match(JSON.stringify(capabilityPack.truthBoundary), /does not prove that any downstream machine consumed/);

const materialCap = capabilityPack.capabilities.find((item)=>item.kind==='material-entry');
const recipeCap = capabilityPack.capabilities.find((item)=>item.kind==='recipe');
const spriteCap = capabilityPack.capabilities.find((item)=>item.kind==='sprite-candidate');
const feedback = core.createUseFeedback(capabilityPack, {
  system:'AXM Universal Creation', repository:'mike-axiom-mir/axm-universal-creation', adapter:'material-capability-v0.18-test'
}, [
  { capabilityId:materialCap.id, action:'adopted', outcome:'PASS', evidence:{consumerAssetId:'asset-001'}, derivedIds:['asset-001'] },
  { capabilityId:materialCap.id, action:'reused', outcome:'PASS', evidence:{consumerAssetId:'asset-002'}, derivedIds:['asset-002'] },
  { capabilityId:recipeCap.id, action:'rendered', outcome:'PASS', evidence:{frameHash:'abc123'} },
  { capabilityId:spriteCap.id, action:'rejected', outcome:'REJECT', evidence:{reason:'not-needed-for-test'} }
]);
assert.strictEqual(core.validateUseFeedback(feedback, capabilityPack).ok, true);
assert.strictEqual(feedback.events.length, 4);
assert.match(JSON.stringify(feedback.truthBoundary), /not automatic authority/);

const ledger = core.createUsageLedger('test ledger');
const applied = core.applyUseFeedback(ledger, feedback, capabilityPack);
assert.strictEqual(applied.applied, true);
const summary = core.usageSummary(applied.ledger);
assert.strictEqual(summary.feedbackReceipts, 1);
assert.strictEqual(summary.totalEvents, 4);
assert.strictEqual(summary.adoptedEvents, 1);
assert.strictEqual(summary.reusedEvents, 1);
assert.strictEqual(summary.rejectedEvents, 1);
assert.strictEqual(applied.ledger.capabilities[materialCap.id].adopted, 1);
assert.strictEqual(applied.ledger.capabilities[materialCap.id].reused, 1);
assert.strictEqual(applied.ledger.capabilities[materialCap.id].consumers.length, 1);

const duplicate = core.applyUseFeedback(applied.ledger, feedback, capabilityPack);
assert.strictEqual(duplicate.applied, false);
assert.strictEqual(duplicate.duplicate, true);
assert.strictEqual(core.usageSummary(duplicate.ledger).totalEvents, 4, 'duplicate feedback must not inflate use evidence');

assert.throws(()=>core.createUseFeedback(capabilityPack,{system:'bad'},[{capabilityId:'unknown',action:'adopted',outcome:'PASS'}]),/unknown capability/);
const tampered = JSON.parse(JSON.stringify(capabilityPack));
tampered.capabilities[0].payload.tampered = true;
assert.strictEqual(core.validateCapabilityPack(tampered).ok, false, 'tampering must invalidate capability identity/fingerprint');
assert.match(core.usageSummary(applied.ledger).boundary,/not an aesthetic ranking/);

console.log('AXM material capability exchange core tests: PASS');
