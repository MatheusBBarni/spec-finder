# Workflow Rules

- Start by checking `git status`, the relevant task packet, repository skills, and existing tests. Preserve unrelated dirty changes.
- Follow the specification pipeline and its approval gates: idea, PRD, TechSpec, tasks, implementation, and evidence report.
- Treat `.spec-finder/config.json` as strict and user-owned. Reject unknown or invalid settings; never add permissive fallback behavior for malformed configuration.
- Keep task dependencies acyclic and backward-only. A task is complete only after its required report contains fresh, substantive verification evidence.
- Stage only files owned by the current change unless explicit instruction expands the scope. Never commit secrets or provider credentials.
