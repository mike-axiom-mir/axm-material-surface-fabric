'use strict';
const assert = require('assert');
const core = require('../state-core.js');

const a = core.createInitialState();
assert.strictEqual(a.format, 'axm-material-surface-state');
assert.strictEqual(a.version, '0.1.0');

const stableA = core.stableStringify({ b: 2, a: 1 });
const stableB = core.stableStringify({ a: 1, b: 2 });
assert.strictEqual(stableA, stableB, 'stable stringify should ignore key insertion order');

const before = { x: 1, nested: { y: 2 }, list: [1, 2] };
const after = { x: 1, nested: { y: 3 }, list: [1, 2, 4] };
const diff = core.diffStates(before, after);
assert(diff.some((d) => d.path === 'nested.y'));
assert(diff.some((d) => d.path === 'list[2]'));

const withPayload = core.createInitialState();
withPayload.assets.push({ id: 'a1', dataUrl: 'data:image/png;base64,AAAA' });
const compact = core.compactState(withPayload, false);
assert.strictEqual(compact.assets[0].dataUrl.omitted, true);
assert.strictEqual(typeof compact.assets[0].dataUrl.hash, 'string');

const snap1 = core.captureSnapshot(withPayload, 'first');
withPayload.snapshots.push(snap1);
withPayload.workspace.name = 'changed';
const snap2 = core.captureSnapshot(withPayload, 'second');
assert(snap2.diffFromPrevious.some((d) => d.path === 'workspace.name'));

assert.strictEqual(core.validateImportedState(withPayload).ok, true);
assert.strictEqual(core.validateImportedState({}).ok, false);

console.log('AXM state-core tests: PASS');
