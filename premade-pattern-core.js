(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports ? require('./premade-composer-core.js') : root.AXMPremadeComposerCore
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMPremadePatternCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (composer) {
  'use strict';

  if (!composer) throw new Error('Premade Pattern Core requires Premade Composer Core.');

  const VERSION = '0.15.0';
  const LIBRARY_FORMAT = 'axm-premade-pattern-library';
  const INSTANCE_FORMAT = 'axm-premade-pattern-instance-receipt';
  const SOURCE_PACK_FORMAT = 'axm-premade-recipe-pack';
  const SOURCE_PACK_VERSION = '0.13.0';

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : min;
    return Math.max(min, Math.min(max, safe));
  }
  function stableStringify(value) { return composer.stableStringify(value); }
  function fnv1a(text) { return composer.fnv1a(text); }
  function xorshift(seed) { return composer.xorshift(seed); }
  function rounded(value, digits) {
    const scale = 10 ** (digits == null ? 6 : digits);
    return Math.round(value * scale) / scale;
  }
  function pick(list, rand) {
    if (!list.length) throw new Error('Cannot pick from an empty list.');
    return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  }
  function quantize(value, step, min, max) {
    const n = clamp(value, min, max);
    return rounded(Math.round(n / step) * step, 4);
  }
  function categoryRoot(category) {
    const parts = String(category || 'unknown').split('/');
    return parts.slice(0, Math.min(parts.length, 2)).join('/');
  }
  function sourceType(layer) {
    if (layer && layer.spriteCandidate) return 'sprite-candidate';
    if (layer && layer.cell) return 'globe-cell';
    return 'atlas-window';
  }
  function transformBands(transform) {
    const t = transform || {};
    return {
      x: quantize(t.x == null ? 0.5 : t.x, 0.1, -1, 2),
      y: quantize(t.y == null ? 0.5 : t.y, 0.1, -1, 2),
      width: quantize(t.width == null ? 0.75 : t.width, 0.1, 0.05, 3),
      height: quantize(t.height == null ? 0.75 : t.height, 0.1, 0.05, 3),
      rotation: quantize(t.rotation || 0, 15, -360, 360),
      mirrorX: Boolean(t.mirrorX),
      mirrorY: Boolean(t.mirrorY)
    };
  }
  function layerDescriptor(layer, pack, index) {
    const asset = composer.byId(pack, layer.assetId);
    if (!asset) throw new TypeError(`Unknown premade asset: ${layer.assetId}`);
    return {
      order:index,
      role:index === 0 && asset.kind === 'globe-atlas' ? 'base' : 'layer',
      kind:asset.kind,
      category:categoryRoot(asset.category),
      sourceType:sourceType(layer),
      blendMode:layer.blendMode || 'normal',
      opacity:quantize(layer.opacity == null ? 1 : layer.opacity,0.1,0,1),
      transform:transformBands(layer.transform),
      tags:clone(asset.tags || [])
    };
  }
  function recipeSkeleton(recipe, pack) {
    const validation = composer.validateRecipe(recipe, pack);
    if (!validation.ok) throw new TypeError(validation.reason);
    const visible = recipe.layers.filter((layer)=>layer.visible !== false);
    const layers = visible.map((layer,index)=>layerDescriptor(layer,pack,index));
    return { transparent:recipe.canvas && recipe.canvas.transparent === true, layerCount:layers.length, layers };
  }
  function skeletonSignature(skeleton) { return fnv1a(stableStringify(skeleton)); }

  function validateRecipePack(packFile, pack) {
    if (!packFile || packFile.format !== SOURCE_PACK_FORMAT || packFile.version !== SOURCE_PACK_VERSION) return {ok:false,reason:`Expected ${SOURCE_PACK_FORMAT}/${SOURCE_PACK_VERSION}.`};
    if (!Array.isArray(packFile.recipes)) return {ok:false,reason:'recipe pack recipes must be an array.'};
    for (const row of packFile.recipes) {
      const validation = composer.validateRecipe(row && row.recipe, pack);
      if (!validation.ok) return {ok:false,reason:`Invalid kept recipe: ${validation.reason}`};
      if (!row.recipe.canvas || row.recipe.canvas.transparent !== true) return {ok:false,reason:'Kept recipes must preserve transparent:true.'};
    }
    return {ok:true};
  }

  function observationForRow(row, sourcePackId, pack) {
    const recipe = row.recipe;
    return {
      sourcePackId,
      candidateId:row.candidateId || null,
      recipeFingerprint:row.recipeFingerprint || composer.recipeFingerprint(recipe,pack),
      technicalScore:Number.isFinite(Number(row.technicalScore)) ? Number(row.technicalScore) : null,
      skeleton:recipeSkeleton(recipe,pack),
      recipe:clone(recipe)
    };
  }
  function numberRange(values, fallback) {
    const list=values.map(Number).filter(Number.isFinite);
    if (!list.length) return {min:fallback,max:fallback,mean:fallback};
    return {min:Math.min(...list),max:Math.max(...list),mean:rounded(list.reduce((a,b)=>a+b,0)/list.length,4)};
  }
  function collectSlot(group, index, pack) {
    const layers=group.map((obs)=>obs.recipe.layers.filter((layer)=>layer.visible !== false)[index]).filter(Boolean);
    const assets=layers.map((layer)=>composer.byId(pack,layer.assetId)).filter(Boolean);
    const dominant=assets[0] || null;
    const observedAssetIds=Array.from(new Set(layers.map((layer)=>layer.assetId))).sort();
    const spriteExamples=[];
    layers.forEach((layer)=>{
      if (!layer.spriteCandidate) return;
      const key=stableStringify({assetId:layer.assetId,spriteCandidate:layer.spriteCandidate});
      if (!spriteExamples.some((item)=>item.key===key)) spriteExamples.push({key,assetId:layer.assetId,spriteCandidate:clone(layer.spriteCandidate)});
    });
    const blendModeCounts={};
    const sourceTypeCounts={};
    layers.forEach((layer)=>{
      blendModeCounts[layer.blendMode || 'normal']=(blendModeCounts[layer.blendMode || 'normal']||0)+1;
      const type=sourceType(layer); sourceTypeCounts[type]=(sourceTypeCounts[type]||0)+1;
    });
    const transforms=layers.map((layer)=>layer.transform||{});
    return {
      order:index,
      role:index===0 && dominant && dominant.kind==='globe-atlas' ? 'base' : 'layer',
      kind:dominant ? dominant.kind : null,
      category:dominant ? categoryRoot(dominant.category) : null,
      observedAssetIds,
      sourceTypeCounts,
      blendModeCounts,
      opacity:numberRange(layers.map((layer)=>layer.opacity),1),
      transform:{
        x:numberRange(transforms.map((t)=>t.x),0.5),
        y:numberRange(transforms.map((t)=>t.y),0.5),
        width:numberRange(transforms.map((t)=>t.width),0.75),
        height:numberRange(transforms.map((t)=>t.height),0.75),
        rotation:numberRange(transforms.map((t)=>t.rotation),0)
      },
      spriteExamples:spriteExamples.map(({key,...item})=>item)
    };
  }
  function buildPattern(group, signature, pack) {
    const scores=group.map((obs)=>obs.technicalScore).filter(Number.isFinite);
    const layerCount=group[0].skeleton.layerCount;
    return {
      id:`pattern-${signature}`,
      signature,
      support:group.length,
      sourcePackIds:Array.from(new Set(group.map((obs)=>obs.sourcePackId))).sort(),
      sourceRecipeFingerprints:Array.from(new Set(group.map((obs)=>obs.recipeFingerprint))).sort(),
      technicalScore:scores.length ? numberRange(scores,0) : null,
      slots:Array.from({length:layerCount},(_,index)=>collectSlot(group,index,pack)),
      exampleRecipe:clone(group[0].recipe),
      truthBoundary:{
        meaning:'Pattern summarizes recurring explicit kept recipe structure. It does not infer artistic intent or quality.',
        support:'Support count is recurrence among imported keeper recipes, not a universal preference signal.',
        sources:'Observed asset IDs and sprite candidates remain provenance examples, not semantic ontology.'
      }
    };
  }

  function learnPatternLibrary(recipePacks, pack, name) {
    const inputs=Array.isArray(recipePacks)?recipePacks:[recipePacks];
    if (!inputs.length) throw new TypeError('At least one v0.13 keeper recipe pack is required.');
    const observations=[];
    inputs.forEach((source,index)=>{
      const validation=validateRecipePack(source,pack);
      if (!validation.ok) throw new TypeError(validation.reason);
      const sourcePackId=source.id || `source-pack-${index+1}`;
      source.recipes.forEach((row)=>observations.push(observationForRow(row,sourcePackId,pack)));
    });
    const groups=new Map();
    observations.forEach((obs)=>{
      const signature=skeletonSignature(obs.skeleton);
      if (!groups.has(signature)) groups.set(signature,[]);
      groups.get(signature).push(obs);
    });
    const patterns=Array.from(groups.entries()).map(([signature,group])=>buildPattern(group,signature,pack));
    patterns.sort((a,b)=>b.support-a.support || String(a.id).localeCompare(String(b.id)));
    const sourcePackIds=Array.from(new Set(inputs.map((source,index)=>source.id || `source-pack-${index+1}`))).sort();
    const identity={sourcePackIds,patterns:patterns.map((pattern)=>({id:pattern.id,support:pattern.support}))};
    return {
      format:LIBRARY_FORMAT,
      version:VERSION,
      id:`premade-pattern-library-${fnv1a(stableStringify(identity))}`,
      name:String(name || 'Premade Recipe Pattern Library'),
      sourcePackIds,
      pack:{format:pack.format,version:pack.version,archiveSha256:pack.binaryPack && pack.binaryPack.sha256 || null},
      patterns,
      summary:{keeperRecipes:observations.length,patterns:patterns.length,repeatedPatterns:patterns.filter((p)=>p.support>1).length},
      truthBoundary:{
        curation:'Only recipes already explicitly kept in imported v0.13 recipe packs contribute observations.',
        learning:'Learning means deterministic structural aggregation/counting over explicit keeper state; there is no hidden model training or taste inference.',
        scoring:'Technical scores remain bounded diagnostics and are not artistic authority.',
        agency:'Pattern creation and later instantiation never auto-promote generated recipes.',
        alpha:'Instantiated recipes retain transparent:true.'
      }
    };
  }
  function validateLibrary(library) {
    if (!library || library.format!==LIBRARY_FORMAT || library.version!==VERSION) return {ok:false,reason:`Expected ${LIBRARY_FORMAT}/${VERSION}.`};
    if (!Array.isArray(library.patterns)) return {ok:false,reason:'patterns must be an array.'};
    const ids=new Set();
    for (const pattern of library.patterns) {
      if (!pattern.id || ids.has(pattern.id)) return {ok:false,reason:'pattern ids must be present and unique.'};
      ids.add(pattern.id);
      if (!Array.isArray(pattern.slots) || !pattern.slots.length) return {ok:false,reason:`${pattern.id} has no slots.`};
      if (!Number.isInteger(pattern.support) || pattern.support<1) return {ok:false,reason:`${pattern.id} support must be >= 1.`};
    }
    return {ok:true};
  }

  function weightedChoice(counts,rand,fallback) {
    const entries=Object.entries(counts||{}).filter(([,count])=>Number(count)>0).sort(([a],[b])=>a.localeCompare(b));
    if (!entries.length) return fallback;
    const total=entries.reduce((sum,[,count])=>sum+Number(count),0);
    let target=rand()*total;
    for (const [value,count] of entries) { target-=Number(count); if (target<=0) return value; }
    return entries[entries.length-1][0];
  }
  function sampleRange(range,rand,fallback) {
    if (!range) return fallback;
    const min=Number.isFinite(Number(range.min))?Number(range.min):fallback;
    const max=Number.isFinite(Number(range.max))?Number(range.max):min;
    return max<=min ? min : rounded(min+rand()*(max-min),6);
  }
  function matchingAssets(slot,pack) {
    let list=(pack.assets||[]).filter((asset)=>asset.kind===slot.kind);
    const exact=list.filter((asset)=>categoryRoot(asset.category)===slot.category);
    if (exact.length) list=exact;
    const observed=list.filter((asset)=>(slot.observedAssetIds||[]).includes(asset.id));
    return observed.length ? observed : list;
  }
  function instantiateSlot(slot,pack,rand,index,policy) {
    const choices=matchingAssets(slot,pack);
    if (!choices.length) throw new Error(`No asset can satisfy pattern slot ${index}.`);
    const asset=pick(choices,rand);
    const raw={
      id:`pattern-layer-${index+1}`,
      name:`pattern ${slot.role} ${index+1}`,
      assetId:asset.id,
      visible:true,
      blendMode:weightedChoice(slot.blendModeCounts,rand,asset.kind==='fx-atlas'?'screen':'normal'),
      opacity:clamp(sampleRange(slot.opacity,rand,1),0,1),
      transform:{
        x:sampleRange(slot.transform&&slot.transform.x,rand,0.5),
        y:sampleRange(slot.transform&&slot.transform.y,rand,0.5),
        width:sampleRange(slot.transform&&slot.transform.width,rand,0.75),
        height:sampleRange(slot.transform&&slot.transform.height,rand,0.75),
        rotation:sampleRange(slot.transform&&slot.transform.rotation,rand,0),
        mirrorX:false,mirrorY:false
      },
      provenance:{rule:'v0.15-pattern-instantiation',patternSlot:index,semanticIntentClaim:false}
    };
    if (asset.grid) raw.cell={row:Math.floor(rand()*asset.grid.rows),column:Math.floor(rand()*asset.grid.columns)};
    else {
      const preferSprite=weightedChoice(slot.sourceTypeCounts,rand,'atlas-window')==='sprite-candidate';
      const sprites=(slot.spriteExamples||[]).filter((item)=>item.assetId===asset.id);
      if (preferSprite && sprites.length && policy.reuseObservedSprites!==false) raw.spriteCandidate=clone(pick(sprites,rand).spriteCandidate);
      else raw.crop=composer.coarseWindow(asset,rand);
    }
    return composer.normalizeLayer(raw,index,pack);
  }
  function instantiatePattern(library,patternId,pack,seed,rawPolicy) {
    const validation=validateLibrary(library);
    if (!validation.ok) throw new TypeError(validation.reason);
    const pattern=library.patterns.find((item)=>item.id===patternId);
    if (!pattern) throw new TypeError(`Unknown pattern: ${patternId}`);
    const policy=Object.assign({reuseObservedSprites:true},rawPolicy||{});
    const seedText=String(seed==null?pattern.id:seed);
    const rand=xorshift(`${library.id}|${pattern.id}|${seedText}`);
    const recipe=composer.createRecipe(`pattern ${pattern.id}`,`pattern:${seedText}`);
    recipe.id=`premade-pattern-${fnv1a(`${library.id}|${pattern.id}|${seedText}`)}`;
    recipe.patternLineage={libraryId:library.id,patternId:pattern.id,support:pattern.support,seed:seedText,sourcePackIds:clone(pattern.sourcePackIds)};
    recipe.layers=pattern.slots.map((slot,index)=>instantiateSlot(slot,pack,rand,index,policy));
    recipe.canvas.transparent=true;
    recipe.truthBoundary.pattern='v0.15 pattern instantiation reuses deterministic structure aggregated from explicit keeper recipes; it does not infer artistic intent or quality.';
    const fingerprint=composer.recipeFingerprint(recipe,pack);
    return {
      format:INSTANCE_FORMAT,
      version:VERSION,
      id:`pattern-instance-${fnv1a(`${pattern.id}|${seedText}|${fingerprint}`)}`,
      libraryId:library.id,
      patternId:pattern.id,
      patternSupport:pattern.support,
      seed:seedText,
      recipeFingerprint:fingerprint,
      recipe:clone(recipe),
      truthBoundary:{
        alpha:'transparent:true is retained.',
        source:'Structure comes from explicit kept recipes and locked premade pack state.',
        aesthetics:'Instantiation is not an aesthetic recommendation or quality proof.',
        authority:'The resulting recipe is a proposal and is not automatically kept or promoted.'
      }
    };
  }
  function librarySummary(library) {
    const validation=validateLibrary(library);
    if (!validation.ok) throw new TypeError(validation.reason);
    return {
      id:library.id,
      keeperRecipes:library.summary&&library.summary.keeperRecipes||0,
      patterns:library.patterns.length,
      repeatedPatterns:library.patterns.filter((p)=>p.support>1).length,
      maxSupport:library.patterns.reduce((m,p)=>Math.max(m,p.support),0),
      patternRows:library.patterns.map((p)=>({id:p.id,support:p.support,layers:p.slots.length,sourcePackIds:p.sourcePackIds}))
    };
  }

  return {
    VERSION,LIBRARY_FORMAT,INSTANCE_FORMAT,SOURCE_PACK_FORMAT,SOURCE_PACK_VERSION,
    clone,clamp,stableStringify,fnv1a,xorshift,quantize,categoryRoot,sourceType,transformBands,
    layerDescriptor,recipeSkeleton,skeletonSignature,validateRecipePack,learnPatternLibrary,validateLibrary,
    weightedChoice,sampleRange,matchingAssets,instantiatePattern,librarySummary
  };
});