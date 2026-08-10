# Task 02 Final Report: Issue Validated Report References

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: deterministic ACP fixture; provider identity unavailable; both turns reused `test-session`

## Changes

- `src/engine.ts` — passes explicit `implementation` and `report` phases to the packet session and each turn; computes a safe report reference only after successful report stop and `assertReport`, then emits it only with completed status.
- `src/events.ts` — adds optional `reportReference` to the additive `task_status` event.
- `src/paths.ts` — adds canonical workspace-relative reference validation using `realpath`, containment checks, slash normalization, and fail-closed unsafe-path handling.
- `tests/fixtures/mock-agent.ts` — keeps a configurable repeated session ID and can emit malicious report-phase session metadata.
- `tests/engine.test.ts` — covers explicit phase ordering, reused-session malicious metadata, valid references, external symlink omission, report handoff failure, and implementation failure boundaries.
- `tests/paths.test.ts` — covers valid, empty, traversal, absolute, control-containing, and external/symlink-resolved references.
- `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `memory/task_02.md` — recorded durable implementation and verification handoff facts.
- `task_02.md` lifecycle metadata remains runtime-owned; its status was not changed by this report phase.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Pass explicit `implementation` and `report` phases to both ACP turns. | Satisfied | Engine calls the session seam and `runTurn` with both literals; the first engine scenario observes both phases on updates from the same `test-session`. |
| 2. Emit `reportReference` only with completed status after existing successful-stop and `assertReport` checks. | Satisfied | Reference calculation occurs after the report phase returns and `assertReport` succeeds; the valid fixture emits a completed status with `.spec-finder/tasks/demo/reports/task_01.md`. |
| 3. Canonically validate and normalize workspace-relative references, rejecting unsafe results. | Satisfied | `resolveWorkspaceRelativeReference` canonicalizes root/target with `realpath`, rejects empty, traversal, POSIX/Windows absolute, control-containing, and external results, and normalizes `/`; path tests and the external-report engine scenario pass. |
| 4. Omit unprovable references without changing validated completion and preserve no-reference failure boundaries. | Satisfied | External symlink resolution still completes the task but emits no reference; report refusal remains the existing resumable blocked handoff with no completed/reference event; implementation permission failure emits no report turn/reference. |
| 5. Extend deterministic repeated-session/malicious-metadata coverage. | Satisfied | The fixture reuses/configures one session ID and emits report `session_info_update` containing prompt/path metadata; engine completion remains based only on the validated report file. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/engine.test.ts` | Passed | 16 tests passed, 0 failed, 110 assertions. |
| `rtk bun run check` | Passed | `tsc --noEmit` exited successfully. |
| `rtk bun run verify` | Passed | Check passed; 300 tests across 29 files passed with 0 failures and 1,749 assertions; production bundle built successfully (`28 modules`, `cli.js` 0.33 MB). |
| `rtk git diff --check` | Passed | No whitespace errors reported. |

The repository has no coverage-threshold tool, so a percentage is not
measurable. Deterministic scenario coverage exercises valid references,
canonical containment, traversal/absolute/control rejection, external and
symlink resolution, repeated-session phase attribution, malicious metadata,
report failure, and pre-report implementation failure.

## Risks and Follow-ups

- Cockpit transcript suppression and task-state/UI projection remain owned by
  later packet tasks; this task leaves those consumers unchanged.
- Evidence is deterministic local ACP/filesystem evidence. Live-provider,
  native-platform, and external ACP validation were not release prerequisites.
- Report-phase failures retain the existing resumable `blocked` handoff
  lifecycle; this task only guarantees that they never emit a completed
  `reportReference`.
- A canonicalization failure intentionally drops the optional shortcut while
  preserving an otherwise validated completion.

## Final Verdict

Task 02 is completed. The engine now supplies authoritative ACP phase context
and emits only canonical, workspace-relative report references after validated
report completion. Unsafe references are omitted without failing completion,
provider metadata cannot establish task outcome, existing implementation/no-UI
boundaries remain intact, and the required focused and repository verification
gates passed with terminal evidence.
