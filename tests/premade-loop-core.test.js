'use strict';
const assert=require('assert');
const pack=require('../premade-pack.js');
const composer=require('../premade-composer-core.js');
const evolution=require('../premade-evolution-core.js');
const patterns=require('../premade-pattern-core.js');
const guide=require('../premade-guide-core.js');
const loop=require('../premade-loop-core.js');

function keeper(seed,score,base,layers){
  const recipe=composer.seededRecipe(seed,pack,{basePool:base||'weathered',overlayCount:layers==null?3:layers,includeFx:true,includeDecals:true});
  return {candidateId:`candidate-${seed}`,technicalScore:score,recipeFingerprint:composer.recipeFingerprint(recipe,pack),recipe};
}
const rowA=keeper('loop-a',84,'weathered',3);
const rowB=JSON.parse(JSON.stringify(rowA)); rowB.candidateId='candidate-loop-b'; rowB.recipe.id='loop-b-recipe'; rowB.recipe.seed='loop-b'; rowB.recipe.layers[1].opacity=Math.min(1,rowB.recipe.layers[1].opacity+.02); rowB.recipeFingerprint=composer.recipeFingerprint(rowB.recipe,pack);
const rowC=keeper('loop-c',73,'material',5);
const sourcePack={format:'axm-premade-recipe-pack',version:'0.13.0',id:'loop-source-pack',pack:{format:pack.format,version:pack.version,archiveSha256:pack.binaryPack.sha256},recipes:[rowA,rowB,rowC]};
const library=patterns.learnPatternLibrary([sourcePack],pack,'loop source patterns');
assert.strictEqual(patterns.validateLibrary(library).ok,true);
assert.ok(library.patterns.length>=2,'fixture should expose at least two patterns');

const anchor=library.patterns[0].id;
const donor=library.patterns[1].id;
const guided=guide.composeGuided(library,anchor,[donor],pack,'guided-loop-seed',{maxLayers:7,anchorExtras:2,allowFx:true,allowDecals:true,reuseObservedSprites:true});
assert.strictEqual(guide.validateReceipt(guided,pack).ok,true);
assert.strictEqual(guided.recipe.canvas.transparent,true);

assert.strictEqual(loop.VERSION,'0.17.0');
assert.strictEqual(loop.LOOP_FORMAT,'axm-premade-closed-loop-session');
const sessionA=loop.createLoopSession(guided,pack,'loop-seed',{variants:4,strength:'medium',lockBase:true});
const sessionB=loop.createLoopSession(guided,pack,'loop-seed',{variants:4,strength:'medium',lockBase:true});
assert.deepStrictEqual(sessionA,sessionB,'same guided source + seed + policy must reproduce the same loop state');
assert.strictEqual(loop.validateLoopSession(sessionA,pack).ok,true);
assert.strictEqual(sessionA.evolution.candidates.length,4);
assert.ok(sessionA.evolution.candidates.every((row)=>row.recipe.canvas.transparent===true));
assert.ok(sessionA.evolution.candidates.every((row)=>row.kept===false),'ranking must not auto-keep descendants');
assert.strictEqual(sessionA.state,'EVOLVED_AWAITING_KEEPERS');
assert.throws(()=>loop.commitKeepersToMemory(sessionA,library,pack),/explicitly kept/,'memory commit must fail without an explicit keeper');

const pixels=new Uint8Array(4*4*4); for(let i=0;i<16;i+=1){pixels[i*4]=120;pixels[i*4+1]=150;pixels[i*4+2]=180;pixels[i*4+3]=220;}
const observation=evolution.summarizePixels(pixels,4,4);
const first=sessionA.evolution.candidates[0];
loop.attachRenderObservation(sessionA,first.id,observation,0,true);
assert.strictEqual(sessionA.evolution.candidates.find((row)=>row.id===first.id).render.completed,true);

const chosen=sessionA.evolution.candidates.slice(0,2).map((row)=>row.id);
chosen.forEach((id)=>loop.decideKeeper(sessionA,id,true,'test-explicit-choice'));
assert.strictEqual(sessionA.state,'KEEPERS_SELECTED');
assert.strictEqual(sessionA.keeperDecisions.filter((row)=>row.keep).length,2);
assert.strictEqual(sessionA.evolution.candidates.filter((row)=>row.kept).length,2);
assert.ok(sessionA.keeperDecisions.every((row)=>row.decisionType==='explicit'));

const keeperPack=loop.keeperPack(sessionA,'loop explicit keepers');
assert.strictEqual(keeperPack.recipes.length,2);
assert.strictEqual(keeperPack.loopLineage.loopSessionId,sessionA.id);
assert.match(JSON.stringify(keeperPack.truthBoundary),/explicitly kept/);

const beforeCount=library.summary.keeperRecipes;
const memory=loop.commitKeepersToMemory(sessionA,library,pack,'loop explicit keepers');
assert.strictEqual(loop.validateMemoryReceipt(memory).ok,true);
assert.strictEqual(memory.keeperCount,2);
assert.strictEqual(memory.previousLibraryId,library.id);
assert.notStrictEqual(memory.updatedLibraryId,library.id);
assert.strictEqual(memory.updatedLibrary.summary.keeperRecipes,beforeCount+2);
assert.strictEqual(patterns.validateLibrary(memory.updatedLibrary).ok,true);
assert.ok(memory.patternDeltas.length>=1);
assert.strictEqual(sessionA.state,'MEMORY_COMMITTED');
assert.strictEqual(sessionA.memoryUpdate.id,memory.id);
assert.throws(()=>loop.commitKeepersToMemory(sessionA,memory.updatedLibrary,pack),/already has a memory update/);

const summary=loop.loopSummary(sessionA);
assert.strictEqual(summary.variants,4);
assert.strictEqual(summary.keepers,2);
assert.strictEqual(summary.memoryCommitted,true);
assert.strictEqual(summary.updatedLibraryId,memory.updatedLibrary.id);
assert.match(JSON.stringify(sessionA.truthBoundary),/No candidate becomes a keeper without an explicit keeper decision/);
assert.match(JSON.stringify(memory.truthBoundary),/explicit memory-commit action/);

const unkept=loop.createLoopSession(guided,pack,'unkeep-proof',{variants:2,strength:'low'});
const id=unkept.evolution.candidates[0].id;
loop.decideKeeper(unkept,id,true,'test');
loop.decideKeeper(unkept,id,false,'test');
assert.strictEqual(unkept.evolution.candidates.find((row)=>row.id===id).kept,false);
assert.strictEqual(unkept.state,'EVOLVED_AWAITING_KEEPERS');

console.log('AXM premade closed-loop v0.17 tests: PASS');