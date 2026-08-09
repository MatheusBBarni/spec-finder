# Task 06 Final Report: Enforce Safe Exec Output and Success-Only Stdout

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: Mock ACP fixture and implementation-phase ACP session; live provider certification is not part of this task and remains downstream work.

Task 06 adds the deny-by-default human exec output boundary. Fixed preflight, tool, permission, warning, and terminal-result lines are emitted on stderr; user-facing agent text is buffered in protocol order and reaches stdout only after a confirmed `end_turn` and cleanup. Task frontmatter remains runtime-owned and was not changed by this report phase.

## Changes

- `src/exec-output.ts` — Added the injected-stream `ExecOutputReporter`, fixed preflight and progress vocabulary, tool/permission normalization, hostile-update omission, ordered text buffering, newline handling, terminal outcome mapping, idempotent finalization, and success-only stdout publication.
- `tests/exec-output.test.ts` — Added byte-exact preflight, redirected-stream, text-order, outcome, hostile-payload, cleanup, lifecycle-failure, and normalization coverage.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` — Promoted the durable reporter/channel handoff for downstream exec integration.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_06.md` — Recorded the output contract decisions, correction, dependency evidence, and exact verification results.

The worktree contains unrelated pre-existing packet, checkpoint, CLI, UI, and other task changes; they were preserved and are not attributed to Task 06. `src/ui/transcript.ts`, CLI routing, provider launch, permission prompting, and capability certification were not changed for this task.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Emit fixed preflight, normalized tool, permission, warning, and terminal-result lines to stderr. | Satisfied | `ExecOutputReporter.preflight`, `consumeSessionUpdate`, permission handling, warning handling, and `finish` use the approved `[exec]` vocabulary. The focused suite asserts byte-exact preflight, tool, permission, warning, and result output. |
| 2. Buffer only user-facing agent text and publish it after `end_turn` plus confirmed cleanup. | Satisfied | `agent_message_chunk` text is appended in event order; `finish` requires `stopReason: "end_turn"` and `cleanup: "confirmed"`, then adds one newline only when needed. Multiple-chunk and result-only fixtures pass. |
| 3. Keep stdout empty for cancellation, denial, refusal, limits, invocation/configuration/provider/protocol/transport/cleanup failure, and partial responses. | Satisfied | The outcome matrix asserts empty stdout for cancellation, permission denial, refusal, token/turn limits, invocation, configuration, provider, and cleanup outcomes. Lifecycle failure handling maps protocol/provider/transport failures to `provider-error`; cleanup failure overrides success and discards buffered text. |
| 4. Omit thoughts, plans, raw arguments/results, provider stderr, internal errors, and unknown payloads; normalize unknown kinds conservatively. | Satisfied | Hostile-update fixtures include secret thoughts, plans, paths, raw input/output, provider stderr, unknown events, and unknown updates. They assert no secret reaches either channel and unknown tool data becomes fixed `other`/warning labels. |
| 5. Remain injected, line-oriented, color-independent, and byte-testable. | Satisfied for the task boundary | Streams are injected through a narrow `write(string)` contract; redirected stdout/stderr fixtures assert exact plain-text bytes and ordering. Focused coverage is 100% functions and 100% lines. Manual timing and live-provider/platform certification remain downstream release evidence. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/exec-output.test.ts` | Passed | 11 tests, 0 failures, 48 expectations. |
| `rtk bun test --coverage ./tests/exec-output.test.ts` | Passed | 11 tests, 0 failures, 48 expectations; `src/exec-output.ts` measured 100.00% functions and 100.00% lines. |
| `rtk bun run check` | Passed | Strict TypeScript check completed with `tsc --noEmit`. |
| `rtk bun run verify` | Passed | 216 tests, 0 failures, 1,072 expectations across 24 files; Bun build completed and produced `dist/cli.js` at 240.19 KB. |
| `rtk git diff --check` | Passed | No whitespace errors reported during implementation verification. |

The evidence was complete and fresh at report-phase preflight, so verification was not rerun during this report phase.

## Risks and Follow-ups

- Live Claude/Codex/Cursor output, permission, cancellation, persistence, and provider certification remain downstream release work.
- Native Linux and Windows descendant-cleanup evidence remains a Task 09 release blocker; the local output suite uses injected streams and fixture lifecycle results.
- The accepted same-user concurrent pathname replacement race and the distinction between ACP host callbacks and provider-native tool containment remain documented V1 limitations.
- The concise contract intentionally discards partial text on non-success outcomes; richer diagnostics or machine-readable output are deferred by the approved design.
- Task 08 must compose this reporter with the packet-free exec orchestrator without importing packet events or the cockpit transcript.

## Final Verdict

Task 06 is completed for its implementation boundary: the safe exec reporter now enforces fixed stderr progress, hostile-payload omission, ordered agent-text buffering, and success-only stdout publication, with focused byte-exact coverage and a passing repository-wide verification gate. Runtime lifecycle status remains owned by Spec Finder and was not changed here; provider and cross-platform release certification remain explicitly downstream.
