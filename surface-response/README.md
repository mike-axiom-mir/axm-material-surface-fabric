# AXM Surface Response Organs

This directory preserves the user-supplied material-response update as a standalone, inspectable capability layer.

It adds eight reusable response behaviors above texture/channel data: subsurface, sheen, anisotropy, clear coat, micro-breakup, transmission, iridescence, and wear layering. The 13-family response pack composes those behaviors into bounded examples such as living skin, velvet, brushed metal, automotive paint, marble, glass, leaf, ceramic, and worn rubber.

The interactive `material-lab.html` is a reference host, not the repository's production renderer. Evidence earned there applies to that host only. Downstream adapters must reset evidence to `declared_contract_match_not_tested` until they bind and test the same behavior themselves.

Texture maps and response organs are complementary: maps carry spatial values; organs carry view/light/layer behavior that cannot always be faithfully baked into static maps.

Files:
- `axm-material-response-pack.json` — 13 reusable response families.
- `organs.json` — eight bounded organ contracts.
- `material-response.schema.json` — shape/evidence contract.
- `material-lab.html` — zero-dependency interactive reference host.
- `PROVENANCE.md` — source hashes and evidence boundary.
- `REFERENCE_VERIFICATION.md` — measured 8/8 reference-host result from the supplied package.
