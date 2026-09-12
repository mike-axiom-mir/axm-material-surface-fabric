'use strict';

const assert = require('assert');
const libraryCore = require('../library-core.js');
const capabilityCore = require('../capability-exchange-core.js');
const premadePack = require('../premade-pack.js');
const batchCore = require('../batch-readiness-core.js');
const { buildSyntheticLibrary } = require('../tools/material-batch-readiness.js');

const ninety = buildSyntheticLibrary(15, 4); // 15 families x 6 channels = 90 entries
const report90 = batchCore.analyzeLibrary(ninety);
assert.strictEqual(report90.format, 'axm-material-batch-readiness');
assert.strictEqual(report90.version, '0.18.3');
assert.strictEqual(report90.summary.status, 'PASS');
assert.strictEqual(report90.library.entries, 90);
assert.strictEqual(report90.library.families, 15);
assert.strictEqual(report90.summary.portableEntries, 90);
assert.strictEqual(report90.summary.entryIssues, 0);
assert.strictEqual(report90.summary.familyIssues, 0);
assert.strictEqual(report90.summary.plannedPacks, 1);
assert.strictEqual(report90.chunks[0].entryIds.length, 90);
assert.strictEqual(report90.chunks[0].familyIds.length, 15);
assert.strictEqual(report90.chunks[0].capabilities, 105);
assert.strictEqual(report90.summary.totalCapabilities, 105);
assert.ok(report90.chunks[0].entryIds.every((id) => id.startsWith('stress-')));

const donor90 = libraryCore.makeDonorPack({ library: ninety, selectedEntryIds: report90.chunks[0].entryIds, exportedAt: '2026-09-12T00:00:00.000Z' });
assert.strictEqual(donor90.library.entries.length, 90);
assert.strictEqual(donor90.library.families.length, 15);
assert.ok(donor90.library.entries.every((entry) => typeof entry.dataUrl === 'string' && entry.dataUrl.startsWith('data:image/png;base64,')));

const capability90 = capabilityCore.createCapabilityPack([ninety], premadePack, { name: '90-entry batch stress pack' });
assert.strictEqual(capabilityCore.validateCapabilityPack(capability90).ok, true);
assert.strictEqual(capability90.summary.kinds['material-entry'], 90);
assert.strictEqual(capability90.summary.kinds['material-family'], 15);
assert.strictEqual(capability90.capabilities.length, 105);

const feedback90 = capabilityCore.createUseFeedback(
  capability90,
  { system:'AXM batch stress consumer', adapter:'v0.18.3-test' },
  capability90.capabilities.map((capability) => ({
    capabilityId: capability.id,
    action: 'adopted',
    outcome: 'PASS',
    evidence: { syntheticStressEvidence: true },
    derivedIds: [`stress-use-${capability.id}`]
  }))
);
assert.strictEqual(capabilityCore.validateUseFeedback(feedback90, capability90).ok, true);
const ledger90 = capabilityCore.applyUseFeedback(capabilityCore.createUsageLedger('90 asset stress'), feedback90, capability90).ledger;
const usage90 = capabilityCore.usageSummary(ledger90);
assert.strictEqual(usage90.totalEvents, 105);
assert.strictEqual(usage90.adoptedEvents, 105);
assert.strictEqual(usage90.rejectedEvents, 0);
assert.strictEqual(usage90.heldEvents, 0);

// 22 six-channel families = 132 entries, so the existing 128-entry downstream material boundary
// must be respected by deterministic family-preserving chunking instead of hidden truncation.
const oneThirtyTwo = buildSyntheticLibrary(22, 4);
const report132 = batchCore.analyzeLibrary(oneThirtyTwo);
assert.strictEqual(report132.summary.status, 'PASS');
assert.strictEqual(report132.library.entries, 132);
assert.strictEqual(report132.summary.plannedPacks, 2);
assert.strictEqual(report132.chunks.reduce((sum, chunk) => sum + chunk.entryIds.length, 0), 132);
assert.ok(report132.chunks.every((chunk) => chunk.entryIds.length <= 128));
assert.ok(report132.chunks.every((chunk) => chunk.familyIds.length <= 128));
assert.ok(report132.chunks.every((chunk) => chunk.capabilities <= 512));
for (const family of oneThirtyTwo.families) {
  const containing = report132.chunks.filter((chunk) => family.entryIds.every((id) => chunk.entryIds.includes(id)));
  assert.strictEqual(containing.length, 1, `family ${family.id} must remain intact in exactly one chunk`);
}

// Planning is deterministic and independent of library array ordering.
const shuffled = JSON.parse(JSON.stringify(oneThirtyTwo));
shuffled.entries.reverse();
shuffled.families.reverse();
assert.deepStrictEqual(batchCore.planChunks(shuffled), batchCore.planChunks(oneThirtyTwo));

// Incomplete portable state is reported as HOLD, never quietly treated as downstream-ready.
const missingPayload = buildSyntheticLibrary(1, 4);
missingPayload.entries[0].dataUrl = null;
missingPayload.entries[0].payload = { portable:false, length:0, hash:null };
const missingReport = batchCore.analyzeLibrary(missingPayload);
assert.strictEqual(missingReport.summary.status, 'HOLD');
assert.ok(missingReport.holds.some((hold) => hold.kind === 'entry' && hold.issues.includes('no-portable-payload')));

// Duplicate channel membership inside a family is a downstream ambiguity and stays HOLD.
const duplicateChannel = buildSyntheticLibrary(1, 4);
const extra = JSON.parse(JSON.stringify(duplicateChannel.entries[0]));
extra.id = 'stress-001-base-color-copy';
extra.name += ' copy';
libraryCore.upsertEntries(duplicateChannel, [extra], '2026-09-12T00:00:00.000Z');
duplicateChannel.families[0].entryIds.push(extra.id);
const duplicateReport = batchCore.analyzeLibrary(duplicateChannel);
assert.strictEqual(duplicateReport.summary.status, 'HOLD');
assert.ok(duplicateReport.holds.some((hold) => hold.kind === 'family' && hold.issues.some((issue) => issue.startsWith('duplicate-family-channels:'))));

assert.match(report90.truthBoundary.readiness, /deterministically partitioned/);
assert.match(report90.truthBoundary.scope, /does not prove visual quality/i);

console.log('AXM v0.18.3 batch readiness + 90-entry stress tests: PASS');
