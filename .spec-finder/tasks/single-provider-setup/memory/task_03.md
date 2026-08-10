# Task Memory: task_03

## Objective Snapshot

- Publish and verify the finalized single-provider setup help and documentation contract.

## Important Decisions

- Wait for task_02's actual parser, summary, and error wording before editing docs.
- Keep the public setup syntax singular: one optional `--agent`, provider-curated `--model`, `--speed auto|normal|fast`, at-most-one `--local`/`--global`, and retained `--copy`; document `--symlink` rejection without presenting it as a mode.
- Use task_02's exact requested-value summary wording and describe ACP/runtime capability outcomes as authoritative after setup, not as setup-time guarantees.
- Document v3 first-scope selection for migrated v1/v2 files, valid-rerun value preservation, provider-derived destinations, and Cursor legacy preservation without any migration or deletion.

## Learnings

- `src/cli.tsx`, the README setup walkthrough/config example/CLI block, and `tests/cli.test.ts` now share the same contract. The README deliberately describes managed `sf-*` entries without a numeric bundled-skill count.
- The documentation contract test protects the new usage, defaults, migration, destination, requested/runtime wording, and the absence of multi-select, repeated-agent, canonical-symlink, old Cursor destination, and stale-count claims.
- Focused CLI/docs tests passed: 6 tests, 0 failures, 117 expectations. Full `rtk bun run verify` passed: 297 tests, 0 failures, 1,723 expectations, and a successful Bun build.

## Files / Surfaces

- `src/cli.tsx`, `README.md`, and `tests/cli.test.ts`.

## Errors / Corrections

- No implementation or verification blockers remain. The focused and full evidence is fresh from the implementation handoff, so no rerun was needed; native/provider-account evidence is not applicable because setup performs no live discovery.

## Ready for Next Run

- Implementation and required verification are complete; the final report is now the active handoff while task status remains runtime-owned and unrelated ordered-batch content stays preserved.
