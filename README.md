# AXM Material / Surface Fabric

A local-first material, texture, overlay, decal, surface-composition, material-state, influence, render, vocabulary, and evaluation experiment for AXM.

Its role is deliberately narrower than “make every visual here”:

> **Increase the quality, reuse, inspectability, and quantity of material / texture ingredients so other AXM visual systems become stronger.**

Visuals may be created by Universal Creation, game-asset tooling, FrameState, image generators, scans, authored material tools, or later visual machines. This repository can intake those sources, combine/refine them, preserve evidence, study controlled changes, keep a reusable local library, compose material influence recipes, render explicit material channels locally through WebGL, grow a deterministic baseline material vocabulary, evaluate that state across controlled render conditions, and export portable donor packs.

Open `index.html` directly in a modern browser. No install, account, server, AI call, or network connection is required.

## v0.8.0 — Material Evaluation / Evolution

v0.8 turns the v0.7 breadth into a controlled test/evolution loop:

`material family or saved recipe → temporary explicit influence workspace → existing v0.6 WebGL renderer → geometry × light observations → bounded technical renderer-health signals → optional deterministic variants → explicit reviewed promotion`

The new Material Evaluation / Evolution lab can:

- evaluate a selected v0.7 material family through every current light rig;
- run a quick sphere-only matrix or a deeper sphere + plane + cube matrix;
- evaluate the explicitly saved v0.5 Influence Lab workspace as well, allowing imported/external material sources already represented in the recipe contract to use the same evaluation path;
- measure framebuffer visibility, transparency, mean RGB/alpha, mean luminance, luminance spread/range, near-black/near-white collapse, pixel hashes, renderer holds and receipt state;
- expose a deliberately bounded `bounded-renderer-health` score for technical sorting;
- create four deterministic descriptor variants of a selected vocabulary family, preserving parent ID, mutation index, mutation seed, exact changed parameters and descriptor hash;
- evaluate the parent and variants under the same render matrix;
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
- a deterministic baseline vocabulary of hundreds of reusable family maps and overlays;
- bounded batch evaluation across light rigs and geometries;
- deterministic parent→variant material descriptor evolution with explicit mutation state;
- explicit reviewed candidate promotion with install receipts.

## Capability first

The project does **not** declare the seed vocabulary or the v0.8 technical ranking to be a universal material ontology or universal quality function. We use real visual ingredients and working operations first, inspect what state the software actually requires, and allow the vocabulary/evaluation rules to grow or be replaced as stronger evidence appears.

See [`docs/STATE_EXPERIMENT.md`](docs/STATE_EXPERIMENT.md).

## Roots / merge gate

Internal AXM work is judged against the roots:

- **Truth** — distinguish observed state, declared experiment intent, measured output, routing hints, synthetic source provenance, interpreted render channels, bounded technical evaluation, preserved-only state, inference, and unknowns.
- **Agency / non-domination** — generation, library installation, staging, evaluation, candidate selection, export, rendering, and comparison remain explicit local actions; technical rank never silently becomes promotion authority.
- **Continuity** — stable IDs, descriptors, seeds, mutation lineage, evaluation sessions, framebuffer evidence, install receipts, exported state, persistent library entries, recipes, families, render receipts and donor packs preserve what actually happened.
- **Wisdom before speed** — gain useful breadth and technical test coverage without pretending synthetic seeds or renderer-health scores are measured physical truth, aesthetic judgment, or universal preference.

## Tests

The browser page itself has no build dependency. Pure helpers can be checked with Node:

```bash
npm test
```

CI syntax-checks all browser JavaScript. Tests cover state primitives, trace/delta behavior, library identity and donor round trips, influence recipe state, renderer plans/receipts/geometry, v0.7 vocabulary uniqueness/breadth/category/channel coverage/deterministic sampling/map bounds/normal-map normalization/overlay variation/stable entry IDs/synthetic provenance, plus v0.8 framebuffer summaries, technical hold/signal classification, aggregate evaluation, deterministic variant lineage, bounded mutations, ranking semantics and portable evaluation-session validation.

## Truth boundary

The page can directly observe its own build metadata, pixels, encoded PNG representation, controlled lineage declarations, pixel-local differences, exact reusable image payloads, v0.5 influence state, v0.6 WebGL framebuffer output, v0.7 deterministic seed descriptors/generated payloads, and v0.8 controlled renderer-health observations and deterministic descriptor mutations.

It does not claim automatic PBR correctness, physical-material recognition, measured BRDF data, complete semantic understanding, aesthetic judgment, hidden generator-state recovery, HDRI certification, cross-engine render parity, cross-GPU bit-for-bit framebuffer identity, geometric shadow correctness, displacement rendering, scan-grade material quality, that the highest technical rank is visually best, or causal states that were never recorded/exposed. The vocabulary provides a reproducible baseline; v0.8 adds bounded renderer-path evidence and explicit variation without turning that evidence into silent taste or physical-truth claims.
