# Workflow Memory

## Current State

## Shared Decisions

- `src/acp-turn.ts` is the packet-free neutral ACP v1 lifecycle owner. It owns protocol negotiation, advertised authentication, fresh absolute-cwd sessions, complete configuration state, semantic cancellation, bounded optional close, raw stop reasons, permission/host/supervisor contracts, and cleanup outcomes; packet `RunEvent` and task identifiers stay in adapters.
- `src/acp-client.ts` is the packet compatibility adapter. It preserves packet permission, lexical workspace, event, and engine semantics while translating neutral failures at the per-turn boundary; `runAcpTurn` remains the packet-facing entry point.
- `@agentclientprotocol/sdk` is pinned exactly to `1.2.1` and ACP callers use stable v1 root imports.
- `findWorkspaceRoot` remains the lexical packet resolver. Exec uses additive `findExecWorkspace` discovery, which canonicalizes the invocation directory, selects the nearest real `.spec-finder` marker, skips symlink markers, and never consults config or Git roots.
- `CanonicalWorkspaceAccess` owns canonical host reads/writes behind the neutral `WorkspaceAccess` contract. It rejects non-absolute or aliased traversal paths and every symlinked/escaping component; writes authorize only after validation, revalidate the deepest parent immediately before mutation, and validate each created directory.
- `CanonicalWorkspaceAccess.workspaceRelativePath` and `normalizeWorkspaceRelativePath` provide normalized relative identities without exposing a separately validated mutable target path; the capability method also validates safe missing write identities.
- `resolveExecConfig` selects one complete repository or user runtime projection, applies final explicit overrides, and projects permission only from the user file; repository permission data and invalid unrelated user runtime fields cannot alter that authority. Exec contexts remain `read-only` until downstream release gates certify writes.
- `PermissionRegistry` is the per-turn implementation of `PermissionBroker`: it prefers once-scoped offered options, fails closed without both TTY streams, supports concurrent requests, and idempotently cancels all pending requests without persisting `*_always` selections.
- `NodeProcessSupervisor` is the concrete neutral process-lifecycle seam for later ACP work. It owns direct shell-free provider spawning, explicit web streams, closure tracking, idempotent POSIX group/Windows tree cleanup, and typed stage observability; ACP semantic cancellation remains above it.
- `ExecOutputReporter` is the deny-by-default human output seam: it writes only fixed preflight/tool/permission/warning/result labels to stderr, buffers neutral agent text in protocol order, and publishes stdout only for `end_turn` with confirmed cleanup.
- `src/providers.ts` now resolves explicit `packet`/`exec` launch contexts, keeps packet mode as the compatibility default (including Codex task/report developer guidance), and owns an immutable source certification registry with all real exec providers disabled until task 09. `resolveExecLaunch`/`resolveExecProviderLaunch` reject uncertified real providers before spawn while cloning injected fixture launches.
- `src/exec.ts` composes the packet-free command without a run lock or packet lifecycle; it forces the resolved canonical workspace onto cloned fixture launches, keeps host access read-only, and maps safe reporter outcomes to the stable `0/1/2/130` exits. `commands.ts` owns `exec` dispatch and SIGINT listener cleanup.

## Shared Learnings

- `tests/fixtures/mock-agent.ts` accepts `SPEC_FINDER_TEST_LIFECYCLE_LOG` and records `initialize`, `session/new`, and `session/prompt` lines for deterministic packet lifecycle assertions.
- The canonical capability intentionally retains the approved hostile same-user pathname replacement race between final validation and the filesystem syscall; it does not claim OS-level sandboxing or provider-native tool containment.
- Supervisor cleanup must wait for child and pipe closure plus recorded descendant/tree confirmation; a direct child exit or signal alone is not a successful cleanup result.
- The exec composition passes `hostAccessMode: "read-only"` into the neutral initialize request, so task 08 fixture evidence can assert `writeTextFile=false`; task 09 must not treat this fixture path as real-provider or write certification.

## Open Risks

- Only macOS native process-tree evidence exists for the supervisor so far; Linux and Windows descendant-cleanup certification remains a task 09 release blocker.
- Task 09 certification remains blocked in the current macOS-only environment: native Linux/Windows and complete Claude/Codex/Cursor live ACP/write matrices have no terminal evidence. Keep all source-owned exec providers disabled and host access read-only until another environment supplies the complete matrix.

## Handoffs

- Task 05 extracted the packet-free lifecycle and consumes `createProcessSupervisor()`/`NodeProcessSupervisor` through the neutral `ProcessSupervisor` contract; later work must preserve its cleanup failure semantics rather than reintroducing direct `child_process` termination.
- Task 06/08 should consume `runAcpTurn`/`createAcpTurn` neutral results and events without importing packet task IDs, `RunEvent`, cockpit policy, or packet host-path rules into the core.
- Task 03 should consume `findExecWorkspace`/`createWorkspaceAccess` for exec resolution and permission-gated host callbacks rather than altering packet path behavior.
- Task 05/08 should consume `ResolvedExecContext`, `resolveExecConfig`, and `PermissionRegistry` rather than reintroducing packet config loading or repository-owned permission authority.
