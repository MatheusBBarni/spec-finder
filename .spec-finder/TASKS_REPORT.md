# Spec Finder Tasks Report

Generated: 2026-08-17

Completion is determined by the canonical `status:` field in every `task_NN.md`. A packet moves to `.spec-finder/tasks_done/` only when it contains at least one task, every task is exactly `completed`, and no completed task has `checkpoint.state: blocked`. A blocked checkpoint remains recoverable in the active packet.

## Summary

| Location | Packets | Task files |
|---|---:|---:|
| Remaining (`.spec-finder/tasks/`) | 2 | 0/7 |
| Archived (`.spec-finder/tasks_done/`) | 10 | 57/57 |

- Moved this run: 1 packet (5 tasks)
- Report-only: no

## Remaining

| Packet | Title | Completed | Non-completed tasks | Index | Unchecked boxes |
|---|---|---:|---|---|---:|
| `loop-packet-driver` | Continuous Packet Loop Driver Product Requirements Document | 0/6 | `task_01`–`task_06`: pending | indexMatch | 79 |
| `tui-demo` | TUI Demo PRD | 0/1 | `task_01`: pending | indexNoStatus | 5 |

No checkpoint-delivery blockers or early-stage packets were reported.

`loop-packet-driver` titles: Implement packet-local loop ledger; Implement pure loop detect and classification; Add optional engine loop feedback prefix; Implement loop coordinator with injected engine; Wire loop command, lock, and exit mapping; Publish loop vs run help and README.

`tui-demo` `task_01` title: Exercise the Spec Finder cockpit.

## Moved This Run

| Packet | Title | Tasks | Destination |
|---|---|---:|---|
| `tdd-skill-pack` | Parallel TDD Skill Pack - Product Requirements Document | 5 | `.spec-finder/tasks_done/tdd-skill-pack` |

## Previously Archived

| Packet | Title | Tasks |
|---|---|---:|
| `ad-hoc-acp-exec` | Guarded One-Turn ACP Exec Product Requirements Document | 10 |
| `config-driven-task-checkpoints` | Config-Driven Per-Task Git Checkpoints Product Requirements Document | 7 |
| `empty-run-state` | Explicit Empty-Run State Product Requirements Document | 3 |
| `npm-release-automation` | Guided Stable-Release Contract Product Requirements Document | 6 |
| `ordered-multiple-task-run` | Ordered Multi-Packet Run Product Requirements Document | 6 |
| `read-only-progress-navigator` | Read-Only Progress Navigator with Integrated Task Timer — Product Requirements Document | 7 |
| `single-provider-setup` | Single-provider setup Product Requirements Document | 3 |
| `task-report-outcome` | Task-Report Outcomes Product Requirements Document | 5 |
| `visible-task-run-errors` | Keep Task-Run Errors Visible in the ACP Cockpit — Product Requirements Document | 5 |

## Warnings and Skips

- `tui-demo`: index has no status column (`indexNoStatus`); remaining because `task_01` status is `pending`, not `completed`.
- Destination conflicts: none.
- Index drift: none.
- Unexpected statuses: none.
- Optional directory reports (`REPORT_pending.md`, `REPORT_done.md`) were absent; only `.spec-finder/TASKS_REPORT.md` was refreshed.
