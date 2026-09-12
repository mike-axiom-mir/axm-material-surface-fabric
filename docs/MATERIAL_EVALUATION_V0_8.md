# AXM Material Evaluation / Evolution — v0.8

## Purpose

v0.7 created breadth. v0.8 asks a different question:

> Can reusable material state be exercised repeatedly through the existing renderer, compared under controlled conditions, and varied deterministically without turning a technical renderer signal into a fake claim of beauty or physical correctness?

The path is:

`material family / saved recipe -> exact channel state -> v0.6 WebGL renderer -> geometry × light observations -> technical renderer-health signals -> optional deterministic variants -> explicit human-reviewed promotion`

The v0.8 lab does **not** automatically install, delete, replace, or canonize materials.

## Sources that can enter the lab

### v0.7 deterministic vocabulary families

A selected vocabulary family can be generated at bounded evaluation resolution and routed into the existing v0.5 recipe format, then into the existing v0.6 WebGL renderer.

### Existing saved Influence Lab recipes

The evaluator can also run the explicitly saved v0.5 workspace directly. That route matters because the workspace may contain imported or externally supplied material entries, not only v0.7 synthetic seed vocabulary.

This keeps external visual machines, image generators, manual sources, and later AXM systems able to enter the same evaluation path after their material state is represented in the existing library/recipe contract.

## Quick and deep modes

Quick mode uses:

- sphere geometry;
- every currently declared v0.5 light rig.

Deep mode uses:

- sphere;
- plane;
- cube;
- every currently declared v0.5 light rig.

The evaluator temporarily stages each case through the same explicit Influence Lab IndexedDB surface used by v0.7 staging, asks the existing v0.6 renderer to load/render that state, reads the renderer receipt and framebuffer, then restores the prior saved Influence Lab workspace after the evaluation run.

This is intentionally sequential. It avoids creating a second hidden renderer.

## Framebuffer summary

For every observed render, v0.8 records bounded measurements such as:

- framebuffer pixel hash;
- visible/transparent pixel share;
- mean RGB and alpha;
- mean luminance;
- luminance standard deviation;
- luminance range;
- near-black share;
- near-white share;
- renderer receipt state;
- explicit missing/held layers;
- light rig and geometry identity.

These are observations of the local renderer path.

## Bounded renderer-health score

v0.8 exposes a `bounded-renderer-health` score so many cases can be sorted without hiding the basis of the sort.

The score is intentionally technical. It penalizes conditions such as:

- shader link failure;
- incomplete draw;
- unresolved library references;
- held payload-less layers;
- effectively invisible framebuffer output;
- near-total black/white collapse;
- extremely low renderer signal.

It **does not** score:

- beauty;
- realism;
- artistic style;
- material desirability;
- physical accuracy;
- PBR correctness;
- similarity to a real-world material;
- user preference.

Candidate ranking first prefers completed renderer cases, then mean technical health, then worst-case technical health. That ranking is useful for finding broken/fragile renderer paths, not for declaring a material “better.”

## Deterministic evolution

The `Evolve + evaluate 4` action creates four declared variants from the selected parent family.

Each mutation is deterministic from:

- parent family ID;
- v0.8 mutation index.

The mutated descriptor may adjust bounded fields such as:

- pattern scale;
- roughness range;
- normal strength;
- height contrast;
- AO strength;
- palette brightness/saturation.

Every variant stores:

- parent ID;
- mutation index;
- mutation seed;
- exact mutation parameters;
- deterministic descriptor hash.

There is no hidden optimizer, model preference, or automatic aesthetic selection.

The parent is evaluated beside the variants. This makes it possible to see whether a mutation improves or damages the **bounded renderer path**, while preserving the fact that visual/artistic quality still requires judgment outside that score.

## Explicit promotion only

A generated candidate can be installed into the persistent v0.4 Material Library only through the explicit `Install selected candidate` action.

The install receipt records:

- evaluation session ID;
- candidate ID/rank;
- mean/minimum technical score;
- completion share;
- added/updated library IDs;
- explicit promotion authority;
- the score truth boundary.

A high technical rank never causes automatic promotion.

Saved composed Influence Lab recipes are evaluated in place and are not flattened into a new vocabulary family by this install button.

## Persistence

Evaluation sessions use:

`axm-material-evaluation-session / v0.8.0`

They can be:

- explicitly saved to browser-local IndexedDB;
- explicitly loaded;
- exported as JSON;
- imported as JSON.

A session preserves candidate descriptors, renderer observations, ranking evidence, representative render references, selected candidate, and explicit install receipts.

## Truth boundary

v0.8 can prove:

- deterministic descriptor mutation;
- exact mutation parameters and lineage;
- controlled geometry/light test coverage;
- renderer receipts;
- framebuffer byte measurements/hashes;
- bounded technical warning/hold signals;
- explicit promotion receipts.

It does not prove:

- scan-grade material quality;
- physical correctness;
- photorealism;
- artistic superiority;
- cross-engine equivalence;
- cross-GPU bit-identical rendering;
- real-world durability/optics;
- that the technically highest-ranked candidate should be preferred by a person or another visual system.

## Roots

- **Truth** — measured framebuffer state, renderer holds, declared mutation state, rankings, and unproven aesthetic/physical claims remain separate.
- **Agency / non-domination** — evaluation is explicit; no candidate is silently promoted, deleted, or rewritten.
- **Continuity** — parent/variant lineage, descriptor hashes, observations, sessions, and install receipts are portable and inspectable.
- **Wisdom before speed** — deterministic breadth is tested before expansion claims are strengthened; ambiguous aesthetic meaning is not collapsed into one technical score.
