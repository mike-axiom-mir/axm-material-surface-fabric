# Material Exchange Producer Handoffs

These files exist so the producer-side adapters can be built in each standalone repository's **own chat / PR lane** without losing the v0.9 receiver contract or repeating discovery work.

## Receiver already implemented

Material / Surface Fabric `v0.9.0` accepts:

- `axm-material-offer / v0.9.0`
- `axm-material-feedback / v0.9.0`

The receiver can independently verify portable payload bytes, preserve metadata-only/HOLD state, install explicitly into the reusable library, stage exact channel state into the Influence Lab, drive the existing WebGL/evaluation path, and return bounded feedback.

Canonical receiver documentation:

- `docs/CROSS_MACHINE_MATERIAL_EXCHANGE_V0_9.md`

## Producer lanes

### Game Asset Forge

Use:

- `handoffs/GAME_ASSET_FORGE_MATERIAL_ADAPTER.md`

Suggested new-chat instruction:

> `/returncore /soulcheck Read the material producer handoff in mike-axiom-mir/axm-material-surface-fabric/handoffs/GAME_ASSET_FORGE_MATERIAL_ADAPTER.md and build the Game Asset Forge producer + feedback adapter in this repo's own PR lane. Preserve the Forge AGENTS.md lane/root rules and do not modify Material / Surface Fabric from this chat.`

### FrameState

Use:

- `handoffs/FRAMESTATE_MATERIAL_ADAPTER.md`

Suggested new-chat instruction:

> `/returncore /soulcheck Read the material producer handoff in mike-axiom-mir/axm-material-surface-fabric/handoffs/FRAMESTATE_MATERIAL_ADAPTER.md and build the FrameState producer + feedback adapter in this repo's own PR lane. Preserve FrameState's canonical-vs-realization truth boundary and do not modify Material / Surface Fabric from this chat.`

### Universal Creation

Use:

- `handoffs/UNIVERSAL_CREATION_MATERIAL_ADAPTER.md`

Suggested new-chat instruction:

> `/returncore /soulcheck Read the material producer handoff in mike-axiom-mir/axm-material-surface-fabric/handoffs/UNIVERSAL_CREATION_MATERIAL_ADAPTER.md and build the reverse Asset Atom -> v0.9 material-offer + feedback adapter in this repo's own PR lane. Preserve descriptor-vs-byte truth and do not modify Material / Surface Fabric from this chat.`

## Integration order

Recommended order for first real circulation proof:

1. **Game Asset Forge** — it already owns several explicit native material/PBR authoring paths and can produce a strong real material-family offer.
2. **Universal Creation** — the opposite-direction donor adapter already exists, so a reverse offer adapter creates a clean bidirectional proof.
3. **FrameState** — connect after the interchange is exercised by material-native producers; preserve its especially important canonical-project vs rendered-realization distinction.

This order is pragmatic, not constitutional. Any producer can connect first if its own repo lane is ready.

## Cross-repo stop condition

The exchange experiment becomes meaningfully closed-loop when at least one producer demonstrates:

`producer canonical/source material state -> v0.9 offer -> receiver byte verification -> Surface Fabric renderer/evaluation -> v0.9 feedback -> producer feedback reader`

with no hidden runtime coupling and no automatic canonical rewrite on either side.

## Root invariant

The Surface Fabric is a receiving/evaluation/reuse floor, not a central owner of other machines' state. Producer machines remain sovereign over their own canonical state; feedback is evidence, not authority.
