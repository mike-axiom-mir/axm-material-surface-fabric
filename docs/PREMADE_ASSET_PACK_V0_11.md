# v0.11 — Premade Alpha + Globe Library

v0.11 converts the visual-generation session into a versioned reuse pack instead of leaving useful output trapped in chat.

## Path

`generated visual -> locked binary pack -> manifest -> verified local install -> deterministic atlas/globe selection -> Material / Surface Fabric / downstream visual machine`

The binary pack has one immutable SHA-256 and contains both generated 1254×1254 PNG sources and practical 512×512 WebP runtime derivatives. Runtime derivatives retain alpha.

## Scope

The first pack catalogs 24 atlases:

- 4 globe atlases with 166 declared deterministic cells;
- 12 environmental/surface overlay atlases;
- 2 industrial decal/detail atlases;
- 6 holographic/HUD/light-effect atlases.

## Why globes matter

Color globes provide stable color/value references. Material globes provide compact surface-response references. Weathered globes provide layered-condition references. Energy/futuristic globes provide visual-language references for emissive/procedural creation.

They are preview/reference ingredients, not hidden physical material parameters. The regular grids let a machine address them deterministically by `(atlas id, row, column)` without perception.

## Alpha / transparency

Alpha is a hard pack invariant. Transparent and partially transparent pixels let the overlay families stack with existing surfaces instead of carrying baked backgrounds. The pack was checked locally for alpha before its archive checksum was recorded.

## Source continuity

The 512 runtime derivative is cheaper expression, not replacement truth. The source archive also retains the 1254 PNG generated outputs. Version and archive SHA identify the exact pack so later conversions can never silently become the historical source.

## Binary transport boundary

The current GitHub connector can create text files and git objects but does not expose a safe local-file-to-repository binary upload parameter for these generated images. Therefore v0.11 keeps binary transport separate and verifiable instead of pretending the images were committed when they were not.

`tools/install-premade-pack.py` is local/offline and stdlib-only. It validates the exact archive hash before materializing runtime assets into manifest-declared paths. This boundary can later be replaced by Git LFS, release assets, or direct binary commit transport without changing asset IDs or the pack contract.

## Root alignment

- **Truth:** generated provenance, binary transport state, alpha requirement and physical limitations are explicit.
- **Agency / non-domination:** the pack expands options; no ingredient is silently promoted or made canonical.
- **Continuity:** archive checksum + manifest + deterministic globe grids preserve identity across handling.
- **Wisdom before speed:** useful assets are preserved now without faking reliable segmentation or physical material truth.
