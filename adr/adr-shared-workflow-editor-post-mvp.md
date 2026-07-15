<!--
   Copyright 2021-Present The Open Workflow Specification Authors

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
-->

# ADR: Post-MVP Roadmap for the Open Workflow Editor

**Status:** Proposed

> This ADR sets out the **post-MVP roadmap** for the Open Workflow editor - how it grows from the existing read-only viewer into a full visual authoring tool. The MVP (read-only visualisation) is covered by the prior [ADR](https://github.com/open-workflow-specification/specification/blob/main/adr/v1.0-adr-shared-workflow-editor.md) and assumed here as the starting point.

## Purpose

The purpose of this ADR is to **align the community on the planned phases and release sequence** for the editor beyond the MVP, and to gather feedback before work proceeds.

It is intentionally a roadmap, not a schedule: **no delivery dates or effort estimates are committed here**. Sequencing reflects dependency and risk; timing depends on resources and priorities. Tooling choices (e.g. the embedded code editor) are likewise left open for community input.

## Context

The MVP is a read-only diagram viewer: it renders a workflow from YAML/JSON and surfaces validation errors, and is published as an embeddable package. This ADR covers what comes **after** that - turning the viewer into an editor.

## Decision

Grow the read-only editor into a **full visual authoring tool**, delivered **incrementally** - releasing usable value at every phase rather than waiting for a "complete" product. Editing capabilities are layered on in safe, shippable phases, each building on the last.

Two principles guide the design:

1. **The text (YAML/JSON) is the source of truth.** The diagram is a view of the text. Edits made on the diagram are written back into the text.
2. **Release after every phase.** Each phase below stands on its own and delivers real value - nobody waits for the entire roadmap.

## Licensing

- **Apache 2.0** (consistent with Open Workflow specification)
- All dependencies must be CNCF-compatible

## Governance & Community Alignment

- The editor is developed and maintained **as part of the Open Workflow project**, by the community rather than any single vendor.
- A **multi-maintainer model** with representatives from Quarkus Flow/Sonata Flow, Open Workflow Specification maintainers and other interested engine maintainers (e.g Zigflow/Synapse/Lemline etc) following spec governance model.
- The **specification remains the authority**: the editor follows the spec, it does not extend or fork it. Where editor work surfaces gaps or ambiguities, those are raised back to the specification.

## Scope

Post-MVP work runs in two parallel streams.

- **Stream 1 - the editor itself:** growing from read-only viewing toward full visual authoring.
- **Stream 2 - integrations:** embedding the same shared package into the tools people already use (e.g. VS Code extension). This stream is **isolated from Stream 1** - because every target embeds the same package, integration work has no hard dependency on the editing milestones and _can_ proceed in parallel. Whether it actually runs in parallel is purely a question of **available resources and priorities**, not of technical sequencing.

## Milestones

Phases pick up from the existing read-only viewer and are ordered from **safest/simplest to hardest**; each is independently releasable. **No delivery dates are committed here** - sequencing reflects dependency and risk, not a schedule.

### Milestone 1 - Side-by-side text + diagram

A split view: edit the workflow text on one side, see the diagram refresh on the other, with inline validation. Schema-driven authoring assistance (autocomplete / IntelliSense) makes the editor approachable for newcomers and faster for those debugging existing files.

### Milestone 2 - Edit a node

Select an existing node on the diagram and edit it directly; the change is written back to the text. This is the point at which the diagram becomes genuinely editable.

### Milestone 3 - Build & wire the workflow

Construct and reshape the whole workflow visually - add and remove nodes instead of hand-editing nested text. The most complex phase, delivered last once the foundations are solid.

> **On drag-and-drop:** we are **not** planning free-form drag-and-drop canvas editing - it adds disproportionate layout and connection complexity for the value it returns. Instead, structural editing will use a simpler, more constrained interaction (e.g. an explicit add node button), with the exact design **to be confirmed** through dedicated design work.

### Integrations (independent, parallel stream)

The same shared package is embedded into target tools. This work is **self-contained and decoupled** from the Stream 1 milestones - it can start at any point after and run alongside them, but doing so depends entirely on **available people and agreed priorities**, not on reaching a particular editing milestone. Each integration adopts the editor capabilities that make it worthwhile in that context.

## Consequences

**Positive**

- One shared editor, consistent across implementations.
- Reduced duplication - implementations embed instead of rebuild.
- Value released early and often, not gated on a finished product.

**Trade-offs**

- A shared, neutral editor takes longer to reach feature-complete than a single vendor optimising for itself alone.
- Editing arrives in stages, so the most complex authoring features land last.
- Multi-maintainer governance requires coordination and shared decision-making.

## References

- [Prior MVP ADR](https://github.com/open-workflow-specification/specification/blob/main/adr/v1.0-adr-shared-workflow-editor.md)
- [Open Workflow specification](https://github.com/open-workflow-specification/specification)
