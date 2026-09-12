'use strict';
const assert = require('assert');
const core = require('../alpha-sprite-core.js');

function image(width, height) {
  return { width, height, rgba: new Uint8Array(width * height * 4) };
}
function fill(img, x0, y0, width, height, alpha = 255) {
  for (let y = y0; y < y0 + height; y += 1) for (let x = x0; x < x0 + width; x += 1) {
    const i = (y * img.width + x) * 4;
    img.rgba[i] = 80 + x; img.rgba[i + 1] = 120 + y; img.rgba[i + 2] = 180; img.rgba[i + 3] = alpha;
  }
}

const empty = image(20, 12);
assert.deepStrictEqual(core.extractCandidates(empty.rgba, empty.width, empty.height, 'empty', {
  alphaThreshold: 128, minComponentPixels: 1, minSpritePixels: 1, mergeGap: 1, padding: 0
}), []);

const sample = image(20, 12);
fill(sample, 1, 1, 3, 3);
fill(sample, 5, 2, 1, 1); // one-pixel fragment one pixel away from first box
fill(sample, 13, 6, 4, 3);
fill(sample, 18, 10, 1, 1, 60); // below threshold; must not become a candidate

const separate = core.extractCandidates(sample.rgba, sample.width, sample.height, 'test-atlas', {
  alphaThreshold: 128, minComponentPixels: 1, minSpritePixels: 1, mergeGap: 0, padding: 0
});
assert.strictEqual(separate.length, 3, 'zero-gap extraction keeps the nearby fragment separate');

const merged = core.extractCandidates(sample.rgba, sample.width, sample.height, 'test-atlas', {
  alphaThreshold: 128, minComponentPixels: 1, minSpritePixels: 1, mergeGap: 1, padding: 1
});
assert.strictEqual(merged.length, 2, 'nearby alpha fragments should group conservatively');
assert.strictEqual(merged[0].componentCount, 2);
assert.strictEqual(merged[0].atlasId, 'test-atlas');
assert.ok(merged[0].id.startsWith('test-atlas/sprite-001-'));
assert.ok(merged[0].alphaCoverage.thresholdShare > 0);
assert.ok(merged[0].normalizedBounds.x >= 0 && merged[0].normalizedBounds.x <= 1);
assert.ok(merged[0].normalizedBounds.x + merged[0].normalizedBounds.width <= 1.000001);
assert.match(merged[0].truth, /not inferred/);

const repeat = core.extractCandidates(sample.rgba, sample.width, sample.height, 'test-atlas', {
  alphaThreshold: 128, minComponentPixels: 1, minSpritePixels: 1, mergeGap: 1, padding: 1
});
assert.deepStrictEqual(repeat, merged, 'same bytes + parameters must reproduce exact candidate identity');

const crop = core.cropRgba(sample.rgba, sample.width, sample.height, merged[1].bounds);
assert.strictEqual(crop.rgba.length, crop.width * crop.height * 4);
assert.ok(crop.rgba.some((value, index) => index % 4 === 3 && value >= 128));

const index = core.makeIndex({
  pack: { format: 'axm-premade-visual-asset-pack', version: '0.11.0', archiveSha256: 'sha256:test' },
  atlas: { id: 'test-atlas', kind: 'overlay-atlas', category: 'overlays/test', file: 'test.webp', tags: ['alpha'] },
  width: sample.width, height: sample.height,
  sourceBasis: 'synthetic-test', sourceSha256: 'sha256:fixture',
  extraction: merged[0].extraction,
  candidates: merged
});
assert.strictEqual(index.format, 'axm-premade-sprite-index');
assert.strictEqual(index.version, '0.14.0');
assert.strictEqual(index.summary.spriteCandidates, 2);
assert.strictEqual(core.validateIndex(index).ok, true);
assert.match(core.stableStringify(index.truthBoundary), /not automatically a semantic object/);
assert.match(core.stableStringify(index.truthBoundary), /does not automatically install/);

const duplicate = JSON.parse(JSON.stringify(index));
duplicate.candidates.push(JSON.parse(JSON.stringify(duplicate.candidates[0])));
assert.match(core.validateIndex(duplicate).reason, /duplicate sprite id/);

const outOfBounds = JSON.parse(JSON.stringify(index));
outOfBounds.candidates[0].bounds.x = 999;
assert.match(core.validateIndex(outOfBounds).reason, /outside source image/);

console.log('AXM alpha sprite extraction tests: PASS');
