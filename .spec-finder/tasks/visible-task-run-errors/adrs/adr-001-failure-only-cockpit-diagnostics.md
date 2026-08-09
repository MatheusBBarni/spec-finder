# ADR-001: Failure-Only Cockpit Diagnostics

## Status

Accepted

## Date

2026-08-08

## Context

During an interactive Spec Finder run, the engine emits a failed task status, its surfaced error message, and a final failed outcome. The cockpit projects that information, but the command unconditionally destroys the renderer once the run returns. An operator therefore loses the final state before they can inspect it.

The approved target user is an operator watching an active ACP task run. They need to read the failed task ID, the complete surfaced failure message, final run outcome, and a concise recovery hint before leaving the terminal UI. Successful runs should retain their current exit behavior. `--no-ui` and non-interactive execution must never wait for dismissal and must retain their failure output and non-zero result.

## Decision Drivers

- Make every interactive task-run failure readable and actionable at its terminal moment.
- Preserve the engine event contract and existing successful-run flow.
- Avoid terminal hangs, duplicate cleanup, and accidental retry or permission controls.
- Keep full surfaced error visibility distinct from raw ACP payloads, stacks, telemetry, or durable diagnostics.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | `runCommand` creates the cockpit for interactive runs and unconditionally closes it in `finally`. | [`src/commands.ts`](../../../../src/commands.ts) | 2026-08-08 |
| Repository | The engine emits failed task status, the thrown error text, then `run_finished`. | [`src/engine.ts`](../../../../src/engine.ts) | 2026-08-08 |
| Repository | The cockpit already has failed-task reasons and a final summary, but its compact reason is first-line and width-truncated. | [`src/ui/store.ts`](../../../../src/ui/store.ts), [`src/ui/App.tsx`](../../../../src/ui/App.tsx) | 2026-08-08 |
| Repository | Existing renderer tests cover a failure summary but not a command/PTY hold before destruction. | [`tests/cockpit.test.tsx`](../../../../tests/cockpit.test.tsx), [`tests/commands.test.ts`](../../../../tests/commands.test.ts) | 2026-08-08 |
| External | Failed CI runs are designed to keep logs available for diagnosis and rerun. | [GitHub Actions logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs), [GitLab job logs](https://docs.gitlab.com/ci/jobs/job_logs/), [Buildkite log output](https://buildkite.com/docs/pipelines/configure/managing-log-output) | Accessed 2026-08-08 |
| External | OpenTUI restores terminal state only when its renderer is destroyed, allowing a final interactive state before explicit cleanup. | [OpenTUI renderer](https://opentui.com/docs/core-concepts/renderer/) | Accessed 2026-08-08 |
| User decision | Select the focused failure-only final diagnostic screen; optimize for active-run operators and preserve current successful exits. | Idea-factory clarification and opportunity decision | 2026-08-08 |

## Decision

Adopt a failure-only, explicitly dismissible final cockpit state for interactive task runs.

- A failed terminal run remains visible until the operator dismisses it with `Esc`, `q`, or Ctrl+C.
- The final state shows the failed task ID, complete surfaced `Error.message`, final outcome/counts, and a concise recovery hint.
- `q` and Ctrl+C continue to cancel an active run; after a failed terminal state they dismiss without initiating a second cancellation.
- Renderer cleanup has one idempotent command-owned path after dismissal. Successful runs, cancellations, pre-summary errors, `--no-ui`, and non-interactive streams do not await dismissal.
- The final detail excludes stack traces and raw ACP payloads. It adds no retry, persistence, history, telemetry, or new workflow controls.

## Alternatives Considered

### Delay destruction only

- **Benefits:** Smallest apparent change and reuses the existing summary and transcript.
- **Costs/risks:** The summary truncates failure text, so it does not ensure the operator can read the exact surfaced message before dismissal.
- **Why not selected:** It fails the selected V1 outcome and issue acceptance criteria.

### Durable failure history and recovery center

- **Benefits:** Supports cross-run diagnosis and could enable richer follow-up workflows.
- **Costs/risks:** Introduces retention, privacy, schema, and control-plane decisions far beyond the lifecycle defect.
- **Why not selected:** The evidence and user decision favor an in-session failure view with no persistence or retry behavior.

## Consequences

### Positive

- Operators can inspect the exact failure at the moment it occurs.
- Successful runs remain fast and familiar.
- The existing engine failure events remain authoritative and unchanged.
- Deterministic PTY coverage can prove the renderer remains visible and later restores the terminal.

### Negative and trade-offs

- Failure termination becomes an explicit interaction state rather than immediate command completion.
- The UI requires a readable full-error detail treatment and an additional lifecycle seam.
- Exact surfaced errors can expose ordinary provider or workspace context already present in the run; no new storage is introduced.

### Risks and mitigations

- **Dismissal wait hangs a non-interactive process** — only await dismissal for an interactive failed terminal state; bypass it for `--no-ui` and non-interactive streams.
- **Renderer cleanup happens twice or not at all** — use one idempotent command-owned cleanup path and test every terminal outcome.
- **Long or multiline errors become unreadable** — render full surfaced message with wrapping or scrolling and cover long/multiline fixtures.
- **Final UI becomes a second control plane** — retain only dismissal; exclude retry, permission, status, and task-edit controls.

## Reversibility

The change is local to the command/cockpit presentation lifecycle. Removing the post-failure wait and final-detail surface restores immediate cleanup without task-file, event-schema, provider, or persisted-data migration.

## Follow-ups

- Verify failure-until-dismissal, exact error readability, one cleanup, active cancellation, success, `--no-ui`, and non-interactive behavior through focused tests and a PTY smoke test.
- Recheck OpenTUI lifecycle assumptions if its renderer version changes before implementation.

## References

- [Issue #5](https://github.com/MatheusBBarni/spec-finder/issues/5)
- [OpenTUI renderer](https://opentui.com/docs/core-concepts/renderer/)
- [GitHub Actions workflow logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs)
