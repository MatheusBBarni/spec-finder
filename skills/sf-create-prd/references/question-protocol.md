# PRD Question Protocol

## Required progression

1. **Need:** verified problem/opportunity and current workflow.
2. **Users:** primary persona, secondary impacts, and usage context.
3. **Capabilities:** observable user outcomes and acceptance boundaries.
4. **Scope:** MVP, exclusions, phasing, dependencies, and constraints.
5. **Success:** baseline, target, measurement method, and window.

## Rules

- Ask exactly one question per turn and wait.
- Use the host's blocking question tool when available; otherwise stop after the question.
- Prefer 2-3 evidence-backed options plus `Other`.
- Recommend one option and identify its principal trade-off.
- Ask 3-6 questions. Skip only dimensions already explicit in approved artifacts and evidence.
- Do not ask the user to choose facts that research can establish.
- Do not ask about databases, APIs, frameworks, code structure, architecture, or testing implementation.
- Never auto-resolve product scope, target users, rollout policy, or success metrics.

## Technical drift translation

- Replace “WebSockets or polling?” with “Which user events must appear immediately?”
- Replace “Which CSV library?” with “Which information and compatibility do exported files require?”
- Replace “Which database?” with “What user-visible retention, portability, or recovery behavior is required?”
