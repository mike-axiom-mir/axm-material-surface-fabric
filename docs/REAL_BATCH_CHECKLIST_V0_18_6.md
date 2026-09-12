# Real batch check order

When the real large asset batch arrives, run evidence in this order:

1. `npm run material:payload -- audit ...` — byte/container integrity.
2. `npm run material:batch -- analyze ...` — family/channel/batch routing readiness.
3. `npm run material:signal -- audit ...` — bounded pixel-signal diagnostics.
4. Only after those structural checks, perform actual renderer/game visual comparison.

Do not use a PASS from steps 1–3 as proof that an asset looks good. A technically healthy but visually weak asset is a valid and important outcome; it points the next work toward the visual-generation capability itself rather than transport, metadata or map plumbing.
