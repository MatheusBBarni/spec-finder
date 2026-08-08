---
status: pending
title: Integrate the Packet-Free Exec Command
type: backend
complexity: high
dependencies:
  - task_03
  - task_05
  - task_06
  - task_07
---

# Task 08: Integrate the Packet-Free Exec Command

## Overview

Join the approved invocation, workspace, permission, ACP turn, output, provider, signal, and exit contracts behind `spec-finder exec "<prompt>"`. The command performs exactly one fresh packet-free turn and remains unavailable for real-provider or write-capable use until task_09 supplies the required certification evidence.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, current Git state, and completed `task_03`, `task_05`, `task_06`, and `task_07` before editing.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_08.md` before editing and update memory before finishing.
- Implement only the packet-free exec integration and fixture-backed behavior. Do not enable uncertified real providers or write mode; task_09 owns those release gates.
- Keep exec outside the packet engine, task lifecycle, workflow memory, reports, and cockpit. It MUST NOT create or mutate packet artifacts.
- Complete all preflight checks before provider spawn and preserve the direct, no-shell launch boundary.
- Reference TechSpec sections `Data and Control Flow`, `Components and Boundaries`, `Failure and Recovery Behavior`, `Security and Privacy`, and `Testing and Evidence`.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write `reports/task_08.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST expose `spec-finder exec "<prompt>"` as exactly one fresh ACP v1 turn with no packet, task, report, workflow-memory, cockpit, or history participation (US-01, F-01, F-07, HC-01, HC-09).
2. MUST combine prompt/flag parsing, configuration precedence, canonical workspace resolution, permission policy, certified provider launch, ACP lifecycle, and safe output without duplicating their contracts (US-02 through US-06).
3. MUST complete validation before spawn, launch the provider directly without a shell, and use canonical host access rather than presenting it as a sandbox (F-02, F-03, F-05, HC-04 through HC-08).
4. MUST keep human progress on stderr, emit only the successful final assistant answer on stdout, and map completed, failed/refused/limited, usage, and cancelled outcomes to exit codes `0`, `1`, `2`, and `130` respectively (F-04, F-06, HC-11, HC-15).
5. MUST coordinate Ctrl-C through semantic `session/cancel`, pending permission cancellation, bounded process cleanup, and one terminal outcome (F-06, M-06).
6. MUST remain gated for real-provider and write-capable execution until task_09 records the required live evidence.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01, F-01 | One fresh packet-free turn | Fixture integration and artifact-diff tests |
| US-02 through US-05, F-02 through F-04 | Join invocation and host policy | Preflight, precedence, permission, and workspace cases |
| US-06, F-05, F-06 | Stable output and outcomes | Stream, stdout, stderr, and exit-code assertions |
| F-07, HC-01, HC-14 | No packet/history state | Before/after packet-tree assertions |
| HC-08 through HC-12 | Direct launch and cancellation | Spawn-boundary, cancel, and cleanup fixture cases |
| ADR-001, ADR-002, ADR-003 | Guarded command architecture | Integrated command review |

## Subtasks

- [ ] 08.1 Add the packet-free exec orchestrator over the resolved lower-level contracts.
- [ ] 08.2 Register the exec command and route CLI signals, streams, and stable exit codes.
- [ ] 08.3 Enforce pre-spawn certification/write gates and the direct canonical-host launch boundary.
- [ ] 08.4 Extend the mock agent for successful, refused, limited, cancelled, permission, and cleanup integration paths.
- [ ] 08.5 Add command and end-to-end fixture tests proving no packet artifacts or invocation history are created.
- [ ] 08.6 Run focused and repository-wide verification.

## Implementation Details

`src/exec.ts` should be a thin composition root. Domain decisions remain in the contracts delivered by tasks 03 through 07. Tests must use injected fixture launches until task_09 certifies real providers, and must compare the packet tree before and after execution to enforce the no-artifact boundary.

### Relevant Files

- `src/exec.ts` — packet-free one-turn orchestration.
- `src/commands.ts` — exec command registration and argument routing.
- `src/cli.tsx` — process streams, signals, and exit status.
- `tests/exec.test.ts` — integrated fixture-backed command behavior.
- `tests/commands.test.ts` — command grammar and dispatch coverage.
- `tests/fixtures/mock-agent.ts` — terminal, permission, cancellation, and cleanup modes.

### Dependent Files

- `src/exec-config.ts` — resolved runtime, workspace, permission, and provider inputs.
- `src/acp-turn.ts` — shared neutral ACP v1 turn core.
- `src/exec-output.ts` — redacted stderr and success-only stdout.
- `src/providers.ts` — exec launch context and certification gate.
- `src/process-supervisor.ts` — bounded descendant cleanup.

### Related ADRs

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — one-turn command and guarded write policy.
- [ADR-002: User-Owned Permissions and Human Exec Contract](adrs/adr-002-user-owned-permissions-human-exec.md) — workspace, permission, and human output policy.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — shared core, provider gate, and cancellation lifecycle.

## Deliverables

- Packet-free `exec` command integrated behind disabled real-provider/write gates.
- Fixture-backed command, output, cancellation, permission, and no-artifact tests.
- Updated shared and `task_08` memory when warranted.
- `reports/task_08.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] Missing/invalid prompt, flag, config, workspace, permission, or certification inputs fail before provider spawn with exit `2`.
- [ ] Terminal ACP outcomes map deterministically to `0`, `1`, or `130`, with usage errors remaining `2`.
- [ ] Exec composition selects the direct launch, canonical workspace, and non-persistent permission policy supplied by dependencies.

### Integration Tests

- [ ] A fixture success streams human updates only to stderr, writes exactly one final assistant answer to stdout, exits `0`, and leaves packet artifacts unchanged.
- [ ] Refusal and limit fixtures emit no stdout and exit `1`; malformed invocation exits `2`; Ctrl-C cancellation exits `130` exactly once.
- [ ] Interactive and non-interactive permission fixtures follow the resolved policy without persisting trust or history.
- [ ] Cancellation resolves pending permission requests, sends semantic cancel, honors grace periods, and escalates descendant cleanup when required.
- [ ] Existing packet command and ACP engine tests remain unchanged and green.

### Platform or Manual Evidence

- [ ] Fixture-backed integration runs on the development host; real-provider and native cross-platform certification is deferred exclusively to task_09.

### Verification Commands

- `rtk bun test ./tests/exec.test.ts ./tests/commands.test.ts ./tests/acp-client.test.ts ./tests/engine.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- `exec` performs exactly one fresh fixture-backed ACP turn without packet artifacts or history.
- Preflight, direct launch, stream separation, stable exit codes, permission handling, and cancellation behave as specified.
- Real-provider and write-capable paths remain disabled until task_09 succeeds.
- Existing packet behavior and the full repository gate pass to terminal exit.
- Changed testable logic reaches at least 80% coverage when measurable.
- Memory and the final report contain enough evidence for native certification.
