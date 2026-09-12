# v0.17 — Closed Loop Pattern Evolution

v0.17 closes the premade creativity chain without removing the explicit keeper / memory gates.

## Path

`v0.15 pattern memory -> v0.16 guided composition -> v0.17 evolution descendants -> renderer evidence -> explicit keeper decisions -> explicit memory commit -> updated v0.15-compatible pattern library`

The output is still local, deterministic state. The loop does not create a hidden preference model and it does not promote its own descendants.

## `axm-premade-closed-loop-session/v0.17.0`

A loop session records:

- exact v0.16 guided receipt identity and parent recipe fingerprint;
- anchor + donor pattern lineage inherited from the guided parent;
- deterministic loop seed and v0.13 mutation policy;
- every evolved child recipe / fingerprint / mutation receipt;
- optional browser framebuffer evidence and technical health;
- every explicit keep / unkeep decision;
- optional memory-update receipt after an explicit commit.

The parent and every child must retain `canvas.transparent: true`.

## Explicit keeper gate

Ranking is advisory technical evidence only.

A descendant is not a keeper because it ranked first. `decideKeeper(...)` must be invoked explicitly for the candidate. The CLI likewise requires exact candidate IDs:

```bash
node tools/premade-loop.js keep build/loop.json candidate-... --out build/loop-kept.json
```

No `--keep-top`, automatic winner promotion, or silent selection path exists.

## Explicit memory gate

Pattern memory cannot change until at least one explicit keeper exists. `commitKeepersToMemory(...)` then:

1. exports only explicit keepers as a normal v0.13 `axm-premade-recipe-pack`;
2. derives a normal v0.15 contribution library from that keeper pack;
3. incrementally merges matching pattern signatures into the existing v0.15-compatible library;
4. adds new signatures as new patterns;
5. records exact support deltas and source recipe fingerprints;
6. returns `axm-premade-memory-update-receipt/v0.17.0` containing the keeper pack, contribution identity, support deltas, and updated library.

The browser **Commit explicit keepers → pattern memory** action also explicitly writes the resulting library to the same local-storage key used by the v0.15/v0.16 panels, so a later load starts from the strengthened library.

## Incremental evidence boundary

Pattern support means recurrence among explicit keeper recipes. It is not a preference score.

Observed slot ranges and counts can be extended deterministically because a pattern slot is present in every recipe represented by that signature. Technical-score mean is intentionally withheld after an incremental merge, because v0.15 summaries do not encode the exact count of non-null technical-score observations. Min/max evidence remains preserved.

## Browser Panel 18 — Closed Loop Lab

Panel 18 can:

- import a v0.16 guided receipt;
- import or load an explicitly saved v0.15 pattern library;
- spawn 4 / 8 / 16 deterministic descendants;
- render descendants locally through the same transparent Canvas composition path;
- attach alpha/luminance/framebuffer evidence and HOLD state to v0.13 evolution records;
- inspect ranked descendants;
- explicitly keep or unkeep a selected descendant;
- explicitly commit keepers into pattern memory;
- export the loop session, memory receipt, and updated pattern library;
- send a selected descendant back to the normal premade composer.

If runtime premade images are absent, candidate render evidence records HOLDs instead of claiming pixel success.

## Headless CLI

Start a structural loop:

```bash
node tools/premade-loop.js start guided.json \
  --seed cycle-001 --variants 8 --strength medium \
  --out build/loop.json
```

Select exact keeper IDs:

```bash
node tools/premade-loop.js keep build/loop.json candidate-123 candidate-456 \
  --out build/loop-kept.json
```

Commit those keepers into an existing v0.15 library:

```bash
node tools/premade-loop.js commit build/loop-kept.json pattern-library.json \
  --out build/loop-committed.json \
  --library-out build/pattern-library-next.json \
  --receipt-out build/memory-update.json
```

Headless start does not render pixels and explicitly records `pixelEvidenceAttached:false`.

## Roots

- **Truth** — structural score, framebuffer evidence, recurrence/support, aesthetic unknowns, and semantic unknowns stay distinct.
- **Agency / non-domination** — descendant ranking never selects keepers; memory changes only through explicit keeper and memory-commit actions.
- **Continuity** — guided receipt, mutation lineage, keeper decisions, keeper pack, pattern deltas, and updated-library identity remain linked.
- **Wisdom before speed** — the system compounds reusable evidence without inventing taste, semantic understanding, or physical-material truth.

## Truth boundary

v0.17 proves a deterministic, inspectable feedback cycle over existing AXM material/premade state. It does **not** prove artistic improvement, preference learning, semantic intent, PBR correctness, physical truth, universal fitness, or autonomous canonical authority.