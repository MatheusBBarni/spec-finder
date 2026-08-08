# ADR-001: Guarded One-Turn ACP Execution

## Status

Accepted

## Date

2026-08-08

## Context

Spec Finder can execute implementation task packets through ACP, but it has no direct command for a configured user who wants one ad-hoc agent turn in the current repository. The packet path is an unsuitable workaround because it loads task artifacts, initializes memory, mutates task state, runs a separate report turn, and requires report evidence. Direct provider CLIs bypass Spec Finder's provider-neutral configuration and lifecycle behavior.

The selected product direction must preserve the narrow one-turn job while making write authority, permissions, cancellation, output, and configuration precedence truthful. The current host checks workspace paths lexically, not by canonical real path, and process cleanup is best-effort. Those gaps make containment and bounded termination release conditions rather than optional hardening.

## Decision Drivers

- Existing Spec Finder users need a one-command alternative to direct provider CLIs and artificial task packets.
- `runAcpTurn` already provides a reusable fresh-session ACP execution seam.
- ACP v1 defines a complete one-turn lifecycle with streamed updates, permission requests, cancellation, and typed stop reasons.
- Repository-local configuration must override user configuration, while explicit CLI flags remain highest precedence.
- Write-enabled workspace tools must not be presented as bounded until canonical containment and cancellation are enforceable and verified.
- Demand for automation features is unproven; V1 must validate the human one-turn workflow first.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | The CLI has no `exec` route; `run` is packet-oriented. | `src/cli.tsx`, `src/commands.ts`, `src/engine.ts` | 2026-08-08 |
| Repository | `runAcpTurn` already launches, initializes, configures, prompts, streams, and terminates one fresh ACP session. | `src/acp-client.ts` | 2026-08-08 |
| Repository | Config loading currently reads only one workspace config; nearest-file and user-config fallback do not exist. | `src/config.ts`, `src/paths.ts` | 2026-08-08 |
| Repository | The non-UI listener discards ACP response chunks, and workspace containment is lexical. | `src/commands.ts`, `src/paths.ts` | 2026-08-08 |
| External | ACP v1 supports initialize/authenticate, session creation, one prompt, streamed updates and permissions, cancellation, and a terminal stop reason. | https://agentclientprotocol.com/protocol/v1/prompt-turn | 2026-08-08 |
| External | Codex, Claude Code, and Gemini expose first-class one-shot or headless agent commands. | https://developers.openai.com/codex/noninteractive/, https://code.claude.com/docs/en/headless, https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md | 2026-08-08 |
| User decision | The primary user is an existing Spec Finder user running one ad-hoc, tool-using turn in the current repository. | Idea Factory clarification | 2026-08-08 |
| User decision | The refined guarded V1 was selected over read-only essence-first and broad automation alternatives. | Idea Factory opportunity decision | 2026-08-08 |
| Inference | Provider-neutral configuration is the clearest differentiator, while broad automation demand remains unproven. | Repository and external evidence synthesis | 2026-08-08 |

## Decision

Add a distinct `spec-finder exec "<prompt>"` product path for one fresh ACP turn in the current repository. It streams human-readable agent progress and output, returns a truthful terminal result, and exits without creating or mutating task-packet artifacts.

Runtime values resolve in this order: explicit `--provider`, `--model`, `--reasoning`, and `--speed` flags; the nearest `.spec-finder/config.json` found from the current directory upward; then `~/.spec-finder/config.json`. The configuration source does not relocate the execution workspace.

V1 may expose write-capable workspace tools only after canonical realpath containment, fail-closed permission mediation, semantic cancellation, bounded provider cleanup, and adversarial verification pass. Existing permission configuration remains authoritative but is described as approval policy, not an operating-system sandbox.

V1 remains a single human-oriented turn. Machine-readable automation and persistent session features are deferred.

## Alternatives Considered

### Read-only essence-first command

- **Benefits:** Smaller safety surface and faster validation of configuration, provider startup, and text output.
- **Costs/risks:** Does not test the edit-oriented workspace job that makes an agent turn materially more useful than a text query.
- **Why not selected:** The user selected the refined tool-using direction, and the council concluded that write-enabled V1 is acceptable when host-boundary gates are proven before release.

### Broad automation surface

- **Benefits:** Supports pipelines through stdin, JSONL events, schemas, explicit working directories, budgets, and resumable sessions.
- **Costs/risks:** Expands security, lifecycle, compatibility, and output contracts before the core workflow has usage evidence.
- **Why not selected:** Current evidence validates the general one-shot workflow but not demand for a provider-neutral automation layer.

### Continue using task packets or provider CLIs

- **Benefits:** Requires no new product surface.
- **Costs/risks:** Task packets create unrelated lifecycle artifacts and extra ACP turns; provider CLIs bypass Spec Finder configuration and behavior.
- **Why not selected:** Neither workaround matches the selected one-command, provider-neutral ad-hoc job.

## Consequences

### Positive

- Existing users gain a direct provider-neutral path for ad-hoc repository work.
- The implementation can reuse the current ACP turn and override-validation seams.
- Task execution and ad-hoc execution retain separate, truthful product contracts.
- The V1 boundary can generate usage evidence before automation scope is added.

### Negative and trade-offs

- Host-boundary hardening and lifecycle semantics are release work, not optional follow-up.
- V1 will not offer JSONL, structured output, stdin composition, session resume, or budget controls available in mature provider CLIs.
- The feature's reach, frequency, and defensibility remain unproven.

### Risks and mitigations

- Workspace writes escape through symlinks or path aliasing — Canonicalize workspace and targets, reject escapes at every mutation boundary, and test adversarial paths.
- Approval settings are mistaken for sandboxing — Document the distinction and fail closed when an action cannot be safely mediated.
- Cancellation leaves a provider or descendant process running — Send semantic ACP cancellation, resolve pending permissions, wait for bounded termination, and escalate cleanup deterministically.
- Output or exit status misrepresents the agent result — Define human stream routing and map typed stop reasons, cancellation, usage errors, and runtime failures to stable outcomes.
- Config precedence surprises users — Test the complete flag, nearest-project, user, missing, and invalid configuration matrix.
- Ten maintainer runs overstate demand — Count only genuine repository work, record fallback and completion outcomes without prompt content, and require broader repeated-user evidence before V2 automation.

## Reversibility

- High. The command is additive and does not migrate task packets or configuration schema.
- Write access can be held read-only or disabled without removing the one-turn path if release gates fail.
- Deferred automation features can be layered later without changing the core one-turn lifecycle.

## Follow-ups

- Specify the exact human stream, final output, stop-reason, cancellation, and exit-code contracts.
- Specify canonical workspace containment and provider process-tree cleanup.
- Define privacy-minimizing local measurement for the 30-day validation window.
- Reconsider stdin and JSONL only after repeated real-work evidence shows automation demand.

## References

- `src/acp-client.ts`
- `src/commands.ts`
- `src/config.ts`
- `src/paths.ts`
- https://agentclientprotocol.com/protocol/v1/prompt-turn
- https://developers.openai.com/codex/noninteractive/
- https://code.claude.com/docs/en/headless
- https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md
