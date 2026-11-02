---
"@openworkflowspec/text-editor": patch
---

Fix JSON Schema diagnostics failing silently in production builds by using `minify: "esbuild"` instead of the Oxc default.
