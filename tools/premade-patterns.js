#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const pack = require('../premade-pack.js');
const core = require('../premade-pattern-core.js');

function usage(code=0) {
  const text = [
    'AXM premade recipe pattern memory v0.15', '',
    'Usage:',
    '  node tools/premade-patterns.js learn PACK.json [PACK2.json ...] [--name NAME] [--out FILE]',
    '  node tools/premade-patterns.js summary LIBRARY.json',
    '  node tools/premade-patterns.js instantiate LIBRARY.json PATTERN_ID SEED [--out FILE] [--no-sprite-reuse]',
    '',
    'Only explicit v0.13 keeper recipe packs are accepted as learning input.'
  ].join('\n');
  (code ? process.stderr : process.stdout).write(`${text}\n`);
  process.exit(code);
}

function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(file),'utf8')); }
function writeJson(file,value) {
  const target=path.resolve(file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,`${JSON.stringify(value,null,2)}\n`);
}

function main() {
  const args=process.argv.slice(2);
  const command=args.shift();
  if (!command || command==='--help' || command==='-h') usage();

  if (command==='learn') {
    const files=[];
    let name='Premade Recipe Pattern Library';
    let out=null;
    while (args.length) {
      const token=args.shift();
      if (token==='--name') name=args.shift();
      else if (token==='--out') out=args.shift();
      else if (token.startsWith('--')) throw new Error(`Unknown option: ${token}`);
      else files.push(token);
    }
    if (!files.length) usage(1);
    const sources=files.map(readJson);
    const library=core.learnPatternLibrary(sources,pack,name);
    if (out) writeJson(out,library);
    process.stdout.write(`${JSON.stringify(out ? {ok:true,out:path.resolve(out),summary:core.librarySummary(library)} : library,null,2)}\n`);
    return;
  }

  if (command==='summary') {
    const file=args.shift(); if (!file) usage(1);
    process.stdout.write(`${JSON.stringify(core.librarySummary(readJson(file)),null,2)}\n`);
    return;
  }

  if (command==='instantiate') {
    const file=args.shift(), patternId=args.shift(), seed=args.shift();
    if (!file || !patternId || seed == null) usage(1);
    let out=null, reuseObservedSprites=true;
    while (args.length) {
      const token=args.shift();
      if (token==='--out') out=args.shift();
      else if (token==='--no-sprite-reuse') reuseObservedSprites=false;
      else throw new Error(`Unknown option: ${token}`);
    }
    const receipt=core.instantiatePattern(readJson(file),patternId,pack,seed,{reuseObservedSprites});
    if (out) writeJson(out,receipt);
    process.stdout.write(`${JSON.stringify(out ? {ok:true,out:path.resolve(out),patternId,recipeFingerprint:receipt.recipeFingerprint} : receipt,null,2)}\n`);
    return;
  }

  usage(1);
}

try { main(); }
catch (error) { process.stderr.write(`${error && error.stack ? error.stack : error}\n`); process.exit(1); }
