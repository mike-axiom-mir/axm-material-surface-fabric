# AXM Material / Surface Fabric

A local-first material, texture, overlay, decal, surface-composition, material-state, influence, and render experiment for AXM.

Its role is deliberately narrower than “make every visual here”:

> **Increase the quality, reuse, inspectability, and quantity of material / texture ingredients so other AXM visual systems become stronger.**

Visuals may be created by Universal Creation, game-asset tooling, FrameState, image generators, scans, authored material tools, or later visual machines. This repository can intake those sources, combine/refine them, preserve evidence, study controlled changes, keep a reusable local library, compose material influence recipes, render explicit material channels locally through WebGL, grow a deterministic baseline material vocabulary, and export portable donor packs.

Open `index.html` directly in a modern browser. No install, account, server, AI call, or network connection is required.

## v0.7.0 — Material Vocabulary Expansion

v0.7 moves from “we have the machinery” to “we also have meaningful reusable breadth.”

The new path is:

`deterministic family descriptor → correlated map set → persistent material library → optional v0.5 recipe staging → v0.6 WebGL render / cross-light evidence → donor-pack reuse`

The seed vocabulary includes **39+ material families** across metal, polymer/composite, glass/ceramic, construction/mineral, organic/textile, and environment/FX categories. Every family exposes base-color, normal, roughness, metallic, ambient-occlusion, and height maps; relevant families additionally expose opacity and/or emissive maps. Together with the reusable overlay pack, the declared baseline exceeds **250 reusable material entries**.

The vocabulary includes examples such as brushed/painted/rusted/galvanized steel, anodized aluminum, copper patina, cast iron, scratched chrome, plastics, rubbers, carbon-fiber-like weave, foam, multiple glass states, ceramics, concrete/asphalt/granite/marble/brick/sandstone/plaster, woods, leather-like and woven fabrics, wet/ice/mud/dust surfaces, emissive panels, holographic film, and bio-organic seeds.

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
- map declared decal and microdetail layers into the base-color composition while recording that mapping explicitly;
- preserve height, displacement, color-mask and unassigned state as preserved-only instead of pretending those channels are already rendered;
- preserve missing entry references and payload-less layers as held state;
- reuse recipe layer order, blend modes, opacity, masks, transforms and tiling when composing channel textures;
- interpret the existing light rigs in a bounded metallic/roughness WebGL lighting approximation;
- turn the grazing view from a 2D proxy into an actual oblique WebGL camera and use tile/close-up view states in the 3D path;
- apply sampled AO, normal, metallic, roughness, emissive and opacity state plus existing exposure, saturation, clearcoat-like, Fresnel-like and roughness-override controls;
- export `axm-material-render-receipt/v0.6.0` evidence containing plan identity, interpreted/preserved channels, held state, WebGL context, draw completion and framebuffer pixel hash;
- capture WebGL A/B framebuffers and reuse the existing Material Delta engine for exact pixel/region difference evidence;
- replay the exact same recipe through every declared light rig to produce a cross-light comparison gallery.

The WebGL renderer is a real executable material-preview path, but it remains deliberately bounded. It does not claim engine parity, PBR certification, HDRI truth, geometric shadow maps, displacement rendering or physical-material correctness.

See [`docs/REAL_MATERIAL_RENDERER_V0_6.md`](docs/REAL_MATERIAL_RENDERER_V0_6.md).

## v0.5.0 — Material Influence Lab

v0.5 adds the next layer above the reusable library:

`ingredients → recipe stack → channel routing / masks / transforms / tiling → light rig → shader-like preview controls → view rig → observed preview → A/B state + pixel delta`

The Material Influence Lab can:

- refresh reusable entries from the explicitly saved v0.4 material library, with a weaker current-UI fallback when no saved library is present;
- create, rename and duplicate persistent material recipes;
- stack material-library ingredients bottom-to-top;
- explicitly assign channel routing, blend mode, opacity, masks, scale, rotation, offset and preview tiling per layer;
- preserve normal, roughness, metallic, AO, height/displacement, opacity and color-mask routing even when the bounded 2D preview does not physically interpret those channels;
- preview eight distinct light rigs with editable angle, intensity, ambient, environment, shadow and color controls;
- switch between flat, tiling, close-up and explicitly labeled grazing-angle proxy views;
- vary bounded shader-like preview influences for exposure, saturation, clearcoat-like highlight, fresnel-like edge response, emissive boost and a roughness-response proxy;
- capture A/B material influence states and reuse the existing delta engine to measure exact changed preview pixels and regions;
- explicitly save/load and export/import the complete `axm-material-influence-workspace/v0.5.0` state.

The light/view/shader system is intentionally a local Canvas 2D **influence preview**, not a claim of full PBR, BRDF, HDRI, GPU-shader, engine-parity or physical-light correctness.

See [`docs/MATERIAL_INFLUENCE_LAB_V0_5.md`](docs/MATERIAL_INFLUENCE_LAB_V0_5.md).

## v0.4.0 — Reusable Material Library

v0.4 turns the temporary visual shelf into an explicit persistent reuse layer without making this repository the generator.

The Reusable Material Library can:

- intake exact image payloads from the visual shelf;
- derive stable content-oriented IDs;
- preserve recorded source/provenance metadata and portable image data when available;
- persist explicitly in browser-local IndexedDB;
- export/import complete library JSON;
- import legacy v0.1 and current v0.2 material donor packs;
- attach editable routing hints;
- group ingredients into explicit reusable families;
- export selected ingredients/families as `axm-material-donor-pack` v0.2.

Channel hints are routing metadata, not claims that this page physically understands the material.

See [`docs/MATERIAL_LIBRARY_V0_4.md`](docs/MATERIAL_LIBRARY_V0_4.md).

## v0.3.0 — Material Delta Bridge

v0.3 connects neighboring material states:

`declared edit → build delta → spatial pixel delta → file delta`

It supports parent/child captures, declared edits, pixel-by-pixel difference images, regional summaries, persistent experiments, and donor-pack export while keeping declared intent distinct from observed output.

See [`docs/MATERIAL_DELTA_BRIDGE.md`](docs/MATERIAL_DELTA_BRIDGE.md).

## v0.2.0 — Trace Down

v0.2 established the observable downward path from a finished canvas:

`IMAGE → BUILD → PIXELS → FILE → BITS`

It intentionally does not pretend that final PNG bytes recover hidden image-generator internals or original intent.

See [`docs/TRACE_DOWN_EXPERIMENT.md`](docs/TRACE_DOWN_EXPERIMENT.md).

## Existing material / surface capability

The working page now provides:

- local PNG / JPG / WEBP import and drag/drop;
- transparent layer composition;
- blend modes, opacity, position, scale, rotation, visibility, ordering, duplicate/fit/center;
- configurable workspace dimensions and transparent PNG export;
- full portable workspace-state JSON export/import;
- explicit browser-local save/load;
- state snapshots and changed-path diffs;
- deterministic local demo visuals;
- persistent reusable material-library entries and families;
- persistent material influence recipes with explicit stacking, routing, light/view and shader-like preview state;
- a local WebGL material renderer for explicit base-color/normal/roughness/metallic/AO/emissive/opacity interpretation and framebuffer evidence;
- a deterministic baseline vocabulary of hundreds of reusable family maps and overlays.

## Capability first

The project does **not** declare the v0.7 seed list to be a universal material ontology. We use real visual ingredients and working operations first, inspect what state the software actually requires, and allow the vocabulary to grow or be replaced as stronger evidence appears.

See [`docs/STATE_EXPERIMENT.md`](docs/STATE_EXPERIMENT.md).

## Roots / merge gate

Internal AXM work is judged against the roots:

- **Truth** — distinguish observed state, declared experiment intent, measured output, routing hints, synthetic source provenance, interpreted render channels, preserved-only state, inference, and unknowns.
- **Agency / non-domination** — generation, library installation, staging, export, rendering, and comparison remain explicit local actions.
- **Continuity** — stable IDs, descriptors, seeds, exported state, experiments, persistent library entries, recipes, families, influence state, render receipts and donor packs preserve what actually happened.
- **Wisdom before speed** — gain useful breadth without pretending synthetic seeds are measured physical truth; test output and keep stronger sources welcome.

## Tests

The browser page itself has no build dependency. Pure helpers can be checked with Node:

```bash
npm test
```

CI syntax-checks all browser JavaScript. Tests cover state primitives, trace/delta behavior, library identity and donor round trips, influence recipe state, renderer plans/receipts/geometry, plus v0.7 vocabulary uniqueness, breadth, category/channel coverage, deterministic sampling, bounded map bytes, normal-map normalization, overlay variation, stable entry IDs and explicit synthetic provenance.

## Truth boundary

The page can directly observe its own build metadata, pixels, encoded PNG representation, controlled lineage declarations, pixel-local differences, exact reusable image payloads, v0.5 influence state, v0.6 WebGL framebuffer output, and v0.7 deterministic seed descriptors/generated payloads.

It does not claim automatic PBR correctness, physical-material recognition, measured BRDF data, complete semantic understanding, aesthetic judgment, hidden generator-state recovery, HDRI certification, cross-engine render parity, cross-GPU bit-for-bit framebuffer identity, geometric shadow correctness, displacement rendering, scan-grade material quality, or causal states that were never recorded/exposed. The v0.7 vocabulary provides a reproducible baseline and a route into the existing renderer; quality and suitability remain evidence questions, not metadata assumptions.
