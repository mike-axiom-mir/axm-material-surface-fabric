# v0.18.1 — Universal Creation Cross-Repo Circulation Proof

This checkpoint exercises the first complete Material / Surface Fabric capability-use loop across two standalone AXM repositories.

The path is:

`Material / Surface Fabric exact v0.18 capability pack -> Universal Creation exact pack validation -> bounded detached adoption -> exact v0.18 use feedback -> Material / Surface Fabric feedback validation -> usage ledger`

## Exact input pack

`examples/circulation/universal-creation/full-circulation-v0.18-capability-pack.json`

Identity:

- pack: `material-capability-pack-756825c8`
- fingerprint: `756825c8`
- producer: `AXM Material / Surface Fabric`

It carries one of every current v0.18 capability kind:

- material entry;
- material family;
- sprite candidate;
- deterministic recipe;
- keeper-derived pattern.

The identical pack is used by Universal Creation's full detached consumer.

## Universal Creation consumer

Universal Creation's bounded full-intake adapter was merged through its own repository lane after its complete PR workflow suite passed.

The consumer does not silently modify live Universal Creation topology or canonical project state.

Its bounded downstream representations are:

- material entry -> validated detached texture Asset Atom;
- material family -> validated detached material Asset Atom;
- sprite candidate -> `axm.uc.material-sprite-candidate/v0.1`;
- recipe -> `axm.uc.material-recipe/v0.1`;
- pattern -> `axm.uc.material-pattern/v0.1`.

Sprite/recipe/pattern intake is descriptor compatibility, not a claim that Universal Creation rendered those states or understood their artistic meaning.

## Exact feedback

`examples/circulation/universal-creation/full-circulation-v0.18-feedback.json`

Identity:

- feedback: `material-use-feedback-4e1937b3`
- consumer adapter: `material-capability-consumer/v0.19.0`

The receipt reports five explicit `PASS adopted` events and preserves downstream derived IDs for every source capability.

The derived IDs include the existing material Asset Atoms plus deterministic detached sprite, recipe, and pattern descriptors.

## Producer-side proof

`tests/cross-repo-circulation.test.js` requires:

1. the input capability pack to pass the Material Fabric v0.18 contract;
2. the Universal Creation feedback packet to pass exact pack/fingerprint/event validation;
3. all five source capabilities to have one explicit `PASS adopted` event;
4. the downstream IDs to survive feedback intake;
5. a fresh Material Fabric usage ledger to record exactly five adopted events, zero rejects, and zero HOLDs;
6. re-applying the identical feedback receipt to be idempotent.

This makes downstream-use evidence machine-checkable instead of a prose claim.

## What this proves

It proves that one versioned capability packet can cross the repository boundary, be consumed into bounded Universal Creation state, return exact feedback, and be accepted into the producer's usage-evidence ledger without hidden runtime coupling.

## What it does not prove

It does not prove:

- aesthetic quality;
- PBR or physical correctness;
- semantic recognition of sprite candidates;
- rendered recipe output;
- that keeper-derived pattern recurrence equals preference;
- live Universal Creation installation;
- automatic producer promotion;
- automatic memory/canon changes in either repository.

The downstream consumer remains sovereign over its state, Material Fabric remains sovereign over its state, and the AXM roots remain the constitutional merge gate.
