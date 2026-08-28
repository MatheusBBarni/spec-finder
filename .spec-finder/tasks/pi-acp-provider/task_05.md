---
status: completed
title: Record live Pi packet evidence
type: test
complexity: medium
dependencies:
  - task_04
---

# Task 05: Record live Pi packet evidence

## Overview

Prove the shipped Pi provider with one redacted live packet in this workspace, then write the actual Pi and adapter versions into README. If the environment cannot run that packet, document the limitation and still pass the automated gate. Do not treat missing live credentials as an implementation halt.

## Source Artifacts

- PRD: `.spec-finder/tasks/pi-acp-provider/_prd.md`
- TechSpec: `.spec-finder/tasks/pi-acp-provider/_techspec.md`

<critical>
- Read `.spec-finder/tasks/pi-acp-provider/_prd.md`, `.spec-finder/tasks/pi-acp-provider/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; every declared dependency must already be completed and have a lower numeric ID.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_05.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit. If they fail, fix in scope and re-run until clean. Do not stop to ask whether to proceed.
- Ambiguity and spec conflicts are decisions, not halt conditions. Resolve them against `.spec-finder/tasks/pi-acp-provider/_techspec.md`, this task's requirements, and ADRs; record the pick in memory; continue.
- Missing Git HEAD or checkpoint unavailability is not an implementation blocker.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST attempt one redacted live Pi packet covering setup or `--provider pi`, two-turn implementation and report, auto defaults, advertised close plus bounded cleanup, and no secrets in config, reports, logs, or fixtures (M-01, M-03, F-02).
2. MUST attempt a missing-auth failure that stops before useful work with retry guidance (M-02, G-03). Include one explicit model or reasoning apply-or-fail observation when credentials exist (F-03).
3. MUST record host OS, resolved `@automatalabs/pi-acp` version, and `pi` version if present, on GitHub issue #15 and replace the README tested-pair placeholder when the live packet succeeds (G-05).
4. MUST NOT persist, print, or fixture credential values (constraint no secrets).
5. SHOULD, when live Pi cannot run in this environment, document the exact limitation in `reports/task_05.md` and packet memory, leave the README placeholder, and still complete the automated verification gate.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| M-01, G-01 | One completed live packet or documented skip. | issue #15 comment and/or report |
| M-02, US-04 | Missing-auth path or documented skip. | redacted log / report |
| M-03 | No secrets in artifacts. | review checklist in report |
| F-03 | Explicit option apply-or-fail when live. | runtime_option observation |
| TechSpec End-to-End | Versions into README when live succeeds. | README diff |

## Subtasks

- [x] 05.1 Attempt the live packet matrix from `.spec-finder/tasks/pi-acp-provider/_techspec.md` Testing and Evidence, in a disposable or this workspace path that does not leak secrets.
- [x] 05.2 Redact outputs, confirm no credentials in config/reports/logs/fixtures, and post the evidence on issue #15 when the packet ran.
- [x] 05.3 Replace the README tested-pair placeholder on success, or record why it stayed a placeholder.
- [x] 05.4 Run `bun run verify` regardless of live-packet availability.

## Implementation Details

Follow `.spec-finder/tasks/pi-acp-provider/_techspec.md` End-to-End or Platform Evidence and Known Risks.
Use Grok issue #9 as the evidence shape, not as a copy-paste of Grok commands.
Do not pin the adapter in user config.
Do not enable exec.
If unpinned npx cannot complete the packet, record that as the pin-revisit trigger from ADR-002; do not silently pin in this task unless the live failure is otherwise unrecoverable and the pick is written to memory.

### Relevant Files

- `README.md` — tested-pair placeholder from `task_04`.
- `reports/task_05.md` — create at completion with live or skip evidence.
- GitHub issue https://github.com/MatheusBBarni/spec-finder/issues/15 — redacted live note when possible.

### Dependent Files

- Shipped `src/providers.ts` launch recipe from `task_01`.
- `tests/cli.test.ts` — README still must satisfy the help contract after version edits.

### Related ADRs

- [ADR-002: Registry-only Pi ACP integration](adrs/adr-002-registry-only-pi-acp-integration.md) — live packet is the adapter-pair decision criterion.

## Deliverables

- Redacted live evidence on issue #15, or a written environment limitation.
- README versions when live succeeds.
- `memory/MEMORY.md`, `memory/task_05.md`, and `reports/task_05.md`.

## Tests

### Unit Tests

- [ ] Not applicable: no new production logic required unless README edits break `tests/cli.test.ts`.

### Integration Tests

- [ ] After any README edit, `tests/cli.test.ts` still passes.

### Platform or Manual Evidence

- [ ] Live Pi packet with two-turn handoff, auto defaults, close/cleanup, and no secrets; or a report section naming the environment limitation (missing credentials, no network for npx, or adapter spawn failure) and stating the automated gate still passed.
- [ ] Live missing-auth failure before useful work, or the same documented skip.
- [ ] Explicit model or reasoning apply-or-fail observation when the live session could authenticate.

### Verification Commands

- `bun test tests/cli.test.ts`
- `bun run verify`

## Success Criteria

- Live evidence is recorded or the skip is explicit and bounded.
- Automated gate passes to terminal exit.
- No secrets in committed artifacts.
- Memory is current and the final report records exact evidence and unresolved risks.
