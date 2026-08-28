---
status: completed
title: Document packet-only Pi
type: docs
complexity: low
dependencies:
  - task_02
  - task_03
---

# Task 04: Document packet-only Pi

## Overview

Publish the same packet-only Pi contract operators already see in setup and help. README must state prerequisites, skill destination, leftover `.pi/skills`, no install/login, exec unavailable, and a tested-pair placeholder until `task_05`.

## Source Artifacts

- PRD: `.spec-finder/tasks/pi-acp-provider/_prd.md`
- TechSpec: `.spec-finder/tasks/pi-acp-provider/_techspec.md`

<critical>
- Read `.spec-finder/tasks/pi-acp-provider/_prd.md`, `.spec-finder/tasks/pi-acp-provider/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; every declared dependency must already be completed and have a lower numeric ID.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_04.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit. If they fail, fix in scope and re-run until clean. Do not stop to ask whether to proceed.
- Ambiguity and spec conflicts are decisions, not halt conditions. Resolve them against `.spec-finder/tasks/pi-acp-provider/_techspec.md`, this task's requirements, and ADRs; record the pick in memory; continue.
- Missing Git HEAD or checkpoint unavailability is not an implementation blocker.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST document Pi beside Claude, Codex, Cursor, and Grok as a packet provider, including `.agents/skills` / `~/.agents/skills` and setup model `auto` only (G-05, F-07, F-01).
2. MUST state that Spec Finder does not install Pi, does not log in, and does not migrate `.pi/skills` (F-05, F-06, US-05).
3. MUST state Pi is packet-only and not certified for `exec` (F-05, US-06).
4. MUST leave a tested Pi / adapter pair placeholder that `task_05` can replace with live versions, without pinning a version in user config (constraint live-packet compatibility).
5. SHOULD warn that unpinned `npx` can resolve a newer adapter than a prior probe, matching Grok's "not a compatibility promise" tone.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-05, F-07 | README table, requirements list, and `--provider` grammar include Pi. | `tests/cli.test.ts` README assertions plus review |
| F-05, US-06 | Packet-only / exec unavailable. | README exec and Grok-analog Pi section |
| F-06, US-05 | Leftover `.pi/skills` not migrated. | explicit README sentence |
| ADR-001 / ADR-002 | Auth outside Spec Finder; no config pin. | prerequisites section |

## Subtasks

- [x] 04.1 Add Pi to the supported-provider list, setup model table, and runtime config field docs without dropping the other four providers.
- [x] 04.2 Add a Grok-shaped Pi prerequisites section covering login-outside, packet-only, leftover `.pi/skills`, and a tested-pair placeholder.
- [x] 04.3 Align any remaining help/README phrases `tests/cli.test.ts` still requires.
- [x] 04.4 Run `tests/cli.test.ts` and `bun run verify`.

## Implementation Details

Follow `.spec-finder/tasks/pi-acp-provider/_techspec.md` Observability is not the focus; use Compatibility and External Interfaces for the operator-facing contract.
Mirror the existing Grok Build README section rather than inventing a new docs layout.
Do not claim exec, CI, or first-time Pi onboarding.
Do not fill exact adapter versions here unless already recorded by a live packet.

### Relevant Files

- `README.md` — requirements list, setup table, Grok prerequisites analog, runtime `provider` field, exec notes.
- `tests/cli.test.ts` — help/README contract.

### Dependent Files

- `src/cli.tsx` — grammar already updated in `task_03`; keep them matching.

### Related ADRs

- [ADR-001: Packet-only Pi provider](adrs/adr-001-packet-only-pi-provider.md) — docs audience is existing Pi operators.
- [ADR-002: Registry-only Pi ACP integration](adrs/adr-002-registry-only-pi-acp-integration.md) — unpinned npx; README records the live pair.

## Deliverables

- README Pi contract matching shipped setup/run/exec behavior.
- Tested-pair placeholder for `task_05`.
- `memory/MEMORY.md`, `memory/task_04.md`, and `reports/task_04.md`.

## Tests

### Unit Tests

- [ ] Not applicable as new production logic; documentation is asserted through the existing CLI/README contract test.

### Integration Tests

- [ ] At `tests/cli.test.ts`, verify help and README still share one setup usage string, still mention Grok Build, and now include Pi without restoring multi-agent setup language.

### Platform or Manual Evidence

- [ ] Not applicable: no live provider run in this task.

### Verification Commands

- `bun test tests/cli.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Claude, Codex, Cursor, and Grok docs remain accurate.
- Memory is current and the final report records exact evidence and unresolved risks.
