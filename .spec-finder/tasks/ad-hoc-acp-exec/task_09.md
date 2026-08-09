---
status: completed
title: Certify and Enable Guarded Exec Capabilities
type: infra
complexity: high
dependencies:
  - task_08
---

# Task 09: Certify and Enable Guarded Exec Capabilities

## Overview

Run the native platform and live-provider certification matrix for guarded exec, then enable only the provider and write capabilities supported by complete terminal evidence. This task is the universal release blocker: missing evidence leaves the affected capability disabled and the task blocked rather than weakening the contract.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, current Git state, and completed `task_08` before editing or running live certification.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_09.md` before work and update memory before finishing.
- Treat native macOS, Linux, and Windows descendant-cleanup evidence and live Claude, Codex, and Cursor matrices as mandatory release evidence. There is no read-only or partial-provider release shortcut.
- Enable only source-owned provider entries and guarded write mode whose complete matrices pass. Any missing platform/provider access, unsupported behavior, or non-terminal test leaves the capability disabled and this task blocked.
- Never weaken canonical containment, permission cancellation, success-only stdout, semantic cancellation, close gating, cleanup deadlines, or packet compatibility to make certification pass.
- Use disposable repositories and non-sensitive fixtures for every live provider and write test; do not expose credentials or persist user trust/history.
- Reference TechSpec sections `End-to-End and Platform Evidence`, `Security and Privacy`, `Compatibility, Migration, and Rollback`, `Testing and Evidence`, and `Known Risks and Open Technical Questions`.
- Run the exact repository verification gate to terminal exit after any source change.
- Do not change lifecycle status or write `reports/task_09.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST prove bounded descendant cleanup within five seconds on native macOS, Linux, and Windows for normal completion, Ctrl-C, timeout, and unresponsive descendants before release (G-04, M-06).
2. MUST run live Claude, Codex, and Cursor matrices covering success, first-visible-progress timing, stdout/stderr redirection, TTY and non-TTY permissions, semantic cancellation, capability-gated close, descendant cleanup, and absence of packet/history persistence (M-03 through M-07).
3. MUST certify guarded writes only after canonical in-workspace mutation, symlink/path-swap rejection, out-of-workspace denial, and cancellation rollback behavior pass on every required host/provider combination (US-05, F-05, HC-04 through HC-08).
4. MUST enable only passing capabilities in source-owned policy and leave failures or incomplete evidence disabled with a truthful blocked outcome (F-06, HC-13).
5. MUST preserve existing packet provider behavior and pass the complete repository gate after policy changes (US-07, M-07).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| M-03, M-05, M-06 | Live provider output, permission, and persistence matrices | Terminal logs for Claude, Codex, Cursor |
| G-04, M-06 | Five-second cleanup bound | Native macOS/Linux/Windows descendant tests |
| US-05, F-05, HC-04 through HC-08 | Guarded write containment | Disposable-workspace adversarial matrix |
| F-06, HC-13 | Source-owned certification | Provider/write enablement diff and negative cases |
| US-07, M-07 | Packet compatibility | Full repository gate and packet regressions |
| ADR-001, ADR-002, ADR-003 | Release decisions | Certification evidence review |

## Subtasks

- [ ] 09.1 Run native macOS, Linux, and Windows process-tree supervision matrices to terminal outcomes within the five-second bound.
- [ ] 09.2 Run the complete live Claude, Codex, and Cursor read-only exec matrices.
- [ ] 09.3 Run guarded-write containment and cancellation matrices in disposable repositories on every required platform/provider combination.
- [ ] 09.4 Record capability, close, cancel, output, cleanup, and persistence evidence without secrets.
- [ ] 09.5 Enable only fully certified source-owned provider and write capability entries; otherwise leave them disabled and record the blocker.
- [ ] 09.6 Re-run focused regressions and the full repository verification gate to terminal exit.

## Implementation Details

Certification is an implementation gate, not documentation optimism. Evidence must include command, host, provider/version, terminal exit, elapsed cleanup time, stream assertions, capability negotiation, and artifact checks. Redact credentials and sensitive prompt content. A provider may remain supported for packet workflows while its exec entry stays disabled.

### Relevant Files

- `src/providers.ts` — source-owned provider certification entries.
- `src/exec-config.ts` — guarded write and certified-provider availability gates.
- `src/exec.ts` — certified capability integration and invariant preservation.
- `tests/providers.test.ts` — provider enablement and packet regression cases.
- `tests/exec-config.test.ts` — certification/write availability tests.
- `tests/exec.test.ts` — live-contract and fixture regression coverage.

### Dependent Files

- `src/process-supervisor.ts` — platform cleanup implementation under certification.
- `src/workspace-access.ts` — guarded write containment under certification.
- `src/acp-turn.ts` — semantic cancel, permission settlement, and close lifecycle.
- `reports/task_09.md` — final evidence report produced by the report phase.

### Related ADRs

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — guarded write release boundary.
- [ADR-002: User-Owned Permissions and Human Exec Contract](adrs/adr-002-user-owned-permissions-human-exec.md) — guarded write and release policy.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — provider and process lifecycle certification.

## Deliverables

- Native macOS, Linux, and Windows process supervision evidence.
- Complete Claude, Codex, and Cursor live certification matrices.
- Source-owned enablement limited to capabilities with complete passing evidence.
- Truthful blocked state with capabilities left disabled if any mandatory evidence is unavailable or fails.
- Updated shared and `task_09` memory with environment-neutral evidence references.
- `reports/task_09.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] Source-owned certification enables only explicitly passing provider/capability entries and rejects all others before spawn.
- [ ] Guarded write availability cannot be enabled independently of the required containment certification.
- [ ] Packet provider resolution remains independent of exec certification.

### Integration Tests

- [ ] Claude, Codex, and Cursor each pass success, redirected stream, TTY/non-TTY permission, cancel, close-capability, cleanup, and no-persistence scenarios.
- [ ] Guarded writes succeed only for canonical in-workspace targets and deny symlink escape, path replacement, and out-of-workspace access.
- [ ] Normal completion, cancellation, timeout, and forced escalation leave no provider descendants.
- [ ] Existing packet ACP and command tests remain green after enablement.

### Platform or Manual Evidence

- [ ] Native macOS process-tree matrix completes with no descendants within five seconds.
- [ ] Native Linux process-tree matrix completes with no descendants within five seconds.
- [ ] Native Windows process-tree matrix completes with no descendants within five seconds.
- [ ] Live Claude, Codex, and Cursor matrices are complete on required hosts with credentials redacted.
- [ ] Any unavailable or failing matrix leaves the capability disabled and the task blocked; no waiver or release shortcut is accepted.

### Verification Commands

- `rtk bun test ./tests/providers.test.ts ./tests/exec-config.test.ts ./tests/exec.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Every required native platform and live provider matrix has terminal, secret-safe evidence.
- Descendant cleanup completes within five seconds for every required scenario.
- Only fully certified providers and guarded capabilities are enabled in source-owned policy.
- Packet compatibility and the complete repository gate pass after enablement.
- Missing or failed evidence produces a truthful blocked outcome without weakening safeguards.
- Memory and the final report provide an auditable release decision.
