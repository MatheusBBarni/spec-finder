# Task Memory: task_03

## Objective Snapshot

- Enforce the approved fail-closed permission behavior for TUI ACP turns without changing non-TUI policy behavior.

## Important Decisions

- TUI `permissions: "prompt"` returns ACP cancellation and emits a task-scoped read-only notice.
- `approve-all`, `deny`, and `--no-ui` behavior remain unchanged.
- README edits must preserve unrelated existing dirty changes.

## Learnings

- The stable TUI notice is `Permission request cancelled because the cockpit is read-only; configure permissions before rerunning.` and is emitted as task-scoped activity before ACP cancellation is returned.
- The mock agent requests permission only when `SPEC_FINDER_TEST_REQUEST_PERMISSION=1`; `SPEC_FINDER_TEST_EXPECT_PERMISSION` lets focused tests verify allow, reject, or cancelled responses without changing the default engine fixture.
- ACP cancellation returns promptly as `stopReason: refusal` in the failure fixture, and the unchanged engine emits `implementation stopped: refusal` after the read-only notice.

## Files / Surfaces

- `src/acp-client.ts` — permission resolution branch.
- `tests/acp-client.test.ts` and `tests/fixtures/mock-agent.ts` — ACP request fixtures.
- `README.md` — narrow user-facing cockpit/configuration wording.

## Errors / Corrections

- No implementation errors required a plan change.

## Ready for Next Run

- The final-report phase re-ran current verification on 2026-08-04. `bun test tests/acp-client.test.ts tests/engine.test.ts` exited 0 with 6 passed, 0 failed, and 24 expectation calls; `bun run check` exited 0 with no TypeScript diagnostics; `bun run verify` exited 0 with 48 passed, 0 failed, 168 expectation calls, and a successful 17-module `dist/cli.js` build.
- No `permission_requested` event reaches the TUI prompt path; approve-all, deny, non-UI non-TTY prompt cancellation, normal engine completion, and notice-before-failure ordering are covered.
- Automated evidence does not exercise the non-UI interactive-TTY choice UI or a live provider; those paths remain unchanged in the scoped diff and are follow-up validation rather than a task blocker.
- Spec Finder runtime still owns `reports/task_03.md` and the final task lifecycle transition.
