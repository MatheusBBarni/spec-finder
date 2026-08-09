# Spec Finder Tasks Report

Generated: 2026-08-08

Completion is determined by the canonical `status:` field in every `task_NN.md`. A packet moves to `.spec-finder/tasks_done/` only when it contains at least one task and every task is exactly `completed`.

## Summary

| Location | Packets | Task files |
|---|---:|---:|
| Remaining (`.spec-finder/tasks/`) | 9 | 4/47 |
| Archived (`.spec-finder/tasks_done/`) | 1 | 6/6 |

- Moved this run: 1 packet (6 tasks)
- Report-only: no

## Remaining

| Packet | Title | Completed | Non-completed statuses | Index | Unchecked boxes |
|---|---|---:|---|---|---:|
| `ad-hoc-acp-exec` | Guarded One-Turn ACP Exec Product Requirements Document | 0/10 | pending (10) | indexMatch | 135 |
| `config-driven-task-checkpoints` | Config-Driven Per-Task Git Checkpoints Product Requirements Document | 0/7 | pending (7) | indexMatch | 79 |
| `empty-run-state` | Explicit Empty-Run State Product Requirements Document | 0/3 | pending (3) | indexMatch | 31 |
| `npm-release-automation` | Guided Stable-Release Contract Product Requirements Document | 0/6 | pending (6) | indexMatch | 55 |
| `read-only-progress-navigator` | Read-Only Progress Navigator with Integrated Task Timer — Product Requirements Document | 4/7 | pending (3) | indexMatch | 105 |
| `single-provider-setup` | Single-provider setup Product Requirements Document | 0/3 | pending (3) | indexMatch | 33 |
| `task-report-outcome` | Task-Report Outcomes Product Requirements Document | 0/5 | pending (5) | indexMatch | 51 |
| `tui-demo` | TUI Demo PRD | 0/1 | failed (1): `task_01` | indexNoStatus | 5 |
| `visible-task-run-errors` | Keep Task-Run Errors Visible in the ACP Cockpit — Product Requirements Document | 0/5 | pending (5) | indexMatch | 45 |

No early-stage packets were found.

## Moved This Run

| Packet | Title | Tasks | Destination |
|---|---|---:|---|
| `ordered-multiple-task-run` | Ordered Multi-Packet Run Product Requirements Document | 6 | `.spec-finder/tasks_done/ordered-multiple-task-run` |

## Previously Archived

None.

## Warnings and Skips

- `ordered-multiple-task-run`: `indexDrift(0)` was reported by the classifier. Per-task frontmatter remained authoritative, and all 6 tasks were exactly `completed`.
- Destination conflicts: none.
- Unexpected statuses: none.
