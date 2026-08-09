---
status: completed
title: Add Exec Provider Launch Policy and Certification Gate
type: backend
complexity: medium
dependencies:
  - task_03
---

# Task 07: Add Exec Provider Launch Policy and Certification Gate

## Overview

Separate packet and exec provider launch contexts and add a source-owned certification gate for exec. Codex exec launches no longer receive task/report instructions, while existing packet provider behavior remains unchanged and uncertified exec providers fail before spawn.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, current Git state, and completed `task_03` before editing.
- Treat `task_03` as a required lower-numbered dependency and consume its resolved provider/runtime contract.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_07.md` before editing and update memory before finishing.
- Implement only provider launch mode and source-owned certification policy. Do not run live certification, enable providers, implement orchestration, or add persistent trust/telemetry state.
- Reference TechSpec sections `Components and Boundaries`, `Integration Points`, `Compatibility, Migration, and Rollback`, and `Known Risks and Open Technical Questions`.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write `reports/task_07.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST distinguish `packet` and `exec` launch contexts without changing existing Claude, Codex, or Cursor packet behavior (US-06, US-07, M-07).
2. MUST remove active-task/report developer instructions from exec Codex launches while preserving packet instructions (F-01, F-07).
3. MUST provide a source-owned exec certification gate that rejects uncertified providers before process startup and does not affect provider support elsewhere (F-06, HC-13).
4. MUST add no provider-specific user flags, custom commands, persistent trust state, or runtime history (HC-09, HC-10, HC-14).
5. SHOULD return immutable launch copies so one mode cannot contaminate another invocation.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-06, US-06, F-06 | Normalize and gate provider outcomes | Provider mode/certification tests |
| US-07, M-07 | Preserve packet launches | Existing provider regression cases |
| F-07, HC-10, HC-13, HC-14 | No new provider surface or state | API and persistence review |
| ADR-003 | Exec-specific launch context | Codex instruction assertions |

## Subtasks

- [ ] 07.1 Add explicit packet/exec launch context to provider resolution.
- [ ] 07.2 Preserve packet launch behavior and provide exec-appropriate Codex instructions.
- [ ] 07.3 Add the source-owned certification query with all real providers disabled pending task_09.
- [ ] 07.4 Add provider-mode, immutability, model, and certification tests.
- [ ] 07.5 Run focused and repository-wide verification.

## Implementation Details

Keep the provider registry in source code so certification is a release decision rather than user state. Task_09 may enable only entries with terminal live evidence. The launch API must continue supporting injected fixture launches used by ACP and exec integration tests.

### Relevant Files

- `src/providers.ts` — packet/exec launch mode and certification gate.
- `tests/providers.test.ts` — provider launch and certification regression suite.

### Dependent Files

- `src/exec-config.ts` — rejects uncertified providers before spawn.
- `src/acp-client.ts` — packet adapter preserves current launch behavior.
- `src/exec.ts` — task_08 resolves exec launch context.

### Related ADRs

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — existing providers only.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — provider certification and packet adapter boundary.

## Deliverables

- Packet/exec provider launch policy and disabled-by-default certification gate.
- Focused provider compatibility and instruction tests.
- Updated shared and `task_07` memory when warranted.
- `reports/task_07.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] Given packet mode, preserve current commands, model mapping, environment, and Codex task/report instructions.
- [ ] Given exec mode, preserve provider model mapping while omitting packet/report instructions.
- [ ] Given an uncertified provider, reject exec availability before launch without changing packet support.
- [ ] Given repeated resolution, return independent argument/environment objects.

### Integration Tests

- [ ] Fixture provider launches remain injectable for packet and future exec tests.

### Platform or Manual Evidence

- [ ] Not applicable until task_09 runs live provider certification.

### Verification Commands

- `rtk bun test ./tests/providers.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Packet and exec launch intent cannot be confused.
- No real provider is exposed through exec before certification.
- Existing packet provider tests and the repository gate pass to terminal exit.
- Changed testable logic reaches at least 80% coverage when measurable.
- No trust, telemetry, or provider-specific option state is added.
- Memory and the final report record the disabled certification baseline.
