# ADR-002: User-Owned Permissions and Human Exec Contract

## Status

Accepted

## Date

2026-08-08

## Context

The approved one-turn `exec` direction discovers repository and user configuration, displays live agent activity, may expose workspace writes after safety gates pass, and uses a ten-run hypothesis to validate workflow fit. Product research found that these concerns create five consequential policy choices.

First, repository configuration is not merely cosmetic because the current schema includes `permissions`, including `approve-all`. Second, the approved flags-to-repository-to-user wording does not say whether the two files merge or whether one complete profile is selected. Third, configuration discovery must not silently broaden or relocate the execution workspace. Fourth, a human stream needs a stable visibility boundary so redirection remains useful and sensitive thoughts or raw tool data are not exposed by default. Fifth, content-free metrics would still be persistent product state and would weaken the no-history promise.

## Decision Drivers

- Preserve the direct, low-friction one-turn workflow for existing Spec Finder users.
- Prevent an unfamiliar repository from silently elevating execution authority.
- Keep configuration precedence predictable and compatible with the existing strict complete-file schema.
- Give terminal users visible progress while keeping the final response easy to redirect.
- Preserve a narrow no-history MVP and avoid telemetry scope before workflow fit is proven.
- Release write-capable behavior only when the containment and cancellation gates in ADR-001 pass.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | The strict config includes provider, model, reasoning, speed, and permissions; current loading selects one complete file. | `src/config.ts` | 2026-08-08 |
| Repository | The current console path discards ACP session updates, while the cockpit can expose thoughts and raw tool details. | `src/commands.ts`, `src/ui/transcript.ts` | 2026-08-08 |
| External | Comparable coding-agent CLIs trust-gate project configuration when it can activate tools or grant authority. | https://learn.chatgpt.com/docs/config-file/config-basic, https://code.claude.com/docs/en/permissions, https://geminicli.com/docs/cli/trusted-folders/ | 2026-08-08 |
| External | Codex uses progress on stderr and the final agent response on stdout; Claude and Gemini default to human text and make machine formats explicit options. | https://learn.chatgpt.com/docs/non-interactive-mode, https://code.claude.com/docs/en/headless, https://geminicli.com/docs/cli/headless/ | 2026-08-08 |
| User decision | Repository config may set provider, model, reasoning, and speed, but cannot elevate permissions. | PRD clarification | 2026-08-08 |
| User decision | Repository and user configs are complete runtime profiles selected by fallback, not merged field by field. | PRD clarification | 2026-08-08 |
| User decision | The execution workspace is the nearest ancestor containing `.spec-finder`, or the exact current directory when no marker exists. | PRD clarification | 2026-08-08 |
| User decision | Default output is concise progress on stderr plus the final response on stdout, excluding thoughts and raw tool inputs/results. | PRD clarification | 2026-08-08 |
| User decision | V1 persists no validation metrics; the ten-run hypothesis is tracked manually outside the command. | PRD clarification | 2026-08-08 |
| User decision | The guarded write-capable MVP was selected over read-only-first and automation-ready approaches. | PRD approach selection | 2026-08-08 |

## Decision

Adopt the guarded write-capable MVP with these product policies:

1. Explicit `--provider`, `--model`, `--reasoning`, and `--speed` flags override the selected runtime profile.
2. If a nearest repository `.spec-finder/config.json` exists, its provider/model/reasoning/speed values are selected as one complete runtime profile. Otherwise those values come from `~/.spec-finder/config.json`. The files do not merge field by field.
3. Repository configuration never supplies or elevates `permissions`. Permissions come from the user configuration; when no valid user permission is available, the command uses the safe `prompt` policy.
4. The execution workspace is the nearest ancestor containing `.spec-finder`; if no ancestor contains the marker, it is the exact current working directory. Selecting the user configuration does not relocate or broaden that workspace.
5. Default human output sends concise progress, tool status, permission outcomes, warnings, and the normalized terminal status to stderr. Only the final agent response is sent to stdout. Thoughts and raw tool arguments/results are omitted.
6. V1 stores no prompts, responses, transcripts, task artifacts, trust records, or aggregate usage metrics. The ten-run validation hypothesis is measured manually outside the product.
7. The MVP includes workspace writes only when ADR-001's containment, permission, cancellation, cleanup, and verification gates pass. If they do not pass, the same command remains read-only rather than weakening the safety claim.

## Alternatives Considered

### Remembered repository trust for complete project policy

- **User value:** Teams could share provider choices and elevated permission policy in one file.
- **Costs/risks:** Adds persistent trust state and allows repository content to influence execution authority.
- **Why not selected:** The user chose a simpler boundary where permission authority remains user-owned.

### Field-level configuration merge

- **User value:** Repository profiles could inherit selected user defaults.
- **Costs/risks:** Requires partial-profile semantics and makes the effective configuration harder to predict.
- **Why not selected:** Whole-profile fallback matches the approved wording and existing strict configuration model.

### Full transcript or final-only terminal output

- **User value:** Full output maximizes diagnostics; final-only output minimizes noise.
- **Costs/risks:** Full output may disclose sensitive content, while final-only output hides progress and permission failures.
- **Why not selected:** Concise stderr progress plus stdout final response provides observability and shell composability without raw detail.

### Git-root or exact-current-directory workspace

- **User value:** Git-root resolution gives consistent repository-wide access; exact-current-directory resolution gives the narrowest authority.
- **Costs/risks:** Git-root behavior adds a repository dependency and broadens access, while exact-current-directory behavior can unexpectedly hide the configured repository from nested invocations.
- **Why not selected:** Nearest `.spec-finder` preserves existing Spec Finder workspace behavior, with exact current directory as the safe fallback.

### Persistent local validation aggregates

- **User value:** Automates measurement of usage, latency, terminal outcomes, and fallback.
- **Costs/risks:** Creates new product state, privacy documentation, retention behavior, and a conflict with the narrow no-history promise.
- **Why not selected:** Manual validation is sufficient for the initial single-user hypothesis.

### Read-only-first or automation-ready MVP

- **User value:** Read-only could ship sooner; automation would support CI and pipelines earlier.
- **Costs/risks:** Read-only does not validate edit-oriented work, while automation adds unproven compatibility and safety scope.
- **Why not selected:** The guarded write-capable human workflow is the smallest approach that tests the verified job.

## Consequences

### Positive

- Repository configuration cannot silently select `approve-all` or otherwise elevate permission policy.
- Users can predict which complete runtime profile and explicit overrides are effective.
- Configuration discovery cannot relocate or broaden the workspace selected from the invocation context.
- Default output is readable in a terminal and useful when stdout is redirected.
- Sensitive internal reasoning and raw tool data are not exposed by default.
- V1 introduces no telemetry or trust-state subsystem.
- The command tests real edit-oriented value without broadening into automation.

### Negative and trade-offs

- Teams cannot share elevated permission policy through repository configuration.
- Repository profiles cannot inherit individual fields from a user profile.
- A user-config invocation from a nested directory without `.spec-finder` is intentionally limited to that directory tree.
- Users seeking raw diagnostics or machine-readable output must wait for a later phase.
- Workflow-fit measurement depends on disciplined manual tracking.
- Release may wait for the write-safety gates; otherwise initial capability is read-only.

### Risks and mitigations

- Users misunderstand why repository `permissions` is ignored — Show the effective permission source and document the user-owned policy.
- Invalid repository config unexpectedly blocks user fallback — Fail clearly rather than silently substituting a different profile; define the exact acceptance behavior in the PRD.
- Concise progress hides actionable failure detail — Include normalized warnings and terminal reasons without raw sensitive payloads.
- Manual validation overstates demand — Count only genuine work across multiple contexts and record immediate fallback outside the product.
- Provider behavior leaks thoughts or raw tool data through generic text — Treat only normalized user-facing message content as stdout and classify other updates conservatively.

## Reversibility

- High. Repository permission authority, field-level merge, optional diagnostics, and opt-in local metrics can be added later through explicit product decisions.
- The stdout/stderr contract becomes a compatibility promise once released; machine-readable modes should be additive rather than changing the default.
- Evidence of repeated team-policy, diagnostic, or automation needs would trigger reconsideration.

## Follow-ups

- Define observable handling for missing, invalid, and conflicting repository/user profiles.
- Define the exact normalized progress and terminal-status vocabulary.
- Validate the human output and permission behavior across every supported ACP provider.
- Revisit JSONL, stdin, and persistent metrics only after repeated genuine-use evidence.

## References

- [ADR-001: Guarded One-Turn ACP Execution](adr-001-guarded-one-turn-exec.md)
- [Approved idea](../_idea.md)
- `src/config.ts`
- `src/commands.ts`
- `src/acp-client.ts`
- https://agentclientprotocol.com/protocol/v1/prompt-turn
- https://learn.chatgpt.com/docs/non-interactive-mode
- https://code.claude.com/docs/en/headless
- https://geminicli.com/docs/cli/headless/
