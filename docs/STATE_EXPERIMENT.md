# State experiment — build first, observe second

This repository intentionally does **not** begin by declaring a universal material schema.

The experiment is:

1. make a real local visual shelf and layer composer;
2. use it with imported and self-made visual pieces;
3. expose the state the working page actually needs;
4. capture snapshots during real edits;
5. diff those snapshots;
6. only after enough use, decide which observed state should be reusable elsewhere in AXM.

## What v0.1.0 currently exposes

The live state is not presented as a final ontology. It is merely the runtime structure of this implementation:

- workspace dimensions and preview/export settings;
- imported/generated asset records and provenance;
- composition layers and their render parameters;
- current selection;
- bounded action events;
- explicit captured snapshots;
- a truth block recording network/external-asset assumptions.

Image data URLs remain in exported workspace state for portability. The on-screen state viewer replaces those large strings with a compact descriptor containing payload length and a deterministic hash.

## Snapshot behavior

A capture stores a compact observation of the current state and a hash. After the first capture, later captures also compute changed paths against the prior observation.

This gives the experiment direct evidence such as:

- changing opacity changed `layers[n].opacity`;
- moving an object changed `layers[n].x/y`;
- importing a visual introduced an asset record plus source/provenance state;
- adding it to a composition introduced a separate layer record.

That evidence is more useful than guessing the final cross-AXM state model in advance.

## Truth boundary

The page can show and record its own state. It does **not** yet claim to understand the physical meaning of a generated texture, infer correct PBR maps, judge visual quality, or identify semantic material properties from pixels.
