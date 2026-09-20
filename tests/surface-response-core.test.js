'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pack = JSON.parse(fs.readFileSync(path.join(root, 'surface-response', 'axm-material-response-pack.json'), 'utf8'));
const organs = JSON.parse(fs.readFileSync(path.join(root, 'surface-response', 'organs.json'), 'utf8'));
const lab = fs.readFileSync(path.join(root, 'surface-response', 'material-lab.html'), 'utf8');

assert.equal(pack.format, 'axm-material-response-pack');
assert.equal(pack.version, '0.1.0');
assert.equal(pack.families.length, 13);
assert.equal(organs.length, 8);
const ids = new Set(organs.map((o) => o.id));
for (const id of ['surface.subsurface','surface.sheen','surface.anisotropy','surface.coat','surface.breakup','surface.transmission','surface.iridescence','surface.wear_layer']) assert(ids.has(id), id);
for (const organ of organs) {
  assert.equal(organ.evidence, 'declared_contract_match_not_tested');
  assert.ok(Array.isArray(organ.known_losses) && organ.known_losses.length);
  assert.ok(organ.fallback && organ.fallback.when && organ.fallback.do && organ.fallback.loses);
  assert.ok(Array.isArray(organ.verify) && organ.verify.length);
}
assert.ok(lab.includes('staticChannels'), 'material lab must preserve shared view-independent channels for bake/live consistency');
assert.ok(lab.includes('verifyOrgan'), 'material lab must expose runnable organ verification');
assert.ok(lab.includes('greyscale (behaviour only)'), 'material lab must preserve greyscale behavior test');
assert.ok(!/<script\\s+src=/i.test(lab), 'material lab must stay dependency-free');
console.log('surface-response-core: 13 families, 8 organ contracts, interactive reference host OK');
