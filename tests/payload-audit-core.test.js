'use strict';

const assert = require('assert');
const libraryCore = require('../library-core.js');
const audit = require('../payload-audit-core.js');
const batchTool = require('../tools/material-batch-readiness.js');
const { encodePngRgba } = require('../tools/png-rgba.js');

function dataUrl(mime, bytes) { return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`; }
function rgbaPng(width, height, seed) {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = (seed + i * 17) & 255;
    rgba[i * 4 + 1] = (seed * 3 + i * 29) & 255;
    rgba[i * 4 + 2] = (seed * 7 + i * 43) & 255;
    rgba[i * 4 + 3] = i % 5 === 0 ? 180 : 255;
  }
  return encodePngRgba(rgba, width, height);
}
function minimalJpeg(width, height) {
  const sof = Buffer.alloc(19);
  sof[0] = 0xff; sof[1] = 0xc0;
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 3;
  sof.set([1,0x11,0,2,0x11,0,3,0x11,0], 10);
  return Buffer.concat([Buffer.from([0xff,0xd8]), sof, Buffer.from([0xff,0xd9])]);
}
function minimalWebpVp8x(width, height, alpha) {
  const payload = Buffer.alloc(10);
  payload[0] = alpha ? 0x10 : 0;
  const w = width - 1, h = height - 1;
  payload[4] = w & 255; payload[5] = (w >>> 8) & 255; payload[6] = (w >>> 16) & 255;
  payload[7] = h & 255; payload[8] = (h >>> 8) & 255; payload[9] = (h >>> 16) & 255;
  const chunk = Buffer.alloc(8);
  chunk.write('VP8X', 0, 'ascii');
  chunk.writeUInt32LE(payload.length, 4);
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), chunk, payload]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}
function entry(id, channel, mime, width, height, bytes) {
  const url = dataUrl(mime, bytes);
  return {
    id,
    name: id,
    kind: 'texture',
    mime,
    width,
    height,
    bytes: bytes.length,
    dataUrl: url,
    payload: { portable: true, length: url.length, hash: libraryCore.fnv1aText(url) },
    source: { method: 'payload-audit-test' },
    usage: { channelHint: channel, channelBasis: 'test' },
    tags: ['test']
  };
}

assert.strictEqual(audit.VERSION, '0.18.5');
assert.strictEqual(audit.FORMAT, 'axm-material-payload-audit');

const png = rgbaPng(7, 5, 13);
const pngCheck = audit.auditEntry(entry('png-a', 'base-color', 'image/png', 7, 5, png));
assert.strictEqual(pngCheck.status, 'PASS');
assert.strictEqual(pngCheck.observed.width, 7);
assert.strictEqual(pngCheck.observed.height, 5);
assert.strictEqual(pngCheck.observed.hasAlpha, true);
assert.strictEqual(pngCheck.observed.pixelDecodeVerified, true);
assert.match(pngCheck.observed.sha256, /^[0-9a-f]{64}$/);

const jpeg = minimalJpeg(19, 11);
const jpegCheck = audit.auditEntry(entry('jpg-a', 'base-color', 'image/jpeg', 19, 11, jpeg));
assert.strictEqual(jpegCheck.status, 'PASS_WITH_WARNINGS');
assert.strictEqual(jpegCheck.observed.width, 19);
assert.strictEqual(jpegCheck.observed.height, 11);
assert.deepStrictEqual(jpegCheck.warnings, ['header-structural-audit-only']);

const webp = minimalWebpVp8x(23, 17, true);
const webpCheck = audit.auditEntry(entry('webp-a', 'emissive', 'image/webp', 23, 17, webp));
assert.strictEqual(webpCheck.status, 'PASS_WITH_WARNINGS');
assert.strictEqual(webpCheck.observed.width, 23);
assert.strictEqual(webpCheck.observed.height, 17);
assert.strictEqual(webpCheck.observed.hasAlpha, true);

const badDimensions = entry('bad-dims', 'normal', 'image/png', 8, 5, png);
const badDimensionsCheck = audit.auditEntry(badDimensions);
assert.strictEqual(badDimensionsCheck.status, 'HOLD');
assert.ok(badDimensionsCheck.issues.includes('declared-width-mismatch'));

const badMime = entry('bad-mime', 'roughness', 'image/jpeg', 7, 5, png);
const badMimeCheck = audit.auditEntry(badMime);
assert.strictEqual(badMimeCheck.status, 'HOLD');
assert.ok(badMimeCheck.issues.includes('data-url-mime-signature-mismatch'));

const badBytes = entry('bad-bytes', 'metallic', 'image/png', 7, 5, png);
badBytes.bytes += 2;
assert.ok(audit.auditEntry(badBytes).issues.includes('declared-byte-length-mismatch'));

const badDescriptor = entry('bad-descriptor', 'height', 'image/png', 7, 5, png);
badDescriptor.payload.hash = '00000000';
assert.ok(audit.auditEntry(badDescriptor).issues.includes('payload-hash-mismatch'));

const corruptPng = Buffer.from(png);
const idatIndex = corruptPng.indexOf(Buffer.from('IDAT'));
assert.ok(idatIndex > 0);
corruptPng[idatIndex + 5] ^= 0x01;
const corruptCheck = audit.auditEntry(entry('corrupt', 'ambient-occlusion', 'image/png', 7, 5, corruptPng));
assert.strictEqual(corruptCheck.status, 'HOLD');
assert.ok(corruptCheck.issues.some((issue) => issue === 'png-crc-mismatch:IDAT'));

const invalidBase64 = entry('bad64', 'base-color', 'image/png', 1, 1, rgbaPng(1, 1, 2));
invalidBase64.dataUrl = 'data:image/png;base64,%%%%';
const invalidCheck = audit.auditEntry(invalidBase64);
assert.strictEqual(invalidCheck.status, 'HOLD');
assert.ok(invalidCheck.issues.some((issue) => issue.startsWith('invalid-data-url:')));

const synthetic90 = batchTool.buildSyntheticLibrary(15, 4);
const report90 = audit.auditLibrary(synthetic90);
assert.strictEqual(report90.summary.status, 'PASS');
assert.strictEqual(report90.summary.entries, 90);
assert.strictEqual(report90.summary.families, 15);
assert.strictEqual(report90.summary.heldEntries, 0);
assert.strictEqual(report90.summary.rgba8PngPixelDecodes, 90);
assert.strictEqual(report90.summary.png, 90);
assert.strictEqual(report90.holds.length, 0);

const reordered = JSON.parse(JSON.stringify(synthetic90));
reordered.entries.reverse();
reordered.families.reverse();
const reorderedReport = audit.auditLibrary(reordered);
assert.strictEqual(reorderedReport.fingerprint, report90.fingerprint, 'payload audit must be independent of array order');

const mixed = batchTool.buildSyntheticLibrary(2, 4);
const changed = rgbaPng(8, 8, 99);
const target = mixed.entries.find((row) => row.id === 'stress-001-height');
target.width = 8; target.height = 8; target.bytes = changed.length; target.dataUrl = dataUrl('image/png', changed);
target.payload = { portable: true, length: target.dataUrl.length, hash: libraryCore.fnv1aText(target.dataUrl) };
const mixedReport = audit.auditLibrary(mixed);
assert.strictEqual(mixedReport.summary.status, 'PASS_WITH_WARNINGS');
assert.ok(mixedReport.families.find((row) => row.id === 'stress-family-001').warnings.some((warning) => warning.startsWith('mixed-family-dimensions:')));
const strictMixed = audit.auditLibrary(mixed, { strictFamilyDimensions: true });
assert.strictEqual(strictMixed.summary.status, 'HOLD');
assert.strictEqual(strictMixed.summary.heldFamilies, 1);

const missingPayload = batchTool.buildSyntheticLibrary(1, 4);
missingPayload.entries[0].dataUrl = null;
missingPayload.entries[0].payload = { portable: false, length: 0, hash: null };
const missingReport = audit.auditLibrary(missingPayload);
assert.strictEqual(missingReport.summary.status, 'HOLD');
assert.strictEqual(missingReport.summary.heldEntries, 1);
assert.strictEqual(missingReport.summary.heldFamilies, 1);

assert.match(report90.truthBoundary.quality, /does not prove beauty/i);
assert.match(report90.truthBoundary.authority, /never installs/i);

console.log('AXM portable payload audit core tests: PASS');
