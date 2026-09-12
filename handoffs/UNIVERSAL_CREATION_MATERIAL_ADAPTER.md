# Handoff — Universal Creation -> Material / Surface Fabric

Target producer repo:

`mike-axiom-mir/axm-universal-creation`

Receiver contract:

`axm-material-offer / v0.9.0`

Feedback contract:

`axm-material-feedback / v0.9.0`

## Existing connection

Universal Creation already has the **opposite-direction** detached bridge:

`Material / Surface donor pack -> Universal Creation Asset Atom texture/material descriptors`

That adapter validates explicit channel hints, decodes portable data URLs, hashes bytes, maps declared families into existing Asset Atom material descriptors, and keeps ambiguous state on HOLD instead of guessing.

The v0.9 producer adapter should therefore be the reverse interchange surface:

`Universal Creation explicit Asset Atom material state -> v0.9 material offer -> Surface Fabric evaluation -> feedback -> Universal Creation feedback reader`

Do not simply invert the old adapter mechanically. Export only what Universal Creation actually has enough evidence to materialize.

## Build target

Create a detached exporter beside the existing material donor tooling, for example:

`src/axm_uc/material_offer.py`

with a simple explicit CLI under `tools/`.

Input should be one validated `axm.asset-atom-package/v0.1` or another explicitly supported Universal Creation material state.

The exporter should:

1. validate the source package through the existing Asset Atom validator;
2. locate explicitly referenced texture/material atoms;
3. preserve source package/material/texture atom IDs;
4. map only explicit Asset Atom channels;
5. include exact resource bytes only when they are actually available to the adapter;
6. hash the exact exported bytes;
7. preserve URI/digest descriptor state even when bytes are unavailable;
8. emit one or more explicit families based on actual material `texture_bindings`.

## Descriptor-only resources

Universal Creation may have texture resource descriptors such as URI + digest without locally available bytes.

Those should **not** be fabricated into data URLs.

Export them as metadata-only offer entries with:

- producer entry ID
- channel
- resource URI
- producer digest
- source package/material relationship
- no `dataUrl`

Surface Fabric will retain them as HOLD/metadata-only until portable bytes exist.

## Byte-backed resources

When the adapter can resolve exact bytes from a local resource path or supported source:

- include the exact image as `dataUrl`;
- include the MIME type;
- compute a fresh `sha256:<64 hex>` over the exported bytes;
- retain the original Universal Creation resource digest separately in `source`/`evidence`;
- fail or HOLD if a declared source digest conflicts with resolved bytes.

Do not claim that descriptor compatibility proves rendering or PBR correctness.

## Family mapping

A Universal Creation material atom with explicit `texture_bindings` is a natural v0.9 family candidate.

Preserve:

- material atom ID
- package ID/version
- each texture atom ID
- binding channel -> texture relationship
- package provenance/limitations

Standalone texture atoms not bound to a material may be exported either as one-entry families or as ungrouped entries, but the choice must be explicit and tested.

## Feedback intake

Add a detached feedback reader that accepts `axm-material-feedback/v0.9.0` and reports:

- source offer/family reference;
- receiver payload verification;
- v0.8 renderer/evaluation evidence;
- install status if any;
- held/unknown state.

Feedback must not alter Asset Atom packages, live capabilities, creation state, or machine anatomy automatically. It is external evidence for a later explicit creation/evolution decision.

## Suggested first proof

Use the same small painted-metal style Asset Atom fixture already used by the material donor adapter, but now run the direction in reverse.

Ideal proof:

`Asset Atom material package -> v0.9 offer -> Surface Fabric verify/evaluate -> feedback -> Universal Creation feedback reader`

Then add a second test where one resource has only URI/digest and no bytes to prove metadata-only HOLD behavior.

## Tests

At minimum test:

- source package validation before export;
- deterministic offer identity;
- exact channel mapping from texture bindings;
- byte-backed SHA-256 evidence;
- descriptor-only resource HOLD export;
- digest conflict behavior;
- family identity/relationship preservation;
- feedback reference validation;
- feedback is non-mutating toward Universal Creation canonical/live state.

## Stop condition

The first reverse adapter is complete when one real validated Asset Atom material package can round-trip through Surface Fabric and return feedback without losing package/material/texture identity or pretending URI-only resources were portable bytes.

## Roots

- **Truth:** descriptor state, resolved bytes, receiver verification and render observations remain separate evidence planes.
- **Agency:** export and feedback consumption are explicit detached actions.
- **Continuity:** package/atom IDs, resource digests, offer fingerprint and feedback references survive the round trip.
- **Wisdom before speed:** do not promote the reverse bridge into live topology merely to make the integration look complete.
