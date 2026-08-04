---
status: pending
title: Define and test task-scoped ACP transcript normalization
type: refactor
complexity: medium
dependencies: []
---

# Task 01: Define and test task-scoped ACP transcript normalization

## Overview

Add the pure transcript projection layer required by the approved read-only cockpit. The task produces normalized chronological entries for ACP messages, thoughts, plans, tools, activities, outcomes, and unknown updates, with identity-based coalescing and no presentation cap.

<critical>
- Read the PRD, TechSpec, ADR-002, ADR-003, repository instructions, and current Git state before editing.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_01.md` before editing and update memory before finishing.
- Implement only transcript normalization and its tests; do not move execution, ACP transport, store lifecycle, or UI behavior into this task.
- Keep raw `SessionUpdate` and `RunEvent` contracts unchanged.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST normalize all currently handled ACP update categories and preserve unknown `sessionUpdate` variants with readable fallback labels. (PRD-G-04, PRD-F-05, PRD-F-06, TechSpec Core Interfaces)
2. MUST merge message/thought chunks by stable ACP message identity and tool updates by `toolCallId` while preserving the first chronological position and all meaningful content. (PRD-G-03, PRD-F-03, PRD-F-07, PRD-C-02, PRD-C-03)
3. MUST keep the projection pure, deterministic, and independent of OpenTUI or execution side effects. (ADR-003, TechSpec Components and Boundaries)
4. SHOULD expose the smallest helper surface needed by `CockpitStore`, with no new dependency or runtime event type. (PRD-C-06, TechSpec External Interfaces)
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| `PRD-G-03`, `PRD-US-03`, `PRD-US-05`, `PRD-F-03`, `PRD-F-07` | Preserve task transcript chronology and support complete-history consumers. | Normalization fixtures and ordering assertions |
| `PRD-G-04`, `PRD-US-06`, `PRD-F-05`, `PRD-F-06` | Label event categories and coalesce streamed content. | Message, thought, plan, tool, and unknown-update tests |
| `PRD-C-02`, `PRD-C-03`, `PRD-M-03`, `PRD-M-04` | Retain all entries and preserve start/tail reachability for downstream UI. | Synthetic history over 250 entries |
| TechSpec Core Interfaces, Data Models and Lifecycle | Provide pure normalized entries without changing event contracts. | TypeScript check and pure unit suite |

## Subtasks

- [ ] 01.1 Define normalized entry categories, stable source identity, sequence ordering, and fallback-label rules.
- [ ] 01.2 Implement message/thought coalescing and tool-call/tool-update merging without dropping content.
- [ ] 01.3 Implement chronological handling for plans, activity, outcomes, and unknown update variants.
- [ ] 01.4 Add focused fixtures for ordering, identity collisions, missing initial tool calls, and histories above 250 entries.
- [ ] 01.5 Run the focused tests and repository gate to terminal exit, then update task memory.

## Implementation Details

Implement the pure projection described in the TechSpec’s Core Interfaces, Data Models and Lifecycle, and Failure and Recovery sections. Preserve raw ACP/runtime boundaries and return immutable results suitable for `CockpitStore` snapshots.

### Relevant Files

- `src/ui/transcript.ts` — create the pure normalized transcript helper.
- `tests/transcript.test.ts` — create fixtures and assertions for all supported/fallback update categories.

### Dependent Files

- `src/ui/store.ts` — consumes the helper in `task_02`.
- `tests/store.test.ts` — verifies store integration in `task_02`.
- `src/events.ts` — read-only source of raw update types; do not change.

### Related ADRs

- [ADR-002: Guided Live Transcript Product Shape](adrs/adr-002-guided-live-transcript.md) — requires readable, chronological, coalesced task output.
- [ADR-003: Current-Seam Transcript Projection](adrs/adr-003-current-seam-transcript-projection.md) — keeps normalization in the UI seam.

## Deliverables

- Pure task-scoped transcript normalization and coalescing helpers.
- Focused unit fixtures covering supported and unknown ACP updates.
- Evidence that histories over 250 entries are retained.
- Updated `memory/MEMORY.md` and `memory/task_01.md` when warranted.
- `reports/task_01.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given two text chunks with one `messageId`, when both are applied, then one entry preserves concatenated content and the first sequence position.
- [ ] Given a tool update before its initial tool call, when both are applied, then the fallback entry remains visible and later metadata merges by `toolCallId`.
- [ ] Given plan, thought, activity, and unknown updates, when applied in order, then every category remains labeled in that order.
- [ ] Given more than 250 entries, when projected, then no entry is truncated by the helper.

### Integration Tests

- [ ] `bun run check` accepts the helper’s ACP type usage without changing `src/events.ts`.

### Platform or Manual Evidence

- [ ] Not applicable beyond deterministic unit coverage; OpenTUI rendering is owned by `task_04`.

### Verification Commands

- `bun test tests/transcript.test.ts`
- `bun run check`
- `bun run verify`

## Success Criteria

- Every mapped transcript requirement has a passing focused assertion.
- Message/tool coalescing preserves content and chronology.
- Unknown events remain visible through a generic label.
- No runtime event, execution, dependency, or unrelated dirty file changes are introduced.
- Focused tests and `bun run verify` pass to terminal exit.
- Memory is current and the final report records exact evidence and unresolved risks.
