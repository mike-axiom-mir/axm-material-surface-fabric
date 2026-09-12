(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports ? require('./library-core.js') : root.AXMMaterialLibraryCore,
    typeof module === 'object' && module.exports ? require('./premade-composer-core.js') : root.AXMPremadeComposerCore,
    typeof module === 'object' && module.exports ? require('./premade-pattern-core.js') : root.AXMPremadePatternCore,
    typeof module === 'object' && module.exports ? require('./alpha-sprite-core.js') : root.AXMAlphaSpriteCore,
    typeof module === 'object' && module.exports ? require('./premade-loop-core.js') : root.AXMPremadeLoopCore
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMMaterialCapabilityExchangeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (libraryCore, composer, patternCore, spriteCore, loopCore) {
  'use strict';

  if (!libraryCore || !composer || !patternCore || !spriteCore) throw new Error('Capability Exchange requires material library, composer, pattern, and sprite cores.');

  const VERSION = '0.18.0';
  const PACK_FORMAT = 'axm-material-capability-pack';
  const FEEDBACK_FORMAT = 'axm-material-use-feedback';
  const LEDGER_FORMAT = 'axm-material-use-ledger';
  const KINDS = ['material-entry','material-family','sprite-candidate','recipe','pattern'];
  const ACTIONS = ['inspected','validated','rendered','adopted','modified','rejected','reused'];
  const OUTCOMES = ['PASS','HOLD','REJECT'];

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function stableStringify(value) { return composer.stableStringify(value); }
  function fnv1a(value) { return composer.fnv1a(String(value == null ? '' : value)); }
  function text(value, fallback) { const out = String(value == null ? '' : value).trim(); return out || (fallback || ''); }
  function unique(list) { return Array.from(new Set((list || []).map((item) => text(item)).filter(Boolean))).sort(); }

  function capabilityIdentity(kind, sourceId, payload) {
    return `cap-${kind}-${fnv1a(stableStringify({ kind, sourceId, payload }))}`;
  }

  function makeCapability(kind, sourceId, payload, provenance, refs, evidence) {
    if (!KINDS.includes(kind)) throw new TypeError(`Unsupported capability kind: ${kind}`);
    const sid = text(sourceId);
    if (!sid) throw new TypeError('Capability sourceId is required.');
    const body = clone(payload || {});
    const id = capabilityIdentity(kind, sid, body);
    return {
      id,
      kind,
      sourceId: sid,
      payload: body,
      provenance: clone(provenance || {}),
      refs: clone(refs || {}),
      evidence: clone(evidence || {}),
      fingerprint: fnv1a(stableStringify({ kind, sourceId: sid, payload: body, provenance: provenance || {}, refs: refs || {} }))
    };
  }

  function materialCapabilities(library, options) {
    const validation = libraryCore.validateLibrary(library);
    if (!validation.ok) throw new TypeError(validation.reason);
    const settings = options || {};
    const entryFilter = settings.entryIds && settings.entryIds.length ? new Set(settings.entryIds) : null;
    const familyFilter = settings.familyIds && settings.familyIds.length ? new Set(settings.familyIds) : null;
    const entries = library.entries.filter((entry) => !entryFilter || entryFilter.has(entry.id));
    const selectedEntryIds = new Set(entries.map((entry) => entry.id));
    const out = entries.map((entry) => makeCapability('material-entry', entry.id, {
      name: entry.name,
      kind: entry.kind,
      mime: entry.mime,
      width: entry.width,
      height: entry.height,
      bytes: entry.bytes,
      dataUrl: entry.dataUrl || null,
      payload: clone(entry.payload || {}),
      usage: clone(entry.usage || {}),
      tags: clone(entry.tags || [])
    }, {
      sourceFormat: library.format,
      sourceVersion: library.version,
      sourceLibraryId: library.id,
      source: clone(entry.source || {})
    }, {}, {
      portableBytesPresent: Boolean(entry.dataUrl),
      channelHintIsPhysicalTruth: false
    }));

    library.families.filter((family) => !familyFilter || familyFilter.has(family.id)).forEach((family) => {
      const entryIds = family.entryIds.filter((id) => selectedEntryIds.has(id));
      if (!entryIds.length) return;
      out.push(makeCapability('material-family', family.id, {
        name: family.name,
        purpose: family.purpose || '',
        entryIds,
        tags: clone(family.tags || [])
      }, {
        sourceFormat: library.format,
        sourceVersion: library.version,
        sourceLibraryId: library.id
      }, {
        materialEntrySourceIds: entryIds
      }, {
        familyIsDeclaredGrouping: true,
        physicalMaterialClaim: false
      }));
    });
    return out;
  }

  function spriteCapabilities(indexOrSet, options) {
    const settings = options || {};
    const selected = settings.spriteIds && settings.spriteIds.length ? new Set(settings.spriteIds) : null;
    const indices = indexOrSet && indexOrSet.format === 'axm-premade-sprite-index-set' ? indexOrSet.indices || [] : [indexOrSet];
    const out = [];
    indices.forEach((index) => {
      const validation = spriteCore.validateIndex(index);
      if (!validation.ok) throw new TypeError(validation.reason);
      index.candidates.filter((candidate) => !selected || selected.has(candidate.id)).forEach((candidate) => {
        out.push(makeCapability('sprite-candidate', candidate.id, {
          atlasId: index.atlas.id,
          normalizedBounds: clone(candidate.normalizedBounds),
          bounds: clone(candidate.bounds),
          alphaCoverage: clone(candidate.alphaCoverage || {}),
          componentCount: candidate.componentCount,
          pixelCount: candidate.pixelCount,
          rgbaHash: candidate.rgbaHash || null,
          spriteFile: candidate.spriteFile || null,
          spriteSha256: candidate.spriteSha256 || null
        }, {
          sourceFormat: index.format,
          sourceVersion: index.version,
          sourceIndexId: index.id,
          sourceBasis: index.image && index.image.sourceBasis || null,
          sourceSha256: index.image && index.image.sourceSha256 || null,
          atlas: clone(index.atlas)
        }, {}, {
          alphaObserved: true,
          semanticObjectClaim: false
        }));
      });
    });
    return out;
  }

  function recipeCapability(recipe, premadePack, provenance) {
    const validation = composer.validateRecipe(recipe, premadePack);
    if (!validation.ok) throw new TypeError(validation.reason);
    return makeCapability('recipe', recipe.id || composer.recipeFingerprint(recipe, premadePack), {
      recipe: clone(recipe),
      recipeFingerprint: composer.recipeFingerprint(recipe, premadePack),
      premadePack: {
        format: premadePack.format,
        version: premadePack.version,
        archiveSha256: premadePack.binaryPack && premadePack.binaryPack.sha256 || null
      }
    }, Object.assign({ sourceFormat: recipe.format, sourceVersion: recipe.version }, clone(provenance || {})), {}, {
      transparent: recipe.canvas && recipe.canvas.transparent === true,
      aestheticQualityClaim: false
    });
  }

  function patternCapabilities(library, options) {
    const validation = patternCore.validateLibrary(library);
    if (!validation.ok) throw new TypeError(validation.reason);
    const selected = options && options.patternIds && options.patternIds.length ? new Set(options.patternIds) : null;
    return library.patterns.filter((pattern) => !selected || selected.has(pattern.id)).map((pattern) => makeCapability('pattern', pattern.id, {
      pattern: clone(pattern),
      support: pattern.support
    }, {
      sourceFormat: library.format,
      sourceVersion: library.version,
      sourceLibraryId: library.id,
      sourcePackIds: clone(pattern.sourcePackIds || [])
    }, {}, {
      supportIsRecurrenceOnly: true,
      preferenceClaim: false,
      qualityClaim: false
    }));
  }

  function recipePackCapabilities(recipePack, premadePack, provenance) {
    if (!recipePack || recipePack.format !== 'axm-premade-recipe-pack' || recipePack.version !== '0.13.0' || !Array.isArray(recipePack.recipes)) throw new TypeError('Expected axm-premade-recipe-pack/v0.13.0.');
    return recipePack.recipes.map((row) => recipeCapability(row.recipe, premadePack, Object.assign({
      sourceRecipePackId: recipePack.id || null,
      sourceCandidateId: row.candidateId || null,
      sourceRank: row.rank == null ? null : row.rank,
      sourceTechnicalScore: row.technicalScore == null ? null : row.technicalScore,
      sourceLineage: clone(row.lineage || {})
    }, provenance || {})));
  }

  function loopCapabilities(session, premadePack) {
    if (!session || session.format !== 'axm-premade-closed-loop-session' || session.version !== '0.17.0') throw new TypeError('Expected axm-premade-closed-loop-session/v0.17.0.');
    if (loopCore && typeof loopCore.validateLoopSession === 'function') {
      const validation = loopCore.validateLoopSession(session, premadePack);
      if (!validation.ok) throw new TypeError(validation.reason);
    }
    const decisions = new Map((session.keeperDecisions || []).map((row) => [row.candidateId, row]));
    return (session.evolution && session.evolution.candidates || []).filter((candidate) => candidate.kept === true && decisions.get(candidate.id) && decisions.get(candidate.id).keep === true).map((candidate) => recipeCapability(candidate.recipe, premadePack, {
      sourceLoopSessionId: session.id,
      sourceGuidedReceiptId: session.guidedSource && session.guidedSource.receiptId || null,
      sourceCandidateId: candidate.id,
      sourceTechnicalScore: candidate.technicalScore,
      keeperDecision: clone(decisions.get(candidate.id)),
      explicitKeeper: true
    }));
  }

  function capabilitiesFromArtifact(artifact, premadePack, options) {
    if (!artifact || typeof artifact !== 'object') throw new TypeError('Capability source artifact must be an object.');
    if (artifact.format === libraryCore.LIBRARY_FORMAT) return materialCapabilities(artifact, options);
    if (artifact.format === spriteCore.INDEX_FORMAT || artifact.format === 'axm-premade-sprite-index-set') return spriteCapabilities(artifact, options);
    if (artifact.format === composer.FORMAT) return [recipeCapability(artifact, premadePack, { sourceArtifact: 'direct-recipe' })];
    if (artifact.format === patternCore.LIBRARY_FORMAT) return patternCapabilities(artifact, options);
    if (artifact.format === 'axm-premade-recipe-pack') return recipePackCapabilities(artifact, premadePack, { sourceArtifact: 'keeper-recipe-pack' });
    if (artifact.format === 'axm-premade-closed-loop-session') return loopCapabilities(artifact, premadePack);
    if (artifact.format === 'axm-premade-memory-update-receipt' && artifact.updatedLibrary) {
      return patternCapabilities(artifact.updatedLibrary, options).concat(artifact.keeperPack ? recipePackCapabilities(artifact.keeperPack, premadePack, { sourceMemoryReceiptId: artifact.id || null }) : []);
    }
    if (artifact.format === 'axm-premade-guided-composition-receipt' && artifact.recipe) return [recipeCapability(artifact.recipe, premadePack, { sourceGuidedReceiptId: artifact.id || null })];
    throw new TypeError(`Unsupported capability source artifact: ${artifact.format || 'unknown-format'}`);
  }

  function createCapabilityPack(artifacts, premadePack, options) {
    const settings = options || {};
    const list = Array.isArray(artifacts) ? artifacts : [artifacts];
    if (!list.length) throw new TypeError('At least one source artifact is required.');
    const byId = new Map();
    list.forEach((artifact) => capabilitiesFromArtifact(artifact, premadePack, settings).forEach((capability) => {
      const existing = byId.get(capability.id);
      if (existing && stableStringify(existing) !== stableStringify(capability)) throw new Error(`Capability identity collision: ${capability.id}`);
      byId.set(capability.id, capability);
    }));
    const capabilities = Array.from(byId.values()).sort((a, b) => a.kind.localeCompare(b.kind) || a.sourceId.localeCompare(b.sourceId) || a.id.localeCompare(b.id));
    if (!capabilities.length) throw new Error('No capabilities were selected from the supplied artifacts.');
    const producer = Object.assign({
      system: 'AXM Material / Surface Fabric',
      repository: 'mike-axiom-mir/axm-material-surface-fabric'
    }, clone(settings.producer || {}));
    const basis = {
      producer,
      capabilities: capabilities.map((capability) => ({ id: capability.id, fingerprint: capability.fingerprint }))
    };
    const fingerprint = fnv1a(stableStringify(basis));
    return {
      format: PACK_FORMAT,
      version: VERSION,
      id: `material-capability-pack-${fingerprint}`,
      name: text(settings.name, 'AXM Material Capability Pack'),
      fingerprint,
      producer,
      capabilities,
      summary: {
        total: capabilities.length,
        kinds: KINDS.reduce((out, kind) => { const count = capabilities.filter((item) => item.kind === kind).length; if (count) out[kind] = count; return out; }, {})
      },
      truthBoundary: {
        export: 'A capability pack proves exported state/provenance only. It does not prove that any downstream machine consumed or benefited from it.',
        portability: 'Portable bytes are carried only when present in the source material entry. Descriptor-only capabilities remain descriptor-only.',
        semantics: 'Sprite candidates and channel hints retain their original bounded semantics; export does not upgrade them into recognition or physical truth.',
        authority: 'Downstream adoption and feedback do not automatically promote, merge, or rewrite Material / Surface Fabric state.'
      }
    };
  }

  function validateCapabilityPack(pack) {
    try {
      if (!pack || pack.format !== PACK_FORMAT || pack.version !== VERSION) return { ok: false, reason: `Expected ${PACK_FORMAT}/${VERSION}.` };
      if (!pack.producer || !Array.isArray(pack.capabilities) || !pack.capabilities.length) return { ok: false, reason: 'Capability pack requires producer and non-empty capabilities.' };
      const ids = new Set();
      for (const capability of pack.capabilities) {
        if (!capability.id || !KINDS.includes(capability.kind) || !capability.sourceId) return { ok: false, reason: 'Capability id/kind/sourceId is invalid.' };
        if (ids.has(capability.id)) return { ok: false, reason: `Duplicate capability id: ${capability.id}` };
        ids.add(capability.id);
        const expectedId = capabilityIdentity(capability.kind, capability.sourceId, capability.payload || {});
        if (capability.id !== expectedId) return { ok: false, reason: `Capability identity mismatch: ${capability.id}` };
      }
      const basis = { producer: pack.producer, capabilities: pack.capabilities.map((capability) => ({ id: capability.id, fingerprint: capability.fingerprint })) };
      const expectedFingerprint = fnv1a(stableStringify(basis));
      if (pack.fingerprint !== expectedFingerprint || pack.id !== `material-capability-pack-${expectedFingerprint}`) return { ok: false, reason: 'Capability pack fingerprint/id mismatch.' };
      return { ok: true };
    } catch (error) { return { ok: false, reason: error && error.message ? error.message : String(error) }; }
  }

  function normalizeConsumer(raw) {
    const source = raw || {};
    const system = text(source.system || source.name);
    if (!system) throw new TypeError('Feedback consumer.system is required.');
    return {
      system,
      repository: text(source.repository) || null,
      adapter: text(source.adapter) || null,
      instance: text(source.instance) || null
    };
  }

  function normalizeFeedbackEvent(raw, pack) {
    const source = raw || {};
    const capabilityId = text(source.capabilityId);
    const action = text(source.action).toLowerCase();
    const outcome = text(source.outcome, 'PASS').toUpperCase();
    if (!pack.capabilities.some((item) => item.id === capabilityId)) throw new TypeError(`Feedback references unknown capability: ${capabilityId}`);
    if (!ACTIONS.includes(action)) throw new TypeError(`Unsupported feedback action: ${action}`);
    if (!OUTCOMES.includes(outcome)) throw new TypeError(`Unsupported feedback outcome: ${outcome}`);
    const evidence = clone(source.evidence || {});
    const derivedIds = unique(source.derivedIds || []);
    const note = text(source.note, '');
    const id = `use-event-${fnv1a(stableStringify({ capabilityId, action, outcome, evidence, derivedIds, note }))}`;
    return { id, capabilityId, action, outcome, evidence, derivedIds, note };
  }

  function createUseFeedback(pack, consumer, rawEvents, note) {
    const validation = validateCapabilityPack(pack);
    if (!validation.ok) throw new TypeError(validation.reason);
    const normalizedConsumer = normalizeConsumer(consumer);
    const events = (Array.isArray(rawEvents) ? rawEvents : []).map((event) => normalizeFeedbackEvent(event, pack));
    if (!events.length) throw new TypeError('Use feedback requires at least one explicit use event.');
    const duplicate = events.find((event, index) => events.findIndex((other) => other.id === event.id) !== index);
    if (duplicate) throw new TypeError(`Duplicate feedback event: ${duplicate.id}`);
    const basis = { packId: pack.id, packFingerprint: pack.fingerprint, consumer: normalizedConsumer, events };
    const fingerprint = fnv1a(stableStringify(basis));
    return {
      format: FEEDBACK_FORMAT,
      version: VERSION,
      id: `material-use-feedback-${fingerprint}`,
      fingerprint,
      packId: pack.id,
      packFingerprint: pack.fingerprint,
      consumer: normalizedConsumer,
      events,
      note: text(note, ''),
      truthBoundary: {
        use: 'Events state what the consumer reports doing with named capabilities; they do not prove artistic or physical quality.',
        adoption: 'Adopted/reused events are downstream-use evidence, not automatic authority over producer memory or canonical state.',
        rejection: 'Reject/HOLD events are preserved as evidence rather than silently removed.',
        privacy: 'Feedback should contain only evidence the downstream consumer intentionally exports.'
      }
    };
  }

  function validateUseFeedback(feedback, pack) {
    try {
      if (!feedback || feedback.format !== FEEDBACK_FORMAT || feedback.version !== VERSION) return { ok: false, reason: `Expected ${FEEDBACK_FORMAT}/${VERSION}.` };
      const packValidation = validateCapabilityPack(pack);
      if (!packValidation.ok) return packValidation;
      if (feedback.packId !== pack.id || feedback.packFingerprint !== pack.fingerprint) return { ok: false, reason: 'Feedback capability-pack linkage mismatch.' };
      normalizeConsumer(feedback.consumer);
      if (!Array.isArray(feedback.events) || !feedback.events.length) return { ok: false, reason: 'Feedback requires non-empty events.' };
      const normalized = feedback.events.map((event) => normalizeFeedbackEvent(event, pack));
      if (normalized.some((event, index) => event.id !== feedback.events[index].id)) return { ok: false, reason: 'Feedback event identity mismatch.' };
      const basis = { packId: feedback.packId, packFingerprint: feedback.packFingerprint, consumer: feedback.consumer, events: feedback.events };
      const expected = fnv1a(stableStringify(basis));
      if (feedback.fingerprint !== expected || feedback.id !== `material-use-feedback-${expected}`) return { ok: false, reason: 'Feedback fingerprint/id mismatch.' };
      return { ok: true };
    } catch (error) { return { ok: false, reason: error && error.message ? error.message : String(error) }; }
  }

  function createUsageLedger(name) {
    return {
      format: LEDGER_FORMAT,
      version: VERSION,
      id: `material-use-ledger-${fnv1a(text(name, 'default-ledger'))}`,
      name: text(name, 'Material Capability Use Ledger'),
      feedbackIds: [],
      capabilities: {},
      truthBoundary: {
        evidence: 'Counts summarize imported explicit downstream feedback only. Missing feedback means unknown use, not non-use.',
        scoring: 'The ledger does not convert use counts into beauty, physical correctness, or universal quality scores.',
        authority: 'Usage evidence never auto-promotes recipes, patterns, sprites, or materials.'
      }
    };
  }

  function validateLedger(ledger) {
    if (!ledger || ledger.format !== LEDGER_FORMAT || ledger.version !== VERSION) return { ok: false, reason: `Expected ${LEDGER_FORMAT}/${VERSION}.` };
    if (!Array.isArray(ledger.feedbackIds) || !ledger.capabilities || typeof ledger.capabilities !== 'object') return { ok: false, reason: 'Usage ledger structure is invalid.' };
    return { ok: true };
  }

  function consumerKey(consumer) {
    return [consumer.system, consumer.repository || '', consumer.adapter || '', consumer.instance || ''].join('|');
  }

  function applyUseFeedback(ledger, feedback, pack) {
    const ledgerValidation = validateLedger(ledger);
    if (!ledgerValidation.ok) throw new TypeError(ledgerValidation.reason);
    const feedbackValidation = validateUseFeedback(feedback, pack);
    if (!feedbackValidation.ok) throw new TypeError(feedbackValidation.reason);
    if (ledger.feedbackIds.includes(feedback.id)) return { applied: false, duplicate: true, ledger: clone(ledger) };
    const consumer = consumerKey(feedback.consumer);
    feedback.events.forEach((event) => {
      const capability = pack.capabilities.find((item) => item.id === event.capabilityId);
      const row = ledger.capabilities[event.capabilityId] || {
        capabilityId: event.capabilityId,
        kind: capability.kind,
        sourceId: capability.sourceId,
        consumers: [],
        events: 0,
        actions: {},
        outcomes: {},
        adopted: 0,
        reused: 0,
        rejected: 0,
        held: 0,
        feedbackIds: [],
        lastEvidence: null
      };
      row.events += 1;
      row.actions[event.action] = (row.actions[event.action] || 0) + 1;
      row.outcomes[event.outcome] = (row.outcomes[event.outcome] || 0) + 1;
      if (event.action === 'adopted' && event.outcome === 'PASS') row.adopted += 1;
      if (event.action === 'reused' && event.outcome === 'PASS') row.reused += 1;
      if (event.action === 'rejected' || event.outcome === 'REJECT') row.rejected += 1;
      if (event.outcome === 'HOLD') row.held += 1;
      row.consumers = unique(row.consumers.concat([consumer]));
      row.feedbackIds = unique(row.feedbackIds.concat([feedback.id]));
      row.lastEvidence = { feedbackId: feedback.id, eventId: event.id, action: event.action, outcome: event.outcome, evidence: clone(event.evidence), derivedIds: clone(event.derivedIds) };
      ledger.capabilities[event.capabilityId] = row;
    });
    ledger.feedbackIds = unique(ledger.feedbackIds.concat([feedback.id]));
    return { applied: true, duplicate: false, ledger: clone(ledger) };
  }

  function usageSummary(ledger) {
    const validation = validateLedger(ledger);
    if (!validation.ok) throw new TypeError(validation.reason);
    const rows = Object.values(ledger.capabilities);
    rows.sort((a, b) => (b.reused - a.reused) || (b.adopted - a.adopted) || (b.events - a.events) || a.capabilityId.localeCompare(b.capabilityId));
    return {
      ledgerId: ledger.id,
      feedbackReceipts: ledger.feedbackIds.length,
      capabilitiesObserved: rows.length,
      totalEvents: rows.reduce((sum, row) => sum + row.events, 0),
      adoptedEvents: rows.reduce((sum, row) => sum + row.adopted, 0),
      reusedEvents: rows.reduce((sum, row) => sum + row.reused, 0),
      rejectedEvents: rows.reduce((sum, row) => sum + row.rejected, 0),
      heldEvents: rows.reduce((sum, row) => sum + row.held, 0),
      rows: clone(rows),
      boundary: 'This is downstream-use evidence only. It is not an aesthetic ranking or automatic memory update.'
    };
  }

  return {
    VERSION, PACK_FORMAT, FEEDBACK_FORMAT, LEDGER_FORMAT,
    KINDS: KINDS.slice(), ACTIONS: ACTIONS.slice(), OUTCOMES: OUTCOMES.slice(),
    clone, stableStringify, fnv1a, capabilityIdentity, makeCapability,
    materialCapabilities, spriteCapabilities, recipeCapability, patternCapabilities, recipePackCapabilities, loopCapabilities,
    capabilitiesFromArtifact, createCapabilityPack, validateCapabilityPack,
    createUseFeedback, validateUseFeedback, createUsageLedger, validateLedger, applyUseFeedback, usageSummary
  };
});
