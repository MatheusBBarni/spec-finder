# Task 06 Final Report: Publish the CLI Contract and Release Evidence

## Outcome

- Task: `task_06` — Publish the CLI Contract and Release Evidence.
- Outcome: Published the opt-in batch CLI contract in help and the README, preserved the existing single-slug examples, added public-help regression coverage, and recorded fresh verification plus deterministic three-packet acceptance evidence.
- Verdict: completed
- Date: 2026-08-08
- Provider/session: unavailable; report produced from the shared local worktree with fresh terminal verification.

## Changes

- `src/cli.tsx` — Added the exact `--multiple <slug1,slug2,...>` usage, supported runtime flags, strict rejection rules, outcome vocabulary, manual recovery guidance, and explicit non-goals. Guarded the executable entrypoint with `import.meta.main` so help can be imported by tests without launching the process body.
- `README.md` — Added ordered batch examples, serial fail-fast and exit semantics, outcome/recovery table, no-retry guidance, compatibility notes, and persistence/rollback/resume/parallelism/telemetry non-goals while retaining the single-slug and `--no-ui` examples.
- `tests/cli.test.ts` — Added help-surface tests for single-slug compatibility, batch discoverability, runtime flags, rejection wording, outcomes, and absence of retry/parallel options.
- `.spec-finder/tasks/ordered-multiple-task-run/memory/task_06.md` — Recorded the final report-phase verification, built-help check, and acceptance facts through `sf-memory`.

The shared checkout also contains prior task implementation, packet, task-memory, and unrelated dirty files. Those changes were preserved and are not attributed to task_06. The task frontmatter was not changed by this report phase.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Document exactly one opt-in `--multiple <slug1,slug2,...>` grammar, supported runtime flags, and rejection rules. | Satisfied | `src/cli.tsx` help and `README.md` document one ordered comma-list, `--no-ui`, provider/model/reasoning/speed flags, and all implemented rejection classes. `tests/cli.test.ts` asserts the public strings; the focused run passed 67/67 tests. The rebuilt `dist/cli.js help` command exited 0 with the same contract. |
| 2. Document serial fail-fast behavior, distinct failure/cancellation outcomes, later `not_started` packets, already-complete success, no retry, and manual recovery. | Satisfied | README outcome table and help copy cover `succeeded`/`already complete`, `failed`, `cancelled`, `not_started`, stop boundaries, no automatic retry, and manual rerun. The three-packet smoke reached the middle failure and cancellation cases and showed packet 3 `not_started`, distinct stopping labels, manual recovery text, and exit 1. |
| 3. Preserve existing single-slug examples and explain that batch mode adds no persistence, rollback, or telemetry. | Satisfied | `README.md` retains `spec-finder run my-feature` and `spec-finder run my-feature --no-ui`, and explicitly states no persistence/durable history, rollback, resume, parallelism, continue-on-error, retry, or telemetry. The batch branch is opt-in and no configuration or single-run contract was changed by task_06. |
| 4. Run and record focused tests, `rtk bun run verify`, and three-packet acceptance evidence. | Satisfied | The focused command, TypeScript check, full repository gate, built-help check, and a completed three-packet harness recording the expected success/failure/cancellation exits are shown below. The PRD/TechSpec M-03 4-of-5 human stopping-packet usability measurement was not performed and remains an explicit release follow-up; it is not claimed as complete. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/cli.test.ts ./tests/commands.test.ts ./tests/batch.test.ts ./tests/store.test.ts ./tests/cockpit.test.tsx` | PASS (exit 0) | Bun 1.3.13; 67 tests passed, 0 failed, 401 expectations across 5 files. |
| `rtk bun run check` | PASS (exit 0) | `tsc --noEmit` completed without diagnostics. |
| `rtk bun run verify` | PASS (exit 0) | Check passed; 102 tests passed, 0 failed, 517 expectations across 15 files. Bun bundled 18 modules into `dist/cli.js` (135.75 KB). |
| `rtk proxy git diff --check` | PASS (exit 0) | No whitespace errors reported. |
| `rtk bun dist/cli.js help` | PASS (exit 0) | Built CLI printed both single-slug and exact batch usage, supported flags, rejection rules, outcomes, manual recovery, and non-goals. |
| Three-packet acceptance smoke through `runCommand` and real `runBatch` with an injected packet runner for `ordered-multiple-task-run`, `read-only-progress-navigator`, and `tui-demo` | PASS (harness exit 0; scenario exits recorded) | All-success invoked all three packets and returned exit 0 with aggregate succeeded. Middle failure invoked only packets 1–2, returned exit 1, marked packet 3 `not_started`, identified the failed stopping packet, and printed no-retry/manual-rerun guidance. Middle cancellation had the same stop boundary and exit 1 with distinct `cancelled` wording. No provider process was launched because the runner was injected. |

## Risks and Follow-ups

- The M-03 human usability check (five evaluators; at least four identifying the stopping packet and later `not_started` packet) remains unperformed. Deterministic frame/output and smoke evidence do not substitute for that measurement.
- The three-packet smoke used an injected runner, so it validates the real command/coordinator and terminal presentation path without exercising a live ACP/provider process. Live provider cancellation timing remains a broader integration risk.
- Preflight remains a point-in-time snapshot; filesystem changes after preflight can fail a later packet, and earlier successes are intentionally not rolled back.
- Verification ran in the shared dirty checkout. Unrelated changes were preserved, and Spec Finder still owns task frontmatter/status and report lifecycle metadata.

## Final Verdict

Completed: task_06 publishes the approved opt-in batch contract, preserves the existing single-run workflow, adds public-help regression coverage, and has fresh focused/full gates plus deterministic all-success, failure, and cancellation acceptance evidence. The M-03 human evaluator result and live-provider exercise remain explicit release follow-ups and are not represented as completed. The task frontmatter remains `status: in_progress` under Spec Finder ownership.
