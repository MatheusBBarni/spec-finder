---
status: pending
title: Enforce Safe Exec Output and Success-Only Stdout
type: backend
complexity: medium
dependencies:
  - task_05
---

# Task 06: Enforce Safe Exec Output and Success-Only Stdout

## Overview

Implement the deny-by-default human exec reporter. It emits only fixed normalized progress to stderr and buffers user-facing agent text until both `end_turn` and confirmed cleanup make the response safe to publish on stdout.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, current Git state, and completed `task_05` before editing.
- Treat `task_05` as a required lower-numbered dependency and consume its neutral events/outcomes without importing packet or cockpit renderers.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_06.md` before editing and update memory before finishing.
- Implement only exec output normalization and buffering. Do not add CLI routing, permission prompting, provider launch, capability certification, or change `src/ui/transcript.ts`.
- Reference TechSpec sections `Output Contract`, `Exit Mapping`, `Security and Privacy`, and `Observability`.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write `reports/task_06.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST emit preflight, normalized tool status, permission outcome, warning, and terminal result lines to stderr using the fixed approved vocabulary (F-04, US-03, US-04).
2. MUST buffer only user-facing agent text in protocol order and publish it to stdout only after `end_turn` plus confirmed cleanup (G-03, F-06).
3. MUST leave stdout empty for cancellation, denial, refusal, limits, invocation/configuration/provider/protocol/transport/cleanup failure, and partial responses (ADR-003).
4. MUST omit thoughts, plans, raw arguments/results, provider stderr, internal errors, and unknown payloads; unknown kinds become conservative fixed labels (HC-11).
5. SHOULD remain stream-injected, line-oriented, color-independent, and byte-testable in redirected and interactive contexts (HC-15, HC-16, M-04).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-03, US-03, F-04 | Separate progress and final response channels | Byte-exact stderr/stdout fixtures |
| US-04, HC-11 | Exclude sensitive/raw payloads | Hostile update matrix |
| F-06, ADR-003 | Publish text only on complete success | Outcome table tests |
| HC-15, HC-16, M-04 | Accessible immediate progress | Injected stream ordering tests |

## Subtasks

- [ ] 06.1 Implement the fixed preflight, activity, tool, permission, warning, and terminal line formatter.
- [ ] 06.2 Implement ordered agent-text buffering and final-newline handling.
- [ ] 06.3 Implement success-only stdout release and discard behavior for every non-success outcome.
- [ ] 06.4 Add hostile update and byte-exact redirected-stream tests.
- [ ] 06.5 Run focused and repository-wide verification.

## Implementation Details

Use only neutral event fields explicitly approved by the TechSpec. Do not reuse `src/ui/transcript.ts`, which intentionally renders thoughts and raw tool data for the cockpit. Provider stderr may inform a normalized failure category upstream but is never copied into the reporter.

### Relevant Files

- `src/exec-output.ts` — create; safe reporter and final-text buffer.
- `tests/exec-output.test.ts` — create; byte-exact and hostile-update suite.

### Dependent Files

- `src/acp-turn.ts` — neutral lifecycle events and terminal results.
- `src/exec.ts` — task_08 owns orchestration and calls the reporter.
- `src/ui/transcript.ts` — prohibited renderer reference; must remain unchanged.

### Related ADRs

- [ADR-002: User-Owned Permissions and Human Exec Contract](adrs/adr-002-user-owned-permissions-human-exec.md) — stderr/stdout and visibility boundary.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — deny-by-default renderer and success-only stdout.

## Deliverables

- Safe exec reporter and buffered final-text contract.
- Byte-exact redirection, hostile-update, and outcome tests.
- Updated shared and `task_06` memory when warranted.
- `reports/task_06.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] Given resolved context, write the approved preflight lines to stderr before provider activity.
- [ ] Given multiple text chunks, preserve order and add one trailing newline only when needed.
- [ ] Given each non-success outcome, emit its terminal status and keep stdout byte-empty.
- [ ] Given thoughts, plans, raw tool input/output, provider stderr, paths, or unknown payloads, never serialize them.

### Integration Tests

- [ ] Given separated injected stdout/stderr streams, redirected stdout captures only a successful final response while progress remains visible on stderr.

### Platform or Manual Evidence

- [ ] Review captured plain-text output without color or animation; live providers are certified in task_09.

### Verification Commands

- `rtk bun test ./tests/exec-output.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Output bytes match the approved channel and vocabulary contract.
- No prohibited provider or tool payload reaches either default human channel.
- Focused tests and the full gate pass to terminal exit.
- New testable logic reaches at least 80% coverage when measurable.
- No packet, cockpit, provider, or CLI behavior changes.
- Memory and the final report record exact output evidence.
