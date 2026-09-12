'use strict';

const crypto = require('node:crypto');
const libraryCore = require('./library-core.js');
const pngCodec = require('./tools/png-rgba.js');

const VERSION = '0.18.5';
const FORMAT = 'axm-material-payload-audit';
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const WARN_LIMITS = Object.freeze({
  maxDimension: 8192,
  maxPixels: 32 * 1024 * 1024,
  maxBytes: 64 * 1024 * 1024
});

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value == null ? '' : value).trim(); }
function canonicalMime(value) {
  const mime = text(value).toLowerCase();
  return mime === 'image/jpg' ? 'image/jpeg' : mime;
}
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function normalizeSha256(value) {
  const raw = text(value).toLowerCase();
  if (!raw) return null;
  const stripped = raw.startsWith('sha256:') ? raw.slice(7) : raw;
  return /^[0-9a-f]{64}$/.test(stripped) ? stripped : null;
}
function uniqueSorted(values) { return Array.from(new Set((values || []).map(text).filter(Boolean))).sort(); }

function decodeDataUrl(value) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)$/i.exec(String(value || ''));
  if (!match) throw new TypeError('Portable payload must be a base64 PNG/JPEG/WEBP data URL.');
  const compact = match[2].replace(/\s+/g, '');
  if (!compact || /[^A-Za-z0-9+/=]/.test(compact) || /=/.test(compact.slice(0, -2))) {
    throw new TypeError('Portable payload contains malformed base64 characters or padding.');
  }
  const unpadded = compact.replace(/=+$/, '');
  if (unpadded.length % 4 === 1) throw new TypeError('Portable payload has an impossible base64 length.');
  const padded = unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);
  const bytes = Buffer.from(padded, 'base64');
  if (!bytes.length) throw new TypeError('Portable payload decoded to zero bytes.');
  const roundTrip = bytes.toString('base64').replace(/=+$/, '');
  if (roundTrip !== unpadded) throw new TypeError('Portable payload is not canonical base64 for the observed bytes.');
  return { mime: canonicalMime(`image/${match[1]}`), bytes };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Parts(parts) {
  let crc = 0xffffffff;
  for (const part of parts) {
    for (const value of part) crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngSignature(bytes) {
  return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}
function jpegSignature(bytes) { return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff; }
function webpSignature(bytes) {
  return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

function inspectPng(bytes) {
  const issues = [];
  if (!pngSignature(bytes)) return { mime: 'image/png', width: null, height: null, hasAlpha: null, pixelDecodeVerified: false, issues: ['png-signature-mismatch'] };
  let offset = 8;
  let ihdr = null;
  let idatCount = 0;
  let sawIend = false;
  let sawTransparency = false;
  let chunkIndex = 0;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    const nextOffset = crcOffset + 4;
    if (nextOffset > bytes.length) {
      issues.push('png-truncated-chunk');
      break;
    }
    const typeBytes = bytes.subarray(typeStart, typeStart + 4);
    const type = typeBytes.toString('ascii');
    const data = bytes.subarray(dataStart, dataEnd);
    const observedCrc = bytes.readUInt32BE(crcOffset);
    const expectedCrc = crc32Parts([typeBytes, data]);
    if (observedCrc !== expectedCrc) issues.push(`png-crc-mismatch:${type}`);
    if (chunkIndex === 0 && type !== 'IHDR') issues.push('png-ihdr-not-first');
    if (type === 'IHDR') {
      if (ihdr) issues.push('png-duplicate-ihdr');
      if (length !== 13) issues.push('png-invalid-ihdr-length');
      else {
        const width = data.readUInt32BE(0);
        const height = data.readUInt32BE(4);
        const bitDepth = data[8];
        const colorType = data[9];
        const compression = data[10];
        const filter = data[11];
        const interlace = data[12];
        const validDepths = {
          0: [1, 2, 4, 8, 16],
          2: [8, 16],
          3: [1, 2, 4, 8],
          4: [8, 16],
          6: [8, 16]
        };
        if (!width || !height) issues.push('png-zero-dimensions');
        if (!validDepths[colorType] || !validDepths[colorType].includes(bitDepth)) issues.push('png-invalid-bit-depth-color-type');
        if (compression !== 0) issues.push('png-unsupported-compression-method');
        if (filter !== 0) issues.push('png-unsupported-filter-method');
        if (![0, 1].includes(interlace)) issues.push('png-invalid-interlace-method');
        ihdr = { width, height, bitDepth, colorType, interlace };
      }
    } else if (type === 'IDAT') idatCount += 1;
    else if (type === 'tRNS') sawTransparency = true;
    else if (type === 'IEND') {
      if (length !== 0) issues.push('png-invalid-iend-length');
      sawIend = true;
      offset = nextOffset;
      break;
    }
    offset = nextOffset;
    chunkIndex += 1;
  }
  if (!ihdr) issues.push('png-missing-ihdr');
  if (!idatCount) issues.push('png-missing-idat');
  if (!sawIend) issues.push('png-missing-iend');
  if (sawIend && offset !== bytes.length) issues.push('png-trailing-bytes');
  let pixelDecodeVerified = false;
  if (ihdr && ihdr.bitDepth === 8 && ihdr.colorType === 6 && ihdr.interlace === 0 && !issues.some((issue) => issue.startsWith('png-crc-mismatch') || issue.includes('truncated'))) {
    try {
      const decoded = pngCodec.decodePngRgba(bytes);
      pixelDecodeVerified = decoded.width === ihdr.width && decoded.height === ihdr.height;
      if (!pixelDecodeVerified) issues.push('png-rgba8-decode-dimension-mismatch');
    } catch (error) {
      issues.push(`png-rgba8-decode-failed:${error && error.message ? error.message : String(error)}`);
    }
  }
  return {
    mime: 'image/png',
    width: ihdr ? ihdr.width : null,
    height: ihdr ? ihdr.height : null,
    bitDepth: ihdr ? ihdr.bitDepth : null,
    colorType: ihdr ? ihdr.colorType : null,
    interlace: ihdr ? ihdr.interlace : null,
    hasAlpha: ihdr ? [4, 6].includes(ihdr.colorType) || sawTransparency : null,
    pixelDecodeVerified,
    idatChunks: idatCount,
    issues
  };
}

const JPEG_SOF = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
function inspectJpeg(bytes) {
  const issues = [];
  if (!jpegSignature(bytes)) return { mime: 'image/jpeg', width: null, height: null, hasAlpha: false, pixelDecodeVerified: false, issues: ['jpeg-signature-mismatch'] };
  let width = null;
  let height = null;
  let precision = null;
  let offset = 2;
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    if (offset >= bytes.length) break;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) { issues.push('jpeg-truncated-segment-length'); break; }
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) { issues.push('jpeg-invalid-segment-length'); break; }
    if (JPEG_SOF.has(marker)) {
      if (length < 8) issues.push('jpeg-short-sof');
      else {
        precision = bytes[offset + 2];
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
        if (!width || !height) issues.push('jpeg-zero-dimensions');
      }
      break;
    }
    offset += length;
  }
  if (!width || !height) issues.push('jpeg-missing-sof-dimensions');
  if (bytes.length < 2 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) issues.push('jpeg-missing-eoi');
  return { mime: 'image/jpeg', width, height, precision, hasAlpha: false, pixelDecodeVerified: false, issues };
}

function readUInt24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function inspectWebp(bytes) {
  const issues = [];
  if (!webpSignature(bytes)) return { mime: 'image/webp', width: null, height: null, hasAlpha: null, pixelDecodeVerified: false, issues: ['webp-signature-mismatch'] };
  const declaredRiffBytes = bytes.readUInt32LE(4) + 8;
  if (declaredRiffBytes !== bytes.length) issues.push('webp-riff-size-mismatch');
  let offset = 12;
  let width = null;
  let height = null;
  let hasAlpha = null;
  let primary = null;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > bytes.length) { issues.push('webp-truncated-chunk'); break; }
    if (type === 'VP8X' && length >= 10) {
      primary = primary || type;
      const flags = bytes[dataStart];
      width = 1 + readUInt24LE(bytes, dataStart + 4);
      height = 1 + readUInt24LE(bytes, dataStart + 7);
      hasAlpha = Boolean(flags & 0x10);
    } else if (type === 'VP8 ' && length >= 10 && width == null) {
      primary = primary || type;
      if (bytes[dataStart + 3] !== 0x9d || bytes[dataStart + 4] !== 0x01 || bytes[dataStart + 5] !== 0x2a) issues.push('webp-vp8-frame-signature-mismatch');
      else {
        width = bytes.readUInt16LE(dataStart + 6) & 0x3fff;
        height = bytes.readUInt16LE(dataStart + 8) & 0x3fff;
        hasAlpha = false;
      }
    } else if (type === 'VP8L' && length >= 5 && width == null) {
      primary = primary || type;
      if (bytes[dataStart] !== 0x2f) issues.push('webp-vp8l-signature-mismatch');
      else {
        const b1 = bytes[dataStart + 1], b2 = bytes[dataStart + 2], b3 = bytes[dataStart + 3], b4 = bytes[dataStart + 4];
        width = 1 + b1 + ((b2 & 0x3f) << 8);
        height = 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10);
        hasAlpha = true;
      }
    }
    offset = dataEnd + (length & 1);
  }
  if (!width || !height) issues.push('webp-missing-frame-dimensions');
  if (offset !== bytes.length) issues.push('webp-chunk-layout-mismatch');
  return { mime: 'image/webp', width, height, primaryChunk: primary, hasAlpha, pixelDecodeVerified: false, issues };
}

function inspectImage(bytes) {
  if (pngSignature(bytes)) return inspectPng(bytes);
  if (jpegSignature(bytes)) return inspectJpeg(bytes);
  if (webpSignature(bytes)) return inspectWebp(bytes);
  return { mime: null, width: null, height: null, hasAlpha: null, pixelDecodeVerified: false, issues: ['unknown-image-signature'] };
}

function declaredSha(entry) {
  const candidates = [
    entry && entry.sha256,
    entry && entry.source && entry.source.sha256,
    entry && entry.source && entry.source.digest
  ];
  for (const candidate of candidates) if (text(candidate)) return { raw: text(candidate), normalized: normalizeSha256(candidate) };
  return { raw: null, normalized: null };
}

function auditEntry(entry, options) {
  const settings = Object.assign({}, WARN_LIMITS, options && options.warnLimits || {});
  const issues = [];
  const warnings = [];
  const id = text(entry && entry.id);
  const declaredMime = canonicalMime(entry && entry.mime);
  const declaredWidth = Number(entry && entry.width) || 0;
  const declaredHeight = Number(entry && entry.height) || 0;
  const declaredBytes = Number.isFinite(Number(entry && entry.bytes)) ? Number(entry.bytes) : null;
  const dataUrl = text(entry && entry.dataUrl);
  if (!id) issues.push('missing-entry-id');
  if (!IMAGE_MIMES.has(text(entry && entry.mime).toLowerCase())) issues.push(declaredMime ? `unsupported-declared-mime:${declaredMime}` : 'missing-declared-mime');
  if (!dataUrl) {
    issues.push('no-portable-payload');
    return {
      id,
      channel: text(entry && entry.usage && entry.usage.channelHint),
      status: 'HOLD',
      declared: { mime: declaredMime || null, width: declaredWidth || null, height: declaredHeight || null, bytes: declaredBytes },
      observed: null,
      issues: uniqueSorted(issues),
      warnings
    };
  }

  let parsed;
  try { parsed = decodeDataUrl(dataUrl); }
  catch (error) {
    issues.push(`invalid-data-url:${error && error.message ? error.message : String(error)}`);
    return {
      id,
      channel: text(entry && entry.usage && entry.usage.channelHint),
      status: 'HOLD',
      declared: { mime: declaredMime || null, width: declaredWidth || null, height: declaredHeight || null, bytes: declaredBytes },
      observed: null,
      issues: uniqueSorted(issues),
      warnings
    };
  }

  const image = inspectImage(parsed.bytes);
  issues.push(...image.issues);
  if (declaredMime && declaredMime !== parsed.mime) issues.push('declared-mime-data-url-mismatch');
  if (image.mime && parsed.mime !== image.mime) issues.push('data-url-mime-signature-mismatch');
  if (declaredWidth > 0 && image.width != null && declaredWidth !== image.width) issues.push('declared-width-mismatch');
  if (declaredHeight > 0 && image.height != null && declaredHeight !== image.height) issues.push('declared-height-mismatch');
  if (declaredBytes != null && declaredBytes !== parsed.bytes.length) issues.push('declared-byte-length-mismatch');

  const observedSha256 = sha256(parsed.bytes);
  const claimedSha = declaredSha(entry);
  if (claimedSha.raw && !claimedSha.normalized) issues.push('invalid-declared-sha256');
  if (claimedSha.normalized && claimedSha.normalized !== observedSha256) issues.push('sha256-mismatch');

  if (entry && entry.payload && typeof entry.payload === 'object') {
    if (entry.payload.portable === false) issues.push('payload-portable-flag-mismatch');
    if (Number.isFinite(Number(entry.payload.length)) && Number(entry.payload.length) !== dataUrl.length) issues.push('payload-length-mismatch');
    if (text(entry.payload.hash) && text(entry.payload.hash) !== libraryCore.fnv1aText(dataUrl)) issues.push('payload-hash-mismatch');
  }

  if ((image.width || 0) > settings.maxDimension || (image.height || 0) > settings.maxDimension) warnings.push('large-dimension');
  if ((image.width || 0) * (image.height || 0) > settings.maxPixels) warnings.push('large-pixel-count');
  if (parsed.bytes.length > settings.maxBytes) warnings.push('large-byte-payload');
  if (image.mime === 'image/png' && image.pixelDecodeVerified === false && !issues.length) warnings.push('png-container-verified-pixels-not-decoded-by-rgba8-path');
  if (image.mime === 'image/jpeg' || image.mime === 'image/webp') warnings.push('header-structural-audit-only');

  return {
    id,
    channel: text(entry && entry.usage && entry.usage.channelHint),
    status: issues.length ? 'HOLD' : warnings.length ? 'PASS_WITH_WARNINGS' : 'PASS',
    declared: { mime: declaredMime || null, width: declaredWidth || null, height: declaredHeight || null, bytes: declaredBytes, sha256: claimedSha.normalized },
    observed: {
      mime: image.mime,
      dataUrlMime: parsed.mime,
      width: image.width,
      height: image.height,
      bytes: parsed.bytes.length,
      sha256: observedSha256,
      hasAlpha: image.hasAlpha,
      pixelDecodeVerified: Boolean(image.pixelDecodeVerified),
      bitDepth: image.bitDepth == null ? null : image.bitDepth,
      colorType: image.colorType == null ? null : image.colorType,
      primaryChunk: image.primaryChunk || null
    },
    issues: uniqueSorted(issues),
    warnings: uniqueSorted(warnings)
  };
}

function auditFamily(family, checksById, options) {
  const issues = [];
  const warnings = [];
  const entryIds = uniqueSorted(family && family.entryIds);
  const checks = entryIds.map((id) => checksById.get(id)).filter(Boolean);
  const missing = entryIds.filter((id) => !checksById.has(id));
  if (missing.length) issues.push(`missing-members:${missing.join(',')}`);
  if (checks.some((check) => check.status === 'HOLD')) issues.push('member-payload-hold');
  const dimensions = uniqueSorted(checks.filter((check) => check.observed && check.observed.width && check.observed.height).map((check) => `${check.observed.width}x${check.observed.height}`));
  if (dimensions.length > 1) {
    if (options && options.strictFamilyDimensions) issues.push(`mixed-family-dimensions:${dimensions.join(',')}`);
    else warnings.push(`mixed-family-dimensions:${dimensions.join(',')}`);
  }
  const mimes = uniqueSorted(checks.filter((check) => check.observed && check.observed.mime).map((check) => check.observed.mime));
  if (mimes.length > 1) warnings.push(`mixed-family-mimes:${mimes.join(',')}`);
  const totalBytes = checks.reduce((sum, check) => sum + (check.observed && check.observed.bytes || 0), 0);
  return {
    id: text(family && family.id),
    entryIds,
    status: issues.length ? 'HOLD' : warnings.length ? 'PASS_WITH_WARNINGS' : 'PASS',
    dimensions,
    mimes,
    totalBytes,
    issues: uniqueSorted(issues),
    warnings: uniqueSorted(warnings)
  };
}

function auditLibrary(library, options) {
  const validation = libraryCore.validateLibrary(library);
  if (!validation.ok) throw new TypeError(validation.reason);
  const entries = (library.entries || []).slice().sort((a, b) => text(a.id).localeCompare(text(b.id)));
  const families = (library.families || []).slice().sort((a, b) => text(a.id).localeCompare(text(b.id)));
  const duplicateEntryIds = [];
  const seenEntries = new Set();
  for (const entry of entries) {
    if (seenEntries.has(entry.id)) duplicateEntryIds.push(entry.id);
    seenEntries.add(entry.id);
  }
  const checks = entries.map((entry) => auditEntry(entry, options));
  const checksById = new Map(checks.map((check) => [check.id, check]));
  const familyChecks = families.map((family) => auditFamily(family, checksById, options));
  const holds = [];
  if (duplicateEntryIds.length) holds.push({ kind: 'duplicate-entry-ids', ids: uniqueSorted(duplicateEntryIds) });
  for (const check of checks.filter((row) => row.status === 'HOLD')) holds.push({ kind: 'entry', id: check.id, issues: clone(check.issues) });
  for (const check of familyChecks.filter((row) => row.status === 'HOLD')) holds.push({ kind: 'family', id: check.id, issues: clone(check.issues) });
  const warnings = [];
  for (const check of checks.filter((row) => row.warnings.length)) warnings.push({ kind: 'entry', id: check.id, warnings: clone(check.warnings) });
  for (const check of familyChecks.filter((row) => row.warnings.length)) warnings.push({ kind: 'family', id: check.id, warnings: clone(check.warnings) });
  const totalBytes = checks.reduce((sum, check) => sum + (check.observed && check.observed.bytes || 0), 0);
  const basis = {
    libraryId: library.id || null,
    entries: checks.map((check) => ({ id: check.id, status: check.status, sha256: check.observed && check.observed.sha256 || null, issues: check.issues, warnings: check.warnings })),
    families: familyChecks.map((check) => ({ id: check.id, status: check.status, dimensions: check.dimensions, issues: check.issues, warnings: check.warnings })),
    strictFamilyDimensions: Boolean(options && options.strictFamilyDimensions)
  };
  const fingerprint = libraryCore.fnv1aText(libraryCore.stableStringify(basis));
  const status = holds.length ? 'HOLD' : warnings.length ? 'PASS_WITH_WARNINGS' : 'PASS';
  return {
    format: FORMAT,
    version: VERSION,
    id: `payload-audit-${fingerprint}`,
    fingerprint,
    library: { id: library.id || null, entries: entries.length, families: families.length },
    summary: {
      status,
      entries: checks.length,
      passEntries: checks.filter((row) => row.status === 'PASS').length,
      warningEntries: checks.filter((row) => row.status === 'PASS_WITH_WARNINGS').length,
      heldEntries: checks.filter((row) => row.status === 'HOLD').length,
      families: familyChecks.length,
      warningFamilies: familyChecks.filter((row) => row.status === 'PASS_WITH_WARNINGS').length,
      heldFamilies: familyChecks.filter((row) => row.status === 'HOLD').length,
      png: checks.filter((row) => row.observed && row.observed.mime === 'image/png').length,
      jpeg: checks.filter((row) => row.observed && row.observed.mime === 'image/jpeg').length,
      webp: checks.filter((row) => row.observed && row.observed.mime === 'image/webp').length,
      rgba8PngPixelDecodes: checks.filter((row) => row.observed && row.observed.pixelDecodeVerified).length,
      totalBytes
    },
    entries: checks,
    families: familyChecks,
    holds,
    warnings,
    truthBoundary: {
      bytes: 'The audit verifies portable data-url decoding, image-container signatures, declared byte/dimension continuity, optional SHA-256 continuity, and bounded structural container state.',
      png: 'RGBA8 non-interlaced PNG payloads additionally pass the repository pixel decoder; other valid PNG encodings remain container-level evidence unless another decoder is added.',
      jpegWebp: 'JPEG and WEBP checks are header/container structural checks, not full pixel decode or renderer evidence.',
      family: 'Matching dimensions inside one material family are useful transport evidence; mixed dimensions are warnings by default because resampling can be legitimate.',
      quality: 'Payload integrity does not prove beauty, usefulness, semantic correctness, PBR correctness, physical truth, or renderer equivalence.',
      authority: 'PASS/HOLD is diagnostic evidence only and never installs, keeps, promotes, or rewrites canonical material state.'
    }
  };
}

module.exports = {
  VERSION,
  FORMAT,
  IMAGE_MIMES,
  WARN_LIMITS,
  canonicalMime,
  normalizeSha256,
  decodeDataUrl,
  inspectPng,
  inspectJpeg,
  inspectWebp,
  inspectImage,
  auditEntry,
  auditFamily,
  auditLibrary
};
