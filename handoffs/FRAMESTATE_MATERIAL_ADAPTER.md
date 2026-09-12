# Handoff — FrameState -> Material / Surface Fabric

Target producer repo:

`mike-axiom-mir/axm-framestate`

Receiver contract:

`axm-material-offer / v0.9.0`

Feedback contract:

`axm-material-feedback / v0.9.0`

## Why this belongs in its own FrameState chat

FrameState's `AGENTS.md` defines one chat / one PR lane and requires FrameState to remain standalone. Other AXM repositories may donate ideas, but FrameState must not silently depend on their runtime/code. Build this exporter in a dedicated FrameState lane and keep the interchange as ordinary JSON.

## FrameState truth boundary to preserve

FrameState distinguishes canonical project state from rendered realization. Material exchange must keep that distinction.

Good producer candidates include:

- explicitly selected imported still/texture sources;
- explicit texture assets used by 3D/OBJ layers;
- generated/procedural visual layers when the exported pixels are intentionally treated as reusable material ingredients;
- exact rendered frame/region extracts when the user explicitly exports them as realization evidence rather than canonical project truth.

Do not present rendered pixels as if they were the canonical FrameState project or as a physically measured material.

## Build target

Create a detached FrameState exporter, for example:

`material_exchange.py`

The first version should accept an explicit source selector and produce one v0.9 offer. Suitable explicit selector forms might include:

- project media ID / imported still path;
- 3D texture source ID;
- exact frame number + explicit crop rectangle for a rendered realization export;
- explicit generated image/layer output whose bytes are already deterministic and receipted.

Do not crawl a project and auto-decide which visuals are "materials."

## Required producer identity

Each offer should preserve:

- producer system: `AXM FrameState`
- repo: `mike-axiom-mir/axm-framestate`
- canonical project ID/digest where available
- source media/layer/frame identity
- realization contract identity when pixels came from a render
- adapter version
- exact byte digest
- explicit channel declaration
- source/evidence/truth-boundary metadata

## Channel rule

FrameState usually knows visual usage/state better than physical material semantics. Therefore default conservatively:

- imported color texture explicitly used as color -> `base-color`
- explicit alpha/mask image -> `opacity` or `color-mask` only when project state says so
- explicit normal/roughness/etc. texture -> corresponding channel only when FrameState source state names that role
- generic rendered frame/region -> `unassigned` unless the export request explicitly declares a reuse role

Never infer normal/roughness/metallic from appearance.

## Rendered realization export

For rendered pixels, include evidence such as:

- canonical project digest
- frame index/time
- render/realization contract digest
- exact frame or crop byte digest
- source rectangle
- whether supersampling/filtering/effects/post-processing were active

The offer truth boundary should state that these bytes are **FrameState realization output**, not canonical scene truth and not PBR certification.

## Feedback intake

Add an explicit feedback reader that validates one `axm-material-feedback/v0.9.0` packet and reports:

- source offer/family reference;
- byte verification state;
- Surface Fabric renderer/evaluation observations;
- local install status if any;
- holds/unknowns.

Do not let feedback mutate project timing, layer state, media, effects, or render policy automatically. It may be presented as evidence for a future explicit edit/rehearsal decision.

## Suggested first proof

Use one deterministic imported or generated texture already used by a FrameState 3D/OBJ or visual layer.

Proof path:

`FrameState explicit source -> v0.9 offer -> Surface Fabric verify/evaluate -> v0.9 feedback -> FrameState feedback reader`

A second proof can later use an exact rendered crop to demonstrate the canonical-vs-realization distinction.

## Tests

At minimum test:

- offer identity binds project/source identity;
- exact payload SHA-256;
- explicit channel mapping only;
- rendered realization exports record frame + render-contract identity;
- generic visual output defaults to `unassigned` rather than guessed semantics;
- feedback reference validation;
- feedback cannot mutate canonical FrameState state.

## Stop condition

The first adapter is complete when one real FrameState visual/texture source round-trips through Surface Fabric with exact byte identity and the returned feedback remains clearly external/non-authoritative.

## Roots

- **Truth:** canonical project state, realization pixels, channel declarations and receiver observations remain distinct.
- **Agency:** exports and any later project response to feedback are explicit.
- **Continuity:** project/source/render identities and hashes survive exchange.
- **Wisdom before speed:** start with one explicit source; do not auto-mine the whole timeline for materials.
