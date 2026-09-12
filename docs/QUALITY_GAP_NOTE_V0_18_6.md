# Quality-gap diagnostic note

The repository now has strong evidence for transport integrity, deterministic state, batch survival, lineage, mutation reproducibility and downstream reuse. None of those claims imply that generated assets are visually competitive with a hand-built or higher-quality game asset reference.

v0.18.6 therefore does not try to hide that gap behind another score. It adds only the next observable layer: pixel-signal diagnostics.

When an output is visibly poor, this gives two different cases:

1. **Technical signal failure is present.** Examples: coloured scalar maps, near-flat maps, grayscale/weak tangent normals, fully transparent output, duplicate channel payloads, broken byte/container state. These are actionable machine-pipeline defects.
2. **Technical signal is plausible but the asset still looks poor.** That is evidence that the remaining gap is higher-level form, composition, material authoring, geometry, lighting, art direction, reference matching or another visual capability not captured by current deterministic checks.

Case 2 is important. The machine must be allowed to say: **the files are valid and the signals are plausible, but this still does not look good.** Passing more structural tests must never be presented as visual improvement.
