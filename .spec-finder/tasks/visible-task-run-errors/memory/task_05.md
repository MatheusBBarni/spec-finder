# Task Memory: task_05

## Objective Snapshot

- Deliver the deterministic macOS PTY release gate and manual smoke evidence checklist.

## Important Decisions

- Use absolute `/usr/bin/script` and `/usr/bin/expect`; no new native package or live provider is allowed.
- Keep the deterministic fixture's run-lock root synthetic and per-process so a
  stale or unrelated workspace lock cannot suppress the PTY review.

## Learnings

- Terminal control sequences require tolerant assertions; the original failed command exit remains `1` after Esc dismissal.
- `rtk bun run test:pty` passed on macOS with `/usr/bin/script` and
  `/usr/bin/expect`, observing the retained review, all three multiline error
  lines, the fixed hint, Esc dismissal, and `FIXTURE_EXIT=1`.
- Focused store/cockpit/command coverage passed (`83 pass`), and
  `rtk bun run verify` passed (`318 pass`, type check and build included).
- Recorded platform tools: Darwin 25.6.0 arm64, Bun 1.3.13, Expect 5.45, and
  BSD `script` `PROGRAM:script PROJECT:shell_cmds-329`.
- On the installed macOS Expect 5.45, multi-pattern clauses must be passed as
  separate command arguments; the protocol uses that form so timeout and EOF
  actions execute reliably.

## Files / Surfaces

- `package.json`, `tests/fixtures/failure-review-cli.ts`, and `tests/failure-review.pty.expect`.

## Errors / Corrections

- An initial PTY assertion failure left the fixture's run lock behind; the
  Expect failure path now closes and waits for its child, and the fixture avoids
  the checkout's normal run-lock key.

## Ready for Next Run

- The automated PTY release gate is implemented and passing. Before default-on
  release, manually smoke one single failure and one batch failure in a real
  terminal, confirm each review remains readable until dismissal and the
  terminal is restored, then confirm `--no-ui` completes immediately.
