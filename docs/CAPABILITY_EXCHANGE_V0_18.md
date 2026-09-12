# v0.18 — Capability Exchange / Downstream Use

v0.18 extends Material / Surface Fabric beyond internal technical survival and pattern recurrence.

The new path is:

`material / sprite / recipe / pattern state -> axm-material-capability-pack/v0.18.0 -> downstream adapter -> explicit axm-material-use-feedback/v0.18.0 -> local usage ledger`

The goal is not to turn use counts into taste. The goal is to preserve a missing kind of evidence: **what another machine actually reports consuming, validating, rendering, adopting, modifying, rejecting, or reusing**.

## Contracts

### `axm-material-capability-pack/v0.18.0`

A pack contains deterministic capability entries with stable identities and source provenance. Supported capability kinds are:

- `material-entry`
- `material-family`
- `sprite-candidate`
- `recipe`
- `pattern`

A capability may contain portable image bytes when those bytes already exist in its source material-library entry. Descriptor-only state remains descriptor-only.

Supported source artifacts include:

- `axm-material-library/v0.4.0`
- `axm-premade-sprite-index/v0.14.0`
- `axm-premade-sprite-index-set/v0.14.0`
- `axm-premade-composition/v0.12.0`
- `axm-premade-recipe-pack/v0.13.0`
- `axm-premade-pattern-library/v0.15.0`
- `axm-premade-guided-composition-receipt/v0.16.0`
- `axm-premade-closed-loop-session/v0.17.0`
- `axm-premade-memory-update-receipt/v0.17.0`

For a v0.17 closed-loop session, only descendants carrying an explicit positive keeper decision are exported as recipe capabilities.

### `axm-material-use-feedback/v0.18.0`

Feedback is tied to the exact capability-pack ID and fingerprint. Every event references one exact capability ID.

Allowed actions:

- `inspected`
- `validated`
- `rendered`
- `adopted`
- `modified`
- `rejected`
- `reused`

Allowed outcomes:

- `PASS`
- `HOLD`
- `REJECT`

Events may carry intentionally exported evidence such as downstream asset IDs, renderer receipts, validation state, derived IDs, or rejection reasons.

### `axm-material-use-ledger/v0.18.0`

The ledger is local producer-side evidence state. It aggregates imported feedback by exact capability ID:

- event count
- unique downstream consumers
- action counts
- PASS/HOLD/REJECT counts
- explicit adoption count
- explicit reuse count
- rejection count
- last imported evidence

Applying the same feedback receipt twice is idempotent and does not inflate counts.

## Headless CLI

```bash
node tools/material-capabilities.js pack artifact-a.json artifact-b.json --out capability-pack.json
node tools/material-capabilities.js check-pack capability-pack.json
node tools/material-capabilities.js feedback capability-pack.json events.json --consumer "AXM Universal Creation" --repository mike-axiom-mir/axm-universal-creation --out feedback.json
node tools/material-capabilities.js check-feedback feedback.json capability-pack.json
node tools/material-capabilities.js apply feedback.json capability-pack.json --out use-ledger.json
node tools/material-capabilities.js summary use-ledger.json
```

The `feedback` command exists primarily for downstream adapter development and testing. A producer should not invent downstream-use events for itself.

## Browser — Panel 19

Panel 19 can:

- import supported source artifacts;
- build and export one deterministic capability pack;
- import an existing capability pack;
- import feedback only after the exact source pack is loaded;
- validate pack/feedback linkage;
- aggregate imported feedback into a local usage ledger;
- display downstream adoption/reuse/rejection/HOLD evidence;
- export the ledger for later analysis or handoff.

The browser does **not** auto-generate positive feedback and does **not** route usage counts into keeper or pattern-memory authority.

## Truth boundary

v0.18 can claim:

- deterministic capability identities;
- source-artifact provenance;
- exact capability-pack linkage for feedback;
- explicit downstream action/outcome evidence;
- idempotent usage aggregation;
- preservation of rejection and HOLD evidence.

v0.18 cannot claim:

- that export means use;
- that adoption means aesthetic superiority;
- that reuse proves physical correctness;
- that a high use count is universal quality;
- that absence of feedback means non-use;
- that downstream evidence grants automatic keeper, memory, merge, or CANON authority.

## Root mapping

**Truth** — internal technical health, recurrence, and downstream use are separate evidence classes.

**Agency / non-domination** — consumers decide what they adopt; the producer does not manufacture positive use evidence and imported evidence does not silently rewrite producer state.

**Continuity** — pack IDs, capability IDs, consumer identity, feedback IDs, action evidence, and derived IDs preserve traceable lineage.

**Wisdom before speed** — real downstream reuse can inform future work without pretending to be a hidden taste score.
