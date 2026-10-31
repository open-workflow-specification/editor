---
"@openworkflowspec/diagram-editor": minor
---

Show workflow-level validation errors in the side-panel edit form: field and level highlights, footer counter, and only unplaced errors in the errors section. `validateWorkflow` now also validates every top-level task against its task schema, so errors in tasks the SDK does not reach are reported.
