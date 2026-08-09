---
status: completed
title: Implement Canonical Workspace Host Access
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: Implement Canonical Workspace Host Access

## Overview

Implement the exec-owned canonical workspace resolver and ACP filesystem capability. Reads and writes become absolute-only, symlink-rejecting, canonically contained operations while the existing packet path boundary remains unchanged behind its compatibility path.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, current Git state, and completed `task_01` before editing.
- Treat `task_01` as a required lower-numbered dependency and implement its neutral host-access contract rather than introducing a competing shape.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_02.md` before editing and update memory before finishing.
- Implement only exec workspace discovery and host filesystem containment. Do not migrate packet callbacks, implement permission prompting, launch providers, or claim OS-level sandboxing.
- Reference TechSpec sections `Host Filesystem Capability`, `Security and Privacy`, `Compatibility, Migration, and Rollback`, and `Testing and Evidence`.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write `reports/task_02.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST resolve the exec workspace to the nearest non-symlink `.spec-finder` ancestor, otherwise the canonical exact cwd, without letting config discovery relocate it (F-02, HC-04, HC-05).
2. MUST reject relative ACP paths, parent traversal, sibling prefixes, aliases, every symlinked component, and unsafe or indeterminate ancestors before host reads or writes (F-05, M-05).
3. MUST revalidate the deepest existing parent immediately before mutation and validate every newly created directory component (HC-07, HC-08; ADR-003).
4. MUST keep the existing packet `findWorkspaceRoot` and lexical callback behavior compatible unless a later approved migration explicitly changes it (US-07, M-07).
5. SHOULD expose normalized workspace-relative identities for later permission messages without returning unchecked mutable paths.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-04, US-05, F-05 | Canonically contain host callbacks | Adversarial read/write suite |
| F-02, HC-04, HC-05 | Resolve workspace independently | Marker/cwd resolution matrix |
| HC-07, HC-08, M-05 | Fail closed and gate writes | Symlink/ancestor/revalidation cases |
| TechSpec: Host Filesystem Capability | Own operations inside the capability | Integration tests call capability methods only |

## Subtasks

- [ ] 02.1 Add canonical exec workspace discovery while preserving the existing packet resolver.
- [ ] 02.2 Implement absolute-only canonical read behavior with component-by-component symlink rejection.
- [ ] 02.3 Implement guarded write behavior with deepest-parent and per-created-component validation.
- [ ] 02.4 Add adversarial traversal, alias, symlink, and unresolved-parent tests.
- [ ] 02.5 Verify packet path regressions and the repository gate.

## Implementation Details

Follow the TechSpec capability boundary and reuse the `lstat`/`realpath` safety pattern in `src/setup.ts` as evidence, not as a callable installation API. The capability must perform the filesystem operation itself so callers cannot validate once and mutate an unchecked path later. The accepted hostile concurrent same-user path-swap limitation remains documented rather than silently claimed solved.

### Relevant Files

- `src/paths.ts` — additive exec discovery/canonical helpers while preserving existing exports.
- `src/workspace-access.ts` — create; owned canonical read/write capability.
- `tests/paths.test.ts` — existing packet path regression and additive workspace discovery tests.
- `tests/workspace-access.test.ts` — create; adversarial capability tests.

### Dependent Files

- `src/exec-config.ts` — task_03 consumes canonical workspace discovery.
- `src/acp-turn.ts` — task_05 consumes the host-access capability.
- `src/exec.ts` — task_08 selects read-only or write-capable host access.
- `src/setup.ts` — verified safety pattern reference; do not couple feature behavior to setup.

### Related ADRs

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — write capability remains release-gated.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — defines symlink rejection, immediate parent revalidation, and the accepted threat model.

## Deliverables

- Canonical exec workspace discovery and host filesystem capability.
- Adversarial path and packet-compatibility tests.
- Updated shared and `task_02` memory when warranted.
- `reports/task_02.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] Given nested invocation directories, select the nearest real `.spec-finder` marker; reject a symlink marker and fall back safely.
- [ ] Given no marker, return the canonical exact cwd rather than a user-config or Git root.
- [ ] Given relative, traversal, sibling-prefix, alias, ancestor-symlink, or final-symlink paths, reject before I/O.
- [ ] Given a safe missing write path, validate the deepest parent, create components one at a time, and revalidate immediately before writing.

### Integration Tests

- [ ] Read and write safe nested text through the capability without exposing an unchecked resolved path.
- [ ] Existing `assertInsideWorkspace` and packet resolver tests remain passing unchanged.

### Platform or Manual Evidence

- [ ] Exercise separator and canonicalization behavior on the current OS; the full macOS/Linux/Windows matrix is required in task_09.

### Verification Commands

- `rtk bun test ./tests/paths.test.ts ./tests/workspace-access.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Every in-scope escape and indeterminate path fails closed with named evidence.
- Safe reads and writes stay inside the canonical workspace.
- Existing packet path behavior remains compatible.
- Focused tests and the repository gate pass to terminal exit.
- Changed testable logic reaches at least 80% coverage when measurable.
- Memory is current and the final report records the accepted residual race.
