# AXM Material Exchange Conformance — v0.10

## Purpose

v0.10 adds a headless machine-facing verifier for the portable v0.9 material exchange contract.

The intended path is:

`producer -> axm-material-offer/v0.9.0 -> v0.10 headless conformance -> optional receiver projection -> Surface Fabric browser/library/render/evaluation -> axm-material-feedback/v0.9.0 -> v0.10 feedback conformance -> producer`

This is deliberately not a new material generator, renderer, evaluator, or authority layer. It makes the existing interchange usable in CI, scripts, producer machines, and other non-browser workflows.

## CLI

Offer:

```bash
node tools/material-conformance.js check-material-offer examples/conformance/valid-offer.json
```

Offer plus exact receiver-side family projection:

```bash
node tools/material-conformance.js check-material-offer \
  examples/conformance/valid-offer.json \
  --family family \
  --projection-out build/material-projection.json \
  --receipt-out build/material-conformance-receipt.json
```

Feedback:

```bash
node tools/material-conformance.js check-material-feedback feedback.json \
  --offer original-offer.json
```

Exit codes:

- `0` = PASS
- `2` = HOLD / conformance failure
- `1` = CLI usage or runtime failure

## Receipt

Format:

`axm-material-conformance-receipt / v0.10.0`

Offer receipts record:

- normalized offer identity and v0.9 offer fingerprint;
- producer identity;
- exact receiver-observed SHA-256 for every portable payload;
- declared SHA-256 and match/mismatch state;
- declared MIME versus data-URL MIME;
- bounded PNG/JPEG/WEBP container-signature evidence;
- explicit HOLD reasons;
- family-level installability state;
- stable deterministic receipt identity independent of check time.

The receipt intentionally omits full payload bytes. Full receiver projections are emitted separately when requested.

## Payload verification

For each portable data URL, the headless verifier:

1. validates the v0.9 data-URL form;
2. validates strict base64 shape;
3. decodes exact bytes;
4. computes receiver-side SHA-256;
5. compares the producer-declared SHA-256 when present;
6. compares declared MIME to data-URL MIME;
7. checks bounded container magic for PNG, JPEG, or WEBP.

A producer hash mismatch, MIME mismatch, bad container signature, malformed payload, or missing portable bytes remains visible as HOLD.

When the producer supplies no SHA-256, exact receiver bytes are still hashed and may pass as `PASS_RECEIVER_HASHED`. That proves the bytes observed by the receiver; it does not fabricate producer-side attestation.

Container signature checking is intentionally bounded. It is not a complete image decoder and does not prove semantic correctness, PBR correctness, visual quality, or physical-material truth.

## Receiver projection

For one selected family, v0.10 can create:

`axm-material-conformance-projection / v0.10.0`

The projection reuses the existing receiver contracts rather than inventing new material state:

- v0.4 Material Library bundle via `exchange-core.js`;
- v0.5 Influence Workspace via `influence-core.js`;
- exact producer-declared channel routing;
- stable exchange-derived receiver IDs;
- full portable payloads when present;
- explicit conformance state attached to each projected entry;
- HOLD entries preserved instead of dropped.

Projection itself is detached data. It does not persist, install, render, evaluate, or promote anything.

## Feedback round-trip verification

`check-material-feedback` validates the v0.9 feedback shape.

When the original offer is also supplied, it additionally checks:

- feedback offer ID equals the actual offer ID;
- feedback offer fingerprint equals the recomputed offer fingerprint;
- referenced family still exists in the original offer.

This creates a deterministic round-trip integrity check without treating feedback as canonical authority.

## Portable fixtures

`examples/conformance/` includes:

- `valid-offer.json`
- `hash-mismatch-offer.json`
- `missing-bytes-offer.json`
- `duplicate-id-offer.json`
- `dangling-family-offer.json`
- `unassigned-offer.json`

The fixtures are contract tests, not material-quality examples.

`unassigned` remains a valid explicit channel state and is never guessed into another channel.

## Roots

- **Truth** — structure, bytes, MIME, signatures, producer hashes, receiver hashes, HOLDs, and unknowns stay distinct.
- **Agency / non-domination** — conformance never installs, promotes, merges, or rewrites producer/receiver state.
- **Continuity** — offer fingerprints, exact hashes, stable projection identities, receipt IDs, and feedback references survive machine-to-machine handoff.
- **Wisdom before speed** — bad or incomplete interchange state remains HOLD instead of being silently repaired into a fake pass.

## What v0.10 proves

v0.10 proves that a producer can validate v0.9 material exchange packets headlessly and can deterministically derive the same receiver-side library/influence state shape before involving the browser UI.

It does **not** prove:

- visual quality;
- PBR correctness;
- full image decode validity beyond the bounded container signature check;
- physical material truth;
- renderer compatibility;
- aesthetic superiority;
- producer canonical adoption;
- automatic permission to install or promote anything.
