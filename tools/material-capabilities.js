#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const core = require('../capability-exchange-core.js');
const premadePack = require('../premade-pack.js');

function usage(code = 0) {
  const text = [
    'AXM Material Capability Exchange v0.18', '',
    'Usage:',
    '  node tools/material-capabilities.js pack ARTIFACT.json [ARTIFACT2.json ...] --out PACK.json [--name NAME]',
    '  node tools/material-capabilities.js check-pack PACK.json',
    '  node tools/material-capabilities.js feedback PACK.json EVENTS.json --consumer NAME [--repository OWNER/REPO] --out FEEDBACK.json',
    '  node tools/material-capabilities.js check-feedback FEEDBACK.json PACK.json',
    '  node tools/material-capabilities.js apply FEEDBACK.json PACK.json [LEDGER.json] --out LEDGER-NEXT.json',
    '  node tools/material-capabilities.js summary LEDGER.json', '',
    'EVENTS.json may be either an array of events or {"events":[...]}.',
    'Actions: inspected, validated, rendered, adopted, modified, rejected, reused',
    'Outcomes: PASS, HOLD, REJECT'
  ].join('\n');
  (code ? process.stderr : process.stdout).write(`${text}\n`);
  process.exit(code);
}

function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
function writeJson(file, value) { const target = path.resolve(file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`); }
function option(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
function positional(args) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('--')) { i += 1; continue; }
    out.push(args[i]);
  }
  return out;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') usage();

  if (command === 'pack') {
    const files = positional(args);
    const out = option(args, '--out');
    if (!files.length || !out) usage(1);
    const artifacts = files.map(readJson);
    const pack = core.createCapabilityPack(artifacts, premadePack, { name: option(args, '--name') || undefined });
    writeJson(out, pack);
    process.stdout.write(`${JSON.stringify({ ok:true, id:pack.id, fingerprint:pack.fingerprint, total:pack.summary.total, kinds:pack.summary.kinds }, null, 2)}\n`);
    return;
  }

  if (command === 'check-pack') {
    const file = positional(args)[0]; if (!file) usage(1);
    const result = core.validateCapabilityPack(readJson(file));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.ok ? 0 : 2);
  }

  if (command === 'feedback') {
    const files = positional(args);
    const out = option(args, '--out');
    const consumer = option(args, '--consumer');
    if (files.length < 2 || !out || !consumer) usage(1);
    const pack = readJson(files[0]);
    const raw = readJson(files[1]);
    const events = Array.isArray(raw) ? raw : raw.events;
    const feedback = core.createUseFeedback(pack, {
      system: consumer,
      repository: option(args, '--repository') || null,
      adapter: option(args, '--adapter') || null,
      instance: option(args, '--instance') || null
    }, events || [], raw && raw.note || '');
    writeJson(out, feedback);
    process.stdout.write(`${JSON.stringify({ ok:true, id:feedback.id, events:feedback.events.length, consumer:feedback.consumer }, null, 2)}\n`);
    return;
  }

  if (command === 'check-feedback') {
    const files = positional(args); if (files.length < 2) usage(1);
    const result = core.validateUseFeedback(readJson(files[0]), readJson(files[1]));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.ok ? 0 : 2);
  }

  if (command === 'apply') {
    const files = positional(args); const out = option(args, '--out');
    if (files.length < 2 || !out) usage(1);
    const feedback = readJson(files[0]);
    const pack = readJson(files[1]);
    const ledger = files[2] ? readJson(files[2]) : core.createUsageLedger('material capability use');
    const result = core.applyUseFeedback(ledger, feedback, pack);
    writeJson(out, result.ledger);
    process.stdout.write(`${JSON.stringify({ ok:true, applied:result.applied, duplicate:result.duplicate, summary:core.usageSummary(result.ledger) }, null, 2)}\n`);
    return;
  }

  if (command === 'summary') {
    const file = positional(args)[0]; if (!file) usage(1);
    process.stdout.write(`${JSON.stringify(core.usageSummary(readJson(file)), null, 2)}\n`);
    return;
  }

  usage(1);
}

try { main(); }
catch (error) { process.stderr.write(`${error && error.stack ? error.stack : error}\n`); process.exit(1); }
