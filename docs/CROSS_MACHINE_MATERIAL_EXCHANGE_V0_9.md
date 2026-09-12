# AXM Cross-Machine Material Exchange — v0.9

## Purpose

v0.9 turns Material / Surface Fabric into a **receiving and feedback floor** for material state made elsewhere.

The intended loop is:

`producer machine -> explicit material offer -> Surface Fabric byte verification -> reusable library / Influence Lab -> v0.8 renderer evaluation -> explicit install/adoption -> feedback packet -> producer machine`

The producer may be Game Asset Forge, FrameState, Universal Creation, an image generator, a human-authored tool, or a future AXM machine. Runtime coupling is not required: the interchange surface is ordinary portable JSON.

This version does **not** make the Surface Fabric canonical authority over the producer. It receives a declared material view, records what it can independently verify, and returns bounded observations.

## Material offer contract

Format:

`axm-material-offer / v0.9.0`

Minimal shape:

```json
{
  "format": "axm-material-offer",
  "version": "0.9.0",
  "id": "offer-example-001",
  "createdAt": "2026-09-12T09:30:00Z",
  "producer": {
    "system": "producer name",
    "repo": "owner/repository",
    "sourceId": "canonical-or-export-source-id",
    "sourceDigest": "sha256:...",
    "stateKind": "detached-material-export",
    "version": "producer version",
    "adapter": "optional producer adapter identity"
  },
  "entries": [
    {
      "id": "surface-base",
      "name": "Surface base color",
      "channel": "base-color",
      "mime": "image/png",
      "width": 1024,
      "height": 1024,
      "dataUrl": "data:image/png;base64,...",
      "sha256": "sha256:...",
      "source": {},
      "tags": []
    }
  ],
  "families": [
    {
      "id": "surface-family",
      "name": "Surface family",
      "purpose": "explicit reuse relationship",
      "entryIds": ["surface-base"],
      "tags": []
    }
  ],
  "evidence": {},
  "truthBoundary": {}
}
```

### Required truth properties

- `producer.system` is required.
- Entry IDs and family IDs must be unique within one offer.
- Every family member must resolve to an entry in the same offer.
- Channel meaning is producer-declared. The receiver does not infer a missing material channel from visual appearance.
- Portable bytes are optional. An entry without `dataUrl` stays visible as **HOLD / metadata-only** instead of disappearing.
- When `sha256` is present it must be `sha256:<64 hex>` and the receiver can independently hash the decoded payload.
- A declared hash mismatch becomes a HOLD and blocks installation of that selected family.
- An offer may include stronger producer-specific evidence, but the receiver keeps that evidence separate from its own observations.

Supported routing vocabulary matches the existing Material Library:

- base-color
- normal
- roughness
- metallic
- ambient-occlusion
- height
- displacement
- emissive
- opacity
- color-mask
- decal
- microdetail
- unassigned

`unassigned` is preserved; it is not silently upgraded into a guessed channel.

## Receiver states

Every offered entry is classified as one of:

- `portable-verified` — payload exists and its declared SHA-256 was independently matched;
- `portable-unverified` — payload exists and a producer hash exists but has not yet been independently checked;
- `portable-unhashed` — payload exists but the producer supplied no SHA-256;
- `hold` — payload is absent or declared byte integrity failed.

A family may therefore be:

- `portable`;
- `portable-awaiting-verification`;
- `partial-hold`.

These are transport/evidence states, not material-quality grades.

## Stable receiver identity

The Surface Fabric does not reuse producer IDs directly as persistent Library IDs. It derives stable exchange IDs from:

`offer fingerprint + producer entry/family id`

This avoids collisions between unrelated producers while preserving exact producer IDs in source metadata.

Repeated intake of the same offer therefore updates the same receiver-side material identity instead of creating duplicate churn.

## Explicit library installation

`Install selected family` maps the offer into the existing v0.4 Material Library.

Each installed entry retains:

- offer ID and fingerprint;
- producer identity/source ID;
- producer entry ID;
- producer-declared SHA-256;
- receiver byte-verification result;
- original producer source metadata;
- declared channel routing.

Metadata-only entries may be retained after explicit confirmation so incomplete cross-machine material truth is not erased. SHA-256 mismatches are blocked rather than installed as if valid.

Installation is an explicit local action. Technical evaluation is never automatic promotion authority.

## Influence / renderer staging

A selected family can be converted into the existing:

`axm-material-influence-workspace / v0.5.0`

Every offered family member becomes one recipe layer with the exact declared channel. Payload-less entries remain in the workspace so the v0.6 renderer can report them as HOLDs instead of silently dropping them.

Manual staging retains the previous saved Influence Lab workspace in the v0.9 exchange record and exposes an explicit restore action.

## Automated evaluation

`Evaluate selected family` uses the existing v0.8 evaluation path rather than creating a second scoring/rendering implementation.

The exchange panel:

1. captures the current saved Influence Lab workspace;
2. writes a temporary v0.9 staging workspace;
3. invokes `Evaluate saved lab recipe` in v0.8;
4. waits for the exact staged recipe receipt;
5. explicitly persists the resulting v0.8 evaluation session;
6. restores the previously saved Influence Lab workspace.

The resulting evidence remains bounded to the existing v0.8 definition of **renderer-path technical health**. It is not an aesthetic judge, PBR certification, or physical-material validator.

## Feedback contract

Format:

`axm-material-feedback / v0.9.0`

A feedback packet contains:

- source offer ID + fingerprint;
- exact producer/family reference;
- receiver payload-verification state;
- compact v0.8 evaluation-session evidence;
- explicit install receipt if that family was locally installed;
- receiver truth boundary.

A feedback packet does **not** tell the producer what it must accept. Producer-side adoption remains a separate explicit decision under that machine's own canonical state and roots.

## Producer adapter boundary

This PR implements the receiving interchange floor in Material / Surface Fabric. It deliberately does **not** modify Game Asset Forge, FrameState, or Universal Creation in the same PR lane.

Those machines remain standalone and have their own collaboration/canonical-state boundaries. A producer-side adapter should be implemented in that producer's own lane and should:

1. read explicit producer material state;
2. preserve producer canonical identity and provenance;
3. export only explicitly mapped channels;
4. include portable payload bytes when allowed/available;
5. hash exact exported bytes when possible;
6. treat feedback as external evidence, not automatic canonical rewrite.

This keeps cross-machine sharing open without turning one repository into a hidden runtime dependency of another.

## Example producer mappings

### Game Asset Forge

A future detached Forge adapter can export explicit maps from its native material/PBR stages (for example hard-surface, skin, fabric, eye or hair material outputs) into this contract. Material meaning should come from Forge's explicit source state, not filename guessing.

### FrameState

A future detached FrameState adapter can export explicitly selected image/texture sources or rendered material ingredients while preserving canonical project/source identity. Rendered pixels remain realization evidence, not canonical project truth.

### Universal Creation

Universal Creation already has a detached receiver for Surface Fabric donor packs. A future reverse adapter can export Asset Atom texture/material descriptors as v0.9 offers when resource bytes are actually available; URI-only resources should remain descriptor/HOLD state until bytes are supplied.

## Persistence

The browser exchange workspace uses:

`axm-material-exchange-workspace / v0.9.0`

Explicit IndexedDB store:

`axm-material-exchange-v9 / records / current`

It preserves:

- current normalized offer;
- verification receipts;
- selected family;
- last evaluation session;
- explicit install receipts;
- generated feedback history;
- manual Influence Lab staging backup when present.

It can also be exported as JSON.

## Roots

- **Truth** — producer declarations, exact bytes, receiver verification, render evidence, scoring and unknowns remain distinguishable.
- **Agency / non-domination** — import, verification, installation, staging, evaluation, feedback export and producer adoption are all explicit actions.
- **Continuity** — offer fingerprints, producer IDs, stable receiver IDs, hashes, evaluation sessions and install/feedback receipts survive the handoff.
- **Wisdom before speed** — a packet is not treated as trusted because it arrived from another AXM machine; byte mismatch and missing state remain visible, and technical scores never become automatic promotion.

## What v0.9 proves

It proves a deterministic, local, portable receiving/feedback contract can connect otherwise standalone material-producing machines to the existing Material Library → Influence Lab → WebGL Renderer → Evaluation pipeline.

It does **not** prove that Game Asset Forge, FrameState, Universal Creation, or any external producer already exports the v0.9 packet until a producer-specific adapter is separately implemented and exercised in that producer's own lane.
