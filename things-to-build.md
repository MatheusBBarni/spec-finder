 P0 — product honesty

 These are the items that will make operators distrust the CLI.

 1. Dogfood archive ≠ git HEAD.
 packet-inspection-cliand cockpit-permission-prompt are status: completed in gitignored .spec-finder/tasks_done/. Reports name
 src/packet-inspect.ts, lsCommand, waiting permission UI, a/r. Current tree:

 - no ls / inspect in src/cli.tsx
 - PacketPermissionBroker still auto-cancels cockpit prompt (src/acp-client.ts)
 - store still no-ops permission_requested

 Packets live outside git, so “completed” can mean local work that never shipped. That is a process bug as much as a feature
 gap.

 2. Checkpoint vs gitignore deadlock.
 Setup ignores /tasks/, /tasks_done/, /specs/. This workspace has auto_commit: true. Result: loop-packet-driver is 6/6
 completed and unarchivable because task_01 checkpoint git add failed on ignored .spec-finder/tasks. Archive refuses
 checkpoint.state: blocked. Recovery commits are code-tree only; packet status never lands in git.

 3. exec is advertised and unusable.
 EXEC_PROVIDER_CERTIFICATIONis { exec: false } for every provider. Host access is forced read-only. Linux/Windows cleanup
 evidence is missing (README M-06). The command is a preflight brick.

 4. Docs lag shipped UI.
 README / CLI HELP still say “cockpit iteration meters … are later.” Title bar already shows them. Website still says TDD is
 “a separate opt-in design”; tdd.json already drives run/loop/batch.

 5. sf-write-spec is a second source of truth.
 Doctrine: specs/<slug>-spec.md is the implementation prompt. runTaskPacket never reads it — only task.source + _prd.md +
 _techspec.md. README still claims “without … a second source of truth.”

 P1 — operator features worth building

 Ranked by daily pain.

 ┌───┬──────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────┐
 │ # │ Feature                  │ Why                                                                                        │
 ├───┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 1 │ spec-finder ls / inspect │ Restore the archived packet. Glance remaining / early-stage / blocked / invalid without    │
 │   │                          │ taking the run-lock. Inspect one slug: remaining ids, checkpoint/handoff error, loop       │
 │   │                          │ terminal if present.                                                                       │
 ├───┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 2 │ Cockpit permission wait  │ Default permissions: "prompt" currently cancels every tool request in the TUI. Either      │
 │   │ + a/r                    │ implement the archived prompt, or fail closed before spawn when UI is on. Silent cancel is │
 │   │                          │ the worst of both.                                                                         │
 ├───┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 3 │ Checkpoint policy that   │ Never git add ignored packet paths. Stage src//tests/ only, or snapshot packet state       │
 │   │ respects gitignore       │ outside git. Unblocks archive of fully-done dogfood packets.                               │
 ├───┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 4 │ Failed-task retry        │ Loop treats status: failed as terminal. --reset-state rewrites loop/state.json only. Need  │
 │   │                          │ retry / unfail, or loop will never finish a packet that exhausted one implementation       │
 │   │                          │ attempt.                                                                                   │
 ├───┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 5 │ PR CI: bun run verify on │ Only workflows today: Pages deploy on main, manual release.yml. TUI/runtime regressions    │
 │   │ pull_request             │ land untested. Add Ubuntu verify; optional macOS for OpenTUI / test:pty.                   │
 ├───┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 6 │ Certify one exec         │ Codex or Claude on Darwin first. Until then, hide exec from HELP/README Features, or mark  │
 │   │ provider on one OS       │ it experimental and refuse at parse.                                                       │
 ├───┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 7 │ sf-review then           │ Already named later. Review: diff vs TechSpec contracts vs report evidence, no status      │
 │   │ ship-as-done             │ write. Ship: no blocked checkpoint, docs, optional PR. Task-complete is too weak as        │
 │   │                          │ “done.”                                                                                    │
 ├───┼──────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 8 │ Fix help/footer key lies │ Help advertises Shift+Tab; useKeyboard only handles Tab. Batch summary overlay claims ↑/↓  │
 │   │                          │ packet browse; live batch uses ←/→. Pin behavior, not strings.                             │
 └───┴──────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────┘
