# Spec Finder Tasks Report

Generated: 2026-08-09

Completion is determined by the canonical `status:` field in every `task_NN.md`. A packet moves to `.spec-finder/tasks_done/` only when it contains at least one task, every task is exactly `completed`, and no completed task has `checkpoint.state: blocked`. A blocked checkpoint remains recoverable in the active packet.

## Summary

| Location | Packets | Task files |
|---|---:|---:|
| Remaining (`.spec-finder/tasks/`) | 6 | 4/24 |
| Archived (`.spec-finder/tasks_done/`) | 4 | 29/29 |

- Moved this run: 3 packets (23 tasks)
- Report-only: no

## Remaining

| Packet | Title | Completed | Non-completed tasks | Index | Unchecked boxes |
|---|---|---:|---|---|---:|
| `empty-run-state` | Explicit Empty-Run State Product Requirements Document | 0/3 | `task_01`–`task_03`: pending | indexMatch | 31 |
| `read-only-progress-navigator` | Read-Only Progress Navigator with Integrated Task Timer — Product Requirements Document | 4/7 | `task_05`–`task_07`: pending | indexMatch | 105 |
| `single-provider-setup` | Single-provider setup Product Requirements Document | 0/3 | `task_01`–`task_03`: pending | indexMatch | 33 |
| `task-report-outcome` | Task-Report Outcomes Product Requirements Document | 0/5 | `task_01`–`task_05`: pending | indexMatch | 51 |
| `tui-demo` | TUI Demo PRD | 0/1 | `task_01`: failed | indexNoStatus | 5 |
| `visible-task-run-errors` | Keep Task-Run Errors Visible in the ACP Cockpit — Product Requirements Document | 0/5 | `task_01`–`task_05`: pending | indexMatch | 45 |

No checkpoint-delivery blockers or early-stage packets were reported.

## Moved This Run

| Packet | Title | Tasks | Destination |
|---|---|---:|---|
| `ad-hoc-acp-exec` | Guarded One-Turn ACP Exec Product Requirements Document | 10 | `.spec-finder/tasks_done/ad-hoc-acp-exec` |
| `config-driven-task-checkpoints` | Config-Driven Per-Task Git Checkpoints Product Requirements Document | 7 | `.spec-finder/tasks_done/config-driven-task-checkpoints` |
| `npm-release-automation` | Guided Stable-Release Contract Product Requirements Document | 6 | `.spec-finder/tasks_done/npm-release-automation` |

## Previously Archived

| Packet | Title | Tasks |
|---|---|---:|
| `ordered-multiple-task-run` | Ordered Multi-Packet Run Product Requirements Document | 6 |

## Warnings and Skips

- `ad-hoc-acp-exec`: `indexDrift(0)` was reported by the classifier. Per-task frontmatter remained authoritative, and all 10 tasks were exactly `completed`.
- `config-driven-task-checkpoints`: `indexDrift(0)` was reported by the classifier. Per-task frontmatter remained authoritative, and all 7 tasks were exactly `completed`.
- `npm-release-automation`: `indexDrift(0)` was reported by the classifier. Per-task frontmatter remained authoritative, and all 6 tasks were exactly `completed`.
- `ordered-multiple-task-run`: `indexDrift(0)` remains present in the archived classifier output.
- Destination conflicts: none.
- Unexpected statuses: none.
