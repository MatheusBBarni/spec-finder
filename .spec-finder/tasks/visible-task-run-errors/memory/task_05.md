# Task Memory: task_05

## Objective Snapshot

- Deliver the deterministic macOS PTY release gate and manual smoke evidence checklist.

## Important Decisions

- Use absolute `/usr/bin/script` and `/usr/bin/expect`; no new native package or live provider is allowed.

## Learnings

- Terminal control sequences require tolerant assertions; the original failed command exit remains `1` after Esc dismissal.

## Files / Surfaces

- `package.json`, `tests/fixtures/failure-review-cli.ts`, and `tests/failure-review.pty.expect`.

## Errors / Corrections

- `test:pty` does not yet exist; its absence is expected until this task is implemented.

## Ready for Next Run

- Require tasks 03 and 04 plus integrated ordered-multiple work before building platform evidence.
