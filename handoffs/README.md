# Material Exchange Producer Handoffs

These files exist so producer/consumer-side adapters can be built in each standalone repository's **own persistent repo chat / PR lane** without losing the Material / Surface Fabric contracts or repeating discovery work.

## v0.18 downstream capability exchange

v0.18 adds a broader outward capability contract beside the older material-offer protocol:

- `axm-material-capability-pack / v0.18.0`
- `axm-material-use-feedback / v0.18.0`

A capability pack can carry material entries/families, v0.14 alpha sprite candidates, v0.12 recipes, v0.15 patterns, explicit v0.13 keepers, v0.16 guided recipes, and explicitly kept v0.17 loop descendants.

The downstream machine reports what it actually did using explicit events such as `validated`, `rendered`, `adopted`, `modified`, `rejected`, and `reused`, each with PASS/HOLD/REJECT outcome and exact capability IDs.

Use:

- `handoffs/CAPABILITY_EXCHANGE_ADAPTER_V0_18.md`
- `docs/CAPABILITY_EXCHANGE_V0_18.md`

Suggested downstream repo-chat instruction:

> `/returncore /soulcheck Read mike-axiom-mir/axm-material-surface-fabric/handoffs/CAPABILITY_EXCHANGE_ADAPTER_V0_18.md and build the smallest native v0.18 capability-pack consumer + use-feedback adapter in this repo's existing persistent lane. Preserve this repo's own sovereignty and truth boundaries. Do not auto-adopt source state; return PASS/HOLD/REJECT evidence with exact capability IDs.`

This work belongs in the downstream repository. Material / Surface Fabric owns the export/verification/usage-ledger side only.

## v0.9 receiver and v0.10 verifier already implemented

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

Recommended order for the first real v0.18 use proof:

1. **Universal Creation** — it already consumes Material / Surface state and is a natural first source of actual adoption/reuse evidence.
2. **Game Asset Forge** — material-native state can prove whether texture/sprite/recipe capabilities survive asset production.
3. **FrameState** — realization feedback can prove actual render/use while preserving canonical-vs-realization separation.

This order is pragmatic, not constitutional. Any downstream machine can connect first if its own repo lane is ready.

## Cross-repo stop condition

The broader capability exchange becomes meaningfully exercised when at least one downstream repository demonstrates:

`Surface Fabric capability -> v0.18 pack -> downstream validation/use -> explicit v0.18 feedback -> Surface Fabric feedback validation -> local usage ledger`

with no hidden runtime coupling and no automatic canonical rewrite on either side.

The older material offer loop remains valid independently:

`producer canonical/source material state -> v0.9 offer -> v0.10 conformance -> receiver byte verification -> Surface Fabric renderer/evaluation -> v0.9 feedback -> v0.10 feedback round-trip check -> producer feedback reader`

## Root invariant

Material / Surface Fabric is a receiving/evaluation/reuse/export floor, not a central owner of other machines' state. Producer and consumer machines remain sovereign over their own canonical state; conformance, adoption, rejection, and reuse feedback are evidence, not authority.
