---
status: completed
title: Resolve Exec Invocation, Runtime, and Permission Policy
type: backend
complexity: high
dependencies:
  - task_01
  - task_02
---

# Task 03: Resolve Exec Invocation, Runtime, and Permission Policy

## Overview

Implement strict exec argument parsing, independent runtime-profile selection, and the user-owned abort-aware permission registry. Invalid invocation or required configuration must fail before provider startup, while repository runtime values and user permission authority remain separate projections.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, current Git state, and completed `task_01` and `task_02` before editing.
- Treat `task_01` and `task_02` as required lower-numbered dependencies; reuse their contracts and canonical workspace result.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_03.md` before editing and update memory before finishing.
- Implement only pure exec parsing, resolution, and permission-registry behavior. Do not add CLI dispatch, provider launch, ACP transport, output rendering, or capability certification.
- Reference TechSpec sections `CLI Parsing`, `Runtime and Permission Resolution`, `Permission Lifecycle`, and `Exit Mapping`.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write `reports/task_03.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST accept exactly one non-empty positional prompt and only `--provider`, `--model`, `--reasoning`, and `--speed`; reject missing values, unknown flags, and extra positionals before execution (F-01, HC-01).
2. MUST select a complete repository runtime profile or complete user runtime profile without field merging, block fallback past an invalid existing repository profile, and apply last-value explicit overrides (F-02, M-03).
3. MUST parse user permission independently from unrelated user runtime fields, ignore repository permission authority, default missing or unusable user permission to `prompt`, and never present the policy as sandboxing (F-03, HC-03, HC-06, ADR-002).
4. MUST support concurrent permission requests, prefer once-scoped offered decisions, fail closed without an interactive terminal, and settle every pending request exactly once during abort (F-03, F-05, F-06).
5. SHOULD inject cwd, home, input, and output dependencies so parsing, config, TTY, and cancellation behavior are deterministic in tests.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-02, US-02, F-02 | Deterministic whole-profile runtime selection | Precedence table tests |
| US-04, F-03 | User-owned permission authority | Independent permission-projection tests |
| F-01, HC-01, M-03 | Strict public invocation | Parser error matrix and no-start assertion |
| F-05, F-06, HC-07 | Exactly-once permission settlement | Concurrent request and abort-race tests |

## Subtasks

- [ ] 03.1 Implement the strict, pure exec argument parser and typed overrides.
- [ ] 03.2 Implement canonical workspace-bound repository and user runtime-profile resolution.
- [ ] 03.3 Implement independent user permission projection and safe `prompt` fallback.
- [ ] 03.4 Implement the abort-aware, exactly-once permission registry for agent requests and host writes.
- [ ] 03.5 Add complete parser, precedence, TTY, concurrency, and cancellation test matrices.
- [ ] 03.6 Verify existing config and command behavior remains unchanged.

## Implementation Details

Keep existing `loadConfig()` and `runCommand()` behavior compatible. Exec resolution may reuse low-level schemas/constants, but must not call the strict complete packet loader because repository permissions are ignored and user permission remains valid independently from unrelated runtime fields. The permission registry is the TechSpec's named broker boundary and must not persist “always” choices.

### Relevant Files

- `src/exec-config.ts` — create; workspace/runtime/permission resolution.
- `src/permission-registry.ts` — create; exactly-once request and host-write authorization.
- `src/commands.ts` — add/export strict pure exec parsing without routing.
- `tests/exec-config.test.ts` — create; runtime and permission matrix.
- `tests/exec-args.test.ts` — create; strict grammar matrix.
- `tests/permission-registry.test.ts` — create; TTY, concurrency, and abort behavior.

### Dependent Files

- `src/config.ts` — existing strict packet schema; extend exports only when reuse is safe.
- `src/exec.ts` — task_08 consumes resolved context and permission registry.
- `src/acp-turn.ts` — task_05 consumes the broker contract.
- `src/providers.ts` — task_07 consumes the resolved provider/runtime choice.

### Related ADRs

- [ADR-002: User-Owned Permissions and Human Exec Contract](adrs/adr-002-user-owned-permissions-human-exec.md) — whole-profile fallback and user-only permission authority.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — independent permission projection and exactly-once cancellation.

## Deliverables

- Strict exec parser, runtime resolver, and permission registry.
- Focused config, argument, and permission test matrices.
- Updated shared and `task_03` memory when warranted.
- `reports/task_03.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] Given one quoted prompt and supported overrides, return the prompt and last value for each repeated override.
- [ ] Given a blank/missing prompt, unknown flag, missing flag value, or extra positional, return an invocation error and no executable context.
- [ ] Given repository/user profile combinations, implement whole-profile precedence, invalid-repository blocking, user fallback, and override revalidation exactly.
- [ ] Given valid user permission with invalid unrelated user runtime fields, retain the permission when repository runtime is selected.
- [ ] Given `approve-all`, `deny`, `prompt`, concurrent requests, or abort, choose only offered options and settle every request once.

### Integration Tests

- [ ] Resolve a nested invocation without allowing the user config location to alter the canonical workspace from task_02.
- [ ] Existing config parsing and setup/run command tests remain passing.

### Platform or Manual Evidence

- [ ] Simulate TTY and non-TTY streams with injected harnesses; real interactive provider evidence belongs to task_09.

### Verification Commands

- `rtk bun test ./tests/exec-args.test.ts ./tests/exec-config.test.ts ./tests/permission-registry.test.ts ./tests/config.test.ts ./tests/commands.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Invocation, runtime, workspace, and permission precedence match every approved matrix row.
- No invalid invocation or required configuration can reach provider startup.
- Permission requests settle exactly once without persistence or stdout contamination.
- Focused tests and full verification pass to terminal exit.
- Changed testable logic reaches at least 80% coverage when measurable.
- Memory is current and the final report records exact outcomes and unresolved risks.
