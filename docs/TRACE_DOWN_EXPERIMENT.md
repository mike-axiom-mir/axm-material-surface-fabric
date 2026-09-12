# AXM Trace Down Experiment — v0.2

## Question

Can one visible image be treated as a top-level state and followed downward through observable implementation layers without pretending that the final pixels reveal hidden generator internals?

This experiment tests that idea directly.

## Observable path

`IMAGE → BUILD → PIXELS → FILE → BITS`

The page captures:

1. **Image / top state** — the current rendered canvas, dimensions, workspace identity, a small thumbnail, and a hash of the captured build summary.
2. **Build state** — the actual compacted workspace/assets/layers/selection/truth state exposed by the working composer.
3. **Pixel state** — RGBA byte count, pixel hash, alpha coverage, visible/transparent counts, average visible RGB, luminance histogram, and coarse color buckets.
4. **File state** — the PNG produced from the same canvas, byte size, byte hash, PNG signature check, and a short header preview.
5. **Bits** — a deliberately short binary preview of the encoded PNG header. The system does not dump enormous binary payloads because the purpose is to prove and compare the descent path, not create unreadable output.

## Controlled creation

Use neighboring variants rather than unrelated images when possible. Example:

1. clean
2. painted
3. light wear
4. heavy wear

Change one direction at a time, capture each traced state, then compare any two captures.

This lets the experiment ask a grounded question:

> When the visible creation changes in a chosen direction, what observable state changes underneath it?

## Comparison

Every trace can be compared with any other captured trace. The comparison reports changed paths grouped across:

- top state;
- build state;
- pixel state;
- file state;
- other metadata.

The experiment JSON can be explicitly exported for later analysis or reuse elsewhere in AXM.

## Truth boundary

The trace is deliberately observational.

It **does** show the state available to this working page and the exact rendered pixel/file representation produced from it.

It **does not** claim that PNG bytes can reconstruct:

- hidden latent states inside a remote image generator;
- generator weights or unexposed sampling internals;
- original human intent;
- physically correct material meaning;
- causal states that were never recorded or exposed.

If a future generator exposes intermediate creation state, that state can be appended above/between the existing levels rather than silently inferred.

## Why this matters for AXM

A finished image can be studied as one macro-state composed from lower observable states. The same pattern may later be tested at larger scales:

`value → component → capability → system → monolith`

The experiment does not assume those scales are equivalent. It provides a concrete visual case where state-of-states relationships can be measured before wider claims are made.
