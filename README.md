# AXM Material / Surface Fabric

A local-first material, texture, overlay, decal, surface-composition, and material-state experiment for AXM.

Its role is deliberately narrower than “make every visual here”:

> **Increase the quality, reuse, inspectability, and quantity of material / texture ingredients so other AXM visual systems become stronger.**

Visuals may be created by Universal Creation, game-asset tooling, FrameState, image generators, or later visual machines. This repository can intake those sources, combine/refine them, preserve evidence, study controlled changes, keep a reusable local library, and export portable donor packs.

Open `index.html` directly in a modern browser. No install, account, server, AI call, or network connection is required.

## v0.4.0 — Reusable Material Library

v0.4 turns the temporary visual shelf into an explicit persistent reuse layer without making this repository the generator.

The new Reusable Material Library can:

- intake the exact image payloads currently visible on the material shelf;
- derive stable content-oriented material entry IDs for repeated intake;
- preserve recorded source/provenance metadata and portable image data when available;
- persist the library explicitly in browser-local IndexedDB;
- export/import the complete library as ordinary JSON;
- import both legacy v0.1 and current v0.2 `axm-material-donor-pack` files;
- round-trip donor-pack entries and families without silently flattening their identity;
- attach editable channel-routing hints such as base-color, normal, roughness, metallic, AO, height, opacity, decal, or unassigned;
- group selected ingredients into reusable material families only when a real reuse relationship is declared;
- export selected ingredients/families as `axm-material-donor-pack` v0.2 for explicit downstream adapters.

Channel hints are routing metadata, not claims that this page physically understands the material. The first downstream adapter is intentionally implemented in Universal Creation rather than hidden inside this repository so cross-system compatibility remains testable and explicit.

See [`docs/MATERIAL_LIBRARY_V0_4.md`](docs/MATERIAL_LIBRARY_V0_4.md).

## v0.3.0 — Material Delta Bridge

v0.3 connects neighboring material states instead of only saying that two final images differ:

`declared edit → build delta → spatial pixel delta → file delta`

The Material Delta Bridge can:

- capture a material state with an optional parent capture;
- record the operator-declared edit and free-text parameters;
- compare same-size parent/child renders pixel-for-pixel;
- generate an exact grayscale difference image from the rendered RGBA buffers;
- report changed pixel share, mean/max channel delta, and the bounding box of changed pixels;
- split the image into 4×4, 8×8, or 16×16 local regions and show where change is concentrated;
- preserve composer/build-state, pixel-summary, and PNG/file-state changed paths;
- explicitly save/load experiments in browser-local IndexedDB;
- export/import portable experiment JSON;
- export an `axm-material-donor-pack` containing locally available visual-shelf image bytes, workspace/layer recipe state, source metadata, and compact experiment lineage for later adapters in other AXM systems.

The material machine itself does **not** need to generate the source visuals. Generation and material refinement stay separable.

See [`docs/MATERIAL_DELTA_BRIDGE.md`](docs/MATERIAL_DELTA_BRIDGE.md).

## v0.2.0 — Trace Down

v0.2 established the observable downward path from a finished canvas:

`IMAGE → BUILD → PIXELS → FILE → BITS`

The Trace Down panel can inspect the current rendered image, capture the compacted composer/build state, measure RGBA pixels, inspect the encoded PNG, capture controlled variants, compare traces, and export the trace experiment.

It intentionally does not pretend that final PNG bytes recover hidden image-generator internals or original intent. If a future generator exposes intermediate creation state, that state can be added as observed evidence instead of guessed.

See [`docs/TRACE_DOWN_EXPERIMENT.md`](docs/TRACE_DOWN_EXPERIMENT.md).

## Existing material / surface capability

The working page provides:

- local PNG / JPG / WEBP import and drag/drop;
- a reusable visual shelf;
- transparent layer composition;
- blend modes, opacity, position, scale, rotation, visibility, ordering, duplicate/fit/center;
- configurable workspace dimensions and transparent PNG export;
- full portable workspace-state JSON export/import;
- explicit browser-local save/load via IndexedDB;
- a live compacted view of the actual runtime state;
- state snapshots with deterministic hashes and changed-path diffs;
- a bounded action event log;
- deterministic local demo visuals for exercising the state experiment without external assets.

## Capability first

The project does **not** start by inventing a universal material ontology. We use real visual ingredients and real composition operations first, then inspect what state the working software actually requires and what patterns recur.

See [`docs/STATE_EXPERIMENT.md`](docs/STATE_EXPERIMENT.md).

## Roots / merge gate

Internal AXM work is judged against the roots:

- **Truth** — distinguish observed state, declared experiment intent, measured output, routing hints, inference, and unknowns.
- **Agency / non-domination** — local user control; no hidden upload, account, cloud, or remote dependency.
- **Continuity** — exported state, experiments, lineage, persistent library entries, families, and donor packs preserve what actually happened.
- **Wisdom before speed** — learn reusable material relationships from controlled use before prematurely imposing a universal schema.

## Tests

The browser page itself has no build dependency. Pure state/trace/delta/library helpers can be checked with Node:

```bash
npm test
```

CI also syntax-checks the browser JavaScript. Tests cover stable state primitives, snapshot diffs, import validation, byte hashing, pixel summaries, trace comparison, spatial pixel deltas, region summaries, difference buffers, transition truth boundaries, stable library IDs, family membership, legacy donor import, and donor-pack round trips.

## Truth boundary

The page can directly observe its own build metadata, canvas pixels, encoded PNG representation, controlled lineage declarations, pixel-local differences between same-size captures, and the exact reusable image payloads it stores locally.

It does not claim automatic PBR correctness, physical-material recognition, complete semantic understanding, aesthetic judgment, hidden generator-state recovery, or causal states that were never recorded/exposed. A donor pack proves portable material data and declared routing metadata exist; downstream usefulness is established only when a separate consumer validates and adapts it.
