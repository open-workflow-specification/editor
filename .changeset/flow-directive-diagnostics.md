---
"@openworkflowspec/language-service": minor
---

Report a `then` that names no task in its task list. The schema accepts any string there, but the diagram cannot be drawn (or, in an extension's `before`/`after`, the workflow fails at runtime), so the text editor now marks it.
