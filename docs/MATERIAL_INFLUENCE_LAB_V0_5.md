# AXM Material Influence Lab — v0.5

## Purpose

v0.5 expands the Material / Surface Fabric from a reusable library into a controlled material-influence experiment:

`reusable ingredients -> ordered recipe stack -> explicit channel routing -> masks / transforms / tiling -> light rig -> shader-like preview influences -> view rig -> observed preview -> A/B state + pixel delta`

The repository still does **not** need to originate every source image. Universal Creation, Game Assets, FrameState, image generators, other AXM visual systems, or manual imports can provide material/texture ingredients. This lab studies and reuses how those ingredients combine.

## Recipe state

The new top-level format is:

`axm-material-influence-workspace / v0.5.0`

A workspace contains one or more recipes. Each recipe preserves:

- ordered material stack;
- stable material-library entry references;
- explicit target channel per stack item;
- blend mode and opacity;
- visibility;
- optional mask entry;
- scale, rotation and offset;
- repeat/tiling counts;
- one light rig;
- one view rig;
- bounded shader-like preview controls;
- recipe fingerprint for exact state comparison.

The lab can explicitly save/load its state in browser-local IndexedDB and export/import the complete workspace as ordinary JSON.

## Material library intake

The lab reuses the v0.4 material library rather than creating a second material store.

`Refresh material library` first looks for the explicitly saved v0.4 browser-local library. If no saved library is present, it can observe the currently rendered v0.4 library cards as a weaker UI-level fallback.

The observed library snapshot is copied into the v0.5 workspace so exported recipes retain the exact entries they referenced at export time.

## Stack behavior

Stack order is bottom-to-top.

Each layer can declare:

- target channel;
- blend mode;
- opacity;
- mask;
- visibility;
- transform;
- integer preview tiling.

The 2D preview directly composites these declared color-oriented channels:

- `base-color`;
- `decal`;
- `microdetail`;
- `unassigned` (kept visible so unknown routing is not silently lost).

`emissive` is composited into a separate emissive preview buffer and can be added through the explicit emissive preview control.

Other channel routes such as normal, roughness, metallic, AO, height/displacement, opacity and color-mask remain visible state even when the bounded 2D preview does not physically interpret them. This is intentional: preservation is better than pretending the page has a complete PBR renderer.

## Masks

A recipe layer may reference another material-library entry as an alpha mask. The preview applies that mask only inside the local 2D composition path.

This does not claim that the same mask has identical semantics in every downstream renderer.

## Light rigs

The first built-in rigs include:

- neutral studio;
- hard side light;
- warm top light;
- cold sci-fi;
- dark emissive room;
- outdoor daylight proxy;
- gloss showroom proxy;
- red alert.

Each rig exposes explicit:

- angle;
- intensity;
- ambient amount;
- light color;
- shadow amount;
- environment/reflection-like amount.

These values drive deterministic Canvas 2D gradients/overlays. They are **preview influences**, not measured physical lights, HDRI environments, or renderer-equivalent illumination.

## Shader-like preview modules

v0.5 deliberately uses the label *shader-like preview controls* rather than claiming a complete shader runtime.

Current bounded controls are:

- exposure;
- saturation;
- clearcoat-like highlight;
- fresnel-like edge response;
- emissive boost;
- roughness-response proxy that changes the highlight profile.

These controls are explicit state and can be compared. They do not prove GLSL/WGSL/PBR parity, BRDF correctness, GPU execution, or engine-specific material behavior.

## View rigs

The first view states are:

- flat inspection;
- 2×2 tiling check;
- micro close-up;
- grazing-angle proxy.

The grazing view is intentionally named a proxy. It is a 2D compressed/skewed preview and not a 3D camera projection proof.

## A/B observation

Any current influence state can be captured as A or B.

A comparison includes:

- recipe-state fingerprint A/B;
- exact changed state paths grouped across stack, light, view and shader state;
- observed rendered-pixel delta using the existing Material Delta core;
- changed pixel share;
- changed pixel count;
- mean/max channel delta;
- changed bounds;
- 8×8 regional delta summary;
- A / B / difference previews.

This connects declared influence changes to observed output change without silently turning correlation into universal physical causality.

## Why stacking matters

The useful search space grows from composition, not only raw asset count.

A modest library can produce many materially distinct recipe states through combinations of:

- base surfaces;
- coatings;
- wear / grime / scratches;
- decals;
- masks;
- per-layer transforms and tiling;
- channel routing;
- light conditions;
- view conditions;
- bounded shader-like controls.

The point of v0.5 is to preserve those combinations as explicit, reusable state instead of flattening every result into one opaque image.

## Roots

- **Truth** — stored stack/routing/light/view/shader state is explicit; the page labels preview approximations as approximations.
- **Agency / non-domination** — recipe edits, masking, persistence, import/export and comparisons are explicit local actions.
- **Continuity** — recipes retain stable library entry references, complete influence state, fingerprints, experiment snapshots and exportable JSON.
- **Wisdom before speed** — unsupported physical interpretation stays visible as a boundary instead of being invented to make the material system look more complete.

## Truth boundary

v0.5 proves:

- reusable ingredients can be stacked into persistent recipes;
- routing, masking, transform, tiling, light/view and shader-like controls can coexist in one inspectable state;
- the same recipe can be observed under many influence states;
- A/B state and pixel differences can be measured inside this preview system.

v0.5 does **not** prove:

- physically correct PBR material maps;
- real-time GPU shader execution;
- full BRDF/light transport;
- HDRI correctness;
- engine parity;
- semantic material recognition;
- artistic quality;
- that a preview effect will look identical in another renderer;
- that an observed A/B delta is universal physical causality.
