# v0.18.3 — Batch Readiness + 90-Asset Stress Lab

This checkpoint is deliberately about **testing the existing machine under realistic batch pressure**, not adding another cross-repository bridge.

The immediate target is the incoming large asset batch. Until those real files exist, the repository now exercises the same library/capability/feedback paths with deterministic synthetic image state so failures can be found before the batch lands.

## What is tested

`tests/batch-readiness-core.test.js` builds 15 complete six-channel material families:

- base-color
- normal
- roughness
- metallic
- ambient-occlusion
- height

That produces exactly **90 portable PNG entries + 15 declared families = 105 capabilities**.

The test requires all 90 entries to survive:

`synthetic PNG bytes -> v0.4 material library -> family grouping -> donor-pack export -> v0.18 capability pack -> downstream-use feedback -> usage ledger`

No step may silently truncate the batch.

The stress run also creates 22 families / 132 entries. Because the current bounded Universal Creation material-donor intake is 128 entries per donor pack, the v0.18.3 planner must split the state into multiple packs **without splitting a connected material family**.

## Batch readiness report

`batch-readiness-core.js` emits:

`axm-material-batch-readiness/v0.18.3`

The report checks:

- portable image payload presence;
- supported image MIME;
- explicit supported channel routing;
- positive image dimensions;
- duplicate entry/family identities;
- missing family members;
- duplicate channels inside one family;
- connected family components;
- current downstream entry/family/capability limits;
- deterministic chunk planning.

A family graph is treated as a connected component. Overlapping families therefore stay together instead of being accidentally split across transport packs. If one connected component is itself larger than a configured boundary, the report is `HOLD`; it is never silently chopped apart.

## Headless tool

Generate a deterministic 90-entry stress library:

```bash
node tools/material-batch-readiness.js synth build/stress-90.json 15
```

Analyze any compatible material library:

```bash
node tools/material-batch-readiness.js analyze build/stress-90.json build/stress-90-report.json
```

Write family-preserving donor packs:

```bash
node tools/material-batch-readiness.js packs build/stress-90.json build/stress-packs
```

The default packing limits mirror the currently proven downstream boundaries:

- 128 material entries per pack;
- 128 families per pack;
- 512 total capabilities per pack.

These are transport/readiness limits, not architectural claims that AXM can never grow beyond them.

## What this does not claim

A PASS proves deterministic bounded transport/readiness for the state supplied to the report. It does **not** prove:

- that the incoming real 90 assets are valid before they arrive;
- visual quality or taste;
- semantic correctness;
- PBR/physical correctness;
- renderer equivalence;
- that every asset should be retained;
- downstream adoption or canonical promotion.

When the real batch lands, replace the synthetic evidence with observation of the real files and repair only the failures actually observed.
