'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../capability-exchange-core.js');

const ROOT = path.join(__dirname, '..');
const PACK_PATH = path.join(ROOT, 'examples', 'circulation', 'universal-creation', 'full-circulation-v0.18-capability-pack.json');
const FEEDBACK_PATH = path.join(ROOT, 'examples', 'circulation', 'universal-creation', 'full-circulation-v0.18-feedback.json');

const pack = JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
const feedback = JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf8'));

assert.strictEqual(core.validateCapabilityPack(pack).ok, true, 'cross-repo capability pack must remain valid v0.18 state');
assert.strictEqual(pack.id, 'material-capability-pack-756825c8');
assert.strictEqual(pack.fingerprint, '756825c8');
assert.strictEqual(pack.capabilities.length, 5);
assert.deepStrictEqual(
  new Set(pack.capabilities.map((item) => item.kind)),
  new Set(['material-entry','material-family','sprite-candidate','recipe','pattern'])
);

const feedbackValidation = core.validateUseFeedback(feedback, pack);
assert.strictEqual(feedbackValidation.ok, true, feedbackValidation.reason || 'Universal Creation feedback must validate');
assert.strictEqual(feedback.id, 'material-use-feedback-4e1937b3');
assert.strictEqual(feedback.consumer.system, 'AXM Universal Creation');
assert.strictEqual(feedback.consumer.repository, 'mike-axiom-mir/axm-universal-creation');
assert.strictEqual(feedback.consumer.adapter, 'material-capability-consumer/v0.19.0');
assert.strictEqual(feedback.events.length, 5);

const events = new Map(feedback.events.map((event) => [event.capabilityId, event]));
for (const capability of pack.capabilities) {
  const event = events.get(capability.id);
  assert.ok(event, `missing downstream feedback for ${capability.id}`);
  assert.strictEqual(event.action, 'adopted');
  assert.strictEqual(event.outcome, 'PASS');
  assert.ok(event.derivedIds.length >= 1, `adopted capability ${capability.id} must preserve a downstream derived id`);
}

assert.deepStrictEqual(events.get('cap-material-entry-8fba7d60').derivedIds, ['texture-surface-base']);
assert.deepStrictEqual(events.get('cap-material-family-0f94735e').derivedIds, ['material-painted-metal-family']);
assert.deepStrictEqual(events.get('cap-pattern-bfe14cc0').derivedIds, ['uc-pattern-49da0176']);
assert.deepStrictEqual(events.get('cap-recipe-642024ae').derivedIds, ['uc-recipe-922067f2']);
assert.deepStrictEqual(events.get('cap-sprite-candidate-bfd4a164').derivedIds, ['uc-sprite-052e2cac']);

const ledger = core.createUsageLedger('Universal Creation full circulation proof');
const applied = core.applyUseFeedback(ledger, feedback, pack);
assert.strictEqual(applied.applied, true);
assert.strictEqual(applied.duplicate, false);

const summary = core.usageSummary(applied.ledger);
assert.strictEqual(summary.feedbackReceipts, 1);
assert.strictEqual(summary.capabilitiesObserved, 5);
assert.strictEqual(summary.totalEvents, 5);
assert.strictEqual(summary.adoptedEvents, 5);
assert.strictEqual(summary.reusedEvents, 0);
assert.strictEqual(summary.rejectedEvents, 0);
assert.strictEqual(summary.heldEvents, 0);

for (const row of Object.values(applied.ledger.capabilities)) {
  assert.strictEqual(row.adopted, 1);
  assert.strictEqual(row.rejected, 0);
  assert.strictEqual(row.held, 0);
  assert.strictEqual(row.consumers.length, 1);
  assert.strictEqual(row.feedbackIds.length, 1);
  assert.ok(row.lastEvidence && row.lastEvidence.derivedIds.length >= 1);
}

const duplicate = core.applyUseFeedback(applied.ledger, feedback, pack);
assert.strictEqual(duplicate.applied, false);
assert.strictEqual(duplicate.duplicate, true);
assert.strictEqual(core.usageSummary(duplicate.ledger).totalEvents, 5, 're-applying the exact cross-repo receipt must be idempotent');

assert.match(JSON.stringify(feedback.truthBoundary), /does not prove beauty|does not prove/i);
assert.match(core.usageSummary(applied.ledger).boundary, /downstream-use evidence only/i);

console.log('AXM Material Fabric <-> Universal Creation circulation proof: PASS');
