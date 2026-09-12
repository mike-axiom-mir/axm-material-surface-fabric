(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports ? require('./premade-composer-core.js') : root.AXMPremadeComposerCore
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMPremadeEvolutionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (composer) {
  'use strict';

  if (!composer) throw new Error('Premade Evolution Core requires Premade Composer Core.');

  const VERSION = '0.13.0';
  const SESSION_FORMAT = 'axm-premade-evolution-session';
  const PACK_FORMAT = 'axm-premade-recipe-pack';
  const STRENGTHS = ['low', 'medium', 'high'];
  const STRENGTH = {
    low: { opacity: 0.08, move: 0.04, size: 0.06, rotate: 6, swapChance: 0.08, cropChance: 0.25, blendChance: 0.08, baseChance: 0.02, addDropChance: 0.02 },
    medium: { opacity: 0.18, move: 0.10, size: 0.16, rotate: 18, swapChance: 0.24, cropChance: 0.55, blendChance: 0.22, baseChance: 0.10, addDropChance: 0.10 },
    high: { opacity: 0.34, move: 0.20, size: 0.30, rotate: 42, swapChance: 0.48, cropChance: 0.82, blendChance: 0.42, baseChance: 0.28, addDropChance: 0.20 }
  };

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) {
    const number = Number(value);
    const safe = Number.isFinite(number) ? number : min;
    return Math.max(min, Math.min(max, safe));
  }
  function stableStringify(value) { return composer.stableStringify(value); }
  function fnv1a(text) { return composer.fnv1a(text); }
  function xorshift(seed) { return composer.xorshift(seed); }
  function pick(list, rand) {
    if (!list.length) throw new Error('Cannot pick from empty list.');
    return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  }
  function signed(rand, amount) { return (rand() * 2 - 1) * amount; }
  function rounded(value, digits) {
    const scale = 10 ** (digits == null ? 6 : digits);
    return Math.round(value * scale) / scale;
  }
  function normalizedStrength(value) {
    const name = String(value || 'medium').toLowerCase();
    return STRENGTHS.includes(name) ? name : 'medium';
  }
  function normalizePolicy(raw) {
    const source = raw || {};
    return {
      strength: normalizedStrength(source.strength),
      variants: Math.max(1, Math.min(32, Math.round(Number(source.variants) || 8))),
      lockBase: source.lockBase !== false,
      allowFx: source.allowFx !== false,
      allowDecals: source.allowDecals !== false,
      allowLayerCountChange: source.allowLayerCountChange !== false,
      maxExtraLayers: Math.max(0, Math.min(8, Math.round(Number(source.maxExtraLayers) || 8)))
    };
  }
  function packIdentity(pack) {
    return {
      format: pack && pack.format || null,
      version: pack && pack.version || null,
      archiveSha256: pack && pack.binaryPack && pack.binaryPack.sha256 || null
    };
  }
  function eligibleAssets(pack, policy) {
    return (pack.assets || []).filter((asset) => {
      if (asset.kind === 'overlay-atlas') return true;
      if (asset.kind === 'fx-atlas') return policy.allowFx;
      if (asset.kind === 'decal-atlas') return policy.allowDecals;
      return false;
    });
  }
  function compatibleAssets(pack, current, policy) {
    const list = eligibleAssets(pack, policy);
    if (!current) return list;
    const sameKind = list.filter((asset) => asset.kind === current.kind);
    return sameKind.length ? sameKind : list;
  }
  function globeAssets(pack) { return (pack.assets || []).filter((asset) => asset.kind === 'globe-atlas' && asset.grid); }
  function recipeFingerprint(recipe, pack) { return composer.recipeFingerprint(recipe, pack); }

  function mutateGlobeLayer(layer, pack, rand, mutations, strength, lockBase) {
    if (lockBase || rand() >= strength.baseChance) return layer;
    const globes = globeAssets(pack);
    if (!globes.length) return layer;
    const asset = pick(globes, rand);
    const before = { assetId: layer.assetId, cell: clone(layer.cell) };
    layer.assetId = asset.id;
    layer.cell = { row: Math.floor(rand() * asset.grid.rows), column: Math.floor(rand() * asset.grid.columns) };
    layer.crop = null;
    layer.name = `${asset.id} ${layer.cell.row}:${layer.cell.column}`;
    mutations.push({ type: 'base-globe-swap', layerId: layer.id, before, after: { assetId: layer.assetId, cell: clone(layer.cell) } });
    return layer;
  }

  function mutateLayer(layer, pack, rand, mutations, strength, policy, index) {
    const currentAsset = composer.byId(pack, layer.assetId);
    if (!currentAsset) return layer;

    if (rand() < strength.swapChance) {
      const choices = compatibleAssets(pack, currentAsset, policy);
      if (choices.length) {
        const replacement = pick(choices, rand);
        if (replacement.id !== layer.assetId) {
          const before = layer.assetId;
          layer.assetId = replacement.id;
          layer.name = replacement.id;
          if (replacement.grid) {
            layer.cell = { row: Math.floor(rand() * replacement.grid.rows), column: Math.floor(rand() * replacement.grid.columns) };
            layer.crop = null;
          } else {
            layer.cell = null;
            layer.crop = composer.coarseWindow(replacement, rand);
          }
          mutations.push({ type: 'asset-swap', layerId: layer.id, before, after: layer.assetId });
        }
      }
    }

    const asset = composer.byId(pack, layer.assetId);
    if (!asset) return layer;

    const beforeOpacity = layer.opacity;
    layer.opacity = rounded(clamp(layer.opacity + signed(rand, strength.opacity), 0.03, 1));
    if (layer.opacity !== beforeOpacity) mutations.push({ type: 'opacity', layerId: layer.id, before: beforeOpacity, after: layer.opacity });

    const t = layer.transform || {};
    const beforeTransform = clone(t);
    t.x = rounded(clamp((t.x == null ? 0.5 : t.x) + signed(rand, strength.move), -0.5, 1.5));
    t.y = rounded(clamp((t.y == null ? 0.5 : t.y) + signed(rand, strength.move), -0.5, 1.5));
    t.width = rounded(clamp((t.width == null ? 0.75 : t.width) * (1 + signed(rand, strength.size)), 0.08, 2.2));
    t.height = rounded(clamp((t.height == null ? 0.75 : t.height) * (1 + signed(rand, strength.size)), 0.08, 2.2));
    t.rotation = rounded(clamp((t.rotation || 0) + signed(rand, strength.rotate), -360, 360));
    if (rand() < 0.06 + index * 0.005) t.mirrorX = !Boolean(t.mirrorX);
    if (rand() < 0.03) t.mirrorY = !Boolean(t.mirrorY);
    layer.transform = t;
    if (stableStringify(beforeTransform) !== stableStringify(t)) mutations.push({ type: 'transform', layerId: layer.id, before: beforeTransform, after: clone(t) });

    if (!asset.grid && layer.crop && rand() < strength.cropChance) {
      const before = clone(layer.crop);
      const grid = asset.kind === 'fx-atlas' ? 6 : 4;
      const row = Math.floor(rand() * grid);
      const column = Math.floor(rand() * grid);
      layer.crop = { x: column / grid, y: row / grid, width: 1 / grid, height: 1 / grid, samplingGrid: `${grid}x${grid}` };
      if (stableStringify(before) !== stableStringify(layer.crop)) mutations.push({ type: 'crop-window', layerId: layer.id, before, after: clone(layer.crop) });
    }

    if (rand() < strength.blendChance) {
      const before = layer.blendMode;
      const choices = asset.kind === 'fx-atlas' ? ['screen', 'lighter', 'overlay'] : asset.kind === 'decal-atlas' ? ['normal', 'overlay', 'multiply'] : ['overlay', 'multiply', 'soft-light', 'screen'];
      layer.blendMode = pick(choices, rand);
      if (before !== layer.blendMode) mutations.push({ type: 'blend-mode', layerId: layer.id, before, after: layer.blendMode });
    }

    return layer;
  }

  function maybeChangeLayerCount(recipe, pack, rand, mutations, strength, policy) {
    if (!policy.allowLayerCountChange || rand() >= strength.addDropChance) return;
    const extraCount = Math.max(0, recipe.layers.length - 1);
    const candidates = eligibleAssets(pack, policy);
    if (extraCount > 1 && rand() < 0.45) {
      const index = 1 + Math.floor(rand() * (recipe.layers.length - 1));
      const [removed] = recipe.layers.splice(index, 1);
      mutations.push({ type: 'drop-layer', layerId: removed.id, assetId: removed.assetId });
      return;
    }
    if (extraCount >= policy.maxExtraLayers || !candidates.length) return;
    const asset = pick(candidates, rand);
    const crop = asset.grid ? null : composer.coarseWindow(asset, rand);
    const raw = {
      id: `evo-added-${recipe.layers.length}-${fnv1a(`${recipe.seed}|${asset.id}|${rand()}`)}`,
      name: asset.id,
      assetId: asset.id,
      crop,
      cell: asset.grid ? { row: Math.floor(rand() * asset.grid.rows), column: Math.floor(rand() * asset.grid.columns) } : null,
      blendMode: asset.kind === 'fx-atlas' ? 'screen' : asset.kind === 'decal-atlas' ? 'normal' : 'overlay',
      opacity: asset.kind === 'fx-atlas' ? 0.55 : 0.4,
      transform: { x: 0.35 + rand() * 0.3, y: 0.35 + rand() * 0.3, width: 0.5 + rand() * 0.45, height: 0.5 + rand() * 0.45, rotation: signed(rand, 24) },
      provenance: { rule: 'v0.13-evolution-added-layer' }
    };
    const normalized = composer.normalizeLayer(raw, recipe.layers.length, pack);
    recipe.layers.push(normalized);
    mutations.push({ type: 'add-layer', layerId: normalized.id, assetId: normalized.assetId });
  }

  function mutateRecipe(parentRecipe, pack, sessionSeed, mutationIndex, rawPolicy) {
    const policy = normalizePolicy(rawPolicy);
    const strength = STRENGTH[policy.strength];
    const parentValidation = composer.validateRecipe(parentRecipe, pack);
    if (!parentValidation.ok) throw new TypeError(parentValidation.reason);
    const parentFingerprint = recipeFingerprint(parentRecipe, pack);
    const mutationSeed = `${sessionSeed}|${parentFingerprint}|variant:${mutationIndex}|${policy.strength}`;
    const rand = xorshift(mutationSeed);
    const recipe = clone(parentRecipe);
    recipe.seed = mutationSeed;
    recipe.id = `premade-evo-${fnv1a(mutationSeed)}`;
    recipe.name = `${parentRecipe.name || 'premade'} · ${policy.strength} ${mutationIndex + 1}`;
    recipe.canvas = Object.assign({}, recipe.canvas, { transparent: true });
    recipe.notes = String(recipe.notes || '');
    recipe.lineage = {
      parentRecipeId: parentRecipe.id || null,
      parentFingerprint,
      mutationIndex,
      mutationSeed,
      policy: clone(policy)
    };
    const mutations = [];
    if (recipe.layers[0]) mutateGlobeLayer(recipe.layers[0], pack, rand, mutations, strength, policy.lockBase);
    for (let index = 1; index < recipe.layers.length; index += 1) mutateLayer(recipe.layers[index], pack, rand, mutations, strength, policy, index);
    maybeChangeLayerCount(recipe, pack, rand, mutations, strength, policy);
    recipe.layers = recipe.layers.map((layer, index) => composer.normalizeLayer(layer, index, pack));
    recipe.mutationReceipt = {
      format: 'axm-premade-mutation-receipt', version: VERSION, parentFingerprint, mutationIndex, mutationSeed,
      mutationCount: mutations.length, mutations
    };
    return recipe;
  }

  function structuralObservation(recipe, pack) {
    const plan = composer.compilePlan(recipe, pack);
    const visible = plan.layers.filter((layer) => layer.visible);
    const extra = visible.slice(1);
    const assetIds = extra.map((layer) => layer.assetId);
    const unique = new Set(assetIds);
    const duplicateCount = Math.max(0, assetIds.length - unique.size);
    let coverageEstimate = 0;
    let opacityMean = 0;
    let outOfFrame = 0;
    extra.forEach((layer) => {
      coverageEstimate += Math.min(1, Math.abs(layer.transform.width * layer.transform.height)) * layer.opacity;
      opacityMean += layer.opacity;
      if (layer.transform.x < -0.2 || layer.transform.x > 1.2 || layer.transform.y < -0.2 || layer.transform.y > 1.2) outOfFrame += 1;
    });
    opacityMean = extra.length ? opacityMean / extra.length : 0;
    let score = 100;
    if (!visible.length) score -= 90;
    if (visible.length === 1) score -= 12;
    if (extra.length > 7) score -= (extra.length - 7) * 3;
    score -= duplicateCount * 5;
    score -= outOfFrame * 4;
    if (extra.length && opacityMean < 0.12) score -= 12;
    if (coverageEstimate > 5) score -= Math.min(18, (coverageEstimate - 5) * 4);
    score = rounded(clamp(score, 0, 100), 2);
    return {
      kind: 'bounded-structure-health',
      score,
      visibleLayers: visible.length,
      extraLayers: extra.length,
      uniqueExtraAssets: unique.size,
      duplicateExtraAssets: duplicateCount,
      outOfFrameLayers: outOfFrame,
      meanExtraOpacity: rounded(opacityMean, 4),
      roughCoverageEstimate: rounded(coverageEstimate, 4),
      boundary: 'Structure health only; this does not inspect rendered pixels or aesthetic quality.'
    };
  }

  function summarizePixels(rgba, width, height) {
    if (!rgba || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new TypeError('rgba, width, height are required.');
    const total = width * height;
    if (rgba.length < total * 4) throw new TypeError('rgba byte length is smaller than width*height*4.');
    let nonzero = 0, alphaSum = 0, lumaSum = 0, minLuma = 1, maxLuma = 0, nearBlack = 0, nearWhite = 0;
    let hash = 0x811c9dc5;
    for (let i = 0; i < total; i += 1) {
      const p = i * 4;
      const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2], a = rgba[p + 3];
      hash ^= r; hash = Math.imul(hash, 0x01000193); hash ^= g; hash = Math.imul(hash, 0x01000193); hash ^= b; hash = Math.imul(hash, 0x01000193); hash ^= a; hash = Math.imul(hash, 0x01000193);
      if (!a) continue;
      nonzero += 1;
      const af = a / 255;
      alphaSum += af;
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      lumaSum += luma;
      minLuma = Math.min(minLuma, luma);
      maxLuma = Math.max(maxLuma, luma);
      if (luma < 0.04) nearBlack += 1;
      if (luma > 0.96) nearWhite += 1;
    }
    const alphaCoverage = nonzero / total;
    return {
      width, height,
      pixelHash: (`00000000${(hash >>> 0).toString(16)}`).slice(-8),
      alphaCoverage: rounded(alphaCoverage, 6),
      meanAlphaVisible: rounded(nonzero ? alphaSum / nonzero : 0, 6),
      meanLumaVisible: rounded(nonzero ? lumaSum / nonzero : 0, 6),
      lumaRangeVisible: rounded(nonzero ? maxLuma - minLuma : 0, 6),
      nearBlackShareVisible: rounded(nonzero ? nearBlack / nonzero : 0, 6),
      nearWhiteShareVisible: rounded(nonzero ? nearWhite / nonzero : 0, 6),
      visiblePixels: nonzero,
      totalPixels: total
    };
  }

  function pixelHealth(observation, heldCount) {
    const o = observation || {};
    const holds = Math.max(0, Math.round(Number(heldCount) || 0));
    let score = 100;
    const reasons = [];
    if ((o.alphaCoverage || 0) < 0.005) { score -= 90; reasons.push('near-empty-alpha'); }
    else if (o.alphaCoverage < 0.05) { score -= 35; reasons.push('very-low-alpha-coverage'); }
    else if (o.alphaCoverage < 0.12) { score -= 12; reasons.push('low-alpha-coverage'); }
    if (o.nearBlackShareVisible > 0.9) { score -= 25; reasons.push('near-black-collapse'); }
    if (o.nearWhiteShareVisible > 0.9) { score -= 25; reasons.push('near-white-collapse'); }
    if (o.lumaRangeVisible < 0.04 && o.alphaCoverage > 0.02) { score -= 18; reasons.push('low-luma-range'); }
    if (o.meanAlphaVisible < 0.08 && o.alphaCoverage > 0.02) { score -= 12; reasons.push('very-faint-visible-alpha'); }
    if (holds) { score -= Math.min(60, holds * 15); reasons.push('runtime-holds'); }
    return {
      kind: 'bounded-render-health',
      score: rounded(clamp(score, 0, 100), 2),
      holds,
      reasons,
      boundary: 'Technical framebuffer health only; not beauty, realism, PBR correctness, or preference.'
    };
  }

  function combineHealth(structure, pixel) {
    if (!pixel) return rounded(structure.score * 0.55, 2);
    return rounded(clamp(structure.score * 0.35 + pixel.score * 0.65, 0, 100), 2);
  }

  function buildCandidate(recipe, pack, index) {
    const structure = structuralObservation(recipe, pack);
    return {
      id: `candidate-${index + 1}-${recipeFingerprint(recipe, pack)}`,
      index,
      recipe,
      recipeFingerprint: recipeFingerprint(recipe, pack),
      lineage: clone(recipe.lineage || {}),
      mutationReceipt: clone(recipe.mutationReceipt || null),
      structure,
      render: null,
      technicalScore: combineHealth(structure, null),
      kept: false,
      rank: null
    };
  }

  function rankCandidates(candidates) {
    const rows = candidates.slice();
    rows.sort((a, b) => {
      const ar = a.render && a.render.completed ? 1 : 0;
      const br = b.render && b.render.completed ? 1 : 0;
      if (ar !== br) return br - ar;
      if (a.technicalScore !== b.technicalScore) return b.technicalScore - a.technicalScore;
      return String(a.recipeFingerprint).localeCompare(String(b.recipeFingerprint));
    });
    rows.forEach((candidate, index) => { candidate.rank = index + 1; });
    return rows;
  }

  function createSession(parentRecipe, pack, seed, rawPolicy) {
    const policy = normalizePolicy(rawPolicy);
    const validation = composer.validateRecipe(parentRecipe, pack);
    if (!validation.ok) throw new TypeError(validation.reason);
    const parentFingerprint = recipeFingerprint(parentRecipe, pack);
    const sessionSeed = String(seed == null ? `evolve-${parentFingerprint}` : seed);
    const candidates = [];
    const seen = new Set();
    for (let index = 0; index < policy.variants; index += 1) {
      let recipe = mutateRecipe(parentRecipe, pack, sessionSeed, index, policy);
      let fingerprint = recipeFingerprint(recipe, pack);
      let retry = 0;
      while (seen.has(fingerprint) && retry < 4) {
        retry += 1;
        recipe = mutateRecipe(parentRecipe, pack, `${sessionSeed}|retry:${retry}`, index, policy);
        fingerprint = recipeFingerprint(recipe, pack);
      }
      seen.add(fingerprint);
      candidates.push(buildCandidate(recipe, pack, index));
    }
    const ranked = rankCandidates(candidates);
    return {
      format: SESSION_FORMAT,
      version: VERSION,
      id: `premade-evolution-${fnv1a(`${parentFingerprint}|${sessionSeed}|${stableStringify(policy)}`)}`,
      seed: sessionSeed,
      pack: packIdentity(pack),
      parent: { recipeId: parentRecipe.id || null, recipeFingerprint: parentFingerprint, recipe: clone(parentRecipe) },
      policy,
      candidates: ranked,
      keepers: [],
      truthBoundary: {
        lineage: 'Every child records parent fingerprint, mutation seed, policy and mutation receipt.',
        alpha: 'Every child preserves transparent:true as a hard recipe invariant.',
        scoring: 'Technical scores detect bounded structural/framebuffer failure modes; they do not judge beauty, realism, taste, or physical correctness.',
        authority: 'Ranking never automatically promotes a candidate. Keeper/adoption decisions remain explicit.',
        segmentation: 'Non-grid atlas crops remain deterministic coarse windows, not semantic object segmentation.'
      }
    };
  }

  function attachRenderObservation(session, candidateId, observation, heldCount, completed) {
    const candidate = session.candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new TypeError(`Unknown evolution candidate: ${candidateId}`);
    const pixels = observation ? clone(observation) : null;
    const health = pixels ? pixelHealth(pixels, heldCount) : null;
    candidate.render = {
      completed: Boolean(completed),
      heldLayers: Math.max(0, Math.round(Number(heldCount) || 0)),
      pixels,
      health
    };
    candidate.technicalScore = combineHealth(candidate.structure, health);
    session.candidates = rankCandidates(session.candidates);
    return clone(candidate);
  }

  function keepCandidate(session, candidateId, keep) {
    const candidate = session.candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new TypeError(`Unknown evolution candidate: ${candidateId}`);
    candidate.kept = keep !== false;
    const ids = new Set(session.candidates.filter((item) => item.kept).map((item) => item.id));
    session.keepers = Array.from(ids).sort();
    return clone(candidate);
  }

  function recipePack(session, name) {
    if (!session || session.format !== SESSION_FORMAT || session.version !== VERSION) throw new TypeError(`Expected ${SESSION_FORMAT}/${VERSION}.`);
    const kept = session.candidates.filter((candidate) => candidate.kept);
    const recipes = kept.map((candidate) => ({
      candidateId: candidate.id,
      rank: candidate.rank,
      technicalScore: candidate.technicalScore,
      recipeFingerprint: candidate.recipeFingerprint,
      lineage: clone(candidate.lineage),
      recipe: clone(candidate.recipe)
    }));
    return {
      format: PACK_FORMAT,
      version: VERSION,
      id: `premade-recipe-pack-${fnv1a(`${session.id}|${recipes.map((row) => row.recipeFingerprint).join('|')}`)}`,
      name: String(name || `${session.id} keepers`),
      sourceSessionId: session.id,
      pack: clone(session.pack),
      recipes,
      truthBoundary: {
        curation: 'Only explicitly kept candidates are included.',
        scoring: 'Technical scores are bounded diagnostics, not artistic authority.',
        alpha: 'All recipes retain transparent:true.',
        source: 'Recipes reference the locked premade pack identity and preserve mutation lineage.'
      }
    };
  }

  function compareRecipes(parent, child, pack) {
    const a = composer.compilePlan(parent, pack);
    const b = composer.compilePlan(child, pack);
    const aBy = new Map(a.layers.map((layer) => [layer.id, layer]));
    const bBy = new Map(b.layers.map((layer) => [layer.id, layer]));
    const ids = Array.from(new Set([...aBy.keys(), ...bBy.keys()])).sort();
    const changed = [];
    ids.forEach((id) => {
      const left = aBy.get(id) || null;
      const right = bBy.get(id) || null;
      if (stableStringify(left) !== stableStringify(right)) changed.push({ layerId: id, before: left, after: right });
    });
    return {
      parentFingerprint: a.recipeFingerprint,
      childFingerprint: b.recipeFingerprint,
      changedLayerCount: changed.length,
      changed,
      mutationReceipt: clone(child.mutationReceipt || null)
    };
  }

  return {
    VERSION,
    SESSION_FORMAT,
    PACK_FORMAT,
    STRENGTHS: STRENGTHS.slice(),
    clone,
    clamp,
    stableStringify,
    fnv1a,
    xorshift,
    normalizePolicy,
    packIdentity,
    eligibleAssets,
    recipeFingerprint,
    mutateRecipe,
    structuralObservation,
    summarizePixels,
    pixelHealth,
    combineHealth,
    rankCandidates,
    createSession,
    attachRenderObservation,
    keepCandidate,
    recipePack,
    compareRecipes
  };
});
