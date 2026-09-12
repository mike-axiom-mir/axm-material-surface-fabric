(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports ? require('./premade-composer-core.js') : root.AXMPremadeComposerCore,
    typeof module === 'object' && module.exports ? require('./premade-pattern-core.js') : root.AXMPremadePatternCore
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMPremadeGuideCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (composer, patterns) {
  'use strict';

  if (!composer || !patterns) throw new Error('Premade Guide Core requires composer and pattern cores.');

  const VERSION = '0.16.0';
  const RECEIPT_FORMAT = 'axm-premade-guided-composition-receipt';

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : min;
    return Math.max(min, Math.min(max, safe));
  }
  function stableStringify(value) { return composer.stableStringify(value); }
  function fnv1a(text) { return composer.fnv1a(text); }
  function xorshift(seed) { return composer.xorshift(seed); }

  function normalizePolicy(raw) {
    const source = raw || {};
    return {
      maxLayers: Math.max(2, Math.min(12, Math.round(Number(source.maxLayers) || 8))),
      anchorExtras: Math.max(0, Math.min(8, Math.round(Number(source.anchorExtras) || 2))),
      autoDonors: Math.max(0, Math.min(4, Math.round(Number(source.autoDonors) || 2))),
      allowFx: source.allowFx !== false,
      allowDecals: source.allowDecals !== false,
      reuseObservedSprites: source.reuseObservedSprites !== false,
      preferCategoryNovelty: source.preferCategoryNovelty !== false
    };
  }

  function validateInputs(library, pack) {
    const validation = patterns.validateLibrary(library);
    if (!validation.ok) throw new TypeError(validation.reason);
    if (!pack || !Array.isArray(pack.assets)) throw new TypeError('Premade pack is required.');
    if (library.pack && library.pack.archiveSha256 && pack.binaryPack && pack.binaryPack.sha256 && library.pack.archiveSha256 !== pack.binaryPack.sha256) {
      throw new TypeError('Pattern library premade-pack SHA does not match the active pack.');
    }
    return true;
  }

  function patternById(library, patternId) {
    return library.patterns.find((item) => item.id === patternId) || null;
  }

  function slotAllowed(slot, policy) {
    if (!slot) return false;
    if (slot.role === 'base') return false;
    if (slot.kind === 'fx-atlas' && !policy.allowFx) return false;
    if (slot.kind === 'decal-atlas' && !policy.allowDecals) return false;
    return true;
  }

  function patternCategories(pattern, policy) {
    const categories = [];
    (pattern.slots || []).forEach((slot) => {
      if (!slotAllowed(slot, policy)) return;
      if (slot.category && !categories.includes(slot.category)) categories.push(slot.category);
    });
    return categories.sort();
  }

  function patternProfile(pattern, policy) {
    const slots = (pattern.slots || []).filter((slot) => slotAllowed(slot, policy));
    return {
      patternId: pattern.id,
      support: pattern.support,
      sourcePackIds: clone(pattern.sourcePackIds || []),
      motifSlots: slots.length,
      categories: patternCategories(pattern, policy),
      kinds: Array.from(new Set(slots.map((slot) => slot.kind).filter(Boolean))).sort()
    };
  }

  function donorProfile(anchor, donor, policy) {
    const anchorCategories = new Set(patternCategories(anchor, policy));
    const donorCategories = patternCategories(donor, policy);
    const novelCategories = donorCategories.filter((category) => !anchorCategories.has(category));
    const overlapCategories = donorCategories.filter((category) => anchorCategories.has(category));
    return Object.assign(patternProfile(donor, policy), {
      anchorPatternId: anchor.id,
      novelCategories,
      overlapCategories,
      structuralRelation: {
        categoryNovelty: novelCategories.length,
        categoryOverlap: overlapCategories.length,
        boundary: 'Category novelty/overlap describes deterministic structural relation only; it is not an aesthetic compatibility score.'
      }
    });
  }

  function seededKey(seed, id) { return fnv1a(`${String(seed)}|${String(id)}`); }

  function compatibleDonors(library, anchorPatternId, rawPolicy, seed) {
    const policy = normalizePolicy(rawPolicy);
    const anchor = patternById(library, anchorPatternId);
    if (!anchor) throw new TypeError(`Unknown anchor pattern: ${anchorPatternId}`);
    const rows = library.patterns
      .filter((pattern) => pattern.id !== anchorPatternId)
      .map((pattern) => donorProfile(anchor, pattern, policy))
      .filter((profile) => profile.motifSlots > 0);
    rows.sort((a, b) => {
      if (policy.preferCategoryNovelty && a.structuralRelation.categoryNovelty !== b.structuralRelation.categoryNovelty) return b.structuralRelation.categoryNovelty - a.structuralRelation.categoryNovelty;
      if (a.structuralRelation.categoryOverlap !== b.structuralRelation.categoryOverlap) return a.structuralRelation.categoryOverlap - b.structuralRelation.categoryOverlap;
      const ak = seededKey(seed || anchorPatternId, a.patternId);
      const bk = seededKey(seed || anchorPatternId, b.patternId);
      if (ak !== bk) return ak.localeCompare(bk);
      return String(a.patternId).localeCompare(String(b.patternId));
    });
    return rows;
  }

  function autoSelectDonors(library, anchorPatternId, count, seed, rawPolicy) {
    const policy = normalizePolicy(rawPolicy);
    const wanted = Math.max(0, Math.min(4, Math.round(Number(count) || policy.autoDonors)));
    return compatibleDonors(library, anchorPatternId, policy, seed).slice(0, wanted).map((row) => row.patternId);
  }

  function layerAllowed(layer, pack, policy) {
    if (!layer) return false;
    const asset = composer.byId(pack, layer.assetId);
    if (!asset) return false;
    if (asset.kind === 'fx-atlas' && !policy.allowFx) return false;
    if (asset.kind === 'decal-atlas' && !policy.allowDecals) return false;
    return true;
  }

  function uniquePatternIds(ids, anchorPatternId) {
    const out = [];
    (ids || []).forEach((id) => {
      const value = String(id || '').trim();
      if (!value || value === anchorPatternId || out.includes(value)) return;
      out.push(value);
    });
    return out;
  }

  function instantiateSource(library, pattern, pack, seed, policy, role, ordinal) {
    const sourceSeed = `${seed}|${role}:${ordinal}|${pattern.id}`;
    const instance = patterns.instantiatePattern(library, pattern.id, pack, sourceSeed, { reuseObservedSprites: policy.reuseObservedSprites });
    return {
      role,
      ordinal,
      patternId: pattern.id,
      support: pattern.support,
      sourcePackIds: clone(pattern.sourcePackIds || []),
      instanceId: instance.id,
      instanceFingerprint: instance.recipeFingerprint,
      instanceSeed: sourceSeed,
      recipe: clone(instance.recipe)
    };
  }

  function adoptLayer(layer, source, sourceLayerIndex, targetIndex, pack) {
    const raw = clone(layer);
    raw.id = `guided-layer-${String(targetIndex + 1).padStart(2, '0')}-${fnv1a(`${source.patternId}|${sourceLayerIndex}|${source.instanceFingerprint}`)}`;
    raw.name = `${source.role}:${source.patternId} · slot ${sourceLayerIndex + 1}`;
    raw.provenance = Object.assign({}, raw.provenance || {}, {
      rule: 'v0.16-pattern-guided-composition',
      guideRole: source.role,
      sourcePatternId: source.patternId,
      sourcePatternSupport: source.support,
      sourcePatternLayerIndex: sourceLayerIndex,
      sourcePatternInstanceId: source.instanceId,
      sourcePatternInstanceFingerprint: source.instanceFingerprint,
      supportIsQualityClaim: false,
      semanticIntentClaim: false
    });
    return composer.normalizeLayer(raw, targetIndex, pack);
  }

  function appendSourceLayer(target, layer, source, sourceIndex, pack, selection) {
    const adopted = adoptLayer(layer, source, sourceIndex, target.length, pack);
    target.push(adopted);
    selection.push({
      targetLayerId: adopted.id,
      sourceRole: source.role,
      sourcePatternId: source.patternId,
      sourcePatternSupport: source.support,
      sourcePatternLayerIndex: sourceIndex,
      sourcePatternInstanceFingerprint: source.instanceFingerprint,
      assetId: adopted.assetId,
      sourceType: adopted.spriteCandidate ? 'sprite-candidate' : adopted.cell ? 'globe-cell' : 'atlas-window'
    });
  }

  function composeGuided(library, anchorPatternId, donorPatternIds, pack, seed, rawPolicy) {
    validateInputs(library, pack);
    const policy = normalizePolicy(rawPolicy);
    const anchor = patternById(library, anchorPatternId);
    if (!anchor) throw new TypeError(`Unknown anchor pattern: ${anchorPatternId}`);
    const donorIds = uniquePatternIds(donorPatternIds, anchorPatternId);
    const donors = donorIds.map((id) => {
      const pattern = patternById(library, id);
      if (!pattern) throw new TypeError(`Unknown donor pattern: ${id}`);
      return pattern;
    });
    const seedText = String(seed == null ? `${anchorPatternId}|guided` : seed);
    const anchorSource = instantiateSource(library, anchor, pack, seedText, policy, 'anchor', 0);
    const donorSources = donors.map((pattern, index) => instantiateSource(library, pattern, pack, seedText, policy, 'donor', index));

    const recipe = composer.createRecipe(`guided ${anchorPatternId}`, `guided:${seedText}`);
    recipe.id = `premade-guided-${fnv1a(`${library.id}|${anchorPatternId}|${donorIds.join('|')}|${seedText}|${stableStringify(policy)}`)}`;
    recipe.canvas.transparent = true;
    recipe.layers = [];
    const selection = [];

    const anchorLayers = anchorSource.recipe.layers.filter((layer) => layer.visible !== false);
    if (!anchorLayers.length) throw new Error('Anchor pattern instantiated with no visible layers.');
    appendSourceLayer(recipe.layers, anchorLayers[0], anchorSource, 0, pack, selection);

    const anchorExtras = anchorLayers.slice(1).map((layer, index) => ({ layer, sourceIndex: index + 1 })).filter((row) => layerAllowed(row.layer, pack, policy));
    const donorQueues = donorSources.map((source) => source.recipe.layers
      .map((layer, index) => ({ layer, sourceIndex: index }))
      .filter((row, index) => index > 0 && row.layer.visible !== false && layerAllowed(row.layer, pack, policy)));

    const reserveForDonor = donorQueues.some((queue) => queue.length) ? 1 : 0;
    const anchorLimit = Math.min(policy.anchorExtras, anchorExtras.length, Math.max(0, policy.maxLayers - 1 - reserveForDonor));
    for (let i = 0; i < anchorLimit && recipe.layers.length < policy.maxLayers; i += 1) {
      appendSourceLayer(recipe.layers, anchorExtras[i].layer, anchorSource, anchorExtras[i].sourceIndex, pack, selection);
    }

    let donorRound = 0;
    while (recipe.layers.length < policy.maxLayers) {
      let added = false;
      for (let donorIndex = 0; donorIndex < donorSources.length && recipe.layers.length < policy.maxLayers; donorIndex += 1) {
        const row = donorQueues[donorIndex][donorRound];
        if (!row) continue;
        appendSourceLayer(recipe.layers, row.layer, donorSources[donorIndex], row.sourceIndex, pack, selection);
        added = true;
      }
      if (!added) break;
      donorRound += 1;
    }

    let anchorFillIndex = anchorLimit;
    while (recipe.layers.length < policy.maxLayers && anchorFillIndex < anchorExtras.length) {
      const row = anchorExtras[anchorFillIndex++];
      appendSourceLayer(recipe.layers, row.layer, anchorSource, row.sourceIndex, pack, selection);
    }

    recipe.guidedLineage = {
      version: VERSION,
      libraryId: library.id,
      seed: seedText,
      anchorPatternId,
      donorPatternIds: donorIds,
      policy: clone(policy),
      sourceInstances: [anchorSource].concat(donorSources).map((source) => ({
        role: source.role,
        patternId: source.patternId,
        support: source.support,
        sourcePackIds: clone(source.sourcePackIds),
        instanceId: source.instanceId,
        instanceFingerprint: source.instanceFingerprint,
        instanceSeed: source.instanceSeed
      }))
    };
    recipe.truthBoundary.guidedComposition = 'v0.16 combines explicit v0.15 pattern structure and motifs deterministically. Pattern support is recurrence evidence only; donor selection and layer mixing do not prove artistic compatibility, preference, semantic intent, or physical truth.';
    recipe.truthBoundary.authority = 'Pattern-guided output is a proposal. It does not auto-keep, auto-promote, or silently rewrite canonical material state.';

    const validation = composer.validateRecipe(recipe, pack);
    if (!validation.ok) throw new TypeError(validation.reason);
    const recipeFingerprint = composer.recipeFingerprint(recipe, pack);
    const receipt = {
      format: RECEIPT_FORMAT,
      version: VERSION,
      id: `guided-receipt-${fnv1a(`${recipe.id}|${recipeFingerprint}`)}`,
      libraryId: library.id,
      seed: seedText,
      anchorPatternId,
      donorPatternIds: donorIds,
      policy: clone(policy),
      recipeFingerprint,
      recipe: clone(recipe),
      selection,
      sourceInstances: clone(recipe.guidedLineage.sourceInstances),
      truthBoundary: {
        alpha: 'The guided recipe retains transparent:true.',
        support: 'Pattern support is recurrence among explicit keeper history, not a quality or preference score.',
        compatibility: 'Category novelty/overlap and bounded layer policies guide deterministic mixing; they are not aesthetic compatibility judgments.',
        semantics: 'Exact alpha sprites preserve observed bounds but do not become semantic object labels.',
        authority: 'The result is a proposal and is never automatically kept, promoted, or canonical.'
      }
    };
    return receipt;
  }

  function autoComposeGuided(library, anchorPatternId, pack, seed, rawPolicy) {
    const policy = normalizePolicy(rawPolicy);
    const donorIds = autoSelectDonors(library, anchorPatternId, policy.autoDonors, seed, policy);
    return composeGuided(library, anchorPatternId, donorIds, pack, seed, policy);
  }

  function validateReceipt(receipt, pack) {
    if (!receipt || receipt.format !== RECEIPT_FORMAT || receipt.version !== VERSION) return { ok: false, reason: `Expected ${RECEIPT_FORMAT}/${VERSION}.` };
    if (!receipt.recipe || !receipt.recipe.canvas || receipt.recipe.canvas.transparent !== true) return { ok: false, reason: 'Guided receipt recipe must preserve transparent:true.' };
    if (!Array.isArray(receipt.selection) || !receipt.selection.length) return { ok: false, reason: 'Guided receipt requires non-empty selection lineage.' };
    const validation = composer.validateRecipe(receipt.recipe, pack);
    if (!validation.ok) return { ok: false, reason: validation.reason };
    const fingerprint = composer.recipeFingerprint(receipt.recipe, pack);
    if (receipt.recipeFingerprint !== fingerprint) return { ok: false, reason: 'Guided receipt recipe fingerprint mismatch.' };
    return { ok: true };
  }

  function guideSummary(receipt) {
    return {
      id: receipt.id,
      anchorPatternId: receipt.anchorPatternId,
      donorPatternIds: clone(receipt.donorPatternIds || []),
      layers: receipt.recipe && receipt.recipe.layers ? receipt.recipe.layers.length : 0,
      spriteLayers: (receipt.selection || []).filter((row) => row.sourceType === 'sprite-candidate').length,
      sourcePatterns: Array.from(new Set((receipt.selection || []).map((row) => row.sourcePatternId))).sort(),
      recipeFingerprint: receipt.recipeFingerprint
    };
  }

  return {
    VERSION,
    RECEIPT_FORMAT,
    clone,
    clamp,
    stableStringify,
    fnv1a,
    xorshift,
    normalizePolicy,
    patternById,
    patternCategories,
    patternProfile,
    donorProfile,
    compatibleDonors,
    autoSelectDonors,
    composeGuided,
    autoComposeGuided,
    validateReceipt,
    guideSummary
  };
});
