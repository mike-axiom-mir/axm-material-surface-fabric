# v0.15 — Premade Recipe Pattern Memory

v0.15 adds a deterministic memory layer above the v0.13 keeper workflow and v0.14 alpha-sprite reuse.

The path is:

`explicit v0.13 keepers -> structural observation -> recurring-pattern aggregation -> versioned pattern library -> seeded pattern instance -> local transparent render -> optional later evolution`

## Why this exists

v0.12 can compose one transparent recipe. v0.13 can mutate it into a family. v0.14 can address real alpha-derived sprite candidates instead of relying only on rough atlas windows.

The missing step was remembering **what repeatedly survived explicit keeper decisions** without turning that history into hidden taste authority.

v0.15 therefore learns only from exported `axm-premade-recipe-pack/v0.13.0` keeper packs. It does not watch the user silently, train a model, or treat technical ranking as preference.

## Pattern library

Format:

`axm-premade-pattern-library / v0.15.0`

A library records:

- source keeper-pack IDs;
- source recipe fingerprints;
- recurrence/support count;
- ordered structural slots;
- asset kind + category family;
- globe / atlas-window / sprite-candidate source-type evidence;
- observed blend-mode counts;
- observed opacity and transform ranges;
- observed exact alpha-sprite examples when present;
- bounded technical-score range as historical evidence only;
- locked premade-pack identity.

The pattern ID is deterministic for the quantized structural skeleton.

## What “learning” means here

Learning is deliberately narrow:

1. accept recipes that were already explicitly kept;
2. reduce each visible layer stack to a quantized structural skeleton;
3. group matching skeletons;
4. count recurrence;
5. aggregate bounded observed ranges and source examples;
6. preserve the source recipe fingerprints.

There is **no hidden model training**, no semantic-intent inference, no automatic preference model, and no silent rewrite of the original recipes.

A support count of `5` means only:

> five imported keeper recipes matched this structural pattern under the recorded v0.15 quantization.

It does not mean “five votes that this is beautiful.”

## Pattern instantiation

`instantiatePattern(library, patternId, pack, seed)` creates a new v0.12-compatible transparent recipe from the learned structure.

The same:

`library + pattern + seed + premade pack`

produces the same recipe fingerprint.

Instantiation samples only inside the pattern's observed structural envelope:

- compatible asset family;
- observed blend-mode distribution;
- observed opacity range;
- observed position / size / rotation range;
- observed exact sprite candidates when that source type is selected and sprite reuse is enabled;
- deterministic globe cells or coarse atlas windows where appropriate.

The output is a **proposal**. It is not automatically kept, installed, canonized, or promoted.

## Panel 16 — Recipe Pattern Memory

The browser panel can:

- import one or more v0.13 keeper recipe packs;
- build a pattern library explicitly;
- inspect support, source count and layer slots;
- instantiate one selected pattern from a seed;
- reuse exact v0.14 alpha sprites when they were part of keeper evidence;
- render the instance locally with transparency;
- leave missing runtime files as HOLD;
- export the pattern library;
- export the exact instance receipt/recipe;
- export a transparent PNG when every referenced runtime layer is available;
- explicitly save/load the pattern library in browser-local storage.

No background save or observation occurs.

## Headless path

```bash
node tools/premade-patterns.js learn keeper-a.json keeper-b.json --out build/pattern-library.json
node tools/premade-patterns.js summary build/pattern-library.json
node tools/premade-patterns.js instantiate build/pattern-library.json pattern-12345678 seed-42 --out build/pattern-instance.json
```

This lets a machine reuse explicit keeper history without a browser.

## Relationship to evolution

v0.13 and v0.15 do different jobs:

- **v0.13 evolution** explores children around one parent.
- **v0.15 pattern memory** aggregates structure across explicit keepers and can create a fresh deterministic instance from that recurring structure.

A future loop can therefore be:

`pattern instance -> v0.13 evolution -> explicit keepers -> new keeper pack -> v0.15 pattern-library rebuild`

The rebuild is explicit. The system does not silently reinforce itself.

## Roots

- **Truth** — recurrence, technical evidence and aesthetic unknowns remain separate. A pattern is structural evidence, not semantic understanding.
- **Agency / non-domination** — only explicit keeper packs enter memory; pattern instantiation never becomes automatic promotion.
- **Continuity** — source pack IDs, recipe fingerprints, pack SHA, pattern IDs, support and instance receipts preserve lineage.
- **Wisdom before speed** — useful recurrence is reused without claiming hidden taste, universal quality, or intent recognition.

## Truth boundary

v0.15 proves deterministic structural aggregation and deterministic reuse of explicit keeper state. It does not prove artistic quality, user preference, semantic intent, physical-material correctness, PBR truth, or universal recipe fitness.
