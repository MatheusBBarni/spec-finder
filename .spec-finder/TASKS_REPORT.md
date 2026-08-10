# Spec Finder Tasks Report

Generated: 2026-08-10

Completion is determined by the canonical `status:` field in every `task_NN.md`. A packet moves to `.spec-finder/tasks_done/` only when it contains at least one task, every task is exactly `completed`, and no completed task has `checkpoint.state: blocked`. A blocked checkpoint remains recoverable in the active packet.

## Summary

| Location | Packets | Task files |
|---|---:|---:|
| Remaining (`.spec-finder/tasks/`) | 1 | 0/1 |
| Archived (`.spec-finder/tasks_done/`) | 9 | 52/52 |

- Moved this run: 5 packets (23 tasks)
- Report-only: no

## Remaining

| Packet | Title | Completed | Non-completed tasks | Index | Unchecked boxes |
|---|---|---:|---|---|---:|
| `tui-demo` | TUI Demo PRD | 0/1 | `task_01`: failed | indexNoStatus | 5 |

No checkpoint-delivery blockers or early-stage packets were reported.

`task_01` title: Exercise the Spec Finder cockpit.

## Moved This Run

| Packet | Title | Tasks | Destination |
|---|---|---:|---|
| `empty-run-state` | Explicit Empty-Run State Product Requirements Document | 3 | `.spec-finder/tasks_done/empty-run-state` |
| `read-only-progress-navigator` | Read-Only Progress Navigator with Integrated Task Timer — Product Requirements Document | 7 | `.spec-finder/tasks_done/read-only-progress-navigator` |
| `single-provider-setup` | Single-provider setup Product Requirements Document | 3 | `.spec-finder/tasks_done/single-provider-setup` |
| `task-report-outcome` | Task-Report Outcomes Product Requirements Document | 5 | `.spec-finder/tasks_done/task-report-outcome` |
| `visible-task-run-errors` | Keep Task-Run Errors Visible in the ACP Cockpit — Product Requirements Document | 5 | `.spec-finder/tasks_done/visible-task-run-errors` |

## Previously Archived

| Packet | Title | Tasks |
|---|---|---:|
| `ad-hoc-acp-exec` | Guarded One-Turn ACP Exec Product Requirements Document | 10 |
| `config-driven-task-checkpoints` | Config-Driven Per-Task Git Checkpoints Product Requirements Document | 7 |
| `npm-release-automation` | Guided Stable-Release Contract Product Requirements Document | 6 |
| `ordered-multiple-task-run` | Ordered Multi-Packet Run Product Requirements Document | 6 |

## Warnings and Skips

- `read-only-progress-navigator`: `indexDrift(4)` - `_tasks.md` still lists `task_05`–`task_07` as pending while every `task_NN.md` frontmatter is `completed`. Per-task frontmatter was authoritative; packet archived as DONE.
- `tui-demo`: index has no status column (`indexNoStatus`); remaining because `task_01` status is `failed`, not `completed`.
- Destination conflicts: none.
- Unexpected statuses: none (failed is expected REMAINING).
- Optional directory reports (`REPORT_pending.md`, `REPORT_done.md`) were absent; only `.spec-finder/TASKS_REPORT.md` was refreshed.
