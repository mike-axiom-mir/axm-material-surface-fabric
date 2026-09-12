'use strict';
const assert = require('assert');
const core = require('../material-evaluation-core.js');

function solid(width, height, rgba) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = rgba[0]; out[i + 1] = rgba[1]; out[i + 2] = rgba[2]; out[i + 3] = rgba[3];
  }
  return out;
}

const gray = solid(4, 4, [128, 128, 128, 255]);
const summary = core.summarizeFramebuffer(gray, 4, 4);
assert.strictEqual(summary.pixelCount, 16);
assert.strictEqual(summary.visibleShare, 1);
assert.strictEqual(summary.transparentShare, 0);
assert.strictEqual(summary.pixelHash, core.hashBytes(gray));
assert.ok(summary.meanLuma > 0.49 && summary.meanLuma < 0.51);
assert.ok(summary.lumaStdDev < 1e-9);

const transparent = solid(2, 2, [0, 0, 0, 0]);
const transparentSummary = core.summarizeFramebuffer(transparent, 2, 2);
assert.strictEqual(transparentSummary.visibleShare, 0);
assert.strictEqual(transparentSummary.transparentShare, 1);
assert.throws(() => core.summarizeFramebuffer(new Uint8Array(3), 1, 1), /length/);

const goodReceipt = {
  geometry: 'sphere',
  runtime: { shaderLinked: true, drawCompleted: true },
  missingEntries: [],
  heldLayers: [],
  warnings: [],
  framebuffer: { width: 4, height: 4, pixelHash: summary.pixelHash }
};
const goodObservation = core.evaluateRenderObservation({
  id: 'good',
  lightRigId: 'neutral-studio',
  geometry: 'sphere',
  receipt: goodReceipt,
  summary: Object.assign({}, summary, { lumaStdDev: 0.12, lumaRange: 0.6, nearBlackShare: 0.02, nearWhiteShare: 0.01 })
});
assert.strictEqual(goodObservation.truthStatus, 'OBSERVED_RENDER_PATH');
assert.strictEqual(goodObservation.technicalScore, 100);
assert.strictEqual(goodObservation.scoreLabel, 'bounded-renderer-health');

const badObservation = core.evaluateRenderObservation({
  id: 'bad',
  lightRigId: 'dark-emissive',
  geometry: 'cube',
  receipt: {
    geometry: 'cube',
    runtime: { shaderLinked: false, drawCompleted: false },
    missingEntries: [{ entryId: 'x' }],
    heldLayers: [{ layerId: 'y' }],
    warnings: ['test warning']
  },
  summary: transparentSummary
});
assert.strictEqual(badObservation.truthStatus, 'HOLD_RENDER_PATH');
assert.ok(badObservation.technicalScore < 50);
assert.ok(badObservation.holds.includes('draw-not-completed'));
assert.ok(badObservation.holds.some((value) => value.startsWith('missing-entry-refs')));

const aggregate = core.aggregateEvaluationRun({
  candidateId: 'candidate-a',
  sourceKind: 'vocabulary-family',
  descriptorHash: 'abc',
  observations: [goodObservation, badObservation]
});
assert.strictEqual(aggregate.observationCount, 2);
assert.strictEqual(aggregate.completed, 1);
assert.strictEqual(aggregate.holds, 1);
assert.strictEqual(aggregate.completionShare, 0.5);
assert.strictEqual(aggregate.truthStatus, 'PARTIAL_EVALUATION_WITH_HOLDS');
assert.deepStrictEqual(aggregate.geometries, ['cube', 'sphere']);
assert.deepStrictEqual(aggregate.lightRigs, ['dark-emissive', 'neutral-studio']);

const family = {
  id: 'painted-steel',
  name: 'Painted steel',
  category: 'metal',
  pattern: 'painted',
  palette: ['#203748', '#376982', '#8fb1bf'],
  seed: 42,
  scale: 9,
  roughness: [0.32, 0.62],
  metallic: 0.18,
  metallicSpread: 0.08,
  normalStrength: 0.75,
  heightContrast: 0.55,
  aoStrength: 0.28,
  opacity: null,
  emissive: null,
  note: ''
};
const variantsA = core.createDeterministicVariants(family, 4);
const variantsB = core.createDeterministicVariants(family, 4);
assert.strictEqual(variantsA.length, 4);
assert.deepStrictEqual(variantsA, variantsB, 'same family must yield deterministic variants');
assert.strictEqual(new Set(variantsA.map((row) => row.id)).size, 4);
variantsA.forEach((variant, index) => {
  assert.strictEqual(variant.evaluationVariant.parentId, family.id);
  assert.strictEqual(variant.evaluationVariant.mutationIndex, index + 1);
  assert.ok(variant.scale >= 1.5 && variant.scale <= 64);
  assert.ok(variant.normalStrength >= 0.05 && variant.normalStrength <= 3);
  assert.ok(variant.roughness[0] >= 0.02 && variant.roughness[1] <= 0.99);
  assert.ok(variant.evaluationDescriptorHash);
  assert.notStrictEqual(variant.id, family.id);
});

const ranked = core.rankCandidateRuns([
  { candidateId: 'b', completionShare: 1, technicalScore: 80, minimumTechnicalScore: 70 },
  { candidateId: 'a', completionShare: 1, technicalScore: 90, minimumTechnicalScore: 50 },
  { candidateId: 'c', completionShare: 0.5, technicalScore: 100, minimumTechnicalScore: 100 }
]);
assert.deepStrictEqual(ranked.map((row) => row.candidateId), ['a', 'b', 'c']);
assert.strictEqual(ranked[0].rank, 1);
assert.ok(/technical renderer-path/i.test(ranked[0].rankingBasis));

const session = core.createSession({
  createdAt: '2026-09-12T09:00:00.000Z',
  source: { kind: 'vocabulary-family', familyId: family.id },
  resolution: 64,
  mode: 'quick',
  geometries: ['sphere'],
  lightRigIds: ['neutral-studio', 'hard-side']
});
assert.strictEqual(session.format, 'axm-material-evaluation-session');
assert.strictEqual(session.version, '0.8.0');
assert.strictEqual(core.validateSession(session).ok, true);

const runA = core.aggregateEvaluationRun({ candidateId: family.id, observations: [goodObservation] });
core.addCandidateRun(session, family, runA, { dataUrl: 'data:image/png;base64,x', observationId: 'good' });
const variantRun = core.aggregateEvaluationRun({ candidateId: variantsA[0].id, observations: [Object.assign({}, goodObservation, { id: 'variant-good', technicalScore: 85 })] });
core.addCandidateRun(session, variantsA[0], variantRun, null);
assert.strictEqual(session.candidates.length, 2);
assert.ok(session.selectedCandidateId);
assert.strictEqual(core.validateSession(session).ok, true);
core.recordInstall(session, { candidateId: session.selectedCandidateId, installed: true });
assert.strictEqual(session.installReceipts.length, 1);

const broken = core.clone(session);
broken.selectedCandidateId = 'missing';
assert.strictEqual(core.validateSession(broken).ok, false);

console.log('AXM material evaluation core tests: PASS');
