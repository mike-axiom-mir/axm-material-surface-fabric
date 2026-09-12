'use strict';
const assert = require('assert');
const core = require('../exchange-core.js');

const PNG_A = 'data:image/png;base64,iVBORw0KGgo=';
const PNG_B = 'data:image/png;base64,iVBORw0KGgp=';

function offer() {
  return {
    format: 'axm-material-offer',
    version: '0.9.0',
    id: 'offer-forge-armor-01',
    createdAt: '2026-09-12T09:30:00.000Z',
    producer: {
      system: 'AXM Game Asset Forge',
      repo: 'mike-axiom-mir/Axm-game-assets',
      sourceId: 'sentinel-armor-proof',
      sourceDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      stateKind: 'detached-material-export',
      version: 'proof'
    },
    entries: [
      {
        id: 'armor-base', name: 'Armor base', channel: 'base-color', mime: 'image/png', width: 1, height: 1,
        dataUrl: PNG_A, sha256: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        source: { authoring: 'fixture' }, tags: ['armor']
      },
      {
        id: 'armor-rough', name: 'Armor roughness', channel: 'roughness', mime: 'image/png', width: 1, height: 1,
        dataUrl: PNG_B, source: { authoring: 'fixture' }, tags: ['armor']
      },
      {
        id: 'armor-height', name: 'Armor height descriptor only', channel: 'height', mime: 'image/png', width: 0, height: 0,
        source: { authoring: 'fixture-no-payload' }, tags: ['armor']
      }
    ],
    families: [
      { id: 'armor-family', name: 'Sentinel armor material', purpose: 'Cross-machine fixture.', entryIds: ['armor-base','armor-rough','armor-height'], tags: ['armor'] }
    ],
    evidence: { fixture: true }
  };
}

assert.strictEqual(core.VERSION, '0.9.0');
assert.strictEqual(core.validateOffer(offer()).ok, true);
assert.strictEqual(core.offerFingerprint(offer()), core.offerFingerprint(JSON.parse(JSON.stringify(offer()))));

const normalized = core.normalizeOffer(offer());
assert.strictEqual(normalized.producer.system, 'AXM Game Asset Forge');
assert.strictEqual(normalized.entries.find((entry) => entry.id === 'armor-base').channel, 'base-color');
assert.strictEqual(normalized.entries.find((entry) => entry.id === 'armor-height').dataUrl, null);

const planBeforeVerification = core.intakePlan(offer(), {});
assert.strictEqual(planBeforeVerification.summary.entries, 3);
assert.strictEqual(planBeforeVerification.summary.portable, 2);
assert.strictEqual(planBeforeVerification.summary.pending, 1);
assert.strictEqual(planBeforeVerification.summary.held, 1);
assert.strictEqual(planBeforeVerification.families[0].state, 'partial-hold');

const verified = { 'armor-base': { sha256Match: true, observedSha256: 'sha256:1111111111111111111111111111111111111111111111111111111111111111' } };
const planVerified = core.intakePlan(offer(), verified);
assert.strictEqual(planVerified.summary.verified, 1);
assert.strictEqual(planVerified.summary.pending, 0);

const mismatch = { 'armor-base': { sha256Match: false } };
const mismatchPlan = core.intakePlan(offer(), mismatch);
assert.strictEqual(mismatchPlan.summary.held, 2);
assert.strictEqual(mismatchPlan.entries.find((entry) => entry.entryId === 'armor-base').reason, 'sha256-mismatch');

const bundleA = core.toLibraryBundle(offer(), 'armor-family', verified, '2026-09-12T10:00:00.000Z');
const bundleB = core.toLibraryBundle(offer(), 'armor-family', verified, '2026-09-12T10:01:00.000Z');
assert.strictEqual(bundleA.entries.length, 3);
assert.strictEqual(bundleA.family.entryIds.length, 3);
assert.deepStrictEqual(bundleA.entries.map((entry) => entry.libraryId), bundleB.entries.map((entry) => entry.libraryId), 'library identity must not depend on install timestamp');
assert.strictEqual(bundleA.entries.find((entry) => entry.kind === 'base-color').source.receiverHashVerification, 'verified');
assert.strictEqual(bundleA.entries.find((entry) => entry.kind === 'height').source.receiverState, 'hold');
assert.strictEqual(bundleA.entries.find((entry) => entry.kind === 'base-color').usage.channelBasis, 'producer-declared-v0.9-material-offer');

const session = {
  format: 'axm-material-evaluation-session', version: '0.8.0', id: 'eval-1',
  source: { kind: 'saved-influence-recipe' }, mode: 'quick', resolution: 64,
  geometries: ['sphere'], lightRigIds: ['neutral-studio','hard-side'], selectedCandidateId: 'recipe-x',
  candidates: [{
    id: 'recipe-x', name: 'imported armor', rank: 1, descriptorHash: 'abc',
    run: {
      sourceKind: 'saved-v0.5-influence-workspace', technicalScore: 91.2, minimumTechnicalScore: 76.4,
      completionShare: 1, holds: 0, observationCount: 2, uniqueFramebufferHashes: 2,
      scoreBoundary: 'technical only'
    }
  }],
  truthBoundary: { ranking: 'not beauty' }
};
const feedback = core.makeFeedback({
  offer: offer(), familyId: 'armor-family', evaluationSession: session, verification: verified,
  installReceipt: { authority: 'explicit-user-promotion' }, createdAt: '2026-09-12T10:10:00.000Z'
});
assert.strictEqual(feedback.format, 'axm-material-feedback');
assert.strictEqual(feedback.version, '0.9.0');
assert.strictEqual(feedback.offer.id, offer().id);
assert.strictEqual(feedback.offer.familyId, 'armor-family');
assert.strictEqual(feedback.evaluation.candidates[0].technicalScore, 91.2);
assert.strictEqual(feedback.installReceipt.authority, 'explicit-user-promotion');
assert.strictEqual(core.validateFeedback(feedback).ok, true);

const duplicateEntries = offer();
duplicateEntries.entries.push(Object.assign({}, duplicateEntries.entries[0]));
assert.match(core.validateOffer(duplicateEntries).reason, /Duplicate material offer entry id/);

const missingRef = offer();
missingRef.families[0].entryIds.push('missing-entry');
assert.match(core.validateOffer(missingRef).reason, /references missing entries/);

const duplicateFamilies = offer();
duplicateFamilies.families.push(Object.assign({}, duplicateFamilies.families[0]));
assert.match(core.validateOffer(duplicateFamilies).reason, /Duplicate material offer family id/);

const invalidHash = offer();
invalidHash.entries[0].sha256 = 'sha256:not-real';
assert.match(core.validateOffer(invalidHash).reason, /sha256/);

const invalidDataUrl = offer();
invalidDataUrl.entries[0].dataUrl = 'https://example.com/texture.png';
assert.match(core.validateOffer(invalidDataUrl).reason, /dataUrl/);

const autoPromotionText = core.stableStringify(feedback.truthBoundary);
assert.match(autoPromotionText, /never grants automatic promotion authority/);

console.log('AXM material exchange tests: PASS');
