'use strict';

const assert = require('assert');
const core = require('../material-vocabulary-core.js');

assert.strictEqual(core.VERSION, '0.7.0');
assert.strictEqual(core.FORMAT, 'axm-material-vocabulary');
assert.ok(core.FAMILIES.length >= 39, `expected broad family vocabulary, got ${core.FAMILIES.length}`);
assert.ok(core.OVERLAYS.length >= 18, `expected reusable overlay vocabulary, got ${core.OVERLAYS.length}`);

const familyIds = core.FAMILIES.map((family) => family.id);
assert.strictEqual(new Set(familyIds).size, familyIds.length, 'family ids must be unique');
const overlayIds = core.OVERLAYS.map((overlay) => overlay.id);
assert.strictEqual(new Set(overlayIds).size, overlayIds.length, 'overlay ids must be unique');

const required = ['base-color', 'normal', 'roughness', 'metallic', 'ambient-occlusion', 'height'];
core.FAMILIES.forEach((family) => {
  const channels = core.familyChannels(family);
  required.forEach((channel) => assert.ok(channels.includes(channel), `${family.id} missing ${channel}`));
  assert.ok(family.palette.length >= 2, `${family.id} requires at least two palette colors`);
  assert.ok(family.scale > 0, `${family.id} requires positive scale`);
});

['clear-glass', 'frosted-glass', 'dirty-glass', 'ice', 'holographic-film'].forEach((id) => {
  assert.ok(core.familyChannels(core.familyById(id)).includes('opacity'), `${id} should expose opacity`);
});
['emissive-panel', 'holographic-film'].forEach((id) => {
  assert.ok(core.familyChannels(core.familyById(id)).includes('emissive'), `${id} should expose emissive`);
});

const coverage = core.coverageSummary();
assert.strictEqual(coverage.families, core.FAMILIES.length);
assert.strictEqual(coverage.overlays, core.OVERLAYS.length);
assert.ok(coverage.totalEntries >= 250, `expected >=250 reusable entries, got ${coverage.totalEntries}`);
assert.ok(Object.keys(coverage.categories).length >= 6, 'expected at least six material categories');
required.forEach((channel) => assert.ok(coverage.channels[channel] >= core.FAMILIES.length, `${channel} coverage should include every family`));

const manifest = core.manifest();
assert.strictEqual(manifest.format, core.FORMAT);
assert.strictEqual(manifest.version, core.VERSION);
assert.strictEqual(manifest.families.length, core.FAMILIES.length);
assert.strictEqual(manifest.coverage.totalEntries, coverage.totalEntries);
assert.ok(manifest.truthBoundary.generation.includes('synthetic'));

const probeFamilies = ['brushed-steel', 'rusted-steel', 'clear-glass', 'brick', 'oak', 'canvas', 'emissive-panel', 'bio-organic'];
probeFamilies.forEach((id) => {
  const family = core.familyById(id);
  assert.ok(family, `missing probe family ${id}`);
  const a = core.familySample(family, 0.137, 0.793);
  const b = core.familySample(family, 0.137, 0.793);
  assert.deepStrictEqual(a, b, `${id} sampling must be deterministic`);
  ['height', 'roughness', 'metallic', 'ao', 'opacity'].forEach((field) => {
    assert.ok(a[field] >= 0 && a[field] <= 1, `${id}.${field} must be bounded`);
  });
  assert.strictEqual(a.baseColor.length, 3);
  a.baseColor.forEach((value) => assert.ok(Number.isInteger(value) && value >= 0 && value <= 255));

  core.familyChannels(family).forEach((channel) => {
    const rgba = core.sampleFamilyChannel(family, channel, 0.137, 0.793, 1 / 128);
    assert.strictEqual(rgba.length, 4, `${id}/${channel} must return RGBA`);
    rgba.forEach((value) => assert.ok(Number.isInteger(value) && value >= 0 && value <= 255, `${id}/${channel} channel byte must be bounded`));
  });
});

const normal = core.sampleNormal(core.familyById('concrete'), 0.37, 0.61, 1 / 128);
const nx = normal[0] / 255 * 2 - 1;
const ny = normal[1] / 255 * 2 - 1;
const nz = normal[2] / 255 * 2 - 1;
const normalLength = Math.hypot(nx, ny, nz);
assert.ok(Math.abs(normalLength - 1) < 0.025, `encoded normal should stay normalized, got ${normalLength}`);
assert.ok(nz > 0, 'tangent-space normal should face outward');

core.OVERLAYS.forEach((overlay) => {
  const rgba = core.sampleOverlay(overlay, 0.29, 0.67);
  assert.strictEqual(rgba.length, 4);
  rgba.forEach((value) => assert.ok(Number.isInteger(value) && value >= 0 && value <= 255));
});

const scratch = core.overlayById('fine-scratches');
const scratchSamples = [];
for (let y = 0; y < 12; y += 1) {
  for (let x = 0; x < 12; x += 1) scratchSamples.push(core.overlayMask(scratch, x / 12, y / 12));
}
assert.ok(Math.max(...scratchSamples) > Math.min(...scratchSamples), 'overlay mask must contain actual spatial variation');

const entry = core.makeFamilyEntry(core.familyById('painted-steel'), 'base-color', 'data:image/png;base64,AAAA', 128);
assert.strictEqual(entry.libraryId, 'material-vocab-painted-steel-base-color');
assert.strictEqual(entry.usage.channelHint, 'base-color');
assert.strictEqual(entry.source.synthetic, true);
assert.strictEqual(entry.source.vocabularyVersion, '0.7.0');
assert.ok(entry.tags.includes('metal'));

const family = core.familyById('painted-steel');
const familyRecord = core.makeFamilyRecord(family, core.familyChannels(family).map((channel) => core.familyEntryId(family.id, channel)), '2026-09-12T00:00:00Z');
assert.strictEqual(familyRecord.id, 'family-vocab-painted-steel');
assert.strictEqual(familyRecord.entryIds.length, core.familyChannels(family).length);
assert.ok(familyRecord.purpose.includes('Deterministic reusable seed family'));

const overlayEntry = core.makeOverlayEntry(core.overlayById('rust-speckles'), 'data:image/png;base64,BBBB', 128);
assert.strictEqual(overlayEntry.libraryId, 'material-vocab-overlay-rust-speckles');
assert.strictEqual(overlayEntry.usage.channelHint, 'decal');
assert.strictEqual(overlayEntry.source.synthetic, true);

assert.strictEqual(core.familyById('does-not-exist'), null);
assert.strictEqual(core.overlayById('does-not-exist'), null);
assert.throws(() => core.makeFamilyEntry(core.familyById('oak'), 'emissive', 'data:image/png;base64,AA', 64), /not declared/);

console.log(`AXM material vocabulary tests: PASS (${coverage.families} families / ${coverage.totalEntries} entries)`);
