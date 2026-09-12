# AXM Material / Surface Fabric

A local-first experimental material, texture, overlay, decal, and surface-composition workspace for AXM.

The purpose is deliberately empirical:

> **Build the working visual capability, expose the real runtime state it naturally produces, capture it, and study what actually changes before deciding what should become a wider AXM schema.**

Open `index.html` directly in a modern browser. No install, account, server, AI call, or network connection is required.

## v0.2.0 — Trace Down

v0.2 adds an observable downward path from the finished canvas:

`IMAGE → BUILD → PIXELS → FILE → BITS`

The new Trace Down panel can:

- inspect the current rendered image as a top-level state;
- capture the real compacted composer/build state underneath it;
- measure the actual rendered RGBA pixel state;
- encode the same canvas to PNG and inspect its file size, signature, byte hash, header bytes, and a short binary preview;
- capture labeled controlled variants such as **clean → painted → light wear → heavy wear**;
- compare any two traced captures and list the changed paths across top/build/pixel/file state;
- explicitly export the complete trace experiment as JSON.

The trace system is intentionally observational. It does not pretend that final PNG bytes recover hidden image-generator internals or original intent. If a future generator exposes intermediate creation state, that state can be added to the path as observed evidence instead of guessed.

See [`docs/TRACE_DOWN_EXPERIMENT.md`](docs/TRACE_DOWN_EXPERIMENT.md).

## Existing material / surface capability

The working page provides:

- local PNG / JPG / WEBP import and drag/drop;
- a reusable visual shelf;
- transparent layer composition;
- blend modes, opacity, position, scale, rotation, visibility, ordering, duplicate/fit/center;
- configurable workspace dimensions and transparent PNG export;
- full portable workspace-state JSON export/import;
- explicit browser-local save/load via IndexedDB;
- a live compacted view of the actual runtime state;
- state snapshots with deterministic hashes and changed-path diffs;
- a bounded action event log;
- two self-made deterministic demo visuals so the state experiment can be exercised without external assets.

## State first? No — capability first

The project does **not** start by inventing a universal material ontology. We create and use the capability first, then inspect what state the working software actually requires.

See [`docs/STATE_EXPERIMENT.md`](docs/STATE_EXPERIMENT.md).

## Roots / merge gate

Internal AXM work is judged against the roots rather than requiring founder comprehension of every technical implementation detail:

- **Truth** — distinguish observed state, measured output, inference, and unknowns.
- **Agency / non-domination** — local user control; no hidden upload, account, cloud, or remote dependency.
- **Continuity** — exported state, traced captures, and explicit snapshots preserve what actually happened.
- **Wisdom before speed** — grow the model from observed use and evidence rather than prematurely forcing a theoretical schema.

## Tests

The browser page itself has no build dependency. Pure state/trace helpers can optionally be checked with Node:

```bash
npm test
```

CI also syntax-checks the browser JavaScript. Tests cover stable state primitives, snapshot diffs, import validation, byte hashing, pixel summaries, bit/hex previews, and trace comparison paths.

## Truth boundary

The page can directly observe its own build metadata, canvas pixels, and encoded PNG representation. It still does not claim automatic PBR correctness, physical-material recognition, complete semantic understanding, aesthetic judgment, hidden generator-state recovery, or causal states that were never recorded/exposed.
