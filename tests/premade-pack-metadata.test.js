'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/premade/v0.11/manifest.json'), 'utf8'));

assert.strictEqual(manifest.format, 'axm-premade-visual-asset-pack');
assert.strictEqual(manifest.version, '0.11.0');
assert.strictEqual(manifest.assets.length, 24);
assert.strictEqual(manifest.summary.globeAtlases, 4);
assert.strictEqual(manifest.summary.declaredGlobeCells, 166);
assert.strictEqual(manifest.summary.alphaIsRequired, true);
assert.strictEqual(manifest.binaryPack.sourcePngCount, 24);
assert.strictEqual(manifest.binaryPack.runtimeWebpCount, 24);
assert.match(manifest.binaryPack.sha256, /^[0-9a-f]{64}$/);
assert.strictEqual(manifest.binaryPack.alphaVerified, true);

const ids = new Set();
for (const asset of manifest.assets) {
  assert.ok(!ids.has(asset.id), `duplicate asset id ${asset.id}`);
  ids.add(asset.id);
  assert.ok(asset.file.endsWith('.webp'));
  assert.ok(asset.category.includes('/'));
  assert.ok(Array.isArray(asset.tags) && asset.tags.length > 0);
}

const globes = manifest.assets.filter((asset) => asset.kind === 'globe-atlas');
assert.strictEqual(globes.reduce((sum, asset) => sum + asset.grid.columns * asset.grid.rows, 0), 166);
assert.ok(globes.some((asset) => asset.category === 'globes/color'));
assert.ok(globes.some((asset) => asset.category === 'globes/material'));
assert.ok(globes.some((asset) => asset.category === 'globes/weathered'));
assert.ok(globes.some((asset) => asset.category === 'globes/energy'));

const tags = new Set(manifest.assets.flatMap((asset) => asset.tags));
for (const expected of ['rust','water','oil','mud','frost','moss','glass','scorch','fingerprints','hud','hologram']) {
  assert.ok(tags.has(expected), `missing reusable category tag ${expected}`);
}

assert.match(manifest.truthBoundary.alpha, /Transparency\/alpha/);
assert.match(manifest.truthBoundary.physical, /does not prove PBR correctness/);
console.log('AXM premade asset pack metadata tests: PASS');
