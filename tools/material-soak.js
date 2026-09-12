#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const pack = require('../premade-pack.js');
const composer = require('../premade-composer-core.js');
const evolution = require('../premade-evolution-core.js');

const VERSION = '0.18.4';
const FORMAT = 'axm-material-deterministic-soak';
const BASE_POOLS = ['mixed','color','material','weathered','energy'];
const STRENGTHS = ['low','medium','high'];

function runSoak(options) {
  const source = options || {};
  const seedCount = Math.max(1, Math.min(2000, Math.round(Number(source.seedCount) || 240)));
  const variants = Math.max(1, Math.min(16, Math.round(Number(source.variants) || 4)));
  const evolveEvery = Math.max(1, Math.min(1000, Math.round(Number(source.evolveEvery) || 10)));
  const assetUse = new Map();
  const blendUse = new Map();
  const recipeFingerprints = [];
  const candidateFingerprints = [];
  const failures = [];
  let transparentRecipes = 0;
  let transparentCandidates = 0;
  let candidates = 0;
  let keptCandidates = 0;

  for (let index = 0; index < seedCount; index += 1) {
    const seed = `soak-${String(index).padStart(5, '0')}`;
    const basePool = BASE_POOLS[index % BASE_POOLS.length];
    let recipe;
    try {
      recipe = composer.seededRecipe(seed, pack, {
        basePool,
        overlayCount: 5,
        includeFx: true,
        includeDecals: true
      });
      const validation = composer.validateRecipe(recipe, pack);
      if (!validation.ok) throw new Error(validation.reason);
      const plan = composer.compilePlan(recipe, pack);
      recipeFingerprints.push(plan.recipeFingerprint);
      if (recipe.canvas && recipe.canvas.transparent === true) transparentRecipes += 1;
      for (const layer of plan.layers) {
        assetUse.set(layer.assetId, (assetUse.get(layer.assetId) || 0) + 1);
        blendUse.set(layer.blendMode, (blendUse.get(layer.blendMode) || 0) + 1);
      }
    } catch (error) {
      failures.push({ stage:'recipe', seed, error: String(error && error.message || error) });
      continue;
    }

    if (index % evolveEvery !== 0) continue;
    const strength = STRENGTHS[(index / evolveEvery) % STRENGTHS.length | 0];
    try {
      const session = evolution.createSession(recipe, pack, `${seed}-evolution`, {
        variants,
        strength,
        lockBase: index % 20 !== 0,
        allowFx: true,
        allowDecals: true,
        allowLayerCountChange: true
      });
      for (const candidate of session.candidates) {
        candidates += 1;
        candidateFingerprints.push(candidate.recipeFingerprint);
        if (candidate.recipe && candidate.recipe.canvas && candidate.recipe.canvas.transparent === true) transparentCandidates += 1;
        if (candidate.kept) keptCandidates += 1;
        const validation = composer.validateRecipe(candidate.recipe, pack);
        if (!validation.ok) failures.push({ stage:'candidate', seed, candidateId:candidate.id, error:validation.reason });
        if (!candidate.lineage || !candidate.lineage.parentFingerprint || !candidate.mutationReceipt) {
          failures.push({ stage:'lineage', seed, candidateId:candidate.id, error:'missing lineage or mutation receipt' });
        }
      }
    } catch (error) {
      failures.push({ stage:'evolution', seed, error:String(error && error.message || error) });
    }
  }

  const sortedMap = (map) => Object.fromEntries(Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0])));
  const uniqueRecipeFingerprints = new Set(recipeFingerprints).size;
  const uniqueCandidateFingerprints = new Set(candidateFingerprints).size;
  const summary = {
    seedsRequested: seedCount,
    recipesBuilt: recipeFingerprints.length,
    transparentRecipes,
    evolutionSessions: Math.ceil(seedCount / evolveEvery),
    candidatesBuilt: candidates,
    transparentCandidates,
    explicitlyKeptCandidates: keptCandidates,
    uniqueRecipeFingerprints,
    uniqueCandidateFingerprints,
    assetKindsObserved: assetUse.size,
    failures: failures.length
  };
  return {
    format: FORMAT,
    version: VERSION,
    status: failures.length ? 'HOLD' : 'PASS',
    options: { seedCount, variants, evolveEvery },
    summary,
    assetUse: sortedMap(assetUse),
    blendUse: sortedMap(blendUse),
    failures,
    truthBoundary: {
      soak: 'PASS proves deterministic recipe/evolution invariants for the exercised seeds and current premade pack only.',
      visual: 'This headless soak does not render or judge pixels and therefore makes no beauty, realism, taste, or visual-quality claim.',
      scoring: 'Evolution technical scores remain bounded diagnostics and are not fitness or preference truth.',
      authority: 'The soak never auto-keeps, promotes, merges, or rewrites canonical state.'
    }
  };
}

function main(argv) {
  let seedCount = 240;
  let variants = 4;
  let evolveEvery = 10;
  let out = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--seeds') seedCount = Number(argv[++index]);
    else if (arg === '--variants') variants = Number(argv[++index]);
    else if (arg === '--evolve-every') evolveEvery = Number(argv[++index]);
    else if (arg === '--out') out = argv[++index];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node tools/material-soak.js [--seeds N] [--variants N] [--evolve-every N] [--out report.json]');
      return 0;
    } else {
      console.error(`Unknown argument: ${arg}`);
      return 2;
    }
  }
  const report = runSoak({ seedCount, variants, evolveEvery });
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive:true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify(report.summary, null, 2));
  return report.status === 'PASS' ? 0 : 2;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { VERSION, FORMAT, BASE_POOLS, STRENGTHS, runSoak, main };
