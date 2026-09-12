#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const pack = require('../premade-pack.js');
const patternCore = require('../premade-pattern-core.js');
const guide = require('../premade-guide-core.js');

function usage(code = 0) {
  const text = [
    'AXM premade pattern-guided creation v0.16', '',
    'Usage:',
    '  node tools/premade-guide.js compose LIBRARY.json ANCHOR_PATTERN [options]',
    '  node tools/premade-guide.js auto LIBRARY.json ANCHOR_PATTERN [options]',
    '  node tools/premade-guide.js donors LIBRARY.json ANCHOR_PATTERN [options]',
    '  node tools/premade-guide.js summary RECEIPT.json', '',
    'Options:',
    '  --donor PATTERN_ID       explicit donor pattern (repeatable)',
    '  --donors N               auto donor count, 0..4 (default 2)',
    '  --seed TEXT              deterministic composition seed',
    '  --max-layers N           total layer cap, 2..12 (default 8)',
    '  --anchor-extras N        anchor non-base layers kept first (default 2)',
    '  --no-fx                  exclude FX donor/anchor-extra layers',
    '  --no-decals              exclude decal donor/anchor-extra layers',
    '  --no-sprites             do not reuse observed exact sprite examples',
    '  --no-novelty             do not prefer category novelty for auto donors',
    '  --out FILE               write JSON to FILE instead of stdout'
  ].join('\n');
  (code ? process.stderr : process.stdout).write(`${text}\n`);
  process.exit(code);
}

function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
function writeResult(value, out) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (out) {
    const target = path.resolve(out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    process.stdout.write(`${JSON.stringify({ ok:true, out:target, format:value.format || null, id:value.id || null }, null, 2)}\n`);
  } else process.stdout.write(text);
}

function parseOptions(args) {
  const out = {
    donors: [], donorCount: 2, seed: 'guided-001', output: null,
    policy: { maxLayers:8, anchorExtras:2, autoDonors:2, allowFx:true, allowDecals:true, reuseObservedSprites:true, preferCategoryNovelty:true }
  };
  for (let i=0;i<args.length;i+=1) {
    const key=args[i];
    if (key==='--donor') out.donors.push(args[++i]);
    else if (key==='--donors') { out.donorCount=Number(args[++i]); out.policy.autoDonors=out.donorCount; }
    else if (key==='--seed') out.seed=args[++i];
    else if (key==='--max-layers') out.policy.maxLayers=Number(args[++i]);
    else if (key==='--anchor-extras') out.policy.anchorExtras=Number(args[++i]);
    else if (key==='--no-fx') out.policy.allowFx=false;
    else if (key==='--no-decals') out.policy.allowDecals=false;
    else if (key==='--no-sprites') out.policy.reuseObservedSprites=false;
    else if (key==='--no-novelty') out.policy.preferCategoryNovelty=false;
    else if (key==='--out') out.output=args[++i];
    else throw new Error(`Unknown option: ${key}`);
  }
  return out;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command==='-h' || command==='--help') usage();
  if (command==='summary') {
    if (!args[0]) usage(1);
    const receipt=readJson(args[0]);
    const validation=guide.validateReceipt(receipt,pack);
    if (!validation.ok) throw new Error(validation.reason);
    return writeResult(guide.guideSummary(receipt),null);
  }

  const libraryFile=args[0];
  const anchorId=args[1];
  if (!libraryFile || !anchorId) usage(1);
  const library=readJson(libraryFile);
  const validation=patternCore.validateLibrary(library);
  if (!validation.ok) throw new Error(validation.reason);
  const options=parseOptions(args.slice(2));

  if (command==='donors') {
    const rows=guide.compatibleDonors(library,anchorId,options.policy,options.seed);
    return writeResult({
      format:'axm-premade-guided-donor-report',version:guide.VERSION,libraryId:library.id,anchorPatternId:anchorId,seed:options.seed,policy:guide.normalizePolicy(options.policy),donors:rows,
      truthBoundary:'Rows describe structural category novelty/overlap only, not aesthetic compatibility or preference.'
    },options.output);
  }
  if (command==='compose') {
    const donors=options.donors.length ? options.donors : guide.autoSelectDonors(library,anchorId,options.donorCount,options.seed,options.policy);
    return writeResult(guide.composeGuided(library,anchorId,donors,pack,options.seed,options.policy),options.output);
  }
  if (command==='auto') {
    return writeResult(guide.autoComposeGuided(library,anchorId,pack,options.seed,options.policy),options.output);
  }
  usage(1);
}

try { main(); }
catch (error) { process.stderr.write(`${error && error.stack ? error.stack : error}\n`); process.exit(1); }
