---
status: pending
title: Extract the ACP v1 Turn Core and Preserve Packet Semantics
type: refactor
complexity: high
dependencies:
  - task_01
  - task_02
  - task_03
  - task_04
---

# Task 05: Extract the ACP v1 Turn Core and Preserve Packet Semantics

## Overview

Extract ACP v1 negotiation, authentication, session configuration, one prompt, semantic cancellation, optional close, permission settlement, and supervised cleanup into the neutral core. Adapt `runAcpTurn` to preserve the packet contract frozen in task_01 and pin the validated SDK surface exactly.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, current Git state, and completed `task_01` through `task_04` before editing.
- Treat all four lower-numbered tasks as required dependencies; use their contracts, workspace capability, permission broker, and process supervisor rather than recreating them.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_05.md` before editing and update memory before finishing.
- Implement the shared ACP lifecycle and packet adapter only. Do not add exec rendering, CLI routing, provider certification, documentation, or migrate packet host-access policy.
- Reference TechSpec sections `ACP Lifecycle`, `Permission Lifecycle`, `Integration Points`, `Compatibility, Migration, and Rollback`, and `Development Sequencing`.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write `reports/task_05.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST negotiate ACP protocol version 1, authenticate only through advertised methods, create one fresh absolute-cwd session, reconcile complete config-option state, and send exactly one prompt (F-01; ADR-003).
2. MUST send semantic `session/cancel`, settle pending permissions exactly once, continue consuming trailing updates, and use supervised escalation only after the semantic grace expires (F-06, M-06).
3. MUST call `session/close` only when advertised, bound it, and distinguish semantic stop reason from transport/process/cleanup failure.
4. MUST adapt neutral events/results back to the packet-facing `runAcpTurn` behavior frozen in task_01 without importing packet types into the core (G-05, US-07, M-07).
5. MUST pin `@agentclientprotocol/sdk` to exact `1.2.1` and remain on stable ACP v1 root imports (ADR-003; TechSpec ACP Lifecycle).
6. SHOULD preserve current packet runtime-option and permission behavior while making exec-specific policies injectable for task_08.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-04, US-05, F-06 | Semantic cancellation and supervised cleanup | Cancellation/permission/cleanup fixture matrix |
| G-05, US-07, M-07 | Preserve packet semantics | Frozen task_01 suite through the adapter |
| HC-09, HC-12 | Keep packet/history ownership outside core | Import and behavior assertions |
| ADR-003 / TechSpec: ACP Lifecycle | One stable v1 lifecycle owner | Protocol, auth, config, prompt, close tests |

## Subtasks

- [ ] 05.1 Move v1 initialize/auth/session/config/prompt behavior into the neutral core.
- [ ] 05.2 Implement semantic cancellation, trailing-update handling, permission settlement, and bounded optional close.
- [ ] 05.3 Integrate canonical host access and supervised process cleanup through injected contracts.
- [ ] 05.4 Rebuild `runAcpTurn` as the packet compatibility adapter and pass the frozen baseline.
- [ ] 05.5 Expand the mock agent for version, auth, config replacement, close, cancellation, and stop-reason modes.
- [ ] 05.6 Pin SDK 1.2.1 and run focused/full verification.

## Implementation Details

Keep task IDs, `RunEvent`, cockpit policy, and stdout/stderr rendering out of `src/acp-turn.ts`. The packet adapter remains responsible for resolving the existing packet launch, translating neutral activity/updates, and retaining packet permission behavior. The core retains raw stop reasons and cleanup outcomes so later exec mapping can remain truthful.

### Relevant Files

- `src/acp-turn.ts` — implement the neutral ACP v1 lifecycle.
- `src/acp-client.ts` — packet-facing compatibility adapter.
- `package.json` — exact SDK 1.2.1 declaration.
- `bun.lock` — deterministic dependency resolution.
- `tests/acp-turn.test.ts` — create; protocol and lifecycle suite.
- `tests/acp-client.test.ts` — packet regression suite.
- `tests/fixtures/mock-agent.ts` — deterministic ACP modes.

### Dependent Files

- `src/engine.ts` — unchanged packet consumer of `runAcpTurn`.
- `src/events.ts` — packet event type remains adapter-owned.
- `src/exec-output.ts` — task_06 consumes neutral events/results.
- `src/exec.ts` — task_08 invokes the neutral core.

### Related ADRs

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — one fresh bounded turn.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — selected shared-core and compatibility strategy.

## Deliverables

- Shared ACP v1 turn core and packet compatibility adapter.
- Exact ACP SDK pin and deterministic lockfile.
- Protocol, cancellation, cleanup, and packet regression evidence.
- Updated shared and `task_05` memory when warranted.
- `reports/task_05.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] Given a non-v1 initialize response, fail before session creation.
- [ ] Given an advertised or missing auth method, authenticate correctly or fail before prompting.
- [ ] Given changing config-option responses/updates, replace the complete state rather than merging stale values.
- [ ] Given supported/unsupported session close, call only the advertised method and bound its result.
- [ ] Given every ACP stop reason, retain the raw reason and correct neutral category.

### Integration Tests

- [ ] Given first cancellation with a pending permission, send `session/cancel`, settle the request once, consume a trailing update, and receive or time out the semantic result before process escalation.
- [ ] Given cleanup failure after `end_turn`, return non-success and do not expose a successful final result.
- [ ] Run the complete task_01 packet baseline through the compatibility adapter without changed packet events or engine outcomes.

### Platform or Manual Evidence

- [ ] Run semantic-cancellation integration against the mock provider on the current OS; live provider/platform certification belongs to task_09.

### Verification Commands

- `rtk bun test ./tests/acp-turn.test.ts ./tests/acp-client.test.ts ./tests/engine.test.ts ./tests/process-supervisor.test.ts ./tests/workspace-access.test.ts ./tests/permission-registry.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- One neutral ACP v1 implementation owns the protocol lifecycle.
- Packet behavior remains compatible through an explicit adapter.
- Cancellation and cleanup produce truthful, typed outcomes.
- Focused tests and the full gate pass to terminal exit.
- Changed testable logic reaches at least 80% coverage when measurable.
- Memory and the final report record exact protocol and regression evidence.
