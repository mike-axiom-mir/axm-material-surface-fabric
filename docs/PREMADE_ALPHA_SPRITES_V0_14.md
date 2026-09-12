# v0.14 — Alpha Sprite Extraction / Atlas Decomposition

v0.14 replaces the weakest part of the premade pipeline: rough non-grid atlas windows are no longer the only reusable unit.

## Path

`v0.11 transparent atlas -> observed alpha -> connected regions -> conservative nearby-fragment grouping -> stable sprite candidate -> normalized atlas bounds -> composer/evolution reuse`

The key property is that the generated premade sheets already carry alpha. v0.14 uses that observed alpha as evidence instead of asking a model to guess where one reusable piece begins or ends.

## Sprite index

Per-atlas extraction emits:

`axm-premade-sprite-index / v0.14.0`

Each candidate records:

- stable candidate ID;
- source atlas ID/category/file/tags;
- exact source-image pixel bounds;
- normalized bounds for scaled runtime reuse;
- thresholded pixel count and grouped component count;
- nonzero/threshold alpha coverage and mean alpha;
- deterministic RGBA FNV fingerprint;
- extraction threshold, minimum sizes, merge gap and padding;
- source PNG SHA-256 when created by the headless source extractor;
- emitted sprite PNG path/SHA-256 when individual crops are written.

Normalized bounds are important: the canonical source PNG is 1254×1254 while the practical runtime derivative is 512×512. A source-PNG sprite index can therefore address the corresponding region in the runtime atlas without pretending the rescaled WebP is the historical source.

## Headless source extractor

The locked v0.11 archive already contains the original RGBA PNGs. Install them with:

```bash
python tools/install-premade-pack.py /path/to/axm-premade-alpha-globes-v0.11.zip --keep-source-png
```

Then extract one atlas:

```bash
node tools/premade-sprites.js extract rust-corrosion
```

Or every non-grid premade atlas:

```bash
node tools/premade-sprites.js extract-all
```

Useful controls:

```bash
node tools/premade-sprites.js extract rust-corrosion \
  --threshold 128 \
  --min-component 64 \
  --min-sprite 220 \
  --merge-gap 8 \
  --padding 4
```

The CLI is dependency-free Node code. `tools/png-rgba.js` decodes the actual pack's non-interlaced RGBA8 source PNGs and can write alpha-preserving RGBA8 candidate PNG crops.

`node tools/premade-sprites.js verify INDEX.json` validates bounds/identity shape, while `selftest` exercises extraction plus PNG encode/decode without needing the binary pack in CI.

## Browser Panel 15

**Alpha Sprite Lab** can:

- load any installed non-grid premade runtime atlas;
- observe the runtime alpha channel;
- tune threshold/minimum component/minimum candidate/merge gap/padding;
- draw candidate bounds over the source atlas;
- inspect candidate metadata and alpha coverage;
- export a runtime-observation index;
- import a stronger source-PNG index and project its normalized bounds onto the runtime WebP;
- export one candidate as a transparent PNG;
- send the selected candidate directly into Panel 13 Premade Deterministic Composer.

A browser-derived runtime index is labelled `runtime-webp-observation`. It is useful evidence, but it does not silently replace a source-PNG index because resize/compression can change low-alpha edge pixels.

## Composer + evolution integration

A v0.12 recipe layer can now carry an optional `spriteCandidate`:

```json
{
  "assetId": "rust-corrosion",
  "spriteCandidate": {
    "id": "rust-corrosion/sprite-001-...",
    "atlasId": "rust-corrosion",
    "normalizedBounds": { "x": 0.1, "y": 0.2, "width": 0.25, "height": 0.3 },
    "sourceIndexId": "sprite-index-...",
    "sourceBasis": "v0.11-source-png",
    "canonicalSourceIndex": true
  }
}
```

The composer converts normalized bounds to the installed runtime atlas and renders only that exact region while preserving the atlas alpha.

v0.13 evolution accepts these recipes. If a sprite layer keeps the same atlas, the exact sprite candidate survives normal opacity/transform/blend evolution. If an evolution mutation explicitly swaps the layer to another atlas, the old sprite identity is not silently carried across that new atlas; the layer falls back to that mutation's declared atlas-window state.

## Why the grouping stays conservative

Alpha connectivity is evidence of occupied pixels, not evidence of meaning.

A scratch can contain separate specks. A hologram can have disconnected glow particles. A fingerprint may have multiple ridge islands. v0.14 therefore allows nearby connected components to be grouped with a recorded pixel gap, but calls the result a **sprite candidate**, not a guaranteed object.

The extraction parameters are part of the index identity so changing threshold/grouping policy creates a different recorded state instead of silently rewriting history.

## Roots

- **Truth** — observed alpha, extraction parameters, source basis and candidate/object uncertainty remain explicit.
- **Agency / non-domination** — extraction does not auto-install or auto-promote candidates; sending one to the composer is explicit.
- **Continuity** — source SHA, normalized bounds, candidate IDs, crop hashes and recipe fingerprints preserve the path from atlas to reusable layer.
- **Wisdom before speed** — exact alpha-derived reuse replaces rough windows where evidence allows, without inventing semantic vision or physical-material claims.

## Truth boundary

v0.14 proves deterministic alpha-region discovery, conservative grouping, stable source-relative bounds, alpha-preserving source-PNG crop emission, source/runtime projection, and exact candidate references inside the composer.

It does **not** prove that each candidate is one semantic object, that grouping is aesthetically ideal, that generated visuals are measured PBR materials, or that PNG/WebP resampling is pixel-identical across all renderers.
