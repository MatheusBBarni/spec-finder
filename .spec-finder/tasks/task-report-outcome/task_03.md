---
status: completed
title: Harden Transcript Metadata Projection
type: frontend
complexity: medium
dependencies:
  - task_01
---

# Task 03: Harden Transcript Metadata Projection

## Overview

Make transcript projection treat session-info as metadata rather than provider
content, while preserving a useful bounded diagnostic path for genuinely
unrecognized updates. This task establishes the pure display safety helpers
that cockpit state will reuse without creating a general lifecycle framework.

## Source Artifacts

- PRD: `.spec-finder/tasks/task-report-outcome/_prd.md`
- TechSpec: `.spec-finder/tasks/task-report-outcome/_techspec.md`

<critical>
- Read `.spec-finder/tasks/task-report-outcome/_prd.md`, `.spec-finder/tasks/task-report-outcome/_techspec.md`, ADRs `adr-001-phase-aware-report-outcomes.md`, `adr-002-verified-report-completion-rollout.md`, and `adr-003-additive-report-presentation-contract.md`, repository instructions, and current Git state before editing.
- Treat this task as canonical execution position `task_03`; complete `task_01` first because it defines the phase consumed by transcript projection.
- Use `sf-memory`; read `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `.spec-finder/tasks/task-report-outcome/memory/task_03.md` before editing and update both with factual learnings before finishing.
- Implement only transcript normalization, its pure display-safety helpers, and focused tests. Do not add store state, App layout, or engine path authority here.
- Reference TechSpec sections `Data and Control Flow`, `Failure and Recovery Behavior`, `Security and Privacy`, and `Testing and Evidence` instead of duplicating architecture.
- Run focused tests and the exact repository verification gate to terminal exit. Do not change lifecycle status or write `reports/task_03.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST drop report-phase `session_info_update` entries entirely so title, timestamp, `_meta`, prompt text, and absolute paths cannot become transcript content (G-02, F-04, M-01).
2. MUST render implementation-phase or phase-missing session-info only as a fixed payload-free metadata label; it MUST not fall through to generic raw serialization (G-02, F-04).
3. MUST retain a readable fallback for unrelated unknown updates while excluding `_meta`, using deterministic ordering, redacting common POSIX/Windows-drive/UNC absolute paths, neutralizing C0/DEL/escape controls, and truncating at 1,024 display characters with a marker (US-04, F-04, M-01).
4. MUST preserve existing message, thought, tool, plan, and capability-update behavior and expose only a narrow reusable display formatter for task_04 (G-04, TechSpec Compatibility).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-02, US-04, F-04, M-01 | Remove raw report metadata while keeping safe unknown diagnostics. | Transcript adversarial payload cases. |
| G-04 | Preserve recognized ACP category behavior and task-local history identity. | Existing message/tool/plan regression assertions. |
| TechSpec: Security and Privacy | Centralize bounded/redacted/control-safe presentation. | Exact absence, redaction, and truncation assertions. |
| TechSpec: Integration Points | Accept the optional event phase without session-ID inference. | Report/implementation/missing-phase session-info cases. |

## Subtasks

- [ ] 03.1 Extend pure session-update projection to accept optional turn phase.
- [ ] 03.2 Add the report and non-report session-info presentation branches without serializing metadata fields.
- [ ] 03.3 Replace unbounded unknown serialization with deterministic bounded, path-redacted, control-safe formatting.
- [ ] 03.4 Cover malicious session-info, unrelated unknown payloads, and all existing recognized categories.

## Implementation Details

Keep this work inside the pure transcript projection seam. The phase is local
event context from task_01, not a provider claim. Use small pure helpers so
task_04 can safely format interactive task activity without duplicating path or
control handling. Do not alter ACP schema, engine lifecycle, report prose, or
status ownership.

### Relevant Files

- `src/ui/transcript.ts` — phase-aware session-info handling and safe fallback helpers.
- `tests/transcript.test.ts` — deterministic transcript transformation and regression coverage.

### Dependent Files

- `src/ui/store.ts` — task_04 passes phase and reuses the narrow display formatter.
- `src/ui/App.tsx` and `tests/cockpit.test.tsx` — task_05 renders the projected entries.
- `src/acp-client.ts` — task_01 provides phase on the incoming event.

### Related ADRs

- [ADR-001: Phase-Aware Report Outcomes](adrs/adr-001-phase-aware-report-outcomes.md) — metadata is not report content.
- [ADR-003: Additive Report Presentation Contract](adrs/adr-003-additive-report-presentation-contract.md) — fail-closed session-info and bounded fallback policy.

## Deliverables

- Phase-aware, payload-safe transcript projection.
- Bounded/redacted/control-safe formatting helper limited to cockpit display use.
- Focused transcript regression suite for recognized and adversarial updates.
- Updated `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `memory/task_03.md` with factual durable context.
- `reports/task_03.md` produced by Spec Finder's report phase.

## Tests

### Unit Tests

- [ ] Given a report-phase `session_info_update` containing a report prompt, root path, `_meta`, controls, and oversized title, append no transcript entry and expose none of its payload.
- [ ] Given implementation-phase or phase-missing session-info, append only the fixed metadata label with no title, timestamp, path, or extension content.
- [ ] Given an unrelated unknown update containing POSIX, Windows-drive, and UNC paths plus ESC/C0/DEL characters and more than 1,024 characters, retain a labelled, redacted, neutralized, visibly truncated fallback.
- [ ] Given existing message, thought, tool, plan, capability, and cyclic structured values, preserve current output and identity behavior.

### Integration Tests

- [ ] Confirm updates sharing a provider session ID remain correctly projected when their explicit phases differ across implementation and report turns.

### Platform or Manual Evidence

- [ ] Not applicable: transcript logic is deterministic pure TypeScript and receives rendered-frame proof in task_05.

### Verification Commands

- `rtk bun test tests/transcript.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Report metadata cannot leak through transcript projection.
- Unrelated unknown activity remains bounded and readable without raw control/path content.
- Existing normalized ACP categories retain their current behavior.
- Focused tests and repository verification pass to terminal exit; memory is current and `reports/task_03.md` is ready for the report phase.
- Changed testable logic reaches at least 80% coverage when measurable; this repository has no coverage threshold tool, so record scenario coverage when a percentage is unavailable.
