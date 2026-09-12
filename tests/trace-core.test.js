'use strict';
const assert = require('assert');
const trace = require('../trace-core.js');

assert.strictEqual(trace.VERSION, '0.2.0');

const bytesA = Uint8Array.from([0, 1, 2, 3, 255]);
const bytesB = Uint8Array.from([0, 1, 2, 3, 254]);
assert.strictEqual(trace.fnv1aBytes(bytesA), trace.fnv1aBytes(bytesA));
assert.notStrictEqual(trace.fnv1aBytes(bytesA), trace.fnv1aBytes(bytesB));
assert.strictEqual(trace.hexPreview(Uint8Array.from([137, 80, 78, 71]), 4), '89 50 4e 47');
assert.strictEqual(trace.bitsPreview(Uint8Array.from([1, 255]), 2), '00000001 11111111');

const rgba = Uint8ClampedArray.from([
  255, 0, 0, 255,
  0, 255, 0, 128,
  0, 0, 255, 0,
  255, 255, 255, 255
]);
const summary = trace.summarizePixels(rgba);
assert.strictEqual(summary.pixelCount, 4);
assert.strictEqual(summary.alpha.opaque, 2);
assert.strictEqual(summary.alpha.translucent, 1);
assert.strictEqual(summary.alpha.transparent, 1);
assert.strictEqual(summary.alpha.visible, 3);
assert.strictEqual(summary.alpha.coverage, 0.75);
assert.strictEqual(typeof summary.pixelHash, 'string');
assert.strictEqual(summary.lumaHistogram16.length, 16);
assert(summary.topColorBuckets.length > 0);

const diff = trace.diffValues(
  { buildState: { layers: [{ opacity: 1 }] }, pixelState: { pixelHash: 'a' } },
  { buildState: { layers: [{ opacity: 0.5 }] }, pixelState: { pixelHash: 'b' } }
);
assert(diff.some((item) => item.path === 'buildState.layers[0].opacity'));
assert(diff.some((item) => item.path === 'pixelState.pixelHash'));

console.log('AXM trace-core tests: PASS');
