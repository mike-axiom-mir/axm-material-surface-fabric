#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const signal = require('../signal-audit-core.js');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function usage() {
  console.error('Usage:');
  console.error('  node tools/material-signal-audit.js audit LIBRARY.json [OUT.json]');
  console.error('  node tools/material-signal-audit.js summary REPORT.json');
}

function main(argv) {
  const [command, ...args] = argv;
  if (command === 'audit') {
    if (!args[0]) { usage(); return 2; }
    const library = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    const report = signal.auditLibrarySignals(library);
    if (args[1]) writeJson(args[1], report);
    console.log(JSON.stringify({ id: report.id, fingerprint: report.fingerprint, summary: report.summary }, null, 2));
    return report.summary.status === 'HOLD' ? 2 : 0;
  }
  if (command === 'summary') {
    if (!args[0]) { usage(); return 2; }
    const report = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    if (report.format !== signal.FORMAT || report.version !== signal.VERSION) {
      console.error(`Expected ${signal.FORMAT}/${signal.VERSION}.`);
      return 2;
    }
    console.log(JSON.stringify({ id: report.id, fingerprint: report.fingerprint, summary: report.summary, warnings: report.warnings || [] }, null, 2));
    return report.summary && report.summary.status === 'HOLD' ? 2 : 0;
  }
  usage();
  return 2;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main };
