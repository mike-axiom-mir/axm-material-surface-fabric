'use strict';

const assert = require('assert');
const libraryCore = require('../library-core.js');
const signal = require('../signal-audit-core.js');
const batchTool = require('../tools/material-batch-readiness.js');
const { encodePngRgba } = require('../tools/png-rgba.js');

const CHANNELS = ['base-color','normal','roughness','metallic','ambient-occlusion','height'];

function pngEntry(id, channel, width, height, pixel) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = pixel(x, y);
      rgba[offset] = value[0]; rgba[offset + 1] = value[1]; rgba[offset + 2] = value[2]; rgba[offset + 3] = value.length > 3 ? value[3] : 255;
    }
  }
  const bytes = encodePngRgba(rgba, width, height);
  const dataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
  return {
    id, name:id, kind:'texture', mime:'image/png', width, height, bytes:bytes.length, dataUrl,
    source:{method:'signal-audit-test'}, usage:{channelHint:channel,channelBasis:'test'}, tags:['signal-test']
  };
}

function cleanLibrary() {
  const lib = libraryCore.createLibrary('2026-09-12T00:00:00Z');
  lib.id = 'signal-clean-library';
  const size = 12;
  const entries = [
    pngEntry('clean-base','base-color',size,size,(x,y)=>[(x*19+y*3)%256,(x*7+y*23)%256,(x*13+y*11)%256,255]),
    pngEntry('clean-normal','normal',size,size,(x,y)=>[124+((x+y)%9),124+((x*2+y)%9),248+((x+y)%8),255]),
    pngEntry('clean-rough','roughness',size,size,(x,y)=>{const v=(x*17+y*9)%256; return [v,v,v,255];}),
    pngEntry('clean-metal','metallic',size,size,(x,y)=>{const v=((x+y)%3===0)?230:25; return [v,v,v,255];}),
    pngEntry('clean-ao','ambient-occlusion',size,size,(x,y)=>{const v=80+((x*11+y*5)%170); return [v,v,v,255];}),
    pngEntry('clean-height','height',size,size,(x,y)=>{const v=(x*9+y*15)%256; return [v,v,v,255];})
  ];
  libraryCore.upsertEntries(lib, entries, '2026-09-12T00:00:01Z');
  libraryCore.createFamily(lib, { id:'clean-family', name:'Clean Family', entryIds:entries.map((row)=>row.id) }, '2026-09-12T00:00:02Z');
  return lib;
}

assert.strictEqual(signal.VERSION, '0.18.6');
assert.strictEqual(signal.FORMAT, 'axm-material-signal-audit');

const clean = cleanLibrary();
const cleanReport = signal.auditLibrarySignals(clean);
assert.strictEqual(cleanReport.summary.status, 'PASS');
assert.strictEqual(cleanReport.summary.entries, 6);
assert.strictEqual(cleanReport.summary.pixelObservedEntries, 6);
assert.strictEqual(cleanReport.summary.unobservedEntries, 0);
assert.strictEqual(cleanReport.summary.warnedEntries, 0);
assert.strictEqual(cleanReport.summary.warnedFamilies, 0);
assert.strictEqual(cleanReport.payloadAudit.status, 'PASS');
const normal = cleanReport.entries.find((row)=>row.channel==='normal');
assert.ok(normal.stats.normal.meanZ > 0.8);
assert.ok(normal.stats.normal.validLengthShare > 0.95);
for (const channel of ['roughness','metallic','ambient-occlusion','height']) {
  const row = cleanReport.entries.find((entry)=>entry.channel===channel);
  assert.strictEqual(row.stats.grayscaleShare, 1);
  assert.ok(!row.warnings.includes('scalar-channel-color-leak'));
}

const bad = cleanLibrary();
const coloredRough = pngEntry('clean-rough','roughness',12,12,(x,y)=>[(x*21)%256,(y*31)%256,40,255]);
const grayNormal = pngEntry('clean-normal','normal',12,12,(x,y)=>{const v=90+((x+y)%20); return [v,v,v,255];});
const base = bad.entries.find((row)=>row.id==='clean-base');
const duplicateHeight = Object.assign({}, base, { id:'clean-height', name:'clean-height', usage:{channelHint:'height',channelBasis:'test'} });
libraryCore.upsertEntries(bad, [coloredRough, grayNormal, duplicateHeight], '2026-09-12T00:00:03Z');
const badReport = signal.auditLibrarySignals(bad);
assert.strictEqual(badReport.summary.status, 'PASS_WITH_WARNINGS');
assert.ok(badReport.entries.find((row)=>row.id==='clean-rough').warnings.includes('scalar-channel-color-leak'));
const badNormal = badReport.entries.find((row)=>row.id==='clean-normal');
assert.ok(badNormal.warnings.includes('normal-map-near-grayscale'));
assert.ok(badNormal.warnings.includes('normal-positive-z-weak'));
assert.strictEqual(badReport.summary.duplicateCrossChannelFamilies, 1);
assert.ok(badReport.families[0].warnings.some((warning)=>warning.startsWith('duplicate-payload-across-channels:')));

const batch90 = batchTool.buildSyntheticLibrary(15, 4);
const batchReport = signal.auditLibrarySignals(batch90);
assert.strictEqual(batchReport.summary.status, 'PASS_WITH_WARNINGS');
assert.strictEqual(batchReport.summary.entries, 90);
assert.strictEqual(batchReport.summary.pixelObservedEntries, 90);
assert.strictEqual(batchReport.summary.unobservedEntries, 0);
assert.ok(batchReport.summary.scalarColorLeakEntries > 0, 'synthetic transport fixtures deliberately contain colored scalar channels');

const reordered = JSON.parse(JSON.stringify(clean));
reordered.entries.reverse(); reordered.families.reverse();
assert.strictEqual(signal.auditLibrarySignals(reordered).fingerprint, cleanReport.fingerprint);

const jpegLike = cleanLibrary();
const unsupported = jpegLike.entries[0];
unsupported.mime = 'image/jpeg';
unsupported.dataUrl = 'data:image/jpeg;base64,/9j/2Q==';
unsupported.bytes = 4;
unsupported.width = 1; unsupported.height = 1;
unsupported.payload = {portable:true,length:unsupported.dataUrl.length,hash:libraryCore.fnv1aText(unsupported.dataUrl)};
const unsupportedReport = signal.auditLibrarySignals(jpegLike);
assert.strictEqual(unsupportedReport.summary.status, 'HOLD', 'invalid jpeg payload must remain a payload HOLD before signal analysis');

assert.match(cleanReport.truthBoundary.diagnostics, /not an aesthetic score/i);
assert.match(cleanReport.truthBoundary.quality, /does not claim beauty/i);
assert.match(cleanReport.truthBoundary.authority, /No diagnostic warning keeps/i);

console.log('AXM material signal audit core tests: PASS');
