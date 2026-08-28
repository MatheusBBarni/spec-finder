---
status: completed
title: Expose Pi in setup/run UX and auto-on-switch
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 03: Expose Pi in setup/run UX and auto-on-switch

## Overview

Let operators choose Pi in interactive and flagged setup, and override a run with `--provider pi`. Switching to Pi defaults omitted model and reasoning to `auto` so a saved Codex id is not sent. Help grammar lists `pi`. Leftover `.pi/skills` is not a setup target.

## Source Artifacts

- PRD: `.spec-finder/tasks/pi-acp-provider/_prd.md`
- TechSpec: `.spec-finder/tasks/pi-acp-provider/_techspec.md`

<critical>
- Read `.spec-finder/tasks/pi-acp-provider/_prd.md`, `.spec-finder/tasks/pi-acp-provider/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; every declared dependency must already be completed and have a lower numeric ID.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_03.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit. If they fail, fix in scope and re-run until clean. Do not stop to ask whether to proceed.
- Ambiguity and spec conflicts are decisions, not halt conditions. Resolve them against `.spec-finder/tasks/pi-acp-provider/_techspec.md`, this task's requirements, and ADRs; record the pick in memory; continue.
- Missing Git HEAD or checkpoint unavailability is not an implementation blocker.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST add a single-select setup picker row labeled `Pi` with hint `skills in .agents/skills`, and accept `--agent pi` with default model `auto` (F-01, US-01, G-02).
2. MUST default omitted model and reasoning to `auto` when setup or `--provider` switches to Pi; explicit flags still win (US-03, ADR-002).
3. MUST reject Pi setup models other than `auto`, reuse a saved Pi provider on rerun, and leave Claude/Codex/Cursor/Grok selectable (F-01, US-07).
4. MUST list `pi` in CLI help provider grammar. Because `tests/cli.test.ts` asserts the same setup usage string in help and README, MUST update that shared usage line in `README.md` too so verify stays green (G-05, F-07).
5. SHOULD leave the full Pi prerequisites section, leftover `.pi/skills` narrative, and tested-pair paragraph to `task_04`.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-02, US-01, F-01 | Picker and `--agent pi`. | `tests/commands.test.ts` setup resolution |
| US-03, ADR-002 auto-on-switch | `--provider pi` from Codex yields auto model/reasoning unless flags supplied. | run override test analog to Grok |
| US-05, F-06 | `.pi/skills` is not a setup destination. | setup still uses `.agents/skills`; no `.pi/skills` target |
| G-05, F-07 help | Help (and shared README usage line) include `pi`. | `tests/cli.test.ts` |
| US-07 | Other providers remain in the picker and grammar. | help still lists claude/codex/cursor/grok |

## Subtasks

- [x] 03.1 Add the Pi picker row and wire setup/run consumers of the task_01 auto-on-switch predicate, including changed-to-Pi reasoning defaults in setup writes.
- [x] 03.2 Accept `--agent pi` / `--provider pi`, reject non-auto Pi setup models, and preserve saved Pi reruns.
- [x] 03.3 Update CLI help grammar and the matching README usage line required by `tests/cli.test.ts`, without writing the full Pi README section.
- [x] 03.4 Add command tests mirroring Grok setup and runtime-override coverage.
- [x] 03.5 Run focused suites and `bun run verify`.

## Implementation Details

Follow `.spec-finder/tasks/pi-acp-provider/_techspec.md` Compatibility, Migration, and Rollback and Integration Points for auto-on-switch.
Use the predicate from `task_01` instead of a second `provider === "grok"` special case, unless a documented conflict forces an equivalent pair of checks.
Do not launch Pi during setup.
Do not add `.pi/skills` to `SKILL_TARGETS`.
Do not certify exec.

`tests/cli.test.ts` currently requires help and README to contain `spec-finder setup [--agent claude|codex|cursor|grok]`. Updating only `src/cli.tsx` will fail verify. Change that shared usage string in both files in this task. Defer the Grok-style Pi prerequisites block to `task_04`.

### Relevant Files

- `src/commands.ts` — picker items; `applyRunOverrides` Grok-only auto switch.
- `src/setup.ts` — Grok-only reasoning auto on provider change.
- `src/cli.tsx` — setup and exec provider grammar.
- `README.md` — setup usage line only, to satisfy the shared help test.
- `tests/commands.test.ts` — Grok setup and `--provider grok` analogs.
- `tests/cli.test.ts` — help/README usage assertions.
- `tests/setup.test.ts` — changed-to-Grok reasoning analog for Pi.

### Dependent Files

- `src/setup-profile.ts` — predicate and Pi profile from `task_01`.
- `src/ui/setup-picker.ts` — generic single-select; no Pi-specific parser.

### Related ADRs

- [ADR-001: Packet-only Pi provider](adrs/adr-001-packet-only-pi-provider.md) — setup does not log in.
- [ADR-002: Registry-only Pi ACP integration](adrs/adr-002-registry-only-pi-acp-integration.md) — auto-on-switch.

## Deliverables

- Pi selectable in setup and as `--provider`.
- Auto model/reasoning when switching to Pi.
- Help grammar includes `pi`; shared README usage line matches.
- Tests, memory, and `reports/task_03.md`.

## Tests

### Unit Tests

- [ ] Given non-interactive `--agent pi`, when setup options resolve, then provider is `pi`, model is `auto`, and `--model volatile-model` is rejected as an unsupported setup model for pi.
- [ ] Given a saved Pi config with model `auto` and speed `fast`, when setup reruns with no flags, then those values are reused.
- [ ] Given a Codex config with model `gpt-5.6-luna` and reasoning `high`, when `run --provider pi` is applied, then runtime model and reasoning become `auto` and setup metadata is unchanged.
- [ ] Given the same Codex config, when `run --provider pi --model anthropic/claude-sonnet-4 --reasoning low` is applied, then those explicit values are kept.

### Integration Tests

- [ ] At setup write, verify changing Codex (`reasoning: "high"`) to Pi stores `reasoning: "auto"`, while a saved Pi `reasoning: "low"` rerun keeps `low`.
- [ ] At help capture, verify setup usage includes `claude|codex|cursor|grok|pi` and exec grammar still lists providers without claiming Pi exec certification.

### Platform or Manual Evidence

- [ ] Not applicable: interactive picker frames are unchanged except one extra item; no new cockpit chrome.

### Verification Commands

- `bun test tests/commands.test.ts tests/cli.test.ts tests/setup.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- Full Pi README narrative remains `task_04` except the shared usage line.
- Memory is current and the final report records exact evidence and unresolved risks.
