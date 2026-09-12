#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const libraryCore = require('../library-core.js');
const batchCore = require('../batch-readiness-core.js');
const { encodePngRgba } = require('./png-rgba.js');

const FIXED_TIME = '2026-09-12T00:00:00.000Z';
const FAMILY_CHANNELS = ['base-color','normal','roughness','metallic','ambient-occlusion','height'];

function pngDataUrl(familyIndex, channelIndex, size) {
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const seed = familyIndex * 41 + channelIndex * 67 + x * 17 + y * 29;
      rgba[offset] = (seed * 3 + 31) & 255;
      rgba[offset + 1] = (seed * 5 + 79) & 255;
      rgba[offset + 2] = (seed * 7 + 127) & 255;
      rgba[offset + 3] = 255;
    }
  }
  return `data:image/png;base64,${encodePngRgba(rgba, size, size).toString('base64')}`;
}

function buildSyntheticLibrary(familyCount = 15, size = 4) {
  const count = Math.max(1, Math.min(256, Number(familyCount) || 15));
  const library = libraryCore.createLibrary(FIXED_TIME);
  library.id = `synthetic-batch-${count}x${FAMILY_CHANNELS.length}`;
  const entries = [];
  for (let familyIndex = 0; familyIndex < count; familyIndex += 1) {
    for (let channelIndex = 0; channelIndex < FAMILY_CHANNELS.length; channelIndex += 1) {
      const channel = FAMILY_CHANNELS[channelIndex];
      const familyNumber = String(familyIndex + 1).padStart(3, '0');
      const dataUrl = pngDataUrl(familyIndex, channelIndex, size);
      entries.push({
        id: `stress-${familyNumber}-${channel}`,
        name: `Stress ${familyNumber} ${channel}`,
        kind: 'texture',
        mime: 'image/png',
        width: size,
        height: size,
        bytes: Buffer.from(dataUrl.split(',')[1], 'base64').length,
        dataUrl,
        source: { method: 'deterministic-synthetic-batch-v0.18.3', familyIndex, channelIndex },
        usage: { channelHint: channel, channelBasis: 'test-fixture', note: 'Synthetic transport/readiness evidence only.' },
        tags: ['batch-readiness','synthetic',`family-${familyNumber}`]
      });
    }
  }
  libraryCore.upsertEntries(library, entries, FIXED_TIME);
  for (let familyIndex = 0; familyIndex < count; familyIndex += 1) {
    const familyNumber = String(familyIndex + 1).padStart(3, '0');
    libraryCore.createFamily(library, {
      id: `stress-family-${familyNumber}`,
      name: `Stress Family ${familyNumber}`,
      purpose: 'Deterministic six-channel batch-readiness fixture.',
      entryIds: FAMILY_CHANNELS.map((channel) => `stress-${familyNumber}-${channel}`),
      tags: ['batch-readiness','synthetic']
    }, FIXED_TIME);
  }
  return library;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function usage() {
  console.error('Usage:');
  console.error('  node tools/material-batch-readiness.js synth OUT.json [family-count]');
  console.error('  node tools/material-batch-readiness.js analyze LIBRARY.json [OUT.json]');
  console.error('  node tools/material-batch-readiness.js packs LIBRARY.json OUT_DIR');
}

function main(argv) {
  const [command, ...args] = argv;
  if (command === 'synth') {
    if (!args[0]) { usage(); return 2; }
    const library = buildSyntheticLibrary(args[1] || 15, 4);
    writeJson(args[0], library);
    const report = batchCore.analyzeLibrary(library);
    console.log(JSON.stringify({ library: args[0], entries: library.entries.length, families: library.families.length, report: report.summary }, null, 2));
    return report.summary.status === 'PASS' ? 0 : 2;
  }
  if (command === 'analyze') {
    if (!args[0]) { usage(); return 2; }
    const library = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    const report = batchCore.analyzeLibrary(library);
    if (args[1]) writeJson(args[1], report);
    console.log(JSON.stringify(report, null, 2));
    return report.summary.status === 'PASS' ? 0 : 2;
  }
  if (command === 'packs') {
    if (!args[0] || !args[1]) { usage(); return 2; }
    const library = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    const report = batchCore.analyzeLibrary(library);
    if (report.summary.status !== 'PASS') {
      console.error(JSON.stringify(report, null, 2));
      return 2;
    }
    fs.mkdirSync(args[1], { recursive: true });
    for (const chunk of report.chunks) {
      const pack = libraryCore.makeDonorPack({ library, selectedEntryIds: chunk.entryIds, exportedAt: FIXED_TIME });
      writeJson(path.join(args[1], `${chunk.id}.json`), pack);
    }
    writeJson(path.join(args[1], 'batch-readiness.json'), report);
    console.log(JSON.stringify({ status: 'PASS', packs: report.chunks.length, entries: library.entries.length, families: library.families.length }, null, 2));
    return 0;
  }
  usage();
  return 2;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { FIXED_TIME, FAMILY_CHANNELS, pngDataUrl, buildSyntheticLibrary, main };
