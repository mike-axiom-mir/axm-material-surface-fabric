# AXM Material Vocabulary Expansion — v0.7

## Purpose

v0.7 grows the material/surface machine from a capable editor/renderer into a materially broader donor library without making this repository the only visual generator.

The new path is:

`declared synthetic family -> correlated channel maps -> persistent Material Library -> optional Influence Lab staging -> v0.6 WebGL render / cross-light evidence -> donor-pack reuse`

The seed vocabulary is intentionally local and deterministic. It exists so AXM always has a substantial reusable material baseline even when no external generator, scan library, cloud source, or other AXM visual machine is present.

It remains additive. Better inputs from Universal Creation, game-asset systems, FrameState, image generation, scans, photographs, authored materials, or future machines can enter the same library and replace/extend these seeds.

## Breadth

v0.7 declares at least 39 reusable material families across six broad categories:

- metal;
- polymer / composite;
- glass / ceramic;
- construction / mineral;
- organic / textile;
- environment / FX.

Every family exposes a correlated baseline map set:

- base color;
- tangent-space normal;
- roughness;
- metallic;
- ambient occlusion;
- height.

Families that need it additionally expose:

- opacity;
- emissive.

The initial vocabulary therefore exceeds 250 reusable entries once the standalone overlay pack is included.

## Why the maps are correlated

The maps for one family are not generated as unrelated random pictures.

A family has one explicit procedural descriptor containing:

- family identity;
- category;
- deterministic seed;
- pattern type;
- scale;
- palette;
- roughness range;
- metallic baseline/spread;
- AO strength;
- normal strength;
- height contrast;
- optional opacity state;
- optional emissive state.

The base-color, height, normal, roughness, metallic and AO outputs sample that same deterministic family field. Normal is derived from neighboring height samples. This creates an internally related synthetic material set rather than six independent images.

That relationship is useful evidence, but it is **not** a physical-material measurement or PBR certification.

## Material families

The first vocabulary includes families such as:

- brushed steel;
- painted industrial steel;
- rusted steel;
- galvanized steel;
- anodized aluminum;
- copper patina;
- cast iron;
- scratched chrome;
- molded and matte plastics;
- rubber and tire rubber;
- carbon-fiber-like weave;
- closed-cell foam;
- clear / frosted / dirty glass;
- ceramic glaze and porcelain;
- concrete, asphalt, granite, marble, brick, sandstone and plaster;
- oak and painted wood;
- leather-like, canvas, denim and woven fabrics;
- wet surfaces, ice, mud and dust;
- emissive sci-fi panels;
- holographic film;
- bio-organic surface seeds.

This list is a seed vocabulary, not a closed ontology.

## Overlay vocabulary

v0.7 also includes standalone reusable influence entries such as:

- fine/deep scratches;
- paint chips;
- rust speckles;
- grime;
- oil smears;
- water streaks;
- dust;
- fingerprint-like arcs;
- edge-wear mask;
- weld seam;
- scorch;
- frost;
- moss;
- mud splatter;
- hazard stripes;
- emissive circuit lines;
- droplets.

These are stored as ordinary reusable entries with explicit channel hints such as `decal`, `microdetail`, `color-mask`, or `emissive`.

## Stable identity and provenance

Generated family entries use stable semantic IDs:

`material-vocab-<family-id>-<channel>`

Overlays use:

`material-vocab-overlay-<overlay-id>`

Each generated entry carries source metadata containing:

- vocabulary format/version;
- family or overlay ID;
- deterministic seed;
- descriptor hash;
- generator identity;
- explicit `synthetic: true` marker;
- a note stating that the entry is not a measured scan or certified physical material.

Repeated installation of the same v0.7 entry updates that stable library entry instead of producing duplicate identity churn.

## Explicit generation and storage

Nothing is generated or stored automatically.

The operator can:

- generate one selected family for inspection;
- generate + install one selected family;
- generate + install the overlay pack;
- explicitly generate + install the complete vocabulary;
- choose 64, 128, or 256 pixel map resolution;
- export the vocabulary manifest without generating image bytes.

The complete install action requires an explicit confirmation because hundreds of PNG data URLs are created and persisted locally.

## Renderer staging

`Stage selected -> renderer` creates a small v0.5 Influence Lab workspace containing only the selected family's generated entries and one recipe layer per declared channel.

It stores that workspace through the existing explicit v0.5 local persistence route, then asks the existing v0.6 renderer to load it.

This creates a direct test path:

`family -> generated maps -> v0.5 recipe -> v0.6 WebGL channel interpretation`

The renderer can then perform its existing cross-light sweep to expose how the same synthetic family behaves under different declared light rigs.

## What v0.7 proves

v0.7 can truthfully prove:

- deterministic vocabulary breadth;
- stable family/entry identity;
- repeatable procedural field sampling;
- correlated channel generation from one family descriptor;
- portable PNG payload creation in the browser;
- persistent library installation;
- reuse of the existing Material Library family model;
- staging into the existing Influence Lab / WebGL render path;
- explicit source/provenance metadata for the synthetic seed set.

## What v0.7 does not prove

v0.7 does **not** prove:

- that any family is a physically accurate model of its real-world namesake;
- measured material parameters;
- calibrated BRDF data;
- engine parity;
- photorealism;
- artistic superiority;
- seam-free tiling under every scale;
- that the generated normal/roughness/AO maps match professional scan pipelines;
- that every family is useful in every downstream visual system.

Those require actual renderer/use evidence and, where physical claims matter, real measurement or stronger verified source material.

## Roots

- **Truth** — every seed is labeled synthetic; declared channels, generated bytes, renderer evidence, and unproven physical claims remain separate.
- **Agency / non-domination** — family generation, installation, full-vocabulary growth, staging, and export are explicit local actions.
- **Continuity** — stable IDs, descriptors, seeds, source metadata, library families, recipes, and donor packs preserve the construction path.
- **Wisdom before speed** — the system gets broad deterministic coverage now, but keeps external stronger sources welcome and uses the renderer to test output rather than declaring quality from metadata alone.
