'use strict';

const libraryCore = require('./library-core.js');

const VERSION = '0.18.3';
const FORMAT = 'axm-material-batch-readiness';
const DEFAULT_LIMITS = Object.freeze({ maxEntriesPerPack: 128, maxFamiliesPerPack: 128, maxCapabilitiesPerPack: 512 });
const UC_SUPPORTED_CHANNELS = new Set([
  'base-color','normal','roughness','metallic','ambient-occlusion','height','displacement',
  'emissive','opacity','color-mask','decal','microdetail'
]);
const IMAGE_MIMES = new Set(['image/png','image/jpeg','image/jpg','image/webp']);

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value == null ? '' : value).trim(); }
function uniqueSorted(values) { return Array.from(new Set((values || []).map(text).filter(Boolean))).sort(); }

function normalizeLimits(raw) {
  const source = raw || {};
  const bounded = (value, fallback, max) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
  };
  return {
    maxEntriesPerPack: bounded(source.maxEntriesPerPack, DEFAULT_LIMITS.maxEntriesPerPack, 4096),
    maxFamiliesPerPack: bounded(source.maxFamiliesPerPack, DEFAULT_LIMITS.maxFamiliesPerPack, 4096),
    maxCapabilitiesPerPack: bounded(source.maxCapabilitiesPerPack, DEFAULT_LIMITS.maxCapabilitiesPerPack, 8192)
  };
}

function validateEntry(entry) {
  const issues = [];
  const id = text(entry && entry.id);
  const channel = text(entry && entry.usage && entry.usage.channelHint).toLowerCase().replace(/_/g, '-');
  const mime = text(entry && entry.mime).toLowerCase();
  if (!id) issues.push('missing-entry-id');
  if (!UC_SUPPORTED_CHANNELS.has(channel)) issues.push(channel ? `unsupported-channel:${channel}` : 'missing-channel');
  if (!IMAGE_MIMES.has(mime)) issues.push(mime ? `unsupported-mime:${mime}` : 'missing-mime');
  if (!text(entry && entry.dataUrl)) issues.push('no-portable-payload');
  if (!(Number(entry && entry.width) > 0) || !(Number(entry && entry.height) > 0)) issues.push('invalid-dimensions');
  return { id, channel, mime, issues };
}

function validateFamily(family, entriesById) {
  const issues = [];
  const id = text(family && family.id);
  const entryIds = uniqueSorted(family && family.entryIds);
  if (!id) issues.push('missing-family-id');
  if (!entryIds.length) issues.push('empty-family');
  const missing = entryIds.filter((entryId) => !entriesById.has(entryId));
  if (missing.length) issues.push(`missing-members:${missing.join(',')}`);
  const channels = new Map();
  for (const entryId of entryIds) {
    const entry = entriesById.get(entryId);
    if (!entry) continue;
    const channel = text(entry.usage && entry.usage.channelHint).toLowerCase().replace(/_/g, '-');
    if (!UC_SUPPORTED_CHANNELS.has(channel)) continue;
    channels.set(channel, (channels.get(channel) || 0) + 1);
  }
  const duplicates = Array.from(channels.entries()).filter(([, count]) => count > 1).map(([channel]) => channel).sort();
  if (duplicates.length) issues.push(`duplicate-family-channels:${duplicates.join(',')}`);
  return { id, entryIds, issues };
}

function connectedComponents(library) {
  const entries = (library.entries || []).map((entry) => entry.id).sort();
  const adjacency = new Map(entries.map((id) => [id, new Set()]));
  for (const family of library.families || []) {
    const ids = uniqueSorted(family.entryIds).filter((id) => adjacency.has(id));
    for (const left of ids) for (const right of ids) if (left !== right) adjacency.get(left).add(right);
  }
  const familyByEntry = new Map(entries.map((id) => [id, []]));
  for (const family of library.families || []) {
    for (const id of uniqueSorted(family.entryIds)) if (familyByEntry.has(id)) familyByEntry.get(id).push(family.id);
  }
  const seen = new Set();
  const components = [];
  for (const start of entries) {
    if (seen.has(start)) continue;
    const queue = [start];
    const memberIds = [];
    const familyIds = new Set();
    seen.add(start);
    while (queue.length) {
      const current = queue.shift();
      memberIds.push(current);
      for (const familyId of familyByEntry.get(current) || []) familyIds.add(familyId);
      for (const next of adjacency.get(current) || []) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    memberIds.sort();
    components.push({
      id: `component:${memberIds[0]}`,
      entryIds: memberIds,
      familyIds: Array.from(familyIds).sort()
    });
  }
  return components.sort((a, b) => a.entryIds[0].localeCompare(b.entryIds[0]));
}

function planChunks(library, rawLimits) {
  const validation = libraryCore.validateLibrary(library);
  if (!validation.ok) throw new TypeError(validation.reason);
  const limits = normalizeLimits(rawLimits);
  const components = connectedComponents(library);
  const oversized = components.filter((component) =>
    component.entryIds.length > limits.maxEntriesPerPack ||
    component.familyIds.length > limits.maxFamiliesPerPack ||
    component.entryIds.length + component.familyIds.length > limits.maxCapabilitiesPerPack
  );
  const usable = components.filter((component) => !oversized.includes(component));
  const chunks = [];
  let current = null;
  const newChunk = () => ({ id: `chunk-${String(chunks.length + 1).padStart(3, '0')}`, entryIds: [], familyIds: [] });
  for (const component of usable) {
    if (!current) current = newChunk();
    const nextEntries = uniqueSorted(current.entryIds.concat(component.entryIds));
    const nextFamilies = uniqueSorted(current.familyIds.concat(component.familyIds));
    const wouldOverflow = nextEntries.length > limits.maxEntriesPerPack || nextFamilies.length > limits.maxFamiliesPerPack ||
      nextEntries.length + nextFamilies.length > limits.maxCapabilitiesPerPack;
    if (wouldOverflow && current.entryIds.length) {
      chunks.push(current);
      current = newChunk();
    }
    current.entryIds = uniqueSorted(current.entryIds.concat(component.entryIds));
    current.familyIds = uniqueSorted(current.familyIds.concat(component.familyIds));
  }
  if (current && current.entryIds.length) chunks.push(current);
  for (const chunk of chunks) {
    chunk.capabilities = chunk.entryIds.length + chunk.familyIds.length;
  }
  return { limits, chunks, oversized: clone(oversized) };
}

function analyzeLibrary(library, options) {
  const validation = libraryCore.validateLibrary(library);
  if (!validation.ok) throw new TypeError(validation.reason);
  const entriesById = new Map();
  const duplicateEntryIds = [];
  for (const entry of library.entries) {
    if (entriesById.has(entry.id)) duplicateEntryIds.push(entry.id);
    entriesById.set(entry.id, entry);
  }
  const duplicateFamilyIds = [];
  const seenFamilyIds = new Set();
  for (const family of library.families) {
    if (seenFamilyIds.has(family.id)) duplicateFamilyIds.push(family.id);
    seenFamilyIds.add(family.id);
  }

  const entryChecks = library.entries.map((entry) => validateEntry(entry));
  const familyChecks = library.families.map((family) => validateFamily(family, entriesById));
  const plan = planChunks(library, options && options.limits);
  const holds = [];
  if (duplicateEntryIds.length) holds.push({ kind: 'duplicate-entry-ids', ids: uniqueSorted(duplicateEntryIds) });
  if (duplicateFamilyIds.length) holds.push({ kind: 'duplicate-family-ids', ids: uniqueSorted(duplicateFamilyIds) });
  for (const check of entryChecks.filter((row) => row.issues.length)) holds.push({ kind: 'entry', id: check.id, issues: check.issues.slice() });
  for (const check of familyChecks.filter((row) => row.issues.length)) holds.push({ kind: 'family', id: check.id, issues: check.issues.slice() });
  for (const component of plan.oversized) holds.push({ kind: 'oversized-connected-component', id: component.id, entries: component.entryIds.length, families: component.familyIds.length });

  const basis = {
    libraryId: library.id || null,
    entries: library.entries.map((entry) => ({ id: entry.id, channel: entry.usage && entry.usage.channelHint, mime: entry.mime, portable: Boolean(entry.dataUrl) })).sort((a,b)=>a.id.localeCompare(b.id)),
    families: library.families.map((family) => ({ id: family.id, entryIds: uniqueSorted(family.entryIds) })).sort((a,b)=>a.id.localeCompare(b.id)),
    limits: plan.limits,
    holds
  };
  const fingerprint = libraryCore.fnv1aText(libraryCore.stableStringify(basis));
  return {
    format: FORMAT,
    version: VERSION,
    id: `batch-readiness-${fingerprint}`,
    fingerprint,
    library: { id: library.id || null, entries: library.entries.length, families: library.families.length },
    summary: {
      portableEntries: entryChecks.filter((row) => !row.issues.includes('no-portable-payload')).length,
      entryIssues: entryChecks.filter((row) => row.issues.length).length,
      familyIssues: familyChecks.filter((row) => row.issues.length).length,
      connectedComponents: connectedComponents(library).length,
      plannedPacks: plan.chunks.length,
      oversizedComponents: plan.oversized.length,
      totalCapabilities: library.entries.length + library.families.length,
      status: holds.length ? 'HOLD' : 'PASS'
    },
    chunks: plan.chunks,
    holds,
    truthBoundary: {
      readiness: 'PASS means the current library state can be deterministically partitioned within configured downstream transport bounds with portable image payloads and unambiguous family channels.',
      scope: 'Readiness does not prove visual quality, artistic usefulness, PBR correctness, semantic understanding, renderer output, or downstream adoption.',
      batching: 'Chunk planning preserves connected family membership and never silently splits an oversized connected component.',
      authority: 'This report is diagnostic evidence only and does not install, promote, merge, or rewrite canonical state.'
    }
  };
}

module.exports = {
  VERSION, FORMAT, DEFAULT_LIMITS, UC_SUPPORTED_CHANNELS, IMAGE_MIMES,
  normalizeLimits, validateEntry, validateFamily, connectedComponents, planChunks, analyzeLibrary
};
