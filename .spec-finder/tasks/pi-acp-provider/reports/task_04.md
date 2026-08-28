# Task 04 Final Report: Document packet-only Pi

## Outcome

- Verdict: completed
- Date: 2026-08-27
- Provider/session: manual sf-batch-tasks / sf-execute-task

## Changes

- `README.md` — Pi in the supported-provider list, setup model table, Grok-shaped prerequisites (no install/login, leftover `.pi/skills`, packet-only exec, unpinned npx warning, tested-pair placeholder), runtime `provider`/`model`/`reasoning` notes, and CLI `--provider` grammar.
- `tests/cli.test.ts` — Shared help/README contract now requires `Pi` without restoring multi-agent setup language.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Document Pi beside the other four providers, `.agents/skills` / `~/.agents/skills`, setup model `auto` only (G-05, F-07, F-01). | Satisfied | Requirements list, setup table row (`auto` / `.agents/skills` / `~/.agents/skills`), intro names Pi. |
| 2. Spec Finder does not install Pi, does not log in, and does not migrate `.pi/skills` (F-05, F-06, US-05). | Satisfied | Pi prerequisites bullets and leftover `.pi/skills` paragraph. |
| 3. Pi is packet-only and not certified for `exec` (F-05, US-06). | Satisfied | Prerequisites, runtime field, exec override list, and CLI `--provider` notes. |
| 4. Tested-pair placeholder for task_05; no user-config pin (live-packet compatibility). | Satisfied | Placeholder points at issue #15; launch remains unpinned `npx --yes @automatalabs/pi-acp`. |
| 5. Warn that unpinned npx can resolve a newer adapter. | Satisfied | Same prerequisites paragraph; Grok-analog "not a compatibility promise" tone. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `bun test tests/cli.test.ts` | pass | 6 pass, 0 fail |
| `bun run verify` | pass | `tsc --noEmit`; 407 pass, 0 fail, 2373 expects; `bun build` wrote `dist/cli.js` |
| Claude/Codex/Cursor/Grok docs remain | pass | Those providers remain in the table, requirements list, and Grok prerequisites section |

## Risks and Follow-ups

- Tested-pair versions are still a placeholder until task_05 live evidence.

## Final Verdict

Completed: README documents packet-only Pi with `.agents/skills`, leftover `.pi/skills`, no install/login, exec unavailable, an unpinned-npx warning, and an issue #15 tested-pair placeholder, while existing four-provider docs remain accurate.
