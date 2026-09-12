'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const batchTool = require('../tools/material-batch-readiness.js');
const cli = require('../tools/material-signal-audit.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-signal-cli-'));
const libraryPath = path.join(dir, 'library.json');
const reportPath = path.join(dir, 'report.json');
fs.writeFileSync(libraryPath, JSON.stringify(batchTool.buildSyntheticLibrary(2, 4), null, 2));

const originalLog = console.log;
const originalError = console.error;
console.log = () => {};
console.error = () => {};
try {
  assert.strictEqual(cli.main(['audit', libraryPath, reportPath]), 0);
  assert.ok(fs.existsSync(reportPath));
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.strictEqual(report.format, 'axm-material-signal-audit');
  assert.strictEqual(report.version, '0.18.6');
  assert.strictEqual(report.summary.entries, 12);
  assert.strictEqual(report.summary.pixelObservedEntries, 12);
  assert.strictEqual(cli.main(['summary', reportPath]), 0);
} finally {
  console.log = originalLog;
  console.error = originalError;
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('AXM material signal audit CLI tests: PASS');
