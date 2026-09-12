# v0.16 — Pattern-Guided Creation

v0.16 moves the premade system from remembering one keeper-derived pattern at a time to deliberately combining multiple remembered structures into a new transparent recipe.

## Path

`explicit keepers -> v0.15 pattern memory -> anchor pattern + donor motifs -> deterministic guided composition -> transparent recipe -> composer / evolution / downstream reuse`

The anchor supplies the primary composition structure. Donor patterns contribute non-base motifs such as damage, dirt, industrial decals, alpha sprites, holographic FX, light effects, and other learned layer structures.

## Why this matters

v0.15 could instantiate one remembered pattern. That was useful, but it still reproduced one structural family at a time.

v0.16 allows combinations such as:

- weathered material structure + holographic light motif;
- painted industrial surface + damage motif + hazard decal motif;
- energy globe base + frost / glass / radial HUD motif;
- one explicitly kept alpha-sprite layout combined with a different keeper-derived FX structure.

This turns keeper history into a larger deterministic visual grammar without adding hidden model preference or semantic claims.

## Contract

Guided output is recorded as:

`axm-premade-guided-composition-receipt / v0.16.0`

The receipt preserves:

- pattern-library identity;
- anchor pattern ID;
- donor pattern IDs;
- seed;
- bounded guide policy;
- every source pattern instance and fingerprint;
- per-output-layer source pattern / source layer lineage;
- output recipe fingerprint;
- complete transparent v0.12-compatible recipe.

## Structural donor relation

The guide may describe donor patterns using category novelty and overlap relative to the anchor.

For example, a donor containing `fx/holographic-grids` may have category novelty relative to an anchor whose keeper history only contains `overlays/corrosion` and `overlays/wear`.

That relationship is deliberately **structural only**. It does not mean the donor is more beautiful, semantically appropriate, physically correct, preferred, or universally compatible.

Auto donor selection uses this bounded structural relation plus deterministic seed ordering. Explicit donor selection remains available and overrides that convenience path.

## Layer policy

The default guided policy keeps:

- one anchor first layer;
- a bounded number of anchor extra layers;
- donor non-base layers in deterministic round-robin order;
- a total layer cap;
- optional FX / decal participation;
- optional reuse of exact v0.14 alpha sprite candidates.

Donor base globes are not silently stacked as motifs. The anchor remains the structural base unless the caller explicitly creates a different recipe later.

## Alpha / transparency

`transparent:true` remains a hard recipe invariant.

Exact v0.14 sprite candidates preserve their normalized alpha-derived source bounds when reused through a v0.15 pattern and into a v0.16 guided recipe. Their object meaning is still unknown unless separately established.

## Browser panel

Panel **17 Pattern-Guided Creation** can:

- import a v0.15 pattern library;
- load the explicitly saved local v0.15 library;
- select one anchor pattern;
- manually select donor patterns;
- deterministically auto-select donors by structural novelty / overlap;
- set seed, max layers, anchor extras, FX, decals, and exact-sprite reuse;
- generate and locally render the guided transparent recipe;
- report runtime HOLDs when pack files are missing;
- export the complete guided receipt;
- export transparent PNG only when the local render has no missing runtime layers;
- send the exact recipe into Panel 13 Premade Composer for further editing.

## Headless path

```bash
node tools/premade-guide.js donors pattern-library.json PATTERN_ID --seed donor-search
node tools/premade-guide.js compose pattern-library.json PATTERN_ID \
  --donor DONOR_A --donor DONOR_B --seed guided-42 --max-layers 8
node tools/premade-guide.js auto pattern-library.json PATTERN_ID \
  --donors 2 --seed guided-42 --out build/guided.json
node tools/premade-guide.js summary build/guided.json
```

Headless composition produces deterministic state and lineage. It does not claim that Node rendered or visually judged the result.

## Roots

- **Truth** — pattern recurrence, category relation, exact sprite bounds, technical evidence, and aesthetic unknowns remain distinct.
- **Agency / non-domination** — the user/machine can choose anchor and donors explicitly; auto selection is a convenience proposal, never authority.
- **Continuity** — pattern IDs, source instance fingerprints, per-layer lineage, seed, policy, pack identity, and output fingerprint preserve how the recipe was assembled.
- **Wisdom before speed** — motifs are combined through bounded existing evidence instead of inventing hidden taste, semantic understanding, or physical truth.

## Truth boundary

v0.16 proves deterministic multi-pattern composition and exact lineage through the existing transparent premade stack.

It does **not** prove:

- artistic quality;
- user preference;
- semantic intent;
- aesthetic compatibility;
- PBR correctness;
- physical-material truth;
- that high pattern support is a quality score;
- that a generated guided recipe should be automatically kept or promoted.
