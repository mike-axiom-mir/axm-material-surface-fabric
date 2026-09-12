'use strict';
const assert = require('assert');
const core = require('../library-core.js');

const now = '2026-09-12T00:00:00.000Z';
const later = '2026-09-12T01:00:00.000Z';
const library = core.createLibrary(now);
assert.strictEqual(library.format, 'axm-material-library');
assert.strictEqual(library.version, '0.4.0');
assert.strictEqual(core.validateLibrary(library).ok, true);

const base = {
  id: 'random-workspace-id-a',
  name: 'painted-metal.png',
  kind: 'texture',
  mime: 'image/png',
  width: 64,
  height: 64,
  bytes: 12,
  dataUrl: 'data:image/png;base64,AAAA',
  source: { method: 'local-file', originalName: 'painted-metal.png' }
};
const sameBytesDifferentWorkspaceId = Object.assign({}, base, { id: 'random-workspace-id-b' });
assert.strictEqual(core.stableEntryId(base), core.stableEntryId(sameBytesDifferentWorkspaceId));
assert.strictEqual(core.suggestChannel(base), 'base-color');
assert.strictEqual(core.suggestChannel({ name: 'armor_roughness.png', kind: 'roughness' }), 'roughness');
assert.strictEqual(core.suggestChannel({ name: 'wear-overlay.png', kind: 'overlay' }), 'decal');

const libraryId = core.stableEntryId(base);
let receipt = core.upsertEntries(library, [Object.assign({}, base, { libraryId })], now);
assert.deepStrictEqual(receipt.added, [libraryId]);
assert.strictEqual(library.entries.length, 1);

receipt = core.upsertEntries(library, [Object.assign({}, sameBytesDifferentWorkspaceId, { libraryId })], later);
assert.deepStrictEqual(receipt.updated, [libraryId]);
assert.strictEqual(library.entries.length, 1, 'same stable material entry should update rather than duplicate');
assert.strictEqual(library.entries[0].addedAt, now);
assert.strictEqual(library.entries[0].updatedAt, later);

core.setEntryChannel(library, libraryId, 'roughness', later);
assert.strictEqual(library.entries[0].usage.channelHint, 'roughness');
assert.strictEqual(library.entries[0].usage.channelBasis, 'operator-declared');

const overlay = {
  name: 'scratch-overlay.png',
  kind: 'overlay',
  mime: 'image/png',
  width: 64,
  height: 64,
  dataUrl: 'data:image/png;base64,BBBB',
  source: { method: 'generated-source', generator: 'test' }
};
const overlayId = core.stableEntryId(overlay);
core.upsertEntries(library, [Object.assign({}, overlay, { libraryId: overlayId })], later);
const family = core.createFamily(library, {
  name: 'painted metal family',
  purpose: 'Reusable base + wear test family.',
  entryIds: [libraryId, overlayId],
  tags: ['metal', 'wear']
}, later);
assert.strictEqual(family.entryIds.length, 2);
assert.strictEqual(library.families.length, 1);

const pack = core.makeDonorPack({
  library,
  selectedEntryIds: [libraryId, overlayId],
  workspace: { name: 'surface' },
  layers: [{ id: 'layer-1', assetId: 'source' }],
  exportedAt: later
});
assert.strictEqual(pack.format, 'axm-material-donor-pack');
assert.strictEqual(pack.version, '0.2.0');
assert.strictEqual(pack.library.entries.length, 2);
assert.strictEqual(pack.library.families.length, 1);
assert.strictEqual(pack.assets.length, 2, 'legacy-compatible asset list remains present');

const imported = core.importDonorPack(pack, '2026-09-12T02:00:00.000Z');
assert.strictEqual(imported.entries.length, 2);
assert.strictEqual(imported.families.length, 1);
assert.strictEqual(imported.receipt.portableEntries, 2);
assert.strictEqual(imported.entries[0].source.donorPackId, pack.id);

const library2 = core.createLibrary('2026-09-12T02:00:00.000Z');
core.upsertEntries(library2, imported.entries.map((entry) => Object.assign({}, entry, { libraryId: entry.id })), '2026-09-12T02:00:00.000Z');
imported.families.forEach((item) => core.createFamily(library2, item, '2026-09-12T02:00:00.000Z'));
const pack2 = core.makeDonorPack({ library: library2, exportedAt: '2026-09-12T03:00:00.000Z' });
assert.deepStrictEqual(
  pack2.library.entries.map((entry) => entry.id).sort(),
  pack.library.entries.map((entry) => entry.id).sort(),
  'donor-pack entries should survive a library round trip'
);
assert.deepStrictEqual(pack2.library.families[0].entryIds, pack.library.families[0].entryIds);

const legacyPack = {
  format: 'axm-material-donor-pack',
  version: '0.1.0',
  id: 'legacy',
  exportedAt: now,
  assets: [base]
};
const legacyImported = core.importDonorPack(legacyPack, later);
assert.strictEqual(legacyImported.entries.length, 1);
assert.strictEqual(legacyImported.families.length, 0);

assert.strictEqual(core.validateLibrary({}).ok, false);
assert.throws(() => core.importDonorPack({}), /Not an AXM material donor pack/);

console.log('AXM material library tests: PASS');
