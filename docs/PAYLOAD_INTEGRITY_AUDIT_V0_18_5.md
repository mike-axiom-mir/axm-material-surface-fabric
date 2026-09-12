# v0.18.5 — Portable Payload Integrity Audit

This checkpoint hardens the Material / Surface Fabric for the incoming real asset batch. It does not add another cross-repository bridge.

## Why this exists

The earlier batch-readiness gate proves that a large material library can be grouped, chunked and transported without silent family splitting or contract overflow. That alone is not enough for real generated image batches: a library entry can still claim dimensions, MIME type or byte metadata that do not match its actual portable image payload.

v0.18.5 adds a byte/container audit before those assets are trusted as reusable transport state.

## Format

`axm-material-payload-audit/v0.18.5`

The audit checks every portable material-library entry and every declared family.

## Entry checks

For PNG/JPEG/WEBP data URLs it verifies:

- strict base64 decode and round-trip;
- image signature/container type;
- declared MIME vs data-url MIME vs observed container;
- observed byte length vs declared byte length when declared;
- observed dimensions vs declared width/height;
- optional SHA-256 claims when present;
- Material Library payload descriptor length/FNV continuity when present.

PNG gets stronger structural verification:

- IHDR/IDAT/IEND presence;
- legal bit-depth/color-type combinations;
- chunk bounds;
- CRC for every parsed chunk;
- no unexpected trailing bytes;
- the existing repository RGBA8 decoder is run when the PNG is non-interlaced 8-bit RGBA.

JPEG and WEBP currently receive bounded header/container structural checks and dimension extraction. They are deliberately reported as header-structural evidence rather than full pixel-decode proof.

## Family checks

The audit groups observed member state and reports:

- member payload HOLDs;
- missing members;
- observed dimension variants;
- observed MIME variants;
- aggregate portable bytes.

Mixed family dimensions are warnings by default because legitimate pipelines may resample maps. `--strict-family-dimensions` upgrades that condition to HOLD when a consumer requires exact same-resolution maps.

## Headless use

```bash
npm run material:payload -- audit path/to/library.json build/payload-audit.json
npm run material:payload -- audit path/to/library.json build/payload-audit-strict.json --strict-family-dimensions
npm run material:payload -- summary build/payload-audit.json
```

Exit code is non-zero only for HOLD. `PASS_WITH_WARNINGS` remains usable evidence with explicit limitations.

## Stress evidence

The regression suite audits the existing deterministic 90-entry synthetic material batch. All 90 RGBA PNG payloads must pass byte/container checks and the repository pixel decoder. Additional negative fixtures prove that corrupted PNG CRC state, malformed base64, MIME mismatch, dimension mismatch, stale payload metadata and missing bytes remain HOLD.

A reordered copy of the same library must produce the same report fingerprint.

## Truth boundary

This proves byte/container continuity only within the explicitly implemented checks. It does not prove that an image is aesthetically good, materially plausible, semantically correct, physically accurate, PBR-correct, renderer-equivalent, or worth keeping. A payload PASS is transport/integrity evidence, not artistic authority.
