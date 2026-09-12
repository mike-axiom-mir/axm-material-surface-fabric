#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const core = require('../alpha-sprite-core.js');
const pack = require('../premade-pack.js');
const png = require('./png-rgba.js');

const ROOT = path.resolve(__dirname, '..');

function usage(code = 0) {
  const text = [
    'AXM premade alpha sprite extractor v0.14', '',
    'Usage:',
    '  node tools/premade-sprites.js extract ATLAS_ID [options]',
    '  node tools/premade-sprites.js extract-all [options]',
    '  node tools/premade-sprites.js verify INDEX.json',
    '  node tools/premade-sprites.js selftest', '',
    'Options:',
    '  --source-dir DIR    source PNG directory (default assets/premade/v0.11/source-png)',
    '  --out-dir DIR       output root (default build/premade-sprites-v0.14)',
    '  --index-out FILE    explicit combined index JSON path',
    '  --threshold N       alpha threshold 1..254 (default 128)',
    '  --min-component N   minimum connected component pixels',
    '  --min-sprite N      minimum grouped candidate pixels',
    '  --merge-gap N       max bbox gap when grouping nearby fragments',
    '  --padding N         crop padding pixels',
    '  --max-sprites N     safety cap per atlas',
    '  --no-write-sprites  emit index only'
  ].join('\n');
  (code ? process.stderr : process.stdout).write(`${text}\n`);
  process.exit(code);
}

function sha256(buffer) { return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`; }
function mkdir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeJson(file, value) { mkdir(path.dirname(file)); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function atlasById(id) { return pack.assets.find((asset) => asset.id === id) || null; }
function isExtractable(asset) { return asset && !asset.grid && ['overlay-atlas','decal-atlas','fx-atlas'].includes(asset.kind); }
function sourcePngName(asset) { return asset.file.replace(/\.webp$/i, '.png'); }

function parseOptions(args) {
  const out = {
    sourceDir: path.join(ROOT, 'assets/premade/v0.11/source-png'),
    outDir: path.join(ROOT, 'build/premade-sprites-v0.14'),
    indexOut: null,
    config: {},
    writeSprites: true
  };
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (key === '--source-dir') out.sourceDir = path.resolve(args[++i]);
    else if (key === '--out-dir') out.outDir = path.resolve(args[++i]);
    else if (key === '--index-out') out.indexOut = path.resolve(args[++i]);
    else if (key === '--threshold') out.config.alphaThreshold = Number(args[++i]);
    else if (key === '--min-component') out.config.minComponentPixels = Number(args[++i]);
    else if (key === '--min-sprite') out.config.minSpritePixels = Number(args[++i]);
    else if (key === '--merge-gap') out.config.mergeGap = Number(args[++i]);
    else if (key === '--padding') out.config.padding = Number(args[++i]);
    else if (key === '--max-sprites') out.config.maxSprites = Number(args[++i]);
    else if (key === '--no-write-sprites') out.writeSprites = false;
    else throw new Error(`Unknown option: ${key}`);
  }
  return out;
}

function extractAtlas(asset, options) {
  if (!isExtractable(asset)) throw new Error(`${asset.id} is not a non-grid premade atlas.`);
  const sourcePath = path.join(options.sourceDir, sourcePngName(asset));
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing source PNG for ${asset.id}: ${sourcePath}. Install v0.11 with --keep-source-png first.`);
  const sourceBytes = fs.readFileSync(sourcePath);
  const decoded = png.decodePngRgba(sourceBytes);
  const candidates = core.extractCandidates(decoded.rgba, decoded.width, decoded.height, asset.id, options.config);
  const extraction = core.configFor(decoded.width, decoded.height, options.config);
  const index = core.makeIndex({
    pack: { format: pack.format, version: pack.version, archiveSha256: pack.binaryPack.sha256 },
    atlas: asset,
    width: decoded.width,
    height: decoded.height,
    sourceBasis: 'v0.11-source-png',
    sourceSha256: sha256(sourceBytes),
    extraction,
    candidates
  });
  const validation = core.validateIndex(index);
  if (!validation.ok) throw new Error(validation.reason);

  const atlasRoot = path.join(options.outDir, asset.id);
  if (options.writeSprites) {
    mkdir(atlasRoot);
    for (const candidate of candidates) {
      const crop = core.cropRgba(decoded.rgba, decoded.width, decoded.height, candidate.bounds);
      const bytes = png.encodePngRgba(crop.rgba, crop.width, crop.height);
      const filename = `${candidate.id.split('/').pop()}.png`;
      const target = path.join(atlasRoot, filename);
      fs.writeFileSync(target, bytes);
      candidate.spriteFile = path.relative(options.outDir, target).replace(/\\/g, '/');
      candidate.spriteSha256 = sha256(bytes);
    }
  }
  return index;
}

function combinedIndex(indices) {
  const basis = indices.map((index) => ({ id: index.id, atlasId: index.atlas.id, count: index.candidates.length }));
  return {
    format: 'axm-premade-sprite-index-set',
    version: core.VERSION,
    id: `sprite-index-set-${core.fnv1aText(core.stableStringify(basis))}`,
    pack: { format: pack.format, version: pack.version, archiveSha256: pack.binaryPack.sha256 },
    indices,
    summary: {
      atlases: indices.length,
      spriteCandidates: indices.reduce((sum, index) => sum + index.candidates.length, 0)
    },
    truthBoundary: {
      semantics: 'Entries are alpha-derived sprite candidates, not automatic semantic object labels.',
      continuity: 'Each per-atlas index records extraction parameters, normalized bounds and source-PNG SHA-256.',
      authority: 'Extraction does not install or promote any candidate automatically.'
    }
  };
}

function runSelftest() {
  const width = 12, height = 8;
  const rgba = new Uint8Array(width * height * 4);
  function fill(x0,y0,w,h,a=255) {
    for (let y=y0;y<y0+h;y+=1) for (let x=x0;x<x0+w;x+=1) {
      const i=(y*width+x)*4; rgba[i]=200; rgba[i+1]=100; rgba[i+2]=50; rgba[i+3]=a;
    }
  }
  fill(1,1,2,2); fill(4,1,1,1); fill(8,4,3,2);
  const candidates = core.extractCandidates(rgba,width,height,'selftest',{alphaThreshold:128,minComponentPixels:1,minSpritePixels:1,mergeGap:1,padding:0});
  if (candidates.length !== 2) throw new Error(`selftest expected 2 candidates, observed ${candidates.length}`);
  const encoded = png.encodePngRgba(rgba,width,height);
  const decoded = png.decodePngRgba(encoded);
  if (decoded.width !== width || decoded.height !== height || Buffer.compare(Buffer.from(decoded.rgba),Buffer.from(rgba)) !== 0) throw new Error('PNG roundtrip selftest failed.');
  process.stdout.write(`${JSON.stringify({ ok:true, candidates:candidates.length, pngBytes:encoded.length }, null, 2)}\n`);
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') usage();
  if (command === 'selftest') return runSelftest();
  if (command === 'verify') {
    const file = args[0]; if (!file) usage(1);
    const parsed = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    if (parsed.format === core.INDEX_FORMAT) {
      const validation = core.validateIndex(parsed);
      process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
      process.exit(validation.ok ? 0 : 2);
    }
    if (parsed.format === 'axm-premade-sprite-index-set' && Array.isArray(parsed.indices)) {
      const invalid = parsed.indices.map((index) => core.validateIndex(index)).find((result) => !result.ok);
      const result = invalid || { ok:true };
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exit(result.ok ? 0 : 2);
    }
    throw new Error('Unsupported sprite index format.');
  }

  if (command === 'extract') {
    const atlasId = args[0]; if (!atlasId) usage(1);
    const options = parseOptions(args.slice(1));
    const asset = atlasById(atlasId); if (!asset) throw new Error(`Unknown atlas: ${atlasId}`);
    const index = extractAtlas(asset, options);
    const target = options.indexOut || path.join(options.outDir, `${atlasId}.sprite-index.json`);
    writeJson(target, index);
    process.stdout.write(`${JSON.stringify({ ok:true, atlasId, candidates:index.candidates.length, index:path.relative(ROOT,target) }, null, 2)}\n`);
    return;
  }

  if (command === 'extract-all') {
    const options = parseOptions(args);
    const assets = pack.assets.filter(isExtractable);
    const indices = assets.map((asset) => extractAtlas(asset, options));
    const set = combinedIndex(indices);
    const target = options.indexOut || path.join(options.outDir, 'premade-sprite-index-set-v0.14.json');
    writeJson(target, set);
    process.stdout.write(`${JSON.stringify({ ok:true, atlases:set.summary.atlases, candidates:set.summary.spriteCandidates, index:path.relative(ROOT,target) }, null, 2)}\n`);
    return;
  }

  usage(1);
}

try { main(); }
catch (error) { process.stderr.write(`${error && error.stack ? error.stack : error}\n`); process.exit(1); }
