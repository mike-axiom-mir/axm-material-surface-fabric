# AXM Real Material Renderer — v0.6

## Purpose

v0.5 made material influence state explicit: recipe stacks, channel routing, masks, light rigs, view rigs and shader-like controls. v0.6 adds the first local renderer that actually samples several of those channels on 3D geometry.

The bridge remains deliberately separate from the v0.5 editor state:

`v0.5 saved/imported influence workspace -> compile render plan -> compose channel textures -> local WebGL shader -> framebuffer -> render receipt / A-B evidence`

The renderer is read-only toward the v0.5 workspace. It can load the explicitly saved browser-local influence workspace or import an exported workspace JSON file. It does not rewrite the influence lab or material library.

## Interpreted channels

The WebGL shader directly interprets:

- base color;
- tangent-space normal;
- roughness;
- metallic;
- ambient occlusion;
- emissive;
- opacity.

`decal` and `microdetail` recipe layers are explicitly mapped into the base-color channel composition. This mapping is reported in the render plan rather than hidden.

The following state remains preserved-only for this version:

- height;
- displacement;
- color-mask;
- unassigned state.

Missing library references and entries without portable image payloads are also retained as held state in the receipt.

## Geometry

The page includes dependency-free local geometry for:

- sphere;
- plane;
- cube.

Each geometry carries positions, normals, UVs and tangents so tangent-space normal maps can influence the lighting result without an external 3D library.

The existing v0.5 view rigs are interpreted in 3D where possible:

- `flat` uses a frontal camera;
- `tile-2x2` repeats UVs twice;
- `micro-close` moves the camera closer;
- `grazing-proxy` becomes an actual oblique WebGL camera view.

## Lighting and shader path

The fragment shader uses a bounded metallic/roughness lighting approximation with:

- explicit directional-light color and intensity;
- ambient contribution;
- an environment/reflection-like contribution;
- sampled AO;
- GGX-like normal-distribution and Smith geometry terms;
- Schlick Fresnel;
- tangent-space normal decoding;
- metallic/roughness texture sampling;
- emissive sampling and the existing emissive boost control;
- the existing clearcoat-like and Fresnel-like controls;
- exposure and saturation;
- opacity sampling and alpha cutoff.

The v0.5 `shadow` light-rig field is currently used only as a contrast influence. v0.6 does **not** render a shadow map, self-shadowing or geometric occlusion shadows.

If more than one normal-map layer is present, the image layers are ordinary RGBA-composited before tangent-space decode. That is useful experimental behavior, but it is not reoriented-normal-map blending and the receipt says so.

## Channel composition

Each interpreted channel is first materialized as a local offscreen 2D texture using the recipe's existing:

- stack order;
- visibility;
- blend mode;
- opacity;
- transforms;
- tiling/repeat;
- optional mask entry.

Those exact channel canvases then become WebGL textures. This allows the stack/family system to remain the source of material construction state while WebGL becomes a downstream interpreter rather than a replacement editor.

## Render receipt

Every completed render can produce an:

`axm-material-render-receipt / v0.6.0`

The receipt records:

- render-plan hash;
- recipe identity and fingerprint;
- geometry;
- channels actually interpreted;
- preserved-only channels;
- missing entry references;
- held payload-less layers;
- warnings such as multiple-normal-layer composition;
- framebuffer dimensions and deterministic pixel hash;
- observed WebGL context string;
- shader-link and draw completion state;
- explicit truth boundaries.

The downloadable export also includes the full compiled channel-source plan so material entry identity and channel mapping are not lost.

## Cross-light sweep

The renderer can replay the same recipe through every currently declared v0.5 light rig.

This produces a small gallery and one framebuffer hash per light state. It is useful for finding material recipes that only look useful under one flattering light or for observing how roughness, normals, metallic state and emissive behavior respond across conditions.

The sweep proves only this renderer's response to those declared light states. It is not a universal real-world material test.

## A/B evidence

Rendered framebuffers can be captured into A and B slots. The existing Material Delta engine then computes:

- exact changed-pixel count/share;
- mean absolute channel delta;
- maximum channel delta;
- changed bounding box;
- 8×8 regional change summary;
- a difference image.

This extends the earlier delta path from 2D preview state into the actual WebGL framebuffer.

## Roots

- **Truth** — interpreted channels, preserved-only state, held state, approximated lighting, framebuffer evidence and unverified physical claims remain distinct.
- **Agency / non-domination** — loading, importing, rendering, changing renderer controls, capturing, comparing and sweeping are explicit local actions.
- **Continuity** — recipe identity, source entry identity, render-plan hashes, channel mappings and framebuffer hashes survive in exportable receipts.
- **Wisdom before speed** — unsupported height/displacement and ambiguous state remain visible instead of being guessed into a stronger renderer claim.

## Truth boundary

v0.6 proves that this local WebGL path can consume declared material channels and produce deterministic observed framebuffer state for a fixed browser/GPU implementation.

It does **not** prove:

- physically correct PBR maps;
- BRDF certification;
- cross-GPU bit-for-bit framebuffer identity;
- Unreal, Unity, Blender, Godot or other engine parity;
- HDRI/environment-map truth;
- geometric shadow correctness;
- displacement or height rendering;
- physical scale correctness;
- artistic quality;
- real-world material causality.

Those are later evidence problems, not assumptions to hide inside v0.6.
