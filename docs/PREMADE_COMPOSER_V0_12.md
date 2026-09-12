# v0.12 — Premade Deterministic Composer

v0.12 is the first layer that actively combines the v0.11 premade pack instead of only cataloging it.

## Path

`seed or explicit recipe -> declared globe cell + alpha atlas windows -> ordered blend/transform state -> transparent Canvas composition -> PNG + recipe + render receipt`

The composer consumes the locked v0.11 pack identity and does not invent a second visual library.

## Why this matters

The pack now becomes a deterministic creativity substrate:

- color/material/weathered/energy globes can act as stable bases;
- rust, scratches, mud, water, frost, moss, oil, paint damage and other alpha atlases can layer above them;
- industrial decals and panel details can add structure;
- holographic, radial, grid and light FX can add emissive visual language;
- one string seed can reproduce the same recipe state exactly.

The seeded path does not replace manual control. Every layer remains inspectable/editable and the complete recipe can be exported/imported as JSON.

## Recipe format

`axm-premade-composition / v0.12.0`

A recipe records:

- transparent canvas state;
- seed;
- ordered layers;
- atlas ID;
- declared globe row/column when a regular grid exists;
- normalized crop window for non-grid atlases;
- visibility, opacity and blend mode;
- normalized x/y/width/height, rotation and mirroring;
- provenance notes and truth boundary.

## Globe cells versus atlas windows

The four globe atlases have explicit regular grids from v0.11. `(atlas id, row, column)` therefore addresses a declared deterministic globe cell.

The other generated sheets do **not** yet have reliable semantic segmentation metadata. v0.12 may sample them using deterministic coarse crop windows such as 4x4 or 6x6 regions. Those windows are useful visual fragments but are explicitly **not** claimed to correspond to one semantic object.

That distinction preserves the original create -> observe -> understand -> reuse direction instead of pretending perception we have not proved.

## Seeded generation

`seededRecipe(seed, pack, policy)` uses a deterministic xorshift stream derived from the seed. A policy can constrain:

- globe pool: mixed, material, weathered, color, energy;
- number of added layers (0..8);
- whether decals may participate;
- whether holographic/FX atlases may participate.

The same seed + policy + pack version produces the same recipe and fingerprint.

## Browser panel

Panel **13 Premade Deterministic Composer** can:

- generate a recipe from a seed;
- start a blank recipe;
- explicitly add any atlas or globe cell;
- choose a crop window for non-grid atlases;
- edit layer visibility, blend, opacity, transform and ordering;
- render locally with Canvas 2D and alpha;
- export a transparent PNG;
- export/import recipe JSON;
- emit a local render receipt listing rendered and HOLD layers.

If the v0.11 runtime WebPs have not been installed into their manifest paths, the renderer reports those layers as HOLD instead of claiming success.

## Headless path

`tools/premade-compose.js` lets machines produce or compile recipes without the browser:

```bash
node tools/premade-compose.js seed axm-001 --base weathered --layers 5
node tools/premade-compose.js plan examples/premade-compositions/rusted-holo-globe.json
```

The headless path produces deterministic state/plan data. Actual pixels still require the installed runtime atlas files and a renderer.

## Blend truth

Browser rendering maps the declared blend modes to Canvas 2D compositing:

- normal -> source-over
- multiply
- screen
- overlay
- soft-light
- hard-light
- lighter
- difference

These are this local Canvas path's visual operations, not claims of identical interpretation in every engine.

## Roots

- **Truth** — globe semantic cells and non-semantic coarse atlas windows remain distinct; missing binaries become HOLD.
- **Agency / non-domination** — seed generation proposes a fully editable recipe; it never auto-installs or auto-promotes anything.
- **Continuity** — pack SHA, seed, recipe JSON, layer state and deterministic fingerprint preserve exactly what was composed.
- **Wisdom before speed** — the system starts combining the real pack now without inventing false semantic segmentation or material physics.

## Truth boundary

v0.12 proves deterministic selection, composition state, browser alpha compositing when runtime files are available, and portable recipe identity. It does not prove PBR correctness, physical material truth, aesthetic quality, semantic segmentation of non-grid atlas sheets, or cross-engine/cross-GPU visual equivalence.
