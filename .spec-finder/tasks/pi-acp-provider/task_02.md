---
status: completed
title: Apply Pi session-config policy and ACP fixtures
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 02: Apply Pi session-config policy and ACP fixtures

## Overview

Make Pi packet sessions apply model and reasoning through advertised ACP session config, or fail before prompt. Auto stays provider-default. Speed remains optional. Auth fails closed on missing `pi-stored-credentials`. Stderr stays redacted. Implementation and report turns share one session.

## Source Artifacts

- PRD: `.spec-finder/tasks/pi-acp-provider/_prd.md`
- TechSpec: `.spec-finder/tasks/pi-acp-provider/_techspec.md`

<critical>
- Read `.spec-finder/tasks/pi-acp-provider/_prd.md`, `.spec-finder/tasks/pi-acp-provider/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; every declared dependency must already be completed and have a lower numeric ID.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_02.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit. If they fail, fix in scope and re-run until clean. Do not stop to ask whether to proceed.
- Ambiguity and spec conflicts are decisions, not halt conditions. Resolve them against `.spec-finder/tasks/pi-acp-provider/_techspec.md`, this task's requirements, and ADRs; record the pick in memory; continue.
- Missing Git HEAD or checkpoint unavailability is not an implementation blocker.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST treat Pi model and reasoning as required session-config and speed as optional, matching Grok's required-reasoning path rather than issue #15's optional reasoning (F-03, G-01).
2. MUST fail before `session/new` with the Pi unavailable message when `pi-stored-credentials` is not advertised (G-03, F-04, US-04).
3. MUST keep implementation and final-report turns on one ACP process/session via existing `withAcpSession` (F-02, US-02).
4. MUST redact Pi provider stderr the same way Grok does (ADR-002).
5. SHOULD not add a Pi session-config normalizer or change Claude/Codex/Cursor launch-time model policy.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, F-02, US-02 | Shared Pi session for two packet phases. | engine or acp-client two-turn fixture |
| G-03, F-04, US-04 | Auth preference fail-closed. | acp-turn / acp-client auth fixture |
| F-03 | Auto default; explicit apply-or-fail; speed unsupported non-fatal. | acp-client runtime_option events |
| ADR-002 redact | One generic stderr line, no raw text. | stderr fixture |
| TechSpec Failure table | Missing/rejected config fails before prompt. | protocol error tests |

## Subtasks

- [x] 02.1 Extend packet runtime-option policy so Pi requires model and reasoning and leaves speed optional.
- [x] 02.2 Add Pi auth, auto-default, apply-or-fail, unsupported-speed, and redact fixtures using the existing mock agent, without Grok metadata normalizer.
- [x] 02.3 Prove implementation and report turns share one Pi session, following the Grok engine/client analog.
- [x] 02.4 Run focused ACP suites and `bun run verify`; record policy picks in memory.

## Implementation Details

Follow `.spec-finder/tasks/pi-acp-provider/_techspec.md` Data and Control Flow, Failure and Recovery Behavior, and Testing and Evidence.
Reuse `tests/fixtures/mock-agent.ts`.
Advertise standard `model` plus `thinkingLevel` with `category: "thought_level"`.
Do not invent a Pi metadata normalizer.
Do not parse Pi payloads in `src/ui/`.
Do not spawn live `npx` in tests.

### Relevant Files

- `src/acp-client.ts` — `runtimeOptionPolicy` currently requires reasoning only for `grok`.
- `tests/acp-client.test.ts` — Grok fixtures to mirror for Pi.
- `tests/acp-turn.test.ts` — auth preference unavailable path.
- `tests/engine.test.ts` — Grok two-turn session analog if the client suite cannot prove shared session.

### Dependent Files

- `src/providers.ts` — `createPiAuthMethodPreference` from `task_01`.
- `src/acp-turn.ts` — unchanged core; already matches `thought_level` and redact.
- `src/commands.ts` — `task_03` still owns `--provider pi` auto defaults.

### Related ADRs

- [ADR-002: Registry-only Pi ACP integration](adrs/adr-002-registry-only-pi-acp-integration.md) — required options, no normalizer, redact.

## Deliverables

- Pi runtime-option policy in the packet ACP adapter.
- Fixture coverage for auth, options, redact, and two-turn handoff.
- `memory/MEMORY.md`, `memory/task_02.md`, and `reports/task_02.md`.

## Tests

### Unit Tests

- [ ] Given advertised methods that omit `pi-stored-credentials`, when a Pi turn starts, then it fails with `Pi authentication unavailable. Run \`pi\` and \`/login\`, or set the provider API key, then rerun.`
- [ ] Given advertised `pi-stored-credentials`, when a Pi turn starts, then that method is selected and no API key is copied into launch env.

### Integration Tests

- [ ] At a Pi fixture session with `model/reasoning/speed` all `auto`, verify each runtime_option outcome is `default` and no `session/set_config_option` is required for those autos.
- [ ] At a Pi fixture session that advertises `model` and `thinkingLevel` (`category: "thought_level"`), verify explicit model and `high` reasoning emit `applied` or fail clearly if the setter rejects.
- [ ] At a Pi fixture session with no reasoning option, verify an explicit reasoning request fails before prompt rather than continuing as `unsupported`.
- [ ] At a Pi fixture session with no speed option, verify requested speed emits `unsupported` and the turn still completes.
- [ ] At a Pi fixture that writes stderr, verify events contain the generic redacted diagnostic and not the raw text.
- [ ] At the engine or client boundary, verify implementation and report prompts for one Pi packet share one process/session.

### Platform or Manual Evidence

- [ ] Not applicable: live adapter evidence is `task_05`.

### Verification Commands

- `bun test tests/acp-client.test.ts tests/acp-turn.test.ts tests/engine.test.ts tests/providers.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No setup picker, help, or README changes.
- Memory is current and the final report records exact evidence and unresolved risks.
