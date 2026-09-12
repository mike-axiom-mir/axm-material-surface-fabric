# Material Exchange Producer Handoffs

These files exist so the producer-side adapters can be built in each standalone repository's **own persistent repo chat / PR lane** without losing the v0.9 receiver contract or repeating discovery work.

## Receiver and verifier already implemented

Material / Surface Fabric accepts:

- `axm-material-offer / v0.9.0`
- `axm-material-feedback / v0.9.0`

The browser receiver can independently verify portable payload bytes, preserve metadata-only/HOLD state, install explicitly into the reusable library, stage exact channel state into the Influence Lab, drive the WebGL/evaluation path, and return bounded feedback.

v0.10 additionally provides a headless producer/CI conformance target:

```bash
node tools/material-conformance.js check-material-offer OFFER.json
node tools/material-conformance.js check-material-feedback FEEDBACK.json --offer OFFER.json
```

A producer adapter should run the offer check before handing a packet to Surface Fabric whenever practical. `PASS` proves contract/available-byte integrity only; it is not material-quality approval. `HOLD` must stay visible.

Canonical documentation:

- `docs/CROSS_MACHINE_MATERIAL_EXCHANGE_V0_9.md`
- `docs/MATERIAL_EXCHANGE_CONFORMANCE_V0_10.md`

## Producer lanes

### Game Asset Forge

Use:

- `handoffs/GAME_ASSET_FORGE_MATERIAL_ADAPTER.md`

Suggested repo-chat instruction:

> `/returncore /soulcheck Read the material producer handoff in mike-axiom-mir/axm-material-surface-fabric/handoffs/GAME_ASSET_FORGE_MATERIAL_ADAPTER.md and build the Game Asset Forge producer + feedback adapter in this repo's existing persistent lane. Validate emitted offers against the v0.10 headless conformance harness. Preserve the Forge AGENTS.md/root rules and do not modify Material / Surface Fabric from that repo lane.`

### FrameState

Use:

- `handoffs/FRAMESTATE_MATERIAL_ADAPTER.md`

Suggested repo-chat instruction:

> `/returncore /soulcheck Read the material producer handoff in mike-axiom-mir/axm-material-surface-fabric/handoffs/FRAMESTATE_MATERIAL_ADAPTER.md and build the FrameState producer + feedback adapter in this repo's existing persistent lane. Validate emitted offers against the v0.10 headless conformance harness. Preserve FrameState's canonical-vs-realization truth boundary and do not modify Material / Surface Fabric from that repo lane.`

### Universal Creation

Use:

- `handoffs/UNIVERSAL_CREATION_MATERIAL_ADAPTER.md`

Suggested repo-chat instruction:

> `/returncore /soulcheck Read the material producer handoff in mike-axiom-mir/axm-material-surface-fabric/handoffs/UNIVERSAL_CREATION_MATERIAL_ADAPTER.md and build the reverse Asset Atom -> v0.9 material-offer + feedback adapter in this repo's existing persistent lane. Validate emitted offers against the v0.10 headless conformance harness. Preserve descriptor-vs-byte truth and do not modify Material / Surface Fabric from that repo lane.`

## Integration order

Recommended order for the first real circulation proof:

1. **Game Asset Forge** — it already owns several explicit native material/PBR authoring paths and can produce a strong real material-family offer.
2. **Universal Creation** — the opposite-direction donor adapter already exists, so a reverse offer adapter creates a clean bidirectional proof.
3. **FrameState** — connect after the interchange is exercised by material-native producers; preserve its especially important canonical-project vs rendered-realization distinction.

This order is pragmatic, not constitutional. Any producer can connect first if its own repo lane is ready.

## Cross-repo stop condition

The exchange experiment becomes meaningfully closed-loop when at least one producer demonstrates:

`producer canonical/source material state -> v0.9 offer -> v0.10 conformance -> receiver byte verification -> Surface Fabric renderer/evaluation -> v0.9 feedback -> v0.10 feedback round-trip check -> producer feedback reader`

with no hidden runtime coupling and no automatic canonical rewrite on either side.

## Root invariant

The Surface Fabric is a receiving/evaluation/reuse floor, not a central owner of other machines' state. Producer machines remain sovereign over their own canonical state; conformance and feedback are evidence, not authority.
