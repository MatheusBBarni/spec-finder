# Task Memory: task_01

## Objective Snapshot

- Created and tested the pure task-scoped ACP transcript normalization layer.

## Important Decisions

- Keep raw `SessionUpdate` and `RunEvent` contracts unchanged.
- Merge message chunks by ACP message identity and tool updates by tool-call identity while preserving first chronological position.
- Preserve unknown update types with readable fallback labels and retain complete content.
- Export only `applySessionUpdate`, `appendTranscriptLines`, and the normalized entry types needed by the downstream store.
- Prefix stable entry IDs by ACP category and message role so identical raw IDs cannot merge messages, thoughts, or user/agent streams accidentally.
- Retain every meaningful tool observation in the merged entry; later title/status metadata updates the same `toolCallId` entry without moving its first sequence position.

## Learnings

- ACP SDK 1.2.1 makes `messageId` optional/nullable on streamed content chunks and models tool updates as partial patches; anonymous chunks therefore remain separate while identified chunks coalesce.
- Known but unsupported SDK update variants and provider-specific discriminators can share the same deterministic fallback path without widening `SessionUpdate` or `RunEvent`.

## Files / Surfaces

- `src/ui/transcript.ts` — pure projection helper with stable identities, chronological merging, readable content formatting, fallback serialization, and uncapped immutable arrays.
- `tests/transcript.test.ts` — focused fixtures for messages, thoughts, plans, tools, activity/error/outcome lines, unknown variants, non-text content, identity collisions, and 300-entry history.
- `src/ui/store.ts` and `tests/store.test.ts` consume the helper after this task.

## Errors / Corrections

- No implementation or environment failures were encountered.

## Ready for Next Run

- Final-report verification was rerun from the repository root on 2026-08-04.
- `bun test tests/transcript.test.ts` exited 0: 7 tests passed, 0 failed, 24 expectations.
- `bun run check` exited 0 with `tsc --noEmit` and no TypeScript diagnostics.
- `bun run verify` exited 0: 37 tests passed, 0 failed, 112 expectations, and the Bun production build bundled 16 modules into `dist/cli.js`.
- The final diff check found no changes to `src/events.ts`, execution/ACP/store files, `package.json`, or `bun.lock`; the task frontmatter status change is runtime-owned.
- Complete history still grows in memory for the life of a run, and evolving ACP variants use generic fallback labels; both are accepted packet-level risks for downstream integration and UI validation.
- `CockpitStore` can apply task-scoped ACP updates with `applySessionUpdate` and activity/error/outcome text with `appendTranscriptLines`; execution and ACP transport remain unchanged.
