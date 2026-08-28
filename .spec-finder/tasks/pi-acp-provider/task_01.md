---
status: pending
title: Add Pi provider registries and packet launch recipe
type: backend
complexity: high
dependencies: []
---

# Task 01: Add Pi provider registries and packet launch recipe

## Overview

Make `pi` a valid Spec Finder provider id with a complete packet launch recipe, setup profile, skill destination, label, and exec-false certification. This is independently testable without picker chrome or ACP session fixtures. Later tasks consume this closed-set contract.

## Source Artifacts

- PRD: `.spec-finder/tasks/pi-acp-provider/_prd.md`
- TechSpec: `.spec-finder/tasks/pi-acp-provider/_techspec.md`

<critical>
- Read `.spec-finder/tasks/pi-acp-provider/_prd.md`, `.spec-finder/tasks/pi-acp-provider/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; it has no dependencies.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_01.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit. If they fail, fix in scope and re-run until clean. Do not stop to ask whether to proceed.
- Ambiguity and spec conflicts are decisions, not halt conditions. Resolve them against `.spec-finder/tasks/pi-acp-provider/_techspec.md`, this task's requirements, and ADRs; record the pick in memory; continue.
- Missing Git HEAD or checkpoint unavailability is not an implementation blocker.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST add `"pi"` to the strict provider enum and every exhaustive `Record<ProviderName, …>` that would otherwise fail typecheck (F-01, G-04).
2. MUST ship the source-owned packet launch and auth preference from `.spec-finder/tasks/pi-acp-provider/_techspec.md` Implementation Design, with empty launch env and no session-config normalizer (F-04, ADR-002).
3. MUST keep `EXEC_PROVIDER_CERTIFICATION.pi.exec === false` while packet launch resolution succeeds (F-05, US-06).
4. MUST give Pi the `.agents/skills` setup destination, `auto`-only models, label `Pi` from `providerLabel`, and a tested auto-on-switch predicate that is true for `grok` and `pi` only (F-01, F-06).
5. SHOULD not change picker items, help grammar, `acp-client` option policy, or README narrative in this task.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| F-01 profile, F-06 | Pi setup profile and `SKILL_TARGETS.pi`. | `tests/setup-profile.test.ts`, `tests/setup.test.ts` PROVIDERS loop |
| F-04, constraint no secrets | Launch recipe, auth ids, empty env. | `tests/providers.test.ts` |
| F-05, US-06, G-04 exec | Packet launch allowed; exec refused. | packet vs exec certification tests |
| ADR-002 label | `providerLabel("pi")` is `Pi`, not Grok Build. | unit assertion |
| TechSpec sequencing step 1-2 | Closed-set registries include launch. | typecheck via `bun run verify` |

## Subtasks

- [ ] 01.1 Add `pi` to the provider enum, setup profile, and setup skill-target map so destination `.agents/skills` and `auto` defaults are policy, not live discovery.
- [ ] 01.2 Add the frozen packet launch, Pi auth preference, redacted stderr, exec-false entry, and explicit `providerLabel("pi")`.
- [ ] 01.3 Export a source-owned auto-on-switch predicate for `grok` and `pi` only, with tests, without wiring CLI consumers.
- [ ] 01.4 Extend exhaustive provider tests so hardcoded four-provider loops include `pi` and reject unknown agents as before.
- [ ] 01.5 Run focused suites and `bun run verify`; record durable registry facts in packet memory.

## Implementation Details

Follow `.spec-finder/tasks/pi-acp-provider/_techspec.md` Core Interfaces and Integration Points.
Do not copy those snippets into this file.
Do not bump `@agentclientprotocol/sdk`.
Do not add an npm dependency on `@automatalabs/pi-acp`.
Do not read `~/.pi/agent/auth.json`.
`src/setup.ts` in this task only needs `SKILL_TARGETS.pi`. Leave Grok-only reasoning defaults for `task_03`.

### Relevant Files

- `src/config.ts` — `PROVIDERS` enum consumed by config, exec-config, and commands.
- `src/setup-profile.ts` — exhaustive profiles; add Pi and the auto-on-switch predicate.
- `src/providers.ts` — `PROVIDER_LAUNCHES`, certification, auth preference, `providerLabel`.
- `src/setup.ts` — `SKILL_TARGETS` currently lists claude/codex/cursor/grok only.

### Dependent Files

- `src/exec-config.ts` — inherits `PROVIDERS`; no Pi-specific keys.
- `tests/setup-profile.test.ts` — exhaustive label switch currently ends at Grok Build.
- `tests/providers.test.ts` — hardcoded `["claude", "codex", "cursor", "grok"]` loops.
- `tests/setup.test.ts` — iterates `PROVIDERS` for install destinations.
- `tests/config.test.ts` — must accept `provider: "pi"`.
- `src/acp-client.ts` — `task_02` consumes launch/auth; do not change policy here.
- `src/commands.ts`, `src/cli.tsx` — `task_03`.

### Related ADRs

- [ADR-001: Packet-only Pi provider](adrs/adr-001-packet-only-pi-provider.md) — packet-only, no exec, no credential storage.
- [ADR-002: Registry-only Pi ACP integration](adrs/adr-002-registry-only-pi-acp-integration.md) — unpinned npx recipe, redact, explicit Pi label.

## Deliverables

- `pi` is a valid persisted and runtime provider id.
- Packet launch recipe and exec-false certification.
- Auto-on-switch predicate tested, unused by CLI until `task_03`.
- Focused tests, `memory/MEMORY.md`, `memory/task_01.md`, and `reports/task_01.md`.

## Tests

### Unit Tests

- [ ] Given provider `pi`, when the setup profile is read, then destination is `.agents/skills`, models are `[]`, default model is `auto`, and `isCuratedSetupModel("pi", "anthropic/claude-sonnet-4")` is false.
- [ ] Given provider `pi`, when packet launch is resolved with a non-auto model, then command is `npx`, args are `["--yes", "@automatalabs/pi-acp"]`, env is `{}`, auth methods are `["pi-stored-credentials"]`, stderr policy is `redact`, and no session-config normalizer is attached.
- [ ] Given a present API key in the process environment, when Pi launch is resolved, then launch env still does not contain that key.
- [ ] Given `providerLabel("pi")`, then the string is `Pi` and not `Grok Build`.
- [ ] Given every provider including `pi`, when packet launch is resolved, then it succeeds; when exec launch is resolved, then it throws `ProviderCertificationError`.
- [ ] Given the auto-on-switch predicate, when the provider is `pi` or `grok`, then it is true; when the provider is `claude`, `codex`, or `cursor`, then it is false.

### Integration Tests

- [ ] At setup install, verify the existing `PROVIDERS × local/global` loop still copies managed skills for `pi` into `.agents/skills` or `~/.agents/skills` without launching a provider.

### Platform or Manual Evidence

- [ ] Not applicable: no live adapter spawn in this task.

### Verification Commands

- `bun test tests/providers.test.ts tests/setup-profile.test.ts tests/setup.test.ts tests/config.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No picker, help, ACP policy, or README narrative changes.
- Memory is current and the final report records exact evidence and unresolved risks.
