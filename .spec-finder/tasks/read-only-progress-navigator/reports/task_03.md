# Task 03 Final Report: Enforce read-only ACP permission handling

## Outcome

- Verdict: completed
- Date: 2026-08-04
- Provider/session: unavailable in the task artifacts
- Outcome: TUI-mode ACP `permissions: "prompt"` now fails closed by emitting a stable task-scoped read-only notice and returning cancellation without an interactive permission event. Approve-all, deny, non-UI prompting boundaries, the existing engine failure path, raw event contracts, and provider launch behavior remain intact.

## Changes

- `src/acp-client.ts` — Replaced the TUI prompt promise/event branch with a task-scoped read-only activity notice and an ACP cancelled response.
- `tests/acp-client.test.ts` — Added focused coverage for approve-all, deny, TUI cancellation without `permission_requested`, and non-UI non-TTY prompt cancellation.
- `tests/engine.test.ts` — Added integration coverage proving the read-only notice precedes the existing `implementation stopped: refusal` failure activity and the task fails without an interactive permission event.
- `tests/fixtures/mock-agent.ts` — Made permission requests opt-in and added expected allow, reject, or cancelled response assertions without changing the default engine fixture behavior.
- `README.md` — Corrected the cockpit and `permissions: "prompt"` descriptions to document the read-only cancellation behavior and preserved non-UI prompting semantics.
- `.spec-finder/tasks/read-only-progress-navigator/memory/task_03.md` — Recorded implementation facts, current terminal verification, and the remaining manual-validation gap.
- `.spec-finder/tasks/read-only-progress-navigator/memory/MEMORY.md` — Recorded the packet-level task 03 completion handoff for task 04.
- `.spec-finder/tasks/read-only-progress-navigator/reports/task_03.md` — Added this evidence-backed final report.

The current worktree also contains task 01/task 02 implementation artifacts and runtime-owned task frontmatter transitions. This final-report phase preserved those changes and did not change `task_03.md` status.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Cancel a TUI-mode `permissions: "prompt"` request, emit a stable task-scoped read-only notice, and avoid an interactive `permission_requested` event. | Satisfied | `resolvePermission` emits `Permission request cancelled because the cockpit is read-only; configure permissions before rerunning.` with the current task ID and returns ACP `cancelled`. The focused TUI test passed with `stopReason: refusal`, observed the exact activity event and cancelled response, and asserted that no `permission_requested` event was emitted. The engine integration test also passed and proved the notice appears before the existing failure activity. |
| 2. Preserve approve-all, deny, non-UI prompt behavior, and the existing engine failure outcome. | Satisfied | Current focused tests passed for approve-all selecting the allow option, deny selecting the reject option, and non-UI prompt cancellation when stdin is not interactive without a cockpit read-only notice. The engine integration test returned `{ ok: false, completed: 0, failed: 1, blocked: 0 }` and observed the unchanged `implementation stopped: refusal` activity after the notice. The non-UI interactive-TTY branch remains source-identical after the new TUI branch. |
| 3. Keep the ACP transport and raw `RunEvent` contract unchanged. | Satisfied | The change is confined to the existing internal `resolvePermission` callback and continues returning the SDK's existing `RequestPermissionResponse`. `git diff -- src/events.ts src/engine.ts src/commands.ts package.json bun.lock` exited 0 with no output, and TypeScript plus the full repository gate passed without protocol, engine, command-wiring, or dependency changes. |
| 4. Update user-facing cockpit/configuration documentation without reverting unrelated README changes. | Satisfied | The current README diff contains exactly two narrow wording replacements: the cockpit is described as read-only without permission requests, and prompt policy documents TUI cancellation plus existing `--no-ui` behavior. The rest of the README remains unchanged in the current diff. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/acp-client.test.ts tests/engine.test.ts` | Passed, exit 0 | Bun 1.3.13 ran 6 tests across 2 files: 6 passed, 0 failed, 24 expectation calls. Coverage includes approve-all, deny, TUI prompt cancellation, non-UI non-TTY cancellation, normal report completion, and notice-before-failure ordering. |
| `rtk bun run check` | Passed, exit 0 | `tsc --noEmit` completed with no TypeScript diagnostics. |
| `rtk bun run verify` | Passed, exit 0 | The exact repository gate ran `bun run check && bun test && bun run build`: 48 tests across 13 files passed, 0 failed, 168 expectation calls; the production build bundled 17 modules into `dist/cli.js` (73.23 KB). |
| `rtk proxy git diff --check` | Passed, exit 0 | The command produced no output, so the current tracked diff has no whitespace errors. |
| `rtk proxy git diff -- src/events.ts src/engine.ts src/commands.ts package.json bun.lock` | Clean for protected boundaries, exit 0 | The command produced no output, confirming no change to raw events, engine implementation, TUI/non-UI wiring, dependencies, or lockfile. |
| README diff inspection | Passed | The diff shows only the assigned cockpit sentence and `permissions` policy sentence changed; no other README lines were modified. |

## Risks and Follow-ups

- Automated coverage exercises non-UI prompt behavior with non-interactive stdin. The interactive-TTY option picker remains unchanged in source but was not manually exercised in this phase.
- Cancellation was verified through the repository mock ACP agent, not a live Claude, Codex, or Cursor provider. A future provider smoke test can validate provider-specific cancellation presentation without changing this task's contract.
- The current App/store still contains the legacy permission modal state for build compatibility. The normal TUI prompt path can no longer emit `permission_requested`; task 04 owns removing the unreachable legacy UI/state while integrating the final read-only cockpit.
- No unresolved risk blocks the scoped task 03 deliverables.

## Final Verdict

Completed. All four numbered requirements are satisfied by the scoped ACP, fixture, test, documentation, and memory changes. The focused suite, TypeScript check, exact repository verification gate, whitespace check, and protected-boundary inspection all exited successfully. The remaining interactive-TTY, live-provider, and legacy-UI cleanup items are explicit follow-ups and do not invalidate the fail-closed TUI behavior delivered by this task.
