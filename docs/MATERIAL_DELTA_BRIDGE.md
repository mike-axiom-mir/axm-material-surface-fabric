# AXM Material Delta Bridge — v0.3

## Role of this machine

The Material / Surface Fabric is not required to be the place that invents or generates every visual source.

Other AXM systems may create visuals: Universal Creation, game-asset tooling, FrameState, image generators, or later visual machines. This repository has a narrower strengthening role:

> **Take material / texture ingredients, preserve their source evidence, make controlled edits and combinations, measure what changed, and return reusable material donor packs to the wider visual stack.**

That keeps generation and material refinement separable while allowing both to improve each other.

## v0.3 experiment

v0.2 established an observable descent:

`IMAGE → BUILD → PIXELS → FILE → BITS`

v0.3 adds the bridge between neighboring material states:

`declared edit → build delta → spatial pixel delta → file delta`

The declared edit is operator-supplied experiment intent. It is not treated as discovered causality.

## Controlled lineage

A capture may name an earlier capture as its parent.

Example:

`clean metal`

↓ declared action: `add red paint layer`

`painted metal`

↓ declared action: `add scratch overlay at opacity 0.25`

`light wear`

↓ declared action: `increase scratch opacity 0.25 → 0.60`

`heavy wear`

Each child stores the declared action and optional free-text parameters. The page then measures the actual observable difference.

## Spatial delta

Two same-size captures can be compared pixel-for-pixel.

The comparison records:

- changed pixel count and share;
- mean and maximum RGBA channel difference;
- bounding box of all changed pixels;
- an exact difference image derived from the two rendered canvases;
- a configurable 4×4, 8×8, or 16×16 region grid showing where change is concentrated;
- composer/build-state changed paths;
- pixel-summary changed paths;
- PNG/file-state changed paths.

If the canvas dimensions differ, the page returns a HOLD for pixel-local comparison rather than pretending the coordinates align.

## Persistence

v0.3 material experiments can be explicitly saved to and loaded from browser-local IndexedDB.

Nothing saves automatically. Export/import JSON remains available for portability.

This is deliberate:

- local by default;
- explicit persistence;
- restorable experiment lineage;
- no hidden upload or account dependency.

## Donor packs

`Export donor pack` creates an `axm-material-donor-pack` JSON file.

The pack carries the current material shelf ingredients when their image bytes are locally available, workspace/layer recipe state, source/provenance metadata already present in the workspace, and a compact summary of the controlled material experiment.

The donor pack exists so other AXM visual systems can later build explicit adapters rather than copying unexplained screenshots.

Initial intended consumers include:

- Universal Creation;
- visual-creation tooling;
- game-asset tooling;
- FrameState;
- world / UI / VFX systems;
- future local visual software.

The pack is deliberately generic. A consumer may derive PBR maps, 3D materials, sprites, decals or other forms, but those transformations require their own evidence and must not be silently claimed by this repository.

## Truth boundary

v0.3 directly observes:

- composer state exposed by this page;
- rendered RGBA pixels;
- encoded PNG bytes;
- pixel-local differences between same-size captures;
- operator-declared experiment lineage;
- image bytes present in the local visual shelf when exported as a donor pack.

v0.3 does **not** claim:

- hidden state inside an external generator;
- that a declared edit is the only possible cause of every observed change;
- semantic recognition of rust, metal, paint, glass, cloth, etc.;
- automatic PBR or physical correctness;
- aesthetic quality judgment;
- that every downstream AXM system already understands the donor-pack format.

Those are later capabilities or adapters, not current facts.

## Roots / merge gate

- **Truth** — intent, observation, inference, and unknown are kept separate.
- **Agency / non-domination** — imports, captures, saves, loads and exports are explicit and local.
- **Continuity** — lineage, experiments and donor packs can be exported and restored.
- **Wisdom before speed** — learn reusable material relationships through controlled examples before imposing a universal material ontology.
