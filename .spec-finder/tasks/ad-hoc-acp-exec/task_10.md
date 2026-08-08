---
status: pending
title: Publish Exec Documentation and Release Evidence
type: docs
complexity: medium
dependencies:
  - task_09
---

# Task 10: Publish Exec Documentation and Release Evidence

## Overview

Publish the certified exec contract in CLI help and repository documentation, validate the complete release evidence, and hand off post-release manual measurements. Documentation must describe only capabilities enabled by task_09 and must clearly distinguish canonical host access from sandboxing.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, current Git state, completed `task_09`, and its terminal certification evidence before editing.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_10.md` before editing and update memory before finishing.
- Document only provider and write capabilities actually enabled by task_09. If task_09 is blocked, do not publish unsupported availability claims.
- State explicitly that exec grants direct canonical host access under a permission policy and is not a sandbox.
- Keep M-01 and M-02 as post-release manual measurements outside product state; add no telemetry, counters, trust persistence, or history.
- Reference TechSpec sections `CLI Parsing`, `Output Contract`, `Exit Mapping`, `Security and Privacy`, `End-to-End and Platform Evidence`, `Observability`, and `Compatibility, Migration, and Rollback`, plus PRD `Non-Goals`.
- Review all release evidence and run the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write `reports/task_10.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST document exact command grammar, prompt/flag rules, supported `--provider`, `--model`, `--reasoning`, and `--speed` behavior, and the precedence `CLI flags > nearest repository .spec-finder/config.json > ~/.spec-finder/config.json` (US-01, US-02, F-01, F-02).
2. MUST document workspace discovery, canonical containment, permission modes, guarded writes, direct host access, and the explicit absence of sandbox guarantees (US-02, US-05, F-02, F-03, F-05, HC-02 through HC-08).
3. MUST document human stderr, success-only stdout, exit codes `0`, `1`, `2`, `130`, cancellation/cleanup behavior, provider outcome normalization, and recovery guidance (US-03, US-04, US-06, F-04, F-06, HC-10, HC-11, HC-15, HC-16).
4. MUST document no packet artifacts/history, certified-provider boundaries, capability-gated close, compatibility, rollback, and non-goals (US-07, F-07, HC-09, HC-10, HC-12 through HC-14).
5. MUST review M-03 through M-07 release evidence and provide an owner-ready manual handoff for M-01 and M-02 without product instrumentation.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| US-01 through US-03, F-01 through F-03 | Invocation, precedence, workspace docs | CLI help and README assertions |
| US-04 through US-06, F-04 through F-06 | Permission, output, outcomes | Security/output/recovery documentation tests |
| US-07, F-07, HC-01, HC-14 | Packet/history isolation | Boundary and non-goal text |
| M-03 through M-07 | Release evidence review | Linked certification matrix and full gate result |
| M-01, M-02 | Post-release measurement | Manual owner handoff |
| ADR-001, ADR-002, ADR-003 | Durable decisions | Documentation cross-check |

## Subtasks

- [ ] 10.1 Update CLI help with the certified exec grammar, flags, defaults, stream contract, exits, and provider availability.
- [ ] 10.2 Add README guidance for configuration precedence, workspace discovery, permissions, canonical host access, guarded writes, and non-goals.
- [ ] 10.3 Document cancellation, cleanup, refusal/limit/failure recovery, close capability, and packet/history isolation.
- [ ] 10.4 Add CLI documentation tests that lock the public contract to certified capabilities.
- [ ] 10.5 Review M-03 through M-07 release evidence and write the external M-01/M-02 manual measurement handoff.
- [ ] 10.6 Run focused checks and the complete repository verification gate to terminal exit.

## Implementation Details

CLI help is the concise operational contract; README explains security boundaries and recovery in detail. Both surfaces must be generated from or tested against the same certified provider/capability policy where practical so disabled capabilities are never advertised. The M-01/M-02 handoff should name method, sample, owner, and timing while remaining outside runtime persistence.

### Relevant Files

- `src/cli.tsx` — command help and user-facing usage/errors.
- `README.md` — complete exec usage, security, compatibility, and recovery guide.
- `tests/cli.test.ts` — public CLI documentation contract.

### Dependent Files

- `src/commands.ts` — canonical exec grammar.
- `src/exec-config.ts` — precedence and policy source of truth.
- `src/providers.ts` — certified provider availability.
- `reports/task_09.md` — release certification evidence produced by the prior report phase.
- `reports/task_10.md` — final evidence report produced by the report phase.

### Related ADRs

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — user-visible permission and one-turn contract.
- [ADR-002: User-Owned Permissions and Human Exec Contract](adrs/adr-002-user-owned-permissions-human-exec.md) — user-owned permission and human output disclosure.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — outcome, cancellation, close, and certification behavior.

## Deliverables

- Certified exec CLI help and README documentation.
- CLI contract tests for grammar, security wording, providers, streams, and exits.
- Reviewed release matrix covering M-03 through M-07.
- Owner-ready post-release manual measurement handoff for M-01 and M-02 without telemetry.
- Updated shared and `task_10` memory when warranted.
- `reports/task_10.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] CLI help lists exact grammar, supported flags, precedence, streams, exit codes, and only certified provider/capability entries.
- [ ] Usage and recovery text remain stable for invalid invocation, refusal/limit/failure, and cancellation.
- [ ] Help never describes canonical host access as a sandbox or advertises persistent history/trust.

### Integration Tests

- [ ] README examples parse through the real command grammar or are otherwise contract-checked against it.
- [ ] Disabled provider/write capabilities are absent from availability claims.
- [ ] Existing CLI and packet documentation tests remain green.

### Platform or Manual Evidence

- [ ] Review task_09 terminal matrices for macOS, Linux, Windows, Claude, Codex, Cursor, stream redirection, permissions, cancellation, close, cleanup, writes, and persistence.
- [ ] Record M-01 and M-02 post-release measurement method, owner, sample, and timing as a manual handoff outside product state.
- [ ] Record M-04 timing and the terminal `bun run verify` result in the report phase.

### Verification Commands

- `rtk bun test ./tests/cli.test.ts ./tests/commands.test.ts ./tests/exec.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- CLI help and README state the complete, certified exec contract without unsupported claims.
- Security boundaries, direct host access, stream behavior, exits, cancellation, recovery, compatibility, and non-goals are unambiguous.
- M-03 through M-07 evidence is reviewed and M-01/M-02 have a manual post-release owner handoff.
- The complete repository verification gate passes to terminal exit.
- No telemetry, history, or persistent trust state is added.
- Memory and the final report close the planning packet with auditable release evidence.
