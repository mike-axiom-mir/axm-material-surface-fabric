# v0.18.4 — Deterministic Creation / Evolution Soak

This checkpoint keeps pressure on the existing machine rather than adding another bridge.

`tools/material-soak.js` repeatedly exercises the current premade composition and evolution cores across many deterministic seeds and records only structural/headless evidence.

Default run:

```bash
node tools/material-soak.js --seeds 240 --variants 4 --evolve-every 10 --out build/material-soak.json
```

The default CI-backed soak creates:

- 240 seeded transparent compositions;
- 24 evolution sessions;
- 96 mutation candidates;
- mixed base pools across color, material, weathered, energy and unrestricted selection;
- five overlays per parent recipe;
- low, medium and high mutation strengths;
- locked and periodically unlocked base behavior;
- FX, decals, blend modes, transforms and coarse atlas windows.

Every generated recipe and mutation candidate must remain valid under the existing composer contract. Every candidate must retain lineage and a mutation receipt. Transparency stays a hard invariant, and the soak explicitly requires **zero automatically kept candidates**.

The test runs the same 240-seed workload twice and requires identical reports, then runs a smaller alternate configuration twice as a second reproducibility check.

## What the report measures

The report records:

- requested/built recipe counts;
- transparent recipe/candidate counts;
- evolution session/candidate counts;
- unique recipe and candidate fingerprints;
- asset IDs exercised;
- blend paths exercised;
- failures and their stage.

These are coverage and determinism signals. They are not a quality score.

## Truth boundary

A PASS means the exercised deterministic recipe/evolution paths preserved their current structural invariants for the tested seeds and premade pack.

It does **not** mean:

- visual output was rendered or inspected;
- the results are beautiful, realistic, useful, or physically correct;
- diversity is artistic quality;
- technical scores are fitness or preference;
- any candidate deserves keeper or canonical status.

The soak is intentionally unable to keep or promote anything automatically.
