#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const audit = require('../payload-audit-core.js');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function usage() {
  console.error('Usage:');
  console.error('  node tools/material-payload-audit.js audit LIBRARY.json [OUT.json] [--strict-family-dimensions]');
  console.error('  node tools/material-payload-audit.js summary REPORT.json');
}

function main(argv) {
  const [command, ...args] = argv;
  if (command === 'audit') {
    if (!args[0]) { usage(); return 2; }
    const strictFamilyDimensions = args.includes('--strict-family-dimensions');
    const positional = args.filter((arg) => arg !== '--strict-family-dimensions');
    const library = JSON.parse(fs.readFileSync(positional[0], 'utf8'));
    const report = audit.auditLibrary(library, { strictFamilyDimensions });
    if (positional[1]) writeJson(positional[1], report);
    console.log(JSON.stringify({
      format: report.format,
      version: report.version,
      id: report.id,
      summary: report.summary,
      holdCount: report.holds.length,
      warningCount: report.warnings.length,
      strictFamilyDimensions
    }, null, 2));
    return report.summary.status === 'HOLD' ? 2 : 0;
  }
  if (command === 'summary') {
    if (!args[0]) { usage(); return 2; }
    const report = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    if (!report || report.format !== audit.FORMAT || report.version !== audit.VERSION) {
      console.error(`Expected ${audit.FORMAT}/${audit.VERSION}.`);
      return 2;
    }
    console.log(JSON.stringify({ id: report.id, summary: report.summary, holds: report.holds, warnings: report.warnings }, null, 2));
    return report.summary && report.summary.status === 'HOLD' ? 2 : 0;
  }
  usage();
  return 2;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main };
