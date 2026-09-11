# Spec Finder Tasks Report

Generated: 2026-09-08

Completion is determined by the canonical `status:` field in every `task_NN.md`. A packet moves to `.spec-finder/tasks_done/` only when it contains at least one task, every task is exactly `completed`, and no completed task has `checkpoint.state: blocked`. A blocked checkpoint remains recoverable in the active packet.

## Summary

| Location | Packets | Task files |
|---|---:|---:|
| Remaining (`.spec-finder/tasks/`) | 2 | 6/7 |
| Archived (`.spec-finder/tasks_done/`) | 17 | 78/78 |

- Moved this run: 6 packets (16 tasks)
- Report-only: no

## Remaining

| Packet | Title | Completed | Non-completed tasks | Index | Unchecked boxes |
|---|---|---:|---|---|---:|
| `loop-packet-driver` | Continuous Packet Loop Driver Product Requirements Document | 6/6 | none; `task_01` checkpoint delivery blocked | indexMatch | 32 |
| `tui-demo` | TUI Demo PRD | 0/1 | `task_01`: pending | indexNoStatus | 5 |

No early-stage packets were reported.

`loop-packet-driver` stays in `.spec-finder/tasks/` because the classifier emitted `checkpoint-blocked(>-)` for `task_01` (`status: completed`, `checkpoint.state: blocked`). Operator-facing reason: `checkpoint blocked: git add failed: The following paths are ignored by one of your .gitignore files: .spec-finder/tasks`. Resolve that local Git condition and retry checkpoint delivery before archiving.

`loop-packet-driver` titles: Implement packet-local loop ledger; Implement pure loop detect and classification; Add optional engine loop feedback prefix; Implement loop coordinator with injected engine; Wire loop command, lock, and exit mapping; Publish loop vs run help and README.

`tui-demo` `task_01` title: Exercise the Spec Finder cockpit.

## Moved This Run

| Packet | Title | Tasks | Destination |
|---|---|---:|---|
| `cockpit-permission-prompt` | Cockpit permission prompt Product Requirements Document | 3 | `.spec-finder/tasks_done/cockpit-permission-prompt` |
| `exec-launch-policy` | Honest Exec Public Surface Product Requirements Document | 2 | `.spec-finder/tasks_done/exec-launch-policy` |
| `loop-cockpit-meters` | Loop Cockpit Meters Product Requirements Document | 2 | `.spec-finder/tasks_done/loop-cockpit-meters` |
| `packet-inspection-cli` | Packet Inspection CLI Product Requirements Document | 3 | `.spec-finder/tasks_done/packet-inspection-cli` |
| `run-tdd-opt-in` | Runtime TDD Opt-In Product Requirements Document | 3 | `.spec-finder/tasks_done/run-tdd-opt-in` |
| `upgrade-skill-refresh` | Upgrade skill refresh Product Requirements Document | 3 | `.spec-finder/tasks_done/upgrade-skill-refresh` |

`cockpit-permission-prompt` titles: Keep cockpit permission requests waiting; Resolve a waiting permission with a or r; Document cockpit permission wait in README.

`exec-launch-policy` titles: Hide exec from the terminal command surface; Publish honest README exec stub.

`loop-cockpit-meters` titles: Show live loop iteration, caps, and phase in cockpit header; Present named loop terminal as cockpit stop outcome.

`packet-inspection-cli` titles: List active packets from the CLI; Inspect one active packet from the CLI; Publish ls and inspect help and README.

`run-tdd-opt-in` titles: Honor tdd.json on packet run; Fail-close loop and batch on tdd.json; keep it across reset; Document runtime TDD opt-in.

`upgrade-skill-refresh` titles: Recopy managed skills without rewriting config; Add spec-finder refresh with honest gates; Publish refresh as the skill-update path.

## Previously Archived

| Packet | Title | Tasks |
|---|---|---:|
| `ad-hoc-acp-exec` | Guarded One-Turn ACP Exec Product Requirements Document | 10 |
| `config-driven-task-checkpoints` | Config-Driven Per-Task Git Checkpoints Product Requirements Document | 7 |
| `empty-run-state` | Explicit Empty-Run State Product Requirements Document | 3 |
| `npm-release-automation` | Guided Stable-Release Contract Product Requirements Document | 6 |
| `ordered-multiple-task-run` | Ordered Multi-Packet Run Product Requirements Document | 6 |
| `pi-acp-provider` | Pi as a packet-only ACP provider Product Requirements Document | 5 |
| `read-only-progress-navigator` | Read-Only Progress Navigator with Integrated Task Timer — Product Requirements Document | 7 |
| `single-provider-setup` | Single-provider setup Product Requirements Document | 3 |
| `task-report-outcome` | Task-Report Outcomes Product Requirements Document | 5 |
| `tdd-skill-pack` | Parallel TDD Skill Pack - Product Requirements Document | 5 |
| `visible-task-run-errors` | Keep Task-Run Errors Visible in the ACP Cockpit — Product Requirements Document | 5 |

## Warnings and Skips

- `loop-packet-driver`: kept; classifier `checkpoint-blocked(>-)` on `task_01`. Checkpoint error: git add failed because `.spec-finder/tasks` is gitignored.
- `tui-demo`: index has no status column (`indexNoStatus`); remaining because `task_01` status is `pending`, not `completed`.
- Destination conflicts: none.
- Index drift: none.
- Unexpected statuses: none.
- Optional directory reports (`REPORT_pending.md`, `REPORT_done.md`) were absent; only `.spec-finder/TASKS_REPORT.md` was refreshed.
