(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports ? require('./premade-composer-core.js') : root.AXMPremadeComposerCore,
    typeof module === 'object' && module.exports ? require('./premade-evolution-core.js') : root.AXMPremadeEvolutionCore,
    typeof module === 'object' && module.exports ? require('./premade-pattern-core.js') : root.AXMPremadePatternCore,
    typeof module === 'object' && module.exports ? require('./premade-guide-core.js') : root.AXMPremadeGuideCore
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMPremadeLoopCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (composer, evolution, patterns, guide) {
  'use strict';

  if (!composer || !evolution || !patterns || !guide) throw new Error('Premade Loop Core requires composer, evolution, pattern, and guide cores.');

  const VERSION = '0.17.0';
  const LOOP_FORMAT = 'axm-premade-closed-loop-session';
  const MEMORY_RECEIPT_FORMAT = 'axm-premade-memory-update-receipt';

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function stableStringify(value) { return composer.stableStringify(value); }
  function fnv1a(value) { return composer.fnv1a(value); }
  function union(a, b) { return Array.from(new Set([].concat(a || [], b || []))).sort(); }
  function addCounts(left, right) {
    const out = Object.assign({}, left || {});
    Object.entries(right || {}).forEach(([key, value]) => { out[key] = (Number(out[key]) || 0) + (Number(value) || 0); });
    return out;
  }
  function weightedRange(left, right, leftWeight, rightWeight, fallback) {
    if (!left && !right) return { min: fallback, max: fallback, mean: fallback };
    if (!left) return clone(right);
    if (!right) return clone(left);
    const lw = Math.max(0, Number(leftWeight) || 0);
    const rw = Math.max(0, Number(rightWeight) || 0);
    const total = lw + rw;
    const lmean = Number(left.mean), rmean = Number(right.mean);
    return {
      min: Math.min(Number(left.min), Number(right.min)),
      max: Math.max(Number(left.max), Number(right.max)),
      mean: Number.isFinite(lmean) && Number.isFinite(rmean) && total ? Math.round(((lmean * lw + rmean * rw) / total) * 10000) / 10000 : null
    };
  }
  function normalizeEvolutionPolicy(raw) {
    const source = raw || {};
    return evolution.normalizePolicy({
      strength: source.strength || 'medium',
      variants: source.variants == null ? 8 : source.variants,
      lockBase: source.lockBase !== false,
      allowFx: source.allowFx !== false,
      allowDecals: source.allowDecals !== false,
      allowLayerCountChange: source.allowLayerCountChange !== false,
      maxExtraLayers: source.maxExtraLayers == null ? 8 : source.maxExtraLayers
    });
  }
  function packIdentity(pack) {
    return {
      format: pack && pack.format || null,
      version: pack && pack.version || null,
      archiveSha256: pack && pack.binaryPack && pack.binaryPack.sha256 || null
    };
  }
  function validateGuided(receipt, pack) {
    const validation = guide.validateReceipt(receipt, pack);
    if (!validation.ok) throw new TypeError(validation.reason);
    return true;
  }

  function createLoopSession(guidedReceipt, pack, seed, rawPolicy) {
    validateGuided(guidedReceipt, pack);
    const policy = normalizeEvolutionPolicy(rawPolicy);
    const seedText = String(seed == null ? `${guidedReceipt.id}|loop` : seed);
    const evolutionSession = evolution.createSession(guidedReceipt.recipe, pack, seedText, policy);
    return {
      format: LOOP_FORMAT,
      version: VERSION,
      id: `premade-loop-${fnv1a(`${guidedReceipt.id}|${seedText}|${stableStringify(policy)}`)}`,
      seed: seedText,
      pack: packIdentity(pack),
      guidedSource: {
        receiptId: guidedReceipt.id,
        recipeFingerprint: guidedReceipt.recipeFingerprint,
        anchorPatternId: guidedReceipt.anchorPatternId,
        donorPatternIds: clone(guidedReceipt.donorPatternIds || []),
        libraryId: guidedReceipt.libraryId,
        recipe: clone(guidedReceipt.recipe)
      },
      policy,
      evolution: evolutionSession,
      keeperDecisions: [],
      memoryUpdate: null,
      state: 'EVOLVED_AWAITING_KEEPERS',
      truthBoundary: {
        alpha: 'Guided parent and every evolved child must preserve transparent:true.',
        scoring: 'Evolution rank is bounded technical evidence only; it is not beauty, taste, realism, PBR truth, or semantic intent.',
        keeperGate: 'No candidate becomes a keeper without an explicit keeper decision.',
        memoryGate: 'Pattern memory changes only through an explicit commit after at least one keeper exists.',
        continuity: 'Guided source receipt, evolution lineage, keeper decisions, keeper pack, and memory update receipt remain linked.',
        authority: 'The closed loop compounds reusable state but never auto-promotes a recipe or silently rewrites canonical material state.'
      }
    };
  }

  function candidate(session, candidateId) {
    return session && session.evolution && session.evolution.candidates.find((row) => row.id === candidateId) || null;
  }
  function attachRenderObservation(session, candidateId, observation, heldCount, completed) {
    if (!session || session.format !== LOOP_FORMAT || session.version !== VERSION) throw new TypeError(`Expected ${LOOP_FORMAT}/${VERSION}.`);
    return evolution.attachRenderObservation(session.evolution, candidateId, observation, heldCount, completed);
  }
  function decideKeeper(session, candidateId, keep, actor) {
    if (!session || session.format !== LOOP_FORMAT || session.version !== VERSION) throw new TypeError(`Expected ${LOOP_FORMAT}/${VERSION}.`);
    const row = candidate(session, candidateId);
    if (!row) throw new TypeError(`Unknown loop candidate: ${candidateId}`);
    const explicitKeep = keep !== false;
    evolution.keepCandidate(session.evolution, candidateId, explicitKeep);
    session.keeperDecisions = session.keeperDecisions.filter((item) => item.candidateId !== candidateId);
    session.keeperDecisions.push({
      candidateId,
      keep: explicitKeep,
      recipeFingerprint: row.recipeFingerprint,
      actor: String(actor || 'explicit-user-action'),
      decisionType: 'explicit'
    });
    session.keeperDecisions.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
    session.state = session.evolution.candidates.some((item) => item.kept) ? 'KEEPERS_SELECTED' : 'EVOLVED_AWAITING_KEEPERS';
    return clone(row);
  }
  function keeperPack(session, name) {
    if (!session || session.format !== LOOP_FORMAT || session.version !== VERSION) throw new TypeError(`Expected ${LOOP_FORMAT}/${VERSION}.`);
    const kept = session.evolution.candidates.filter((item) => item.kept);
    if (!kept.length) throw new Error('Memory commit requires at least one explicitly kept candidate.');
    const pack = evolution.recipePack(session.evolution, name || `${session.id} explicit keepers`);
    pack.loopLineage = {
      loopSessionId: session.id,
      guidedReceiptId: session.guidedSource.receiptId,
      guidedRecipeFingerprint: session.guidedSource.recipeFingerprint,
      keeperDecisionCount: session.keeperDecisions.filter((item) => item.keep).length
    };
    pack.truthBoundary = Object.assign({}, pack.truthBoundary || {}, {
      closedLoop: 'This pack contains only candidates explicitly kept in a v0.17 closed-loop session.'
    });
    return pack;
  }

  function mergeSpriteExamples(left, right) {
    const out = [];
    [].concat(left || [], right || []).forEach((item) => {
      const key = stableStringify(item);
      if (!out.some((row) => stableStringify(row) === key)) out.push(clone(item));
    });
    return out;
  }
  function mergeSlot(left, right, leftSupport, rightSupport) {
    if (!left) return clone(right);
    if (!right) return clone(left);
    return {
      order: left.order,
      role: left.role,
      kind: left.kind,
      category: left.category,
      observedAssetIds: union(left.observedAssetIds, right.observedAssetIds),
      sourceTypeCounts: addCounts(left.sourceTypeCounts, right.sourceTypeCounts),
      blendModeCounts: addCounts(left.blendModeCounts, right.blendModeCounts),
      opacity: weightedRange(left.opacity, right.opacity, leftSupport, rightSupport, 1),
      transform: {
        x: weightedRange(left.transform && left.transform.x, right.transform && right.transform.x, leftSupport, rightSupport, 0.5),
        y: weightedRange(left.transform && left.transform.y, right.transform && right.transform.y, leftSupport, rightSupport, 0.5),
        width: weightedRange(left.transform && left.transform.width, right.transform && right.transform.width, leftSupport, rightSupport, 0.75),
        height: weightedRange(left.transform && left.transform.height, right.transform && right.transform.height, leftSupport, rightSupport, 0.75),
        rotation: weightedRange(left.transform && left.transform.rotation, right.transform && right.transform.rotation, leftSupport, rightSupport, 0)
      },
      spriteExamples: mergeSpriteExamples(left.spriteExamples, right.spriteExamples)
    };
  }
  function mergeTechnicalScore(left, right) {
    if (!left && !right) return null;
    if (!left) return clone(right);
    if (!right) return clone(left);
    return {
      min: Math.min(Number(left.min), Number(right.min)),
      max: Math.max(Number(left.max), Number(right.max)),
      mean: null,
      note: 'Mean intentionally withheld after incremental merge because historical technical-score evidence counts are not encoded in v0.15 pattern summaries.'
    };
  }
  function mergePattern(existing, incoming) {
    if (existing.signature !== incoming.signature) throw new Error('Cannot merge patterns with different signatures.');
    if (existing.slots.length !== incoming.slots.length) throw new Error('Cannot merge same-signature patterns with different slot counts.');
    const leftSupport = existing.support;
    const rightSupport = incoming.support;
    const merged = clone(existing);
    merged.support = leftSupport + rightSupport;
    merged.sourcePackIds = union(existing.sourcePackIds, incoming.sourcePackIds);
    merged.sourceRecipeFingerprints = union(existing.sourceRecipeFingerprints, incoming.sourceRecipeFingerprints);
    merged.technicalScore = mergeTechnicalScore(existing.technicalScore, incoming.technicalScore);
    merged.slots = existing.slots.map((slot, index) => mergeSlot(slot, incoming.slots[index], leftSupport, rightSupport));
    merged.truthBoundary = Object.assign({}, merged.truthBoundary || {}, {
      incremental: 'Support/ranges were extended by an explicit v0.17 keeper-memory commit; this remains recurrence evidence, not preference or quality truth.'
    });
    return merged;
  }

  function mergePatternLibrary(existingLibrary, contributionLibrary, keeperPackId) {
    const existingValidation = patterns.validateLibrary(existingLibrary);
    if (!existingValidation.ok) throw new TypeError(existingValidation.reason);
    const contributionValidation = patterns.validateLibrary(contributionLibrary);
    if (!contributionValidation.ok) throw new TypeError(contributionValidation.reason);
    const merged = clone(existingLibrary);
    const bySignature = new Map(merged.patterns.map((pattern, index) => [pattern.signature, index]));
    const deltas = [];
    contributionLibrary.patterns.forEach((incoming) => {
      const index = bySignature.get(incoming.signature);
      if (index == null) {
        merged.patterns.push(clone(incoming));
        bySignature.set(incoming.signature, merged.patterns.length - 1);
        deltas.push({ patternId: incoming.id, signature: incoming.signature, previousSupport: 0, addedSupport: incoming.support, newSupport: incoming.support, created: true });
      } else {
        const previous = merged.patterns[index];
        const previousSupport = previous.support;
        merged.patterns[index] = mergePattern(previous, incoming);
        deltas.push({ patternId: merged.patterns[index].id, signature: incoming.signature, previousSupport, addedSupport: incoming.support, newSupport: merged.patterns[index].support, created: false });
      }
    });
    merged.patterns.sort((a, b) => b.support - a.support || String(a.id).localeCompare(String(b.id)));
    merged.sourcePackIds = union(existingLibrary.sourcePackIds, contributionLibrary.sourcePackIds);
    merged.summary = {
      keeperRecipes: (Number(existingLibrary.summary && existingLibrary.summary.keeperRecipes) || 0) + (Number(contributionLibrary.summary && contributionLibrary.summary.keeperRecipes) || 0),
      patterns: merged.patterns.length,
      repeatedPatterns: merged.patterns.filter((pattern) => pattern.support > 1).length
    };
    merged.previousLibraryId = existingLibrary.id;
    merged.incrementalHistory = [].concat(existingLibrary.incrementalHistory || [], [{ keeperPackId, contributionLibraryId: contributionLibrary.id, deltas: clone(deltas) }]);
    merged.id = `premade-pattern-library-${fnv1a(stableStringify({ previousLibraryId: existingLibrary.id, keeperPackId, patterns: merged.patterns.map((pattern) => ({ signature: pattern.signature, support: pattern.support })) }))}`;
    merged.truthBoundary = Object.assign({}, merged.truthBoundary || {}, {
      incremental: 'This v0.15-compatible library was incrementally extended only from explicitly kept v0.17 descendants. Recurrence/support remains descriptive evidence, not taste or quality authority.'
    });
    return { library: merged, deltas };
  }

  function commitKeepersToMemory(session, existingLibrary, pack, name) {
    if (!session || session.format !== LOOP_FORMAT || session.version !== VERSION) throw new TypeError(`Expected ${LOOP_FORMAT}/${VERSION}.`);
    if (session.memoryUpdate) throw new Error('This loop session already has a memory update receipt. Start a new loop for another memory commit.');
    const libraryValidation = patterns.validateLibrary(existingLibrary);
    if (!libraryValidation.ok) throw new TypeError(libraryValidation.reason);
    const keptPack = keeperPack(session, name);
    const contribution = patterns.learnPatternLibrary([keptPack], pack, `${session.id} keeper contribution`);
    const merged = mergePatternLibrary(existingLibrary, contribution, keptPack.id);
    const receipt = {
      format: MEMORY_RECEIPT_FORMAT,
      version: VERSION,
      id: `memory-update-${fnv1a(`${session.id}|${existingLibrary.id}|${keptPack.id}|${merged.library.id}`)}`,
      loopSessionId: session.id,
      previousLibraryId: existingLibrary.id,
      keeperPackId: keptPack.id,
      keeperCount: keptPack.recipes.length,
      contributionLibraryId: contribution.id,
      updatedLibraryId: merged.library.id,
      patternDeltas: clone(merged.deltas),
      updatedLibrary: clone(merged.library),
      keeperPack: clone(keptPack),
      truthBoundary: {
        keeperGate: 'Only candidates carrying explicit keep decisions were included.',
        memory: 'Memory update extends deterministic recurrence/support and observed parameter ranges; it does not infer hidden taste or semantic intent.',
        scoring: 'Technical scores are evidence attached to descendants, not promotion authority.',
        authority: 'The update occurs only because an explicit memory-commit action was invoked.'
      }
    };
    session.memoryUpdate = clone(receipt);
    session.state = 'MEMORY_COMMITTED';
    return receipt;
  }

  function validateLoopSession(session, pack) {
    if (!session || session.format !== LOOP_FORMAT || session.version !== VERSION) return { ok: false, reason: `Expected ${LOOP_FORMAT}/${VERSION}.` };
    if (!session.guidedSource || !session.guidedSource.recipe || session.guidedSource.recipe.canvas.transparent !== true) return { ok: false, reason: 'Loop guided source must preserve transparent:true.' };
    if (!session.evolution || session.evolution.format !== evolution.SESSION_FORMAT || session.evolution.version !== evolution.VERSION) return { ok: false, reason: 'Loop requires a v0.13 evolution session.' };
    for (const row of session.evolution.candidates || []) {
      const validation = composer.validateRecipe(row.recipe, pack);
      if (!validation.ok) return { ok: false, reason: validation.reason };
      if (!row.recipe.canvas || row.recipe.canvas.transparent !== true) return { ok: false, reason: 'Every loop candidate must preserve transparent:true.' };
    }
    return { ok: true };
  }
  function validateMemoryReceipt(receipt) {
    if (!receipt || receipt.format !== MEMORY_RECEIPT_FORMAT || receipt.version !== VERSION) return { ok: false, reason: `Expected ${MEMORY_RECEIPT_FORMAT}/${VERSION}.` };
    if (!receipt.keeperCount || !receipt.keeperPack || !receipt.updatedLibrary) return { ok: false, reason: 'Memory receipt requires keeper pack and updated library.' };
    const validation = patterns.validateLibrary(receipt.updatedLibrary);
    if (!validation.ok) return validation;
    return { ok: true };
  }
  function loopSummary(session) {
    const candidates = session && session.evolution && session.evolution.candidates || [];
    return {
      id: session.id,
      state: session.state,
      guidedReceiptId: session.guidedSource.receiptId,
      parentFingerprint: session.guidedSource.recipeFingerprint,
      variants: candidates.length,
      rendered: candidates.filter((row) => row.render && row.render.completed).length,
      keepers: candidates.filter((row) => row.kept).length,
      memoryCommitted: Boolean(session.memoryUpdate),
      updatedLibraryId: session.memoryUpdate && session.memoryUpdate.updatedLibraryId || null
    };
  }

  return {
    VERSION,
    LOOP_FORMAT,
    MEMORY_RECEIPT_FORMAT,
    clone,
    stableStringify,
    fnv1a,
    normalizeEvolutionPolicy,
    createLoopSession,
    attachRenderObservation,
    decideKeeper,
    keeperPack,
    mergePatternLibrary,
    commitKeepersToMemory,
    validateLoopSession,
    validateMemoryReceipt,
    loopSummary
  };
});