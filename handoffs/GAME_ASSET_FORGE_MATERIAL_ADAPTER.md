# Handoff — Game Asset Forge -> Material / Surface Fabric

Target producer repo:

`mike-axiom-mir/Axm-game-assets`

Receiver contract:

`axm-material-offer / v0.9.0`

Feedback contract:

`axm-material-feedback / v0.9.0`

## Why this belongs in its own Forge chat

Game Asset Forge's `AGENTS.md` says one chat = one PR lane and explicitly says not to spread work from one chat across unrelated AXM repositories. Build this adapter inside a dedicated Game Asset Forge lane, not from the Material / Surface Fabric implementation chat.

## Existing Forge state worth mapping

Forge already owns explicit material-producing mechanisms including native hard-surface PBR/ORM authoring, skin materials, fabric materials, eye materials, hair materials, UV state and native surface state. It also has material-aware Godot/GLTF delivery and evidence paths.

Do not infer material meaning from filenames. Read it from the explicit producer state that created the maps.

Likely producer sources include:

- `native_pbr.py`
- `native_surface.py`
- `native_skin_material.py`
- `native_fabric_material.py`
- `native_eye_material.py`
- `native_hair_material.py`
- specific Sentinel/weapon material packages where their channel state is explicit

The adapter should discover the smallest truthful common extraction surface rather than special-casing every file immediately.

## Build target

Create a detached Forge-side exporter, for example:

`material_exchange.py`

It should take one explicit Forge material/source-state input and emit one portable JSON file in the Surface Fabric v0.9 offer shape.

Required offer fields:

- producer system: `AXM Game Asset Forge`
- repo: `mike-axiom-mir/Axm-game-assets`
- canonical/source ID
- source digest when Forge already has one
- producer version/adapter identity
- explicit material entries with channel declarations
- exact portable bytes when the producer owns/has them locally
- `sha256:<64 hex>` for every exported portable payload when practical
- family relationship tying maps from the same declared material together
- producer evidence and truth boundary

## Channel mapping

Map only channels that Forge explicitly owns in the source state. Surface Fabric currently understands these declared names:

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

If Forge stores ORM packed together, do not silently pretend one packed image is three independently verified payloads. Either:

1. export the packed source as `unassigned` plus explicit packed-channel metadata, or
2. deterministically split the channels in Forge, hash the resulting exact bytes, and record the transform receipt.

## Portable byte rule

The receiver can independently verify image `dataUrl` payloads. Prefer PNG for deterministic local interchange when the Forge already has image maps.

If a Forge material is descriptor-only or its bytes are not currently materialized, export metadata without `dataUrl`. Surface Fabric will preserve it as HOLD / metadata-only rather than guessing.

## Feedback intake

Add a separate explicit command/path that can read one `axm-material-feedback/v0.9.0` packet and report:

- which Forge offer/family it refers to;
- receiver byte-verification result;
- compact renderer/evaluation observations;
- whether Surface Fabric explicitly installed it;
- any held/missing states.

Feedback is **external evidence only**. It must not rewrite a Game Asset Genome, material source state, canonical package or delivery automatically.

## Suggested first proof

Use one small native hard-surface material family that already has explicit PBR/ORM authoring state. The proof should be:

`Forge native material state -> v0.9 offer -> Surface Fabric import/verify -> v0.8 evaluation -> feedback -> Forge feedback reader`

Do not start with the full Sentinel material body.

## Tests

At minimum test:

- deterministic offer identity from identical source state;
- explicit channel mapping;
- exact payload SHA-256;
- no filename-based semantic inference;
- metadata-only HOLD export;
- packed ORM truth boundary;
- feedback validation/reference matching;
- feedback cannot mutate canonical Forge state.

## Stop condition

Call the first adapter proof complete when one real Forge-produced material family can round-trip through Surface Fabric and back as feedback while preserving source identity, byte hashes, channel declarations and non-authoritative feedback semantics.

## Roots

- **Truth:** declared Forge material state, exported bytes, receiver verification and evaluation are separate evidence planes.
- **Agency:** export and feedback intake are explicit actions; no automatic canonical adoption.
- **Continuity:** Forge source IDs/digests, offer fingerprint, payload hashes and feedback references survive the round trip.
- **Wisdom before speed:** one real material family first; no mass export until the mapping is evidenced.
