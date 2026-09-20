# AXM Material / Surface Fabric

A local-first material, texture, overlay, decal, surface-composition, material-state, influence, render, vocabulary, evaluation, cross-machine exchange, and headless conformance experiment for AXM.

Its role is deliberately narrower than “make every visual here”:

> **Increase the quality, reuse, inspectability, and quantity of material / texture ingredients so other AXM visual systems become stronger.**

Visuals may be created by Universal Creation, Game Asset Forge, FrameState, image generators, scans, authored material tools, or later visual machines. This repository can intake those sources, combine/refine them, preserve evidence, study controlled changes, keep a reusable local library, compose material influence recipes, render explicit material channels locally through WebGL, grow a deterministic baseline material vocabulary, evaluate that state across controlled render conditions, exchange material state with other machines through portable receipts, and verify that interchange headlessly before a browser is involved.

Open `index.html` directly in a modern browser for the visual tools. The v0.10 conformance path runs directly under Node and requires no account, server, AI call, or network connection.

## v0.19.0 — Surface response organs

v0.19 adds a bounded layer above texture channels: **surface response organs**.
Texture maps still carry spatial channel values; the response layer carries reusable behavior such as subsurface transport, grazing-angle sheen, directional anisotropy, clear coat, deterministic micro-breakup, transmission/absorption, iridescence, and placed wear layers.

The imported user-supplied update lives under `surface-response/` with an interactive zero-dependency material lab, the 13-family response pack, eight organ records, a shape schema, provenance, and an explicit verification note. The supplied reference host has eight measured organ checks; those receipts apply to that host only and do **not** silently certify this repository's existing WebGL renderer or any downstream renderer.

Important boundaries:

- response behavior is additive to texture/channel state, not a replacement for it;
- unknown/unbound response organs must remain visible HOLD state in downstream adapters rather than silently collapsing to plastic;
- material behavior can be judged in greyscale, backlight, and rotation tests without confusing color differences for material differences;
- generated/baked textures remain secondary realizations where they cannot preserve view/light-dependent behavior;
- no response family is automatically promoted, installed, or treated as aesthetic/physical truth.

Run the data/host conformance smoke test with:

```bash
npm run surface-response:test
```

Open `surface-response/material-lab.html` directly for the interactive reference host.

## v0.10.0 — Material Exchange Conformance

v0.10 adds the machine-facing verifier that the v0.9 exchange floor was missing:

`producer → axm-material-offer/v0.9.0 → headless structure/byte conformance → optional v0.4/v0.5 receiver projection → existing browser/render/evaluation path → axm-material-feedback/v0.9.0 → headless round-trip check`

The conformance harness can:

- validate material offers without opening the browser UI;
- strictly decode portable PNG/JPEG/WEBP data URLs;
- compute exact receiver-side SHA-256 for payload bytes;
- compare producer-declared SHA-256 when present;
- check declared MIME against the data-URL MIME;
- check bounded PNG/JPEG/WEBP container signatures;
- preserve missing bytes, malformed payloads, hash mismatch, MIME mismatch and signature mismatch as explicit HOLD state;
- keep explicitly `unassigned` channels unassigned rather than guessing semantics;
- emit deterministic `axm-material-conformance-receipt/v0.10.0` identities independent of check time;
- project one family into the same existing v0.4 Material Library bundle and v0.5 Influence Workspace shapes used by the receiver;
- preserve HOLD entries inside the detached projection instead of dropping them;
- validate v0.9 feedback packets and, when the original offer is supplied, prove offer ID/fingerprint/family round-trip integrity;
- return CLI exit `0` for PASS, `2` for HOLD, and `1` for usage/runtime errors.

Example:

```bash
node tools/material-conformance.js check-material-offer \
  examples/conformance/valid-offer.json \
  --family family \
  --projection-out build/material-projection.json
```

Conformance proves contract/byte integrity only. It is not a full image decoder, aesthetic judge, PBR certification, physical-material validator, renderer-compatibility proof, install permission, or canonical merge authority.

See [`docs/MATERIAL_EXCHANGE_CONFORMANCE_V0_10.md`](docs/MATERIAL_EXCHANGE_CONFORMANCE_V0_10.md) and [`examples/conformance/`](examples/conformance/).

## v0.9.0 — Cross-Machine Material Exchange

v0.9 adds a portable receiving + feedback floor above the existing material pipeline:

`producer machine → axm-material-offer/v0.9.0 → payload verification → Material Library / Influence Lab → v0.8 renderer evaluation → explicit install/adoption → axm-material-feedback/v0.9.0`

The Cross-Machine Material Exchange can:

- import a versioned material offer from another standalone machine without contacting that machine or depending on it at runtime;
- preserve producer system/repository/source identity, source digests, explicit channel declarations, family relationships, tags and producer evidence;
- accept portable PNG/JPEG/WEBP data URLs or preserve descriptor-only entries as visible HOLD state;
- independently SHA-256 portable payload bytes in browsers that expose Web Crypto;
- classify entries as portable-verified, portable-unverified, portable-unhashed, or HOLD;
- block local installation when a producer-declared SHA-256 does not match the received bytes;
- derive stable receiver-side material/family IDs from the offer fingerprint plus producer IDs so repeated intake does not create duplicate identity churn;
- explicitly install a selected offered family into the existing v0.4 Material Library while preserving offer/provenance/verification state;
- stage a selected family into the v0.5 Influence Lab with every exact producer-declared channel, including metadata-only layers that should remain visible as renderer HOLDs;
- retain and explicitly restore the previously saved Influence Lab workspace after manual staging;
- temporarily stage a family through the existing v0.8 evaluation path, persist its evaluation session, and restore the prior Influence Lab workspace automatically;
- export `axm-material-feedback/v0.9.0` containing exact offer/family references, receiver verification state, compact v0.8 renderer-health evidence, and any explicit local install receipt;
- explicitly save/load/export the complete `axm-material-exchange-workspace/v0.9.0` state.

The protocol does **not** make Material / Surface Fabric canonical authority over a producer, and a technical score or feedback packet never grants automatic adoption/promotion authority.

Producer-specific adapters for Game Asset Forge, FrameState, Universal Creation or other systems remain separate work in those repositories' own collaboration lanes. v0.9 proves the receiving/feedback contract; v0.10 now gives those producer lanes a headless conformance target before real circulation.

See [`docs/CROSS_MACHINE_MATERIAL_EXCHANGE_V0_9.md`](docs/CROSS_MACHINE_MATERIAL_EXCHANGE_V0_9.md) and [`examples/material-offer-v0.9.example.json`](examples/material-offer-v0.9.example.json).

## v0.8.0 — Material Evaluation / Evolution

v0.8 turns the v0.7 breadth into a controlled test/evolution loop:

`material family or saved recipe → temporary explicit influence workspace → existing v0.6 WebGL renderer → geometry × light observations → bounded technical renderer-health signals → optional deterministic variants → explicit reviewed promotion`

The Material Evaluation / Evolution lab can:

- evaluate a selected v0.7 material family through every current light rig;
- run a quick sphere-only matrix or a deeper sphere + plane + cube matrix;
- evaluate the explicitly saved v0.5 Influence Lab workspace as well, allowing imported/external material sources already represented in the recipe contract to use the same evaluation path;
- measure framebuffer visibility, transparency, mean RGB/alpha, mean luminance, luminance spread/range, near-black/near-white collapse, pixel hashes, renderer holds and receipt state;
- expose a deliberately bounded `bounded-renderer-health` score for technical sorting;
- create four deterministic descriptor variants of a selected vocabulary family, preserving parent ID, mutation index, mutation seed, exact changed parameters and descriptor hash;
- evaluate parent and variants under the same render matrix;
- rank candidates by renderer completion, mean technical health, then worst-case technical health;
- preserve representative renders and the complete geometry/light observation matrix;
- explicitly save/load/export/import `axm-material-evaluation-session/v0.8.0` sessions;
- explicitly install a reviewed generated candidate into the persistent material library while recording its evaluation/install receipt;
- restore the prior saved Influence Lab workspace after temporary evaluation staging.

The technical ranking is **not** an aesthetic, realism, PBR, physical-accuracy, taste, or universal quality score. A candidate is never installed or promoted automatically.

See [`docs/MATERIAL_EVALUATION_V0_8.md`](docs/MATERIAL_EVALUATION_V0_8.md).

## v0.7.0 — Material Vocabulary Expansion

v0.7 moves from “we have the machinery” to “we also have meaningful reusable breadth.”

The path is:

`deterministic family descriptor → correlated map set → persistent material library → optional v0.5 recipe staging → v0.6 WebGL render / cross-light evidence → donor-pack reuse`

The seed vocabulary includes **39+ material families** across metal, polymer/composite, glass/ceramic, construction/mineral, organic/textile, and environment/FX categories. Every family exposes base-color, normal, roughness, metallic, ambient-occlusion, and height maps; relevant families additionally expose opacity and/or emissive maps. Together with the reusable overlay pack, the declared baseline exceeds **250 reusable material entries**.

Examples include brushed/painted/rusted/galvanized steel, anodized aluminum, copper patina, cast iron, scratched chrome, plastics, rubbers, carbon-fiber-like weave, foam, multiple glass states, ceramics, concrete/asphalt/granite/marble/brick/sandstone/plaster, woods, leather-like and woven fabrics, wet/ice/mud/dust surfaces, emissive panels, holographic film, and bio-organic seeds.

The overlay pack adds reusable scratches, chips, rust speckles, grime, oil, water streaks, dust, fingerprint-like arcs, edge wear, weld seams, scorch, frost, moss, mud splatter, hazard stripes, emissive circuit lines, and droplets.

Important implementation properties:

- one explicit procedural family descriptor drives the correlated channel set;
- normal maps are derived from neighboring samples of the same height field;
- stable IDs such as `material-vocab-<family>-<channel>` prevent duplicate identity churn;
- generated entries carry explicit `synthetic: true` provenance, vocabulary version, descriptor hash, seed, and generator identity;
- generation and persistence are explicit actions only;
- 64, 128, and 256 pixel generation sizes are available;
- one selected family can be staged directly into a v0.5 recipe so the v0.6 renderer can test the exact generated channel set;
- the complete vocabulary can be installed locally in one explicit operation;
- stronger external visual/material sources remain welcome and additive.

The seed vocabulary proves deterministic breadth and portable bytes, not physical correctness, scan quality, photorealism, or artistic superiority. Actual behavior should be tested through the renderer and downstream consumers.

See [`docs/MATERIAL_VOCABULARY_V0_7.md`](docs/MATERIAL_VOCABULARY_V0_7.md).

## v0.6.0 — Real Material Renderer

v0.6 adds the first renderer downstream of the v0.5 influence-state system:

`v0.5 saved/imported recipe → explicit channel render plan → local channel texture composition → sphere/plane/cube WebGL material shader → framebuffer → render receipt / A-B delta / cross-light sweep`

The renderer can:

- load the explicitly saved v0.5 Influence Lab workspace or import its JSON without rewriting that source state;
- render local sphere, plane, or cube geometry with positions, normals, tangents and UVs and no external 3D dependency;
- directly sample base-color, tangent-space normal, roughness, metallic, ambient-occlusion, emissive and opacity channels;
- map declared decal and microdetail layers into base-color composition while recording that mapping explicitly;
- preserve height, displacement, color-mask and unassigned state as preserved-only;
- preserve missing entry references and payload-less layers as held state;
- reuse recipe layer order, blend modes, opacity, masks, transforms and tiling when composing channel textures;
- interpret existing light rigs in a bounded metallic/roughness WebGL lighting approximation;
- turn the grazing view from a 2D proxy into an actual oblique WebGL camera and use tile/close-up view states in the 3D path;
- apply sampled AO, normal, metallic, roughness, emissive and opacity plus exposure, saturation, clearcoat-like, Fresnel-like and roughness-override controls;
- export `axm-material-render-receipt/v0.6.0` evidence;
- capture WebGL A/B framebuffers and reuse Material Delta for exact pixel/region difference evidence;
- replay the same recipe through every declared light rig.

The renderer is a real executable material-preview path, but it does not claim engine parity, PBR certification, HDRI truth, geometric shadow maps, displacement rendering or physical-material correctness.

See [`docs/REAL_MATERIAL_RENDERER_V0_6.md`](docs/REAL_MATERIAL_RENDERER_V0_6.md).

## v0.5.0 — Material Influence Lab

v0.5 adds the state layer above the reusable library:

`ingredients → recipe stack → channel routing / masks / transforms / tiling → light rig → shader-like preview controls → view rig → observed preview → A/B state + pixel delta`

It supports persistent recipes, bottom-to-top stacking, explicit channel targets, masks/transforms/tiling, eight editable light rigs, multiple view states, bounded shader-like controls, A/B comparison, and portable `axm-material-influence-workspace/v0.5.0` state.

The light/view/shader Canvas 2D preview remains an influence preview, not full PBR/BRDF/HDRI/GPU-shader/engine parity truth.

See [`docs/MATERIAL_INFLUENCE_LAB_V0_5.md`](docs/MATERIAL_INFLUENCE_LAB_V0_5.md).

## v0.4.0 — Reusable Material Library

The Reusable Material Library can:

- intake exact image payloads from the visual shelf;
- derive stable content-oriented IDs;
- preserve source/provenance metadata and portable image data when available;
- persist explicitly in browser-local IndexedDB;
- export/import complete library JSON;
- import legacy v0.1 and current v0.2 material donor packs;
- attach editable routing hints;
- group ingredients into explicit reusable families;
- export selected ingredients/families as `axm-material-donor-pack` v0.2.

Channel hints are routing metadata, not automatic physical-material recognition.

See [`docs/MATERIAL_LIBRARY_V0_4.md`](docs/MATERIAL_LIBRARY_V0_4.md).

## v0.3.0 — Material Delta Bridge

v0.3 connects neighboring material states:

`declared edit → build delta → spatial pixel delta → file delta`

It supports parent/child captures, declared edits, pixel-by-pixel difference images, regional summaries, persistent experiments, and donor-pack export while keeping declared intent distinct from observed output.

See [`docs/MATERIAL_DELTA_BRIDGE.md`](docs/MATERIAL_DELTA_BRIDGE.md).

## v0.2.0 — Trace Down

v0.2 established the observable downward path:

`IMAGE → BUILD → PIXELS → FILE → BITS`

It intentionally does not pretend final PNG bytes recover hidden generator internals or original intent.

See [`docs/TRACE_DOWN_EXPERIMENT.md`](docs/TRACE_DOWN_EXPERIMENT.md).

## Existing material / surface capability

The working page now provides local image intake and composition, portable state, snapshots/diffs, persistent material library/families, influence recipes, real WebGL material rendering, hundreds of deterministic seed maps/overlays, bounded batch evaluation/evolution, reviewed promotion receipts, and versioned cross-machine material offer/feedback interchange. The repository also provides a separate headless Node conformance route for machine/CI use.

## Capability first

The project does **not** declare the seed vocabulary, v0.8 technical ranking, v0.9 exchange channel vocabulary, or v0.10 PASS state to be a universal material ontology or universal quality function. Real sources and working operations come first; schemas are kept small enough to evolve as stronger evidence appears.

See [`docs/STATE_EXPERIMENT.md`](docs/STATE_EXPERIMENT.md).

## Roots / merge gate

Internal AXM work is judged against the roots:

- **Truth** — distinguish producer declarations, exact byte evidence, receiver verification, conformance state, observed state, routing hints, synthetic provenance, interpreted render channels, bounded technical evaluation, preserved-only state, inference, and unknowns.
- **Agency / non-domination** — generation, exchange import, conformance, installation, staging, evaluation, candidate selection, feedback export, rendering, and producer adoption remain explicit actions; technical rank and conformance PASS never silently become promotion authority.
- **Continuity** — stable IDs, offer fingerprints, producer identity, SHA-256 receipts, descriptors, mutation lineage, evaluation sessions, framebuffer evidence, install/feedback/conformance receipts, persistent library state, recipes, families, render receipts and donor packs preserve what happened.
- **Wisdom before speed** — packets are not trusted because they come from another AXM machine; byte mismatch and missing state remain HOLD, and technical scores, feedback, or conformance never become silent aesthetic/physical truth.

## Tests

Pure helpers can be checked with Node:

```bash
npm test
```

CI syntax-checks the browser and headless JavaScript. Tests cover state/trace/delta/library/influence/renderer behavior, v0.7 vocabulary breadth/determinism/provenance, v0.8 renderer-health/evolution/session semantics, v0.9 offer validation/stable receiver identity/feedback boundaries, and v0.10 SHA-256/MIME/signature verification, HOLD fixtures, deterministic projections, feedback round trips and CLI exit semantics.

## Truth boundary

The page can directly observe its own runtime state, pixels, encoded PNG representation, controlled lineage, reusable payloads, influence recipes, WebGL framebuffer output, deterministic seed descriptors/maps, bounded renderer-health observations, deterministic variants, imported v0.9 offer bytes, and receiver-side payload hashes. The headless v0.10 path can independently verify contract structure, available portable bytes and exact round-trip references.

It does not claim automatic PBR correctness, physical-material recognition, measured BRDF data, complete semantic understanding, aesthetic judgment, hidden generator-state recovery, HDRI certification, cross-engine render parity, cross-GPU bit-for-bit identity, geometric shadow correctness, displacement rendering, scan-grade quality, that the highest technical rank is visually best, that a conformance PASS proves material quality, that producer declarations are true merely because they were imported, or that any producer already implements v0.9 until its own adapter is separately built and exercised.
