#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/premade/v0.11/manifest.json'), 'utf8'));

function usage(code = 0) {
  const message = [
    'AXM premade asset helper', '',
    'Usage:',
    '  node tools/premade-assets.js list [--category PREFIX] [--tag TAG]',
    '  node tools/premade-assets.js show ASSET_ID',
    '  node tools/premade-assets.js grid-cell ASSET_ID ROW COLUMN',
    '  node tools/premade-assets.js pack',
  ].join('\n');
  (code ? process.stderr : process.stdout).write(`${message}\n`);
  process.exit(code);
}

function byId(id) {
  return manifest.assets.find((asset) => asset.id === id) || null;
}

function gridCell(asset, row, column) {
  if (!asset.grid) throw new Error(`${asset.id} is not a regular-grid atlas`);
  const { rows, columns } = asset.grid;
  if (!Number.isInteger(row) || row < 0 || row >= rows) throw new Error(`row must be 0..${rows - 1}`);
  if (!Number.isInteger(column) || column < 0 || column >= columns) throw new Error(`column must be 0..${columns - 1}`);
  const x0 = Math.floor(column * manifest.binaryPack.runtimeDimensions[0] / columns);
  const x1 = Math.floor((column + 1) * manifest.binaryPack.runtimeDimensions[0] / columns);
  const y0 = Math.floor(row * manifest.binaryPack.runtimeDimensions[1] / rows);
  const y1 = Math.floor((row + 1) * manifest.binaryPack.runtimeDimensions[1] / rows);
  return { assetId: asset.id, row, column, x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

const [command, ...args] = process.argv.slice(2);
if (!command || command === '--help' || command === '-h') usage();

if (command === 'list') {
  let category = null;
  let tag = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--category') category = args[++index];
    else if (args[index] === '--tag') tag = args[++index];
    else usage(1);
  }
  const result = manifest.assets.filter((asset) =>
    (!category || asset.category.startsWith(category)) && (!tag || asset.tags.includes(tag))
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (command === 'show') {
  const asset = byId(args[0]);
  if (!asset) throw new Error(`Unknown asset id: ${args[0]}`);
  process.stdout.write(`${JSON.stringify(asset, null, 2)}\n`);
} else if (command === 'grid-cell') {
  const asset = byId(args[0]);
  if (!asset) throw new Error(`Unknown asset id: ${args[0]}`);
  process.stdout.write(`${JSON.stringify(gridCell(asset, Number(args[1]), Number(args[2])), null, 2)}\n`);
} else if (command === 'pack') {
  process.stdout.write(`${JSON.stringify(manifest.binaryPack, null, 2)}\n`);
} else {
  usage(1);
}
