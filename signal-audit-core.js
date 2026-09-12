'use strict';

const libraryCore = require('./library-core.js');
const payloadAudit = require('./payload-audit-core.js');
const { decodePngPixels } = require('./tools/png-pixels.js');

const VERSION = '0.18.6';
const FORMAT = 'axm-material-signal-audit';
const SCALAR_CHANNELS = new Set(['roughness','metallic','ambient-occlusion','height','displacement','opacity']);
const MAX_SAMPLES = 100000;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value == null ? '' : value).trim(); }
function channelOf(entry) { return text(entry && entry.usage && entry.usage.channelHint).toLowerCase().replace(/_/g, '-'); }
function uniqueSorted(values) { return Array.from(new Set((values || []).map(text).filter(Boolean))).sort(); }
function round(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(Number(value || 0) * scale) / scale;
}

function decodeEntryPixels(entry) {
  if (!entry || !entry.dataUrl) throw new TypeError('Portable dataUrl is required for pixel signal observation.');
  const parsed = payloadAudit.decodeDataUrl(entry.dataUrl);
  if (parsed.mime !== 'image/png') throw new TypeError(`Pixel signal decoder currently supports PNG only; observed ${parsed.mime}.`);
  return decodePngPixels(parsed.bytes);
}

function signalStats(rgba, width, height, channel) {
  const pixels = width * height;
  const step = Math.max(1, Math.floor(pixels / MAX_SAMPLES));
  let samples = 0;
  const sums = [0,0,0,0];
  const squares = [0,0,0,0];
  let gray = 0;
  let visible = 0;
  let partialAlpha = 0;
  let edgeTotal = 0;
  let edgeCount = 0;
  const coarse = new Set();
  let normalLengthSum = 0;
  let normalZSum = 0;
  let normalLengthValid = 0;

  for (let pixel = 0; pixel < pixels; pixel += step) {
    const offset = pixel * 4;
    const r = rgba[offset], g = rgba[offset + 1], b = rgba[offset + 2], a = rgba[offset + 3];
    const values = [r,g,b,a];
    for (let c = 0; c < 4; c += 1) {
      sums[c] += values[c];
      squares[c] += values[c] * values[c];
    }
    if (Math.max(r,g,b) - Math.min(r,g,b) <= 2) gray += 1;
    if (a > 16) visible += 1;
    if (a > 0 && a < 255) partialAlpha += 1;
    coarse.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    const x = pixel % width;
    if (x + 1 < width) {
      const next = offset + 4;
      const l0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const l1 = 0.2126 * rgba[next] + 0.7152 * rgba[next + 1] + 0.0722 * rgba[next + 2];
      edgeTotal += Math.abs(l1 - l0) / 255;
      edgeCount += 1;
    }
    if (channel === 'normal') {
      const nx = r / 127.5 - 1;
      const ny = g / 127.5 - 1;
      const nz = b / 127.5 - 1;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      normalLengthSum += length;
      normalZSum += nz;
      if (length >= 0.5 && length <= 1.5) normalLengthValid += 1;
    }
    samples += 1;
  }

  const means = sums.map((sum) => sum / Math.max(1, samples));
  const std = squares.map((sum, index) => Math.sqrt(Math.max(0, sum / Math.max(1, samples) - means[index] * means[index])));
  const lumaMean = 0.2126 * means[0] + 0.7152 * means[1] + 0.0722 * means[2];
  const lumaStd = Math.sqrt((0.2126 * std[0]) ** 2 + (0.7152 * std[1]) ** 2 + (0.0722 * std[2]) ** 2);
  return {
    samples,
    width,
    height,
    mean: { r: round(means[0]), g: round(means[1]), b: round(means[2]), a: round(means[3]) },
    std: { r: round(std[0]), g: round(std[1]), b: round(std[2]), a: round(std[3]) },
    lumaMean: round(lumaMean),
    lumaStd: round(lumaStd),
    grayscaleShare: round(gray / Math.max(1, samples)),
    visibleAlphaShare: round(visible / Math.max(1, samples)),
    partialAlphaShare: round(partialAlpha / Math.max(1, samples)),
    coarseColorBins: coarse.size,
    edgeEnergy: round(edgeTotal / Math.max(1, edgeCount)),
    normal: channel === 'normal' ? {
      meanVectorLength: round(normalLengthSum / Math.max(1, samples)),
      validLengthShare: round(normalLengthValid / Math.max(1, samples)),
      meanZ: round(normalZSum / Math.max(1, samples))
    } : null
  };
}

function warningsForStats(channel, stats) {
  const warnings = [];
  const maxRgbStd = Math.max(stats.std.r, stats.std.g, stats.std.b);
  if (maxRgbStd < 1.5 && stats.std.a < 1.5) warnings.push('near-flat-signal');
  if (SCALAR_CHANNELS.has(channel) && stats.grayscaleShare < 0.95) warnings.push('scalar-channel-color-leak');
  if (channel === 'normal') {
    if (stats.grayscaleShare > 0.95) warnings.push('normal-map-near-grayscale');
    if (stats.normal && stats.normal.meanZ < 0.15) warnings.push('normal-positive-z-weak');
    if (stats.normal && stats.normal.validLengthShare < 0.75) warnings.push('normal-vector-length-irregular');
  }
  // Low palette diversity is suspicious for base colour, but it is common and valid for
  // gently varying tangent-space normals. Normal maps have their own vector diagnostics above.
  if (channel === 'base-color' && stats.coarseColorBins <= 4 && stats.samples > 16) warnings.push('low-signal-diversity');
  if (stats.visibleAlphaShare === 0) warnings.push('fully-transparent-signal');
  return uniqueSorted(warnings);
}

function auditEntrySignal(entry, payloadCheck) {
  const channel = channelOf(entry);
  if (!payloadCheck || payloadCheck.status === 'HOLD') {
    return { id: text(entry && entry.id), channel, status: 'HOLD', observed: false, reason: 'payload-integrity-hold', stats: null, warnings: [] };
  }
  if (!payloadCheck.observed || payloadCheck.observed.mime !== 'image/png') {
    return { id: text(entry && entry.id), channel, status: 'UNOBSERVED', observed: false, reason: 'pixel-signal-decoder-png-only', stats: null, warnings: ['pixel-signal-unobserved'] };
  }
  let decoded;
  try { decoded = decodeEntryPixels(entry); }
  catch (error) {
    return { id: text(entry && entry.id), channel, status: 'UNOBSERVED', observed: false, reason: error && error.message ? error.message : String(error), stats: null, warnings: ['pixel-signal-unobserved'] };
  }
  const stats = signalStats(decoded.rgba, decoded.width, decoded.height, channel);
  const warnings = warningsForStats(channel, stats);
  return {
    id: text(entry && entry.id),
    channel,
    status: warnings.length ? 'OBSERVED_WITH_WARNINGS' : 'OBSERVED',
    observed: true,
    reason: null,
    stats,
    warnings
  };
}

function auditFamilySignal(family, entriesById, signalById, payloadById) {
  const entryIds = uniqueSorted(family && family.entryIds);
  const warnings = [];
  const channels = [];
  const digestGroups = new Map();
  for (const entryId of entryIds) {
    const entry = entriesById.get(entryId);
    if (!entry) continue;
    const channel = channelOf(entry);
    channels.push(channel);
    const payload = payloadById.get(entryId);
    const digest = payload && payload.observed && payload.observed.sha256;
    if (digest) {
      if (!digestGroups.has(digest)) digestGroups.set(digest, []);
      digestGroups.get(digest).push({ entryId, channel });
    }
  }
  for (const rows of digestGroups.values()) {
    const distinctChannels = uniqueSorted(rows.map((row) => row.channel));
    if (distinctChannels.length > 1) warnings.push(`duplicate-payload-across-channels:${distinctChannels.join(',')}`);
  }
  const observed = entryIds.filter((id) => signalById.get(id) && signalById.get(id).observed).length;
  const warned = entryIds.filter((id) => signalById.get(id) && signalById.get(id).warnings.length).length;
  const unobserved = entryIds.filter((id) => signalById.get(id) && !signalById.get(id).observed).length;
  return {
    id: text(family && family.id),
    entryIds,
    channels: uniqueSorted(channels),
    observedEntries: observed,
    warnedEntries: warned,
    unobservedEntries: unobserved,
    status: warnings.length || warned || unobserved ? 'OBSERVED_WITH_WARNINGS' : 'OBSERVED',
    warnings: uniqueSorted(warnings)
  };
}

function auditLibrarySignals(library) {
  const validation = libraryCore.validateLibrary(library);
  if (!validation.ok) throw new TypeError(validation.reason);
  const payloadReport = payloadAudit.auditLibrary(library);
  const payloadById = new Map(payloadReport.entries.map((row) => [row.id, row]));
  const entries = library.entries.slice().sort((a, b) => text(a.id).localeCompare(text(b.id)));
  const signalEntries = entries.map((entry) => auditEntrySignal(entry, payloadById.get(entry.id)));
  const signalById = new Map(signalEntries.map((row) => [row.id, row]));
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const families = library.families.slice().sort((a, b) => text(a.id).localeCompare(text(b.id))).map((family) => auditFamilySignal(family, entriesById, signalById, payloadById));
  const warningRows = [];
  for (const entry of signalEntries.filter((row) => row.warnings.length)) warningRows.push({ kind: 'entry', id: entry.id, warnings: clone(entry.warnings) });
  for (const family of families.filter((row) => row.warnings.length)) warningRows.push({ kind: 'family', id: family.id, warnings: clone(family.warnings) });
  const basis = {
    libraryId: library.id || null,
    payloadFingerprint: payloadReport.fingerprint,
    entries: signalEntries.map((row) => ({ id: row.id, channel: row.channel, status: row.status, stats: row.stats, warnings: row.warnings })),
    families: families.map((row) => ({ id: row.id, status: row.status, warnings: row.warnings }))
  };
  const fingerprint = libraryCore.fnv1aText(libraryCore.stableStringify(basis));
  const payloadHold = payloadReport.summary.status === 'HOLD';
  const unobserved = signalEntries.filter((row) => !row.observed).length;
  const warnedEntries = signalEntries.filter((row) => row.warnings.length).length;
  const familyWarnings = families.filter((row) => row.warnings.length || row.warnedEntries || row.unobservedEntries).length;
  const status = payloadHold ? 'HOLD' : (warningRows.length || unobserved || familyWarnings ? 'PASS_WITH_WARNINGS' : 'PASS');
  return {
    format: FORMAT,
    version: VERSION,
    id: `signal-audit-${fingerprint}`,
    fingerprint,
    library: { id: library.id || null, entries: entries.length, families: families.length },
    payloadAudit: { id: payloadReport.id, fingerprint: payloadReport.fingerprint, status: payloadReport.summary.status, heldEntries: payloadReport.summary.heldEntries },
    summary: {
      status,
      entries: signalEntries.length,
      pixelObservedEntries: signalEntries.filter((row) => row.observed).length,
      unobservedEntries: unobserved,
      warnedEntries,
      families: families.length,
      warnedFamilies: familyWarnings,
      nearFlatEntries: signalEntries.filter((row) => row.warnings.includes('near-flat-signal')).length,
      scalarColorLeakEntries: signalEntries.filter((row) => row.warnings.includes('scalar-channel-color-leak')).length,
      normalWarnings: signalEntries.filter((row) => row.channel === 'normal' && row.warnings.length).length,
      duplicateCrossChannelFamilies: families.filter((row) => row.warnings.some((warning) => warning.startsWith('duplicate-payload-across-channels:'))).length
    },
    entries: signalEntries,
    families,
    warnings: warningRows,
    truthBoundary: {
      signal: 'Observed statistics describe bounded pixel-signal properties such as variance, grayscale share, alpha, coarse diversity, edge energy and tangent-normal plausibility checks.',
      diagnostics: 'Warnings identify technical signal pathologies or suspicious channel state; they are not an aesthetic score, preference model, semantic judgment, or automatic rejection.',
      normal: 'Normal-map checks assume the common tangent-space RGB encoding only as a warning heuristic. They do not certify coordinate convention or physical correctness.',
      scalar: 'Scalar-channel grayscale checks are routing diagnostics, not proof that the scalar values are physically meaningful.',
      quality: 'This audit does not claim beauty, realism, game-readiness, PBR truth, artistic quality, semantic correctness, or parity with any reference asset.',
      authority: 'No diagnostic warning keeps, rejects, promotes, merges, or rewrites canonical state automatically.'
    }
  };
}

module.exports = {
  VERSION,
  FORMAT,
  SCALAR_CHANNELS,
  MAX_SAMPLES,
  decodeEntryPixels,
  signalStats,
  warningsForStats,
  auditEntrySignal,
  auditFamilySignal,
  auditLibrarySignals
};
