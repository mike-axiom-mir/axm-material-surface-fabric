# v0.13 — Premade Evolution Lab

v0.13 grows the deterministic premade composer into a bounded recipe-evolution system.

## Path

`v0.12 parent recipe -> deterministic bounded mutations -> transparent child recipes -> structural health -> optional browser framebuffer health -> ranked candidates -> explicit keepers -> reusable recipe pack`

The parent may come from a seed or an imported `axm-premade-composition/v0.12.0` recipe.

## Evolution session

Format:

`axm-premade-evolution-session / v0.13.0`

Every child keeps:

- parent recipe ID and fingerprint;
- mutation index;
- mutation seed;
- mutation policy;
- exact mutation receipt;
- locked premade-pack version/SHA identity;
- the complete transparent v0.12 recipe.

The same parent + session seed + policy + pack version produces the same child recipe states and fingerprints.

## Mutation strengths

Three bounded policies are provided:

- `low` — small transform/opacity/crop changes and rare swaps;
- `medium` — moderate swaps, crop changes, blend changes and occasional layer-count changes;
- `high` — stronger exploration while remaining within v0.12 recipe limits.

The base globe can be locked. FX and decals can be independently allowed/held out. Extra-layer count stays bounded.

Mutation never makes a recipe opaque: `canvas.transparent === true` remains a hard invariant.

## Technical health, not taste

Headless mode computes `bounded-structure-health` from inspectable recipe state such as:

- visible/extra layer count;
- duplicate ingredient reuse;
- strongly out-of-frame layers;
- mean overlay opacity;
- a rough overlap/coverage estimate.

The browser path additionally reads the actual transparent framebuffer and records:

- alpha coverage;
- mean visible alpha;
- visible luminance mean/range;
- near-black / near-white collapse shares;
- framebuffer FNV hash;
- runtime HOLD count.

These feed `bounded-render-health` and a combined technical score. The score exists to find empty, collapsed, missing, or obviously fragile compositions. It is **not** beauty, realism, PBR truth, taste, or universal visual quality.

## Ranking and keeper authority

Candidates are ranked by completed-render state and technical score. Ranking does not adopt anything.

`Keep / unkeep` is explicit. Only kept candidates enter an exported:

`axm-premade-recipe-pack / v0.13.0`

A recipe pack preserves each candidate's lineage, rank, technical score, recipe fingerprint, transparent recipe state, and locked source-pack identity.

## Browser panel 14

Panel **14 Premade Evolution Lab** can:

- create a parent from a seed or import a v0.12 parent recipe;
- generate 4 / 8 / 16 deterministic variants;
- choose low / medium / high mutation;
- lock/unlock the base globe;
- allow/disable FX and decals;
- render every child locally when the v0.11 runtime atlas pack is installed;
- measure transparent framebuffer health;
- show ranked previews;
- inspect parent -> child lineage/mutation state;
- explicitly keep candidates;
- export a full evolution session, selected child recipe, or keeper recipe pack.

When runtime atlas files are missing, layers stay visible as HOLD evidence and the technical score is penalized rather than claiming a successful render.

## Headless path

`tools/premade-evolve.js` produces deterministic evolution state without a browser:

```bash
node tools/premade-evolve.js seed axm-001 --variants 8 --strength medium --base weathered --layers 5
node tools/premade-evolve.js recipe examples/premade-compositions/rusted-holo-globe.json --variants 12 --strength high
```

Headless mode does **not** pretend it rendered pixels. It marks execution as `headless-structure-only`; framebuffer evidence may be attached later by the browser path.

## Roots

- **Truth** — structure scores and framebuffer observations are named separately; non-grid atlas windows remain non-semantic; missing runtime bytes remain HOLD.
- **Agency / non-domination** — ranking is advisory; keeper/adoption is explicit.
- **Continuity** — parent fingerprint, mutation seed/policy/receipt, child fingerprint, pack SHA and optional framebuffer hash preserve lineage.
- **Wisdom before speed** — bounded mutations grow real reusable recipe families without inventing aesthetic authority or physical-material correctness.

## Truth boundary

v0.13 proves deterministic bounded mutation, lineage, alpha-preserving recipe continuity, technical structural scoring, browser framebuffer scoring when the runtime pack is installed, explicit curation, and reusable recipe-pack export.

It does not prove aesthetic quality, semantic understanding, measured material physics, PBR correctness, universal preference, reliable semantic segmentation of non-grid atlas sheets, or cross-engine/cross-GPU pixel equivalence.
