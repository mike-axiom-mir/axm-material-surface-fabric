# AXM Material / Surface Fabric

A local-first experimental material, texture, overlay, decal, and surface-composition workspace for AXM.

The first purpose is deliberately empirical:

> **Build the working visual capability, expose the real runtime state it naturally produces, capture snapshots, and study that state before deciding what should become a wider AXM schema.**

## v0.1.0 experiment

Open `index.html` directly in a modern browser. No install, account, server, AI call, or network connection is required.

The first build provides:

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

## Roots

- **Truth** — distinguish what the page actually stores/does from what we infer from it.
- **Agency / non-domination** — local user control; no hidden upload, account, cloud, or remote dependency.
- **Continuity** — exported state and explicit snapshots make work reproducible instead of silently rewriting it.
- **Wisdom before speed** — grow the state model from observed use instead of prematurely forcing a theoretical schema.

## Tests

The browser page itself has no build dependency. The pure state helpers can optionally be checked with Node:

```bash
npm test
```

This currently verifies stable state hashing primitives, payload compaction, snapshot diffs, and imported-state validation.

## Truth boundary

v0.1.0 is a visual composition and state-observation tool. It does not yet claim automatic PBR correctness, physical-material recognition, semantic understanding of pixels, or aesthetic judgment.
