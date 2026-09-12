#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const composer = require('../premade-composer-core.js');
const evolution = require('../premade-evolution-core.js');
const pack = require('../premade-pack.js');

function usage(code) {
  const text = [
    'AXM premade evolution helper', '',
    'Usage:',
    '  node tools/premade-evolve.js seed SEED [--variants N] [--strength low|medium|high] [--base mixed|material|weathered|color|energy] [--layers N] [--unlock-base] [--no-fx] [--no-decals] [--out FILE]',
    '  node tools/premade-evolve.js recipe RECIPE.json [--seed SEED] [--variants N] [--strength low|medium|high] [--unlock-base] [--no-fx] [--no-decals] [--out FILE]',
    '',
    'Headless scores are structure-only until a browser path attaches framebuffer evidence.'
  ].join('\n');
  (code ? process.stderr : process.stdout).write(`${text}\n`);
  process.exit(code || 0);
}

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('-h') || argv.includes('--help')) usage(0);
const mode = argv.shift();
const source = argv.shift();
if (!source || !['seed', 'recipe'].includes(mode)) usage(1);

const options = { variants: 8, strength: 'medium', base: 'mixed', layers: 4, lockBase: true, allowFx: true, allowDecals: true, out: null, seed: null };
for (let i = 0; i < argv.length; i += 1) {
  const token = argv[i];
  if (token === '--variants') options.variants = Number(argv[++i]);
  else if (token === '--strength') options.strength = argv[++i];
  else if (token === '--base') options.base = argv[++i];
  else if (token === '--layers') options.layers = Number(argv[++i]);
  else if (token === '--seed') options.seed = argv[++i];
  else if (token === '--unlock-base') options.lockBase = false;
  else if (token === '--no-fx') options.allowFx = false;
  else if (token === '--no-decals') options.allowDecals = false;
  else if (token === '--out') options.out = argv[++i];
  else usage(1);
}

let parent;
let sessionSeed;
if (mode === 'seed') {
  sessionSeed = source;
  parent = composer.seededRecipe(source, pack, {
    basePool: options.base,
    overlayCount: options.layers,
    includeFx: options.allowFx,
    includeDecals: options.allowDecals
  });
} else {
  const file = path.resolve(source);
  parent = JSON.parse(fs.readFileSync(file, 'utf8'));
  const validation = composer.validateRecipe(parent, pack);
  if (!validation.ok) throw new Error(validation.reason);
  sessionSeed = options.seed || `evolve-${composer.recipeFingerprint(parent, pack)}`;
}

const session = evolution.createSession(parent, pack, sessionSeed, {
  variants: options.variants,
  strength: options.strength,
  lockBase: options.lockBase,
  allowFx: options.allowFx,
  allowDecals: options.allowDecals,
  allowLayerCountChange: true,
  maxExtraLayers: 8
});
session.execution = {
  mode: 'headless-structure-only',
  pixelEvidenceAttached: false,
  boundary: 'No framebuffer was rendered in this Node path. Scores are bounded structure health until browser render evidence is attached.'
};
const payload = `${JSON.stringify(session, null, 2)}\n`;
if (options.out) fs.writeFileSync(path.resolve(options.out), payload);
else process.stdout.write(payload);
