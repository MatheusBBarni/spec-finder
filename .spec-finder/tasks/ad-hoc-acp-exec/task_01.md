---
status: pending
title: Freeze Packet ACP Behavior and Define Neutral Turn Contracts
type: refactor
complexity: medium
dependencies: []
---

# Task 01: Freeze Packet ACP Behavior and Define Neutral Turn Contracts

## Overview

Define the task-neutral ACP lifecycle, host-access, permission, supervisor, event, and result contracts while freezing the packet-visible behavior that later extraction must preserve. This produces a typed shared seam and independently testable regression baseline without separating tests from their contract implementation.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; it has no dependencies and later tasks must consume these neutral contracts rather than redefine them.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_01.md` before editing and update memory before finishing.
- Implement only neutral contracts and packet-visible regression coverage. Do not extract the ACP implementation, change packet semantics, harden packet host access, or implement exec behavior here.
- Reference TechSpec sections `Core Interfaces`, `ACP Lifecycle`, `Integration Points`, and `Development Sequencing` instead of duplicating interface definitions.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write `reports/task_01.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST create task-neutral turn, event, outcome, host-access, permission, and supervisor contracts that contain no task IDs, packet events, cockpit state, or terminal rendering policy (ADR-003; TechSpec Core Interfaces).
2. MUST freeze the current packet-facing initialization, session, prompt, runtime-option, permission, event, and result behavior before later extraction (G-05, US-07, M-07).
3. MUST prove successful packet execution still owns separate implementation and report turns without treating host lexical containment or direct-child cleanup as desired new contracts (F-07, HC-09, HC-12).
4. SHOULD keep the neutral seam minimal and dependency-injectable so workspace, permission, process, and output tasks can implement it independently.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-05, US-07, F-07 | Preserve packet workflow ownership and behavior | Frozen ACP and engine regression tests |
| HC-09, HC-12, M-07 | Prevent history/compatibility regressions | Existing suite plus new lifecycle counters |
| TechSpec: Core Interfaces | Establish the task-neutral seam | TypeScript compilation and contract imports |
| ADR-003 | Keep packet adapters outside the shared core | Contract review and dependency assertions |

## Subtasks

- [ ] 01.1 Define the minimal task-neutral contracts in the new ACP turn module.
- [ ] 01.2 Extend the mock agent with deterministic lifecycle counters required by packet regression tests.
- [ ] 01.3 Freeze packet-facing ACP events, permission outcomes, runtime options, and terminal stop behavior.
- [ ] 01.4 Freeze successful implementation/report turn ownership in the packet engine.
- [ ] 01.5 Run focused and repository-wide verification to establish the pre-extraction baseline.

## Implementation Details

Use the approved TechSpec's shared-core boundary as the source of truth. The new module contains contracts only at this stage; `runAcpTurn` remains the active implementation until task_05. Baseline assertions should cover externally consumed packet behavior while avoiding assertions that would prevent the approved containment and cleanup fixes.

### Relevant Files

- `src/acp-turn.ts` — create; task-neutral contracts consumed by later implementation tasks.
- `tests/acp-client.test.ts` — current packet-facing ACP behavior to freeze.
- `tests/engine.test.ts` — packet implementation/report lifecycle ownership to freeze.
- `tests/fixtures/mock-agent.ts` — deterministic fixture counters and observations.

### Dependent Files

- `src/acp-client.ts` — task_05 adapts the existing packet API to the neutral core.
- `src/engine.ts` — must continue consuming the packet adapter without behavior changes.
- `src/events.ts` — packet-shaped events remain outside the neutral contracts.
- `src/ui/store.ts` — downstream packet event consumer protected by the baseline.

### Related ADRs

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — preserves the distinct packet-free exec direction.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — requires neutral contracts and a packet compatibility adapter.

## Deliverables

- Task-neutral ACP turn contracts in `src/acp-turn.ts`.
- Packet-visible ACP and engine regression coverage with deterministic fixture observations.
- Updated `memory/MEMORY.md` and `memory/task_01.md` when warranted.
- `reports/task_01.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] Given the neutral contract module, importing it does not require packet events, task files, cockpit state, or process-global streams.
- [ ] Given each existing packet permission mode, the frozen result and emitted packet-facing events remain unchanged.
- [ ] Given advertised runtime options, model/reasoning/speed outcomes retain their current packet contract.

### Integration Tests

- [ ] Given one successful task, the engine performs one implementation turn and one report turn and only completes after a substantive report.
- [ ] Given the mock provider lifecycle, initialization, session creation, and prompt counts match the current packet behavior.

### Platform or Manual Evidence

- [ ] Not applicable beyond Bun integration tests; process-tree certification belongs to tasks 04 and 09.

### Verification Commands

- `rtk bun test ./tests/acp-client.test.ts ./tests/engine.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Neutral contracts compile without packet or UI ownership.
- Packet-visible lifecycle behavior has named regression evidence.
- Focused tests and the repository gate pass to terminal exit.
- Coverage reaches 80% for new testable contract helpers when measurable.
- No unrelated behavior or files change.
- Memory is current and the final report records exact evidence and unresolved risks.
