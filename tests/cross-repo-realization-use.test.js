'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const core = require('../capability-exchange-core.js');

const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'examples', 'circulation', 'universal-creation');
const PACK_PATH = path.join(BASE, 'full-circulation-v0.18-capability-pack.json');
const ADOPTION_PATH = path.join(BASE, 'full-circulation-v0.18-feedback.json');
const REALIZATION_PATH = path.join(BASE, 'full-circulation-v0.20-realization.svg');
const REUSE_PATH = path.join(BASE, 'full-circulation-v0.20-realization-feedback.json');

const pack = JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
const adoption = JSON.parse(fs.readFileSync(ADOPTION_PATH, 'utf8'));
const reuse = JSON.parse(fs.readFileSync(REUSE_PATH, 'utf8'));
const svg = fs.readFileSync(REALIZATION_PATH);
const svgSha256 = crypto.createHash('sha256').update(svg).digest('hex');

assert.strictEqual(core.validateCapabilityPack(pack).ok, true, 'shared circulation pack must remain valid');
assert.strictEqual(core.validateUseFeedback(adoption, pack).ok, true, 'detached adoption receipt must remain valid');
const reuseValidation = core.validateUseFeedback(reuse, pack);
assert.strictEqual(reuseValidation.ok, true, reuseValidation.reason || 'native realization feedback must validate');

assert.strictEqual(svgSha256, 'a00b24de9257c68852060d0ebb3c02fe958d38499ead5091c86807ae17e06b74');
assert.match(svg.toString('utf8'), /axm\.uc\.material-capability-realization\/v0\.1/);
assert.match(svg.toString('utf8'), /uc-material-creation-a80d9ff46d31057e1aa5/);
assert.match(svg.toString('utf8'), /producerPixelsRendered&quot;:false|producerPixelsRendered":false/);

assert.strictEqual(reuse.id, 'material-use-feedback-0a233906');
assert.strictEqual(reuse.fingerprint, '0a233906');
assert.strictEqual(reuse.consumer.system, 'AXM Universal Creation');
assert.strictEqual(reuse.consumer.repository, 'mike-axiom-mir/axm-universal-creation');
assert.strictEqual(reuse.consumer.adapter, 'material-capability-realizer/v0.20.0');
assert.strictEqual(reuse.events.length, 5);

const expectedModes = new Map([
  ['cap-material-entry-8fba7d60', 'hash-derived-native-palette-seed'],
  ['cap-material-family-0f94735e', 'native-material-family-grouping'],
  ['cap-sprite-candidate-bfd4a164', 'alpha-bounds-native-motif-window'],
  ['cap-recipe-642024ae', 'layout-transform-opacity-blend-structure'],
  ['cap-pattern-bfe14cc0', 'slot-order-category-support-motif-structure']
]);

for (const capability of pack.capabilities) {
  const event = reuse.events.find((row) => row.capabilityId === capability.id);
  assert.ok(event, `missing actual-use feedback for ${capability.id}`);
  assert.strictEqual(event.action, 'reused');
  assert.strictEqual(event.outcome, 'PASS');
  assert.deepStrictEqual(event.derivedIds, ['uc-material-creation-a80d9ff46d31057e1aa5']);
  assert.strictEqual(event.evidence.nativeCreationId, 'uc-material-creation-a80d9ff46d31057e1aa5');
  assert.strictEqual(event.evidence.artifactFormat, 'image/svg+xml');
  assert.strictEqual(event.evidence.artifactSha256, svgSha256);
  assert.strictEqual(event.evidence.useMode, expectedModes.get(capability.id));
  assert.strictEqual(event.evidence.svgArtifactGenerated, true);
  assert.strictEqual(event.evidence.producerPixelsRendered, false);
  assert.strictEqual(event.evidence.rasterRenderVerified, false);
}

const ledger = core.createUsageLedger('Universal Creation actual-use circulation proof');
const first = core.applyUseFeedback(ledger, adoption, pack);
assert.strictEqual(first.applied, true);
const second = core.applyUseFeedback(first.ledger, reuse, pack);
assert.strictEqual(second.applied, true);

const summary = core.usageSummary(second.ledger);
assert.strictEqual(summary.feedbackReceipts, 2);
assert.strictEqual(summary.capabilitiesObserved, 5);
assert.strictEqual(summary.totalEvents, 10);
assert.strictEqual(summary.adoptedEvents, 5);
assert.strictEqual(summary.reusedEvents, 5);
assert.strictEqual(summary.rejectedEvents, 0);
assert.strictEqual(summary.heldEvents, 0);

for (const row of Object.values(second.ledger.capabilities)) {
  assert.strictEqual(row.adopted, 1);
  assert.strictEqual(row.reused, 1);
  assert.strictEqual(row.rejected, 0);
  assert.strictEqual(row.held, 0);
  assert.strictEqual(row.feedbackIds.length, 2);
  assert.strictEqual(row.consumers.length, 2, 'adoption and realization adapters must remain distinct downstream evidence sources');
  assert.strictEqual(row.lastEvidence.action, 'reused');
  assert.strictEqual(row.lastEvidence.outcome, 'PASS');
  assert.deepStrictEqual(row.lastEvidence.derivedIds, ['uc-material-creation-a80d9ff46d31057e1aa5']);
}

const duplicate = core.applyUseFeedback(second.ledger, reuse, pack);
assert.strictEqual(duplicate.applied, false);
assert.strictEqual(duplicate.duplicate, true);
assert.strictEqual(core.usageSummary(duplicate.ledger).totalEvents, 10, 'duplicate actual-use evidence must not inflate the ledger');

assert.match(JSON.stringify(reuse.truthBoundary), /not rendered or sampled|not prove aesthetics/i);
assert.match(summary.boundary, /downstream-use evidence only/i);

console.log('AXM Material Fabric <-> Universal Creation actual-use proof: PASS');
