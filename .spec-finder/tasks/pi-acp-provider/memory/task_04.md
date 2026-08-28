# Task Memory: task_04

## Objective Snapshot

Document packet-only Pi in README, including leftover `.pi/skills` and a tested-pair placeholder.

## Important Decisions

- Mirrored the Grok Build README layout: requirements list, dedicated prerequisites section, setup table row, runtime field notes, exec packet-only wording.
- Left a tested-pair placeholder pointing at issue #15 instead of inventing versions.
- Warned that unpinned `npx --yes @automatalabs/pi-acp` can resolve a newer adapter than a prior probe.

## Learnings

- `tests/cli.test.ts` now requires the word `Pi` in both help and README.

## Files / Surfaces

- `README.md`, `tests/cli.test.ts`

## Errors / Corrections

- None.

## Ready for Next Run

- Task complete. task_05 replaces the placeholder if a live packet succeeds, otherwise documents the skip.
