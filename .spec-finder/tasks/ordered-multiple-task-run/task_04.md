---
status: pending
title: Integrate Batch Command Routing and Terminal Results
type: backend
complexity: high
dependencies:
  - task_02
  - task_03
---

# Task 04: Integrate Batch Command Routing and Terminal Results

## Overview

Route the new batch mode through the command layer while leaving the existing single-slug branch behaviorally unchanged. The batch invocation must use one shared controller, store, renderer/listener lifecycle, deterministic terminal output, and aggregate exit mapping for success, failure, cancellation, and preflight failure.

## Source Artifacts

- PRD: `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`
- TechSpec: `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`, `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`, all three packet ADRs, repository instructions, current Git state, and completed dependencies `task_01` through `task_03` before editing.
- Treat `task_02` and `task_03` as required lower-numbered dependencies; do not bypass their parser, coordinator, event, or store contracts.
- Use `sf-memory`; read `.spec-finder/tasks/ordered-multiple-task-run/memory/MEMORY.md` and `.spec-finder/tasks/ordered-multiple-task-run/memory/task_04.md` before editing and update them before finishing.
- Implement only command routing and terminal presentation. Preserve unrelated UI changes and the existing single-slug branch; do not redesign the cockpit here.
- Reference TechSpec sections `CLI contract`, `Integration Points`, `Failure and Recovery Behavior`, and `Observability`.
- Run focused tests and the repository verification gate to terminal exit. Do not mark status complete or write `reports/task_04.md`.
</critical>

<requirements>
1. MUST route exactly the validated batch grammar to the coordinator and preserve the current single-slug path and event behavior (G-04, US-06, C-01).
2. MUST create one shared `AbortController`, effective config, store, and renderer/listener lifecycle per invocation (F-02, C-02).
3. MUST emit concise `--no-ui` packet progress/outcomes, stopping packet, later not-started packets, and no-retry recovery guidance (US-03, US-04, F-04, C-04).
4. MUST return exit `0` only for all-success/already-complete aggregate results and exit `1` for preflight failure, failure, or cancellation (US-05, F-06).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-04, US-06, C-01 | Preserve singular command branch | Command regression tests |
| G-01, US-01, F-02 | Invoke coordinator in declared order | Injected command/coordinator harness |
| US-03, US-04, F-04 | Print stop boundary and manual recovery | Exact console output assertions |
| US-05, F-06 | Aggregate exit mapping | Command result tests |
| TechSpec: Observability | Deterministic no-UI lifecycle output | Console listener tests |

## Subtasks

- [ ] 04.1 Replace unsafe batch-mode slug discovery with the validated parser while retaining the legacy single-run route.
- [ ] 04.2 Wire one shared controller/configuration and batch event listener to the coordinator, with existing renderer cleanup in `finally`.
- [ ] 04.3 Format no-UI packet start/outcome, failure/cancellation, not-started, no-retry, and aggregate messages.
- [ ] 04.4 Map aggregate results to process exit codes and preserve existing single-run exit behavior.
- [ ] 04.5 Add command-level tests for routing, flags, output, exits, and single-run regression.

## Implementation Details

Current `runCommand` uses `args.find((arg) => !arg.startsWith("-"))`, which can mistake option values for slugs. The batch branch must parse explicitly and reject positional slugs. Keep one store/renderer/controller per invocation. The batch listener must not forward nested packet lifecycle events as legacy `run_started`/`run_finished`; use the additive events from `task_03`.

### Relevant Files

- `src/commands.ts` — batch routing, shared lifecycle, terminal listener, and exit mapping.
- `tests/commands.test.ts` — extend with batch parser/routing/output tests while preserving setup tests.
- `src/batch.ts` — coordinator import and event/result contract consumer.
- `src/ui/cockpit.tsx` — existing renderer lifecycle reference; change only if command integration exposes a bounded cleanup issue.

### Dependent Files

- `src/ui/App.tsx` — consumes the store state in `task_05`.
- `src/cli.tsx` and `README.md` — document the public command in `task_06`.

### Related ADRs

- [ADR-001: Ordered Multi-Packet Run Coordinator](adrs/adr-001-ordered-multiple-task-run.md) — shared lifecycle and fail-safe command.
- [ADR-003: Coordinator Batch Envelope and Active Projection](adrs/adr-003-coordinator-batch-envelope-active-projection.md) — additive event compatibility.

## Deliverables

- Batch command routing and aggregate exit behavior.
- Deterministic no-UI output and command tests.
- Factual shared and `task_04` memory updates.
- `reports/task_04.md` produced by the report phase.

## Tests

### Unit Tests

- [ ] Valid batch flags route to the coordinator and preserve slug order.
- [ ] Positional slugs, duplicate `--multiple`, and malformed lists fail before renderer/provider start.
- [ ] All-success returns `0`; preflight failure, failure, and cancellation return `1`.
- [ ] No-UI output names packet outcomes, stopping packet, later not-started packets, and no automatic retry.

### Integration Tests

- [ ] Existing single-slug command tests and current setup command tests remain passing.
- [ ] Renderer close executes after batch success, failure, cancellation, and thrown preflight errors.

### Platform or Manual Evidence

- [ ] Run one non-interactive three-packet sequence and capture terminal output for the release report.

### Verification Commands

- `rtk bun test ./tests/commands.test.ts ./tests/batch.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Batch mode is opt-in and cannot regress single-slug parsing.
- Terminal output and exit codes are truthful for every aggregate outcome.
- Shared cancellation and renderer cleanup are preserved.
- Focused tests and repository verification pass to terminal exit with no unrelated changes.
