# AXM Premade Alpha + Globe Pack 001 — v0.11

This pack turns the generated visual sheets from the Material / Surface Fabric session into versioned reusable machine state instead of leaving them trapped in chat.

## Content

The locked pack contains **24 generated source PNG atlases** plus **24 runtime WebP derivatives**. The runtime derivatives are 512×512 and retain alpha/transparency. Source PNGs remain 1254×1254 and their identity is preserved by the pack archive checksum.

The catalog includes:

- 4 regular-grid globe atlases with **166 declared globe cells** total;
- wear, scratches, grunge, rust/corrosion and damaged-paint overlays;
- water/condensation, oil/grease, mud/dirt and frost/ice overlays;
- fingerprints/smudges, cracked glass, moss/lichen and scorch/soot overlays;
- industrial hazard decals and modular panel/rivet/seam details;
- HUD, holographic, grid/shield, portal/radial and light-effect atlases.

## Transparency is an invariant

Transparency is not optional decoration in this pack. The generated sources were inspected as RGBA and the runtime derivatives retain alpha. Consumers should HOLD or reject an asset that unexpectedly becomes fully opaque unless a later version explicitly changes that asset contract.

Soft effects intentionally use partial alpha: smoke, frost, droplets, light bloom, holograms, grime and similar layers should remain stackable rather than carrying a baked background.

## Deterministic globe cropping

The globe atlases use explicit regular grids. Consumers do not need image recognition to select a globe.

```text
x0 = floor(column * width / columns)
x1 = floor((column + 1) * width / columns)
y0 = floor(row * height / rows)
y1 = floor((row + 1) * height / rows)
```

Declared grids:

- color globes: 12 × 8 = 96;
- material globes: 5 × 5 = 25;
- weathered/special globes: 5 × 5 = 25;
- energy/futuristic globes: 5 × 4 = 20.

## Irregular overlay sheets

The irregular sheets remain atlas-level sources in v0.11. That is deliberate. Their alpha makes manual or downstream region cropping possible, but this version does **not** pretend that automatic segmentation has already identified every scratch, drip, flare, rust patch or hologram correctly.

A later evidenced region-manifest pass can add stable sub-assets without rewriting the generated source identity.

## Binary pack lock

The binary bundle is version-locked by `manifest.json`:

`axm-premade-alpha-globes-v0.11.zip`

SHA-256:

`99cff0f3e098406145acba4b07a6539f8dcaae0c9aa1cd3adce461110421f905`

The archive is deliberately separate from normal source-code history while the current GitHub connector cannot stream local generated binary files directly into git safely. `tools/install-premade-pack.py` verifies that exact archive and installs the runtime files into their manifest-declared repo paths.

## Truth boundary

These are model-generated visual ingredients. They are useful premade material/texture/effect state, but they are not measured physical material data. A rust-looking layer is not corrosion physics; a glossy material globe is not a measured BRDF; a holographic globe is not an engine-certified shader.

The renderer/evaluation path can observe how these ingredients behave without converting appearance into physical truth.
