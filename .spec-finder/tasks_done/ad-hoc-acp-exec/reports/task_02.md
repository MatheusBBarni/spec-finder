# Task 02 Final Report: Implement Canonical Workspace Host Access

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: unavailable; verification used the local Bun test suite and filesystem fixtures on macOS

Task 02 implements the exec-owned canonical workspace boundary and host filesystem capability. Packet path resolution remains unchanged, while exec discovery and host reads/writes now fail closed on unsafe, aliased, symlinked, or indeterminate paths.

## Changes

- `src/paths.ts` — Added canonical exec workspace discovery (`findExecWorkspace`) with nearest real `.spec-finder` marker selection, canonical cwd fallback, and descriptive aliases; preserved `findWorkspaceRoot` and `assertInsideWorkspace` behavior.
- `src/workspace-access.ts` — Added `CanonicalWorkspaceAccess`, factory helpers, named fail-closed path errors, canonical component validation, normalized relative identities, guarded reads, and revalidated one-component-at-a-time writes.
- `tests/paths.test.ts` — Added nearest-marker, symlink-marker, canonical-cwd, and packet-boundary coverage.
- `tests/workspace-access.test.ts` — Added safe read/write, traversal/alias, sibling-prefix, symlink, authorization ordering, missing-parent, and workspace-symlink adversarial coverage.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` — Promoted the canonical discovery/capability boundary and accepted residual race for later tasks.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_02.md` — Recorded implementation decisions, corrections, exact verification, coverage, and follow-ups.

Pre-existing unrelated worktree changes were preserved and are not attributed to this task.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Resolve the exec workspace to the nearest non-symlink `.spec-finder` ancestor, otherwise the canonical exact cwd, independently of config discovery. | Satisfied | `findExecWorkspace` canonicalizes the invocation directory, checks markers with `lstat`, skips symlink markers, and does not read configuration. `tests/paths.test.ts` covers nearest real markers, symlink-marker fallback, and no-marker canonical cwd. |
| 2. Reject relative paths, traversal, sibling prefixes, aliases, symlinked components, and unsafe/indeterminate ancestors before host reads or writes. | Satisfied | `CanonicalWorkspaceAccess` enforces absolute paths, rejects dot/separator aliases, checks lexical and canonical containment, walks every existing component with `lstat`/`realpath`, and raises named `WorkspaceAccessError` failures. The adversarial workspace-access suite covers these cases and confirms the external sentinel is unchanged. |
| 3. Revalidate the deepest existing parent immediately before mutation and validate each newly created directory component. | Satisfied | Writes authorize only after initial containment checks, revalidate the deepest existing parent after authorization, create missing directories individually, validate each created component, then revalidate the final parent and target. The authorization-ordering and nested-write tests cover the sequence. |
| 4. Preserve packet `findWorkspaceRoot` and lexical callback behavior. | Satisfied | Existing `findWorkspaceRoot`/`assertInsideWorkspace` implementations remain intact; packet path regressions and the full repository suite pass. |
| 5. Expose normalized workspace-relative identities without returning unchecked mutable paths. | Satisfied | `workspaceRelativePath` and `normalizeWorkspaceRelativePath` return relative identities only; the capability method validates an existing or safely missing target first. The focused suite asserts a missing nested identity. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/paths.test.ts ./tests/workspace-access.test.ts` | Passed | 10 passed, 0 failed, 30 expect calls. |
| `rtk bun run check` | Passed | `tsc --noEmit` completed successfully; also passed as the first stage of `rtk bun run verify`. |
| `rtk bun run verify` | Passed | 167 tests passed, 0 failed, 898 expect calls; Bun build bundled 20 modules successfully. |
| `rtk bun test --coverage ./tests/paths.test.ts ./tests/workspace-access.test.ts` | Passed | 10 passed, 0 failed; `src/workspace-access.ts` measured 89.66% functions and 96.97% lines. |
| `rtk git diff --check` | Passed | No whitespace errors reported. |

## Risks and Follow-ups

- The approved hostile same-user pathname replacement race between final validation and the filesystem syscall remains a documented residual risk; this capability does not claim OS-level sandboxing or containment of provider-native tools.
- The full macOS/Linux/Windows release matrix remains owned by task 09. Current evidence is from the macOS execution environment.
- This task supplies the capability but does not wire packet callbacks, permission prompting, provider launch, or command-level write enablement; later tasks must consume the neutral contract and keep write release gated.
- Task frontmatter status remains runtime-owned `in_progress`; this report phase did not change it.

## Final Verdict

Completed. Canonical exec workspace discovery and the guarded host filesystem capability are implemented, adversarial and packet-compatibility tests pass, the exact repository verification gate passes, and memory is current. The accepted same-user pathname race and later cross-platform release certification remain explicitly documented follow-ups.
