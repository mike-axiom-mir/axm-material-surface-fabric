'use strict';

const assert = require('assert');
const { runSoak } = require('../tools/material-soak.js');

const first = runSoak({ seedCount: 240, variants: 4, evolveEvery: 10 });
const second = runSoak({ seedCount: 240, variants: 4, evolveEvery: 10 });

assert.deepStrictEqual(second, first, 'the same soak inputs must reproduce the same report');
assert.strictEqual(first.status, 'PASS');
assert.strictEqual(first.summary.failures, 0);
assert.strictEqual(first.summary.recipesBuilt, 240);
assert.strictEqual(first.summary.transparentRecipes, 240);
assert.strictEqual(first.summary.evolutionSessions, 24);
assert.strictEqual(first.summary.candidatesBuilt, 96);
assert.strictEqual(first.summary.transparentCandidates, 96);
assert.strictEqual(first.summary.explicitlyKeptCandidates, 0, 'soak must never auto-keep evolution candidates');
assert.ok(first.summary.uniqueRecipeFingerprints >= 235, 'seeded recipes should remain strongly diverse');
assert.ok(first.summary.uniqueCandidateFingerprints >= 85, 'mutation candidates should remain strongly diverse');
assert.ok(first.summary.assetKindsObserved >= 20, 'soak should exercise most of the current premade vocabulary');
assert.ok(Object.keys(first.blendUse).length >= 5, 'soak should exercise multiple blend paths');
assert.match(first.truthBoundary.visual, /does not render or judge pixels/i);
assert.match(first.truthBoundary.authority, /never auto-keeps/i);

// A smaller alternate configuration exercises clamping/parameterization and remains deterministic.
const alternateA = runSoak({ seedCount: 37, variants: 3, evolveEvery: 7 });
const alternateB = runSoak({ seedCount: 37, variants: 3, evolveEvery: 7 });
assert.deepStrictEqual(alternateB, alternateA);
assert.strictEqual(alternateA.status, 'PASS');
assert.strictEqual(alternateA.summary.recipesBuilt, 37);
assert.strictEqual(alternateA.summary.transparentRecipes, 37);
assert.strictEqual(alternateA.summary.evolutionSessions, 6);
assert.strictEqual(alternateA.summary.candidatesBuilt, 18);
assert.strictEqual(alternateA.summary.transparentCandidates, 18);
assert.strictEqual(alternateA.summary.explicitlyKeptCandidates, 0);

console.log('AXM v0.18.4 deterministic creation/evolution soak: PASS');
