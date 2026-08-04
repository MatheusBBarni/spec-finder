# ADR-002: Guided Live Transcript Product Shape

## Status

Accepted

## Date

2026-08-04

## Context

The approved idea establishes a read-only progress navigator for Spec Finder. Product clarification adds a concrete information hierarchy: users need a header with the task slug and effective runtime identity, a task-progress column, and a live ACP transcript column.

The transcript must retain the complete task history while remaining understandable during streaming. It must distinguish messages, thoughts, plans, tool activity, failures, and final outcomes. The cockpit should follow the active task by default, and task failures should be immediately visible with a plain-language reason.

## Decision

The V1 product will use the Guided Live Transcript approach:

- a persistent header shows the task slug, provider, model, reasoning, speed, and overall run phase or outcome;
- the main surface is divided into two columns;
- the task column lists every task with status indicators and clearly marks the running task;
- the transcript column shows the selected task's complete chronological ACP history;
- the selected task follows the active task automatically while the run advances;
- transcript entries use readable event labels, grouped visual treatment, coalesced streaming text, and prominent tool/error/outcome states;
- failures and blocked tasks show a plain-language reason in the summary and selected transcript;
- the cockpit remains read-only apart from navigation, scrolling, and the terminal escape hatch.

## Alternatives Considered

### Transcript-first observer

Give most of the screen to the transcript and reduce the task list to a compact strip. This improves output density but weakens immediate progress orientation for new users.

### Execution ledger

Add cross-task timelines, dependency-impact explanations, filters, and historical comparisons. This would support deeper investigation but expands V1 into a broader observability product.

### Flat global activity stream

Keep the current single stream and add styling only. This avoids state changes but cannot provide task-specific history or reliable task navigation.

## Consequences

### Positive

- Users get a stable spatial model: runtime context above, task progress left, ACP detail right.
- New users can identify the active task and run phase without understanding ACP terminology.
- Experienced users can inspect complete task history while the live task continues to update.
- Failure context is visible at the moment it matters rather than buried in raw activity lines.

### Negative

- The product must maintain task-scoped transcript history instead of one global activity list.
- The header and two-column layout require responsive behavior for narrow terminals.
- Streaming output needs readable coalescing and event-specific presentation rules.

### Risks and Mitigations

- **Live-follow disrupts inspection:** distinguish active and selected tasks, and only auto-follow while the user is viewing the active task.
- **Full history becomes noisy:** retain all task history but group and label entries so raw fidelity does not mean visual ambiguity.
- **Runtime metadata overwhelms progress:** keep the header compact and prioritize task slug, active phase, and outcome over secondary identity fields.
- **Failure reasons remain cryptic:** normalize error text into a short user-facing summary while retaining the full detail in the transcript.

## References

- [Read-Only Progress Navigator idea](/Users/matheusbbarni/projects/spec-finder/.spec-finder/tasks/read-only-progress-navigator/_idea.md)
- [Spec Finder cockpit implementation](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx)
- [Spec Finder cockpit store](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts)
- [Kitten transcript projection](/Users/matheusbbarni/projects/kitten/packages/tui/src/core/transcriptProjection.ts)
- [Kitten message presentation](/Users/matheusbbarni/projects/kitten/packages/tui/src/ui/MessageView.tsx)
