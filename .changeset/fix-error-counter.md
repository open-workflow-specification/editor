---
"@openworkflowspec/diagram-editor": patch
---

Fix the footer error counter so it matches the errors the form shows:

- Field-level errors found on blur before Apply are counted, and dropped when the field is removed or its variant is switched.
- One mistake is counted once: errors that only repeat what another `oneOf` branch reports, or summarise an error below them, are no longer counted. A `oneOf` error reporting that several branches matched is still counted.
- The count no longer changes when a field is blurred without a change: errors are seeded on open with the same task-level validation every later change runs. Errors only the workflow validation finds, such as an unresolved transition target, are kept next to the form's own and stay until the user edits their field, so a task the diagram marks as invalid still shows its errors.
- An inline error no longer stays on a field after the count drops it, because errors present on open are now recorded like any other validation error.
- String lists and switches show their field error below the control. A switch re-validates when it is toggled.
- The Try and Catch nodes show the errors of their try/catch task, matching the outer node.
- An emptied required container (e.g. `wait: {}`) reports what is wrong inside it instead of "must have required property 'wait'".
- Unknown properties and section-level errors are unchanged: unknown properties stay out of the counter, and section-level errors are still only found on Apply.
