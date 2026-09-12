# Material Signal Audit v0.18.6

This checkpoint exists because transport correctness and deterministic generation are not the same thing as useful visual material state.

The earlier batch, payload and soak tests can prove that image bytes survive, families stay intact, recipes are deterministic and mutation lineage is preserved. They cannot explain why an asset still looks weak. v0.18.6 adds a bounded pixel-signal inspection layer so the next real asset batch can expose obvious technical pathologies before anyone mistakes structural PASS for visual quality.

## Observed signals

For portable PNG entries the audit records bounded sampled RGBA mean/stddev, luminance mean/stddev, grayscale share, visible/partial alpha share, coarse colour-bin diversity and horizontal edge energy.

For entries routed as `normal`, it also interprets RGB using the common tangent-space [-1,1] encoding and reports mean vector length, share of vectors in a broad plausible length band, and mean Z. This is a warning heuristic only; it does not certify normal-map convention or physical correctness.

Scalar-style channels (`roughness`, `metallic`, `ambient-occlusion`, `height`, `displacement`, `opacity`) are checked for heavy colour leakage. Families are checked for identical payload bytes being routed to multiple different channels.

Warnings currently include:

- `near-flat-signal`
- `scalar-channel-color-leak`
- `normal-map-near-grayscale`
- `normal-positive-z-weak`
- `normal-vector-length-irregular`
- `low-signal-diversity`
- `fully-transparent-signal`
- `duplicate-payload-across-channels:*`

## Important boundary

A warning is not an aesthetic verdict and PASS is not a quality certificate. This layer can expose cases such as a coloured roughness map, a nearly grayscale normal map, a flat/empty texture, or the same bitmap accidentally reused across unrelated channels. It cannot determine whether an asset is beautiful, coherent with a game's art direction, semantically correct, AAA quality, physically accurate, or better than a reference.

The point is narrower: when the real batch arrives, we can separate **broken/suspicious visual signal** from **valid-but-still-unimpressive art**. That distinction tells the next repair step whether to fix the machine's material pipeline or to confront the higher-level asset-generation/art-direction gap.

## CLI

```bash
npm run material:signal -- audit path/to/library.json build/signal-report.json
npm run material:signal -- summary build/signal-report.json
```

PNG gets pixel observation. JPEG/WEBP remain bounded by the prior payload audit unless a full decoder is added later. Unobserved formats stay explicit; they are never silently treated as visually verified.
