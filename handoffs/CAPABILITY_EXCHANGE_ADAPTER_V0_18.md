# v0.18 Capability Exchange — Downstream Adapter Handoff

This handoff is intentionally producer-agnostic. Build the consumer adapter in the downstream repository's own persistent repo lane.

## Input

Accept exactly:

- `axm-material-capability-pack/v0.18.0`

Validate the pack before use. Do not silently reinterpret unsupported capabilities.

## Consumer behavior

For each capability the adapter may inspect, validate, render, adopt, modify, reject, or reuse it. The consumer remains sovereign over its own canonical state.

If a capability is consumed, preserve its exact capability ID in the downstream provenance/receipt where practical.

If it creates derived state, preserve downstream derived IDs in feedback.

If it cannot use the capability, emit `HOLD` or `REJECT` rather than manufacturing success.

## Output

Return exactly:

- `axm-material-use-feedback/v0.18.0`

Every feedback packet must preserve:

- exact source `packId`
- exact source `packFingerprint`
- consumer system identity
- optional consumer repository / adapter / instance identity
- one or more explicit events referencing exact capability IDs
- action
- PASS/HOLD/REJECT outcome
- intentionally exported evidence only
- optional downstream derived IDs

## Important boundary

A `PASS adopted` or `PASS reused` event means the downstream consumer reports that action occurred. It does not mean the material is beautiful, physically correct, PBR-certified, or universally useful.

A downstream adapter must not ask Material / Surface Fabric to auto-promote the source capability. Feedback is evidence, not authority.

## Suggested first adapters

Universal Creation is a strong first consumer because it already has a detached material donor adapter and now has more texture capability. Game Asset Forge can provide material-native use evidence. FrameState can report actual realization/render use while preserving its canonical-project vs realization boundary.

Those integrations belong in their respective repositories, not this repo lane.

## CLI contract check

A consumer-side test fixture can be built and validated against:

```bash
node tools/material-capabilities.js check-pack capability-pack.json
node tools/material-capabilities.js feedback capability-pack.json events.json --consumer "CONSUMER NAME" --repository owner/repo --out feedback.json
node tools/material-capabilities.js check-feedback feedback.json capability-pack.json
```

The producer-side ledger can later ingest that receipt with:

```bash
node tools/material-capabilities.js apply feedback.json capability-pack.json existing-ledger.json --out next-ledger.json
```
