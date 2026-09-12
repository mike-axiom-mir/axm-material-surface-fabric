'use strict';
const assert = require('assert');
const delta = require('../delta-core.js');

assert.strictEqual(delta.VERSION, '0.3.0');

const before = new Uint8ClampedArray([
  10, 10, 10, 255,   10, 10, 10, 255,
  10, 10, 10, 255,   10, 10, 10, 255
]);
const after = new Uint8ClampedArray([
  30, 20, 10, 255,   10, 10, 10, 255,
  10, 10, 10, 255,   10, 10, 10, 255
]);

const summary = delta.summarizePixelDelta(before, after, 2, 2, { gridSize: 2, threshold: 0 });
assert.strictEqual(summary.pixelCount, 4);
assert.strictEqual(summary.changedPixels, 1);
assert.strictEqual(summary.changedShare, 0.25);
assert.deepStrictEqual(summary.changedBounds, { x: 0, y: 0, width: 1, height: 1, maxX: 0, maxY: 0 });
assert.strictEqual(summary.regions[0].changedPixels, 1);
assert.strictEqual(summary.regions[1].changedPixels, 0);
assert.strictEqual(summary.maxChannelDelta, 20);

const heldByThreshold = delta.summarizePixelDelta(before, after, 2, 2, { gridSize: 2, threshold: 20 });
assert.strictEqual(heldByThreshold.changedPixels, 0);
assert.strictEqual(heldByThreshold.changedBounds, null);

const diffImage = delta.buildDifferenceRgba(before, after, 2, 2, { threshold: 0 });
assert.strictEqual(diffImage[0], 20);
assert.strictEqual(diffImage[1], 20);
assert.strictEqual(diffImage[2], 20);
assert.strictEqual(diffImage[3], 255);
assert.strictEqual(diffImage[7], 0);

const groups = delta.groupChangedPaths([
  { path: 'buildState.layers[0].opacity' },
  { path: 'pixelState.alpha.coverage' },
  { path: 'fileState.bytes' },
  { path: 'declaredAction' },
  { path: 'somethingElse' }
]);
assert.deepStrictEqual(groups, { top: 0, build: 1, pixels: 1, file: 1, lineage: 1, other: 1 });

const transition = delta.makeTransition(
  { id: 'a' },
  { id: 'b' },
  'increase wear opacity',
  '0.25 -> 0.60',
  { pixels: { changedShare: 0.25 } }
);
assert.strictEqual(transition.fromTraceId, 'a');
assert.strictEqual(transition.toTraceId, 'b');
assert.strictEqual(transition.declaredAction, 'increase wear opacity');
assert.strictEqual(transition.observed.pixels.changedShare, 0.25);
assert(/does not claim hidden causal state/.test(transition.truthBoundary));

assert.throws(() => delta.summarizePixelDelta(before, after, 3, 2), /Width and height/);

console.log('AXM delta-core tests: PASS');
