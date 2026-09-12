# AXM Reusable Material Library — v0.4

## Purpose

This repository is not required to generate every visual source. Its v0.4 job is to retain useful material/texture ingredients created elsewhere and make them easier to reuse without erasing where they came from.

`visual source -> shelf -> persistent material entry -> optional family -> donor pack -> explicit downstream adapter`

Candidate source systems include Universal Creation, game-asset tooling, FrameState, local generators, image generators, or manual imports. Source category does not grant trust by itself; recorded provenance stays attached to the reusable entry.

## Library state

The browser-local library uses:

`axm-material-library / v0.4.0`

Each entry retains:

- a stable content-oriented library ID;
- name and current visual-shelf kind;
- MIME type and dimensions;
- portable image data URL when available;
- a compact payload length/hash descriptor;
- recorded source metadata;
- editable tags;
- one editable channel-routing hint.

The routing hint is deliberately bounded to channels already useful to current visual systems, including base color, normal, roughness, metallic, AO, height/displacement, emissive, opacity, color mask, decal, microdetail, and unassigned.

The hint is not physical-material recognition. Filename/kind-derived defaults are labeled as hints and an operator can replace them explicitly.

## Families

A family is a declared reuse relationship between library entries. For example, a family might contain:

- one base-color surface;
- one roughness map;
- one normal map;
- one transparent wear/decal layer.

The library does not automatically declare that unrelated entries form a physically correct material. A family exists only after an explicit grouping action.

Removing an entry prunes it from families; empty families disappear rather than retaining dangling members.

## Donor pack v0.2

The current portable contract is:

`axm-material-donor-pack / v0.2.0`

The pack contains:

- stable pack identity derived from selected entry/family state;
- selected reusable library entries;
- selected families clipped to those entries;
- a legacy-compatible `assets` projection for older consumers;
- current workspace/layer context when exported from the page;
- explicit truth-boundary notes.

The v0.4 importer also accepts the earlier v0.1 donor pack produced by the Material Delta Bridge. Legacy assets are normalized into current library entries instead of being silently discarded.

## Round trip

A useful continuity requirement is:

`library -> donor pack -> imported library -> donor pack`

The exact exported timestamp/pack ID may change, but reusable entry IDs and family membership must survive. The pure library-core test suite verifies that bounded invariant.

## Downstream boundary

The material pack does not claim that another AXM system already understands it.

A downstream consumer must explicitly:

1. validate the donor-pack format it accepts;
2. preserve material entry identity and source evidence;
3. state how routing hints were mapped into its own contract;
4. expose entries it could not use instead of dropping them silently;
5. distinguish descriptor compatibility from rendered/physical correctness.

The first verified adapter is intentionally built in Universal Creation against its existing Asset Atom fabric. That keeps producer and consumer boundaries separate and makes the reuse proof falsifiable.

## Roots

- **Truth** — source evidence, routing hints, explicit families, and downstream receipts remain distinct kinds of information.
- **Agency / non-domination** — intake, persistence, grouping, import and export are explicit local actions.
- **Continuity** — reusable IDs, donor packs and family membership survive export/import rather than depending on one browser session.
- **Wisdom before speed** — prove a small material reuse loop before scaling the library to thousands of generated ingredients.

## Truth boundary

v0.4 proves local persistence, portable payload retention, family grouping, donor-pack round trip, and an explicit interchange surface. It does not prove:

- PBR correctness;
- semantic material recognition;
- visual quality;
- that a routing hint is physically true;
- that all downstream renderers interpret the same channel identically;
- that an exported donor pack has been consumed until a downstream adapter produces its own evidence.
