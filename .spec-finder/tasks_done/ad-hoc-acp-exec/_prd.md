# Guarded One-Turn ACP Exec Product Requirements Document

## Overview

Spec Finder users need a direct way to perform one bounded, ad-hoc agent turn in their current workspace without creating a task packet or invoking a provider-specific CLI.

The selected MVP adds:

```text
spec-finder exec "<prompt>"
```

It starts one fresh ACP turn, uses Spec Finder's provider-neutral configuration, shows concise human-readable progress, prints the final agent response separately, and exits with a truthful terminal outcome. It creates no task, memory, report, transcript, telemetry, or session-history artifact.

The primary user is an existing Spec Finder user working in a configured repository. The selected product approach is a guarded write-capable MVP: workspace writes are available only after containment, permission, cancellation, and cleanup gates pass. Otherwise the command remains explicitly read-only.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | The CLI exposes no `exec` route. | `src/cli.tsx`, `src/commands.ts` | 2026-08-08 | Add a distinct command without changing `run`. |
| Repository | Packet execution initializes memory, mutates task state, runs implementation and report turns, and requires report evidence. | `src/engine.ts` | 2026-08-08 | `exec` must not use packet lifecycle behavior. |
| Repository | `runAcpTurn` already performs one fresh ACP session and prompt turn. | `src/acp-client.ts` | 2026-08-08 | The product is feasible without inventing a second agent model. |
| Repository | Current config loading reads one complete workspace file; runtime flags already overlay and revalidate it. | `src/config.ts`, `src/commands.ts` | 2026-08-08 | Preserve complete profiles and explicit overrides. |
| Repository | Workspace discovery, config source, and provider working directory are currently coupled. | `src/paths.ts`, `src/commands.ts` | 2026-08-08 | Config fallback must never relocate the execution workspace. |
| Repository | The non-UI path drops streamed agent updates. | `src/commands.ts` | 2026-08-08 | Define a dedicated human output contract. |
| Repository | Current workspace checks are lexical and do not prevent symlink escapes. | `src/paths.ts`, `tests/paths.test.ts` | 2026-08-08 | Write access requires canonical containment before release. |
| Repository | Current cancellation sends best-effort termination without bounded cleanup or a distinct terminal result. | `src/acp-client.ts` | 2026-08-08 | Cancellation and provider cleanup are release requirements. |
| External | Codex, Claude Code, and Gemini expose direct one-shot agent commands; structured automation modes are separate. | [Codex](https://learn.chatgpt.com/docs/non-interactive-mode), [Claude](https://code.claude.com/docs/en/headless), [Gemini](https://geminicli.com/docs/cli/headless/) | 2026-08-08 | Human text is the credible MVP; defer automation formats. |
| External | Codex sends progress to `stderr` and reserves `stdout` for the final agent response. | [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) | 2026-08-08 | Use separate progress and final-response channels. |
| External | Comparable tools trust-gate project configuration when it can grant execution authority. | [Codex config](https://learn.chatgpt.com/docs/config-file/config-basic), [Claude permissions](https://code.claude.com/docs/en/permissions), [Gemini trusted folders](https://geminicli.com/docs/cli/trusted-folders/) | 2026-08-08 | Repository config cannot control Spec Finder permissions. |
| External | ACP provides streamed messages, plans, tool updates, permission requests, cancellation, and typed stop reasons. | [ACP prompt turn](https://agentclientprotocol.com/protocol/v1/prompt-turn) | 2026-08-08 | Normalize provider behavior into one truthful terminal experience. |
| Inference | Provider-neutral configuration is the clearest differentiated value. | Repository and competitor synthesis | 2026-08-08 | Keep provider/model/reasoning/speed overrides in MVP. |
| Inference | Ten genuine runs can validate local workflow fit but not broad demand. | Approved idea and council critique | 2026-08-08 | Validate manually before expanding scope. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Let an existing user complete one ad-hoc ACP turn without packet overhead | At least 10 genuine runs in the first 30 days |
| G-02 | Make runtime configuration and permission authority predictable | 100% of the configuration precedence acceptance matrix behaves as documented |
| G-03 | Provide a clear, redirectable terminal experience | Median time to first visible output is no more than 10 seconds under normal local conditions |
| G-04 | Keep workspace access and cancellation bounded | Zero successful workspace escapes and 100% bounded cancellation in release validation |
| G-05 | Preserve Spec Finder's structured workflow and privacy boundary | No task artifacts or Spec Finder-owned prompt, response, transcript, trust, or metrics state is created |
| G-06 | Validate whether the command replaces existing workarounds | At least 80% of genuine runs complete without immediate provider-CLI or task-packet fallback |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Existing Spec Finder user | As a repository user, I want to send one prompt through my configured provider so that I can complete ad-hoc work without creating a packet. | One command produces one terminal result and no packet artifacts. |
| US-02 | Existing Spec Finder user | As a user with personal preferences, I want repository runtime defaults without surrendering control of permission policy. | Repository config affects runtime selection but cannot elevate permissions. |
| US-03 | Terminal user | As a terminal user, I want to see useful progress while keeping the final answer separately redirectable. | Progress remains visible when stdout is redirected to a file. |
| US-04 | User supervising agent work | As a supervising user, I want tool and permission activity summarized without exposing internal thoughts or raw payloads. | Concise status is visible; thoughts and raw tool data are absent. |
| US-05 | Security-conscious user | As a user granting workspace access, I want the agent confined to the selected workspace and cancellation to stop outstanding work. | Escaped access is refused and cancellation reaches a bounded terminal state. |
| US-06 | User switching providers | As a user of Claude, Codex, or Cursor, I want equivalent product-level outcomes even when provider details differ. | Each supported provider produces normalized progress and terminal categories. |
| US-07 | Existing `run` user | As a packet-workflow user, I want the new command to leave `run` and packet semantics unchanged. | Existing packet journeys behave as before. |

## Core Features

### F-01: One-Turn Exec Command

- **User value:** Completes ad-hoc repository work without artificial planning or reporting artifacts.
- **Mapped goals/stories:** G-01, G-05, G-06; US-01, US-07
- **MUST:** Accept one non-empty positional prompt, start one fresh ACP turn, return one terminal outcome, and exit.
- **SHOULD:** Fail before provider startup when invocation input is missing or invalid.
- **Acceptance conditions:**
  - `spec-finder exec "<prompt>"` starts exactly one fresh prompt turn.
  - The command does not create or mutate task files, packet memory, reports, checkpoints, archives, or task status.
  - The command does not offer an interactive follow-up prompt.
  - Missing prompts, unknown flags, or malformed option values produce an actionable usage result without starting a provider.
  - Existing `spec-finder run` behavior is unchanged.

### F-02: Workspace and Runtime Profile Resolution

- **User value:** Applies predictable project or personal runtime choices without unexpectedly expanding workspace access.
- **Mapped goals/stories:** G-02, G-04; US-02, US-05
- **MUST:** Resolve the execution workspace independently from the configuration source and use whole-profile fallback.
- **SHOULD:** Show the effective workspace, provider, model, reasoning, and speed before or as execution begins.
- **Acceptance conditions:**
  - The workspace is the nearest ancestor containing `.spec-finder`.
  - If no ancestor contains `.spec-finder`, the workspace is the exact current working directory.
  - Selecting `~/.spec-finder/config.json` never changes or broadens the workspace.
  - A valid nearest repository config supplies provider, model, reasoning, and speed as one complete profile.
  - The user profile supplies those runtime values only when no repository config exists.
  - Repository and user profiles never merge field by field.
  - Explicit `--provider`, `--model`, `--reasoning`, and `--speed` values override the selected runtime profile.
  - An existing invalid repository profile fails clearly rather than silently falling back to the user profile.
  - When no repository profile exists, a missing or invalid user profile fails clearly.
  - The provider is not started until configuration resolution succeeds.

### F-03: User-Owned Permission Policy

- **User value:** Repository defaults cannot silently elevate authority.
- **Mapped goals/stories:** G-02, G-04; US-02, US-04, US-05
- **MUST:** Resolve permission policy only from the valid user config or the safe `prompt` default.
- **SHOULD:** Make the effective permission policy and its source visible without implying OS-level sandboxing.
- **Acceptance conditions:**
  - Repository `permissions` never controls the effective permission policy.
  - A valid user permission value remains effective even when runtime values come from a repository profile.
  - Missing or unusable user permission data results in `prompt`.
  - `prompt` asks for a decision when an interactive terminal is available.
  - In noninteractive use, `prompt` never waits indefinitely; permission requests fail closed and are visibly reported.
  - `approve-all` and `deny` are accepted only from user-owned configuration.
  - Documentation explicitly distinguishes approval policy from workspace containment or operating-system sandboxing.

### F-04: Concise Human Terminal Stream

- **User value:** Makes long-running work understandable while preserving clean shell redirection.
- **Mapped goals/stories:** G-03, G-05; US-03, US-04, US-06
- **MUST:** Send concise progress and terminal status to `stderr`, and only the final agent response to `stdout`.
- **SHOULD:** Use stable, line-oriented, provider-neutral labels.
- **Acceptance conditions:**
  - Progress includes normalized activity, tool name and status, permission decisions, warnings, and terminal outcome.
  - Internal thoughts, raw tool arguments, and raw tool results are not shown.
  - Redirecting stdout captures only the final agent response.
  - Progress remains visible on stderr when stdout is redirected.
  - A failed turn may leave stdout empty but always emits a terminal status on stderr.
  - Meaning is not conveyed by color, animation, or symbols alone.
  - Unknown provider updates are summarized conservatively rather than dumped raw.

### F-05: Guarded Workspace Access

- **User value:** Enables useful edit-oriented work without allowing the host file boundary to escape the selected workspace.
- **Mapped goals/stories:** G-04; US-01, US-05
- **MUST:** Refuse host file access that cannot be proven to remain within the canonical workspace.
- **SHOULD:** Make read-only fallback mode visible before the prompt turn begins.
- **Acceptance conditions:**
  - File reads and writes through Spec Finder's host capabilities cannot escape through parent traversal, sibling prefixes, symlinks, aliases, or unresolved target ancestors.
  - Unsafe or indeterminate paths fail closed and produce a normalized warning.
  - Write capability is enabled only after containment, permission, cancellation, cleanup, and adversarial release gates pass.
  - If those gates have not passed, the command remains explicitly read-only.
  - Permission approval never overrides workspace containment.
  - V1 does not add generalized terminal or shell host capabilities.

### F-06: Cancellation and Truthful Terminal Outcomes

- **User value:** Lets users stop work confidently and understand why a turn ended.
- **Mapped goals/stories:** G-03, G-04; US-04, US-05, US-06
- **MUST:** Treat user cancellation as distinct from success, refusal, resource limits, permission denial, configuration failure, and provider failure.
- **SHOULD:** Use the same normalized outcome vocabulary across supported providers.
- **Acceptance conditions:**
  - Ctrl+C begins semantic cancellation rather than reporting ordinary failure.
  - Pending permission requests are settled during cancellation.
  - Provider work reaches a terminal state or is forcibly cleaned up within five seconds in release validation.
  - A provider that cannot meet bounded cancellation is not available through `exec` until the gate passes; its existing non-`exec` support is unchanged.
  - Success is reported only for a completed end-of-turn outcome.
  - Refusal, token or turn limits, cancellation, permission denial, configuration error, and provider failure are distinguishable in the terminal status.
  - Every non-success outcome returns a non-zero process result.
  - Exact process-result values remain stable once released and are documented.

### F-07: Discoverability, Compatibility, and No-History Boundary

- **User value:** Makes the command understandable without weakening existing workflows or privacy expectations.
- **Mapped goals/stories:** G-01, G-05, G-06; US-01, US-06, US-07
- **MUST:** Document command usage, precedence, workspace scope, permission ownership, output channels, cancellation, and V1 exclusions.
- **SHOULD:** State provider-specific limitations discovered during release validation.
- **Acceptance conditions:**
  - CLI help and user documentation include the command and four supported runtime overrides.
  - Documentation explains whole-profile fallback and why repository permissions are ignored.
  - Documentation explains stdout/stderr behavior and read-only fallback.
  - Spec Finder stores no prompt, response, transcript, session history, usage counter, trust record, or packet artifact.
  - The product does not claim that providers themselves retain no local state.
  - Claude, Codex, and Cursor each complete the documented one-turn journey or fail with a truthful provider-specific limitation.
  - Existing setup, config, run, version, and upgrade journeys retain their prior behavior.

## User Experience

1. The user discovers `exec` through CLI help or documentation.
2. The user runs `spec-finder exec "<prompt>"` from a repository or directory.
3. Before provider startup, Spec Finder resolves and reports:
   - the execution workspace;
   - the selected repository or user runtime profile;
   - any explicit runtime overrides;
   - the user-owned permission policy;
   - whether workspace access is read-only or write-capable.
4. Spec Finder starts one fresh ACP turn.
5. Concise progress appears on `stderr`, including tool activity and permission outcomes.
6. In `prompt` mode, an interactive user can approve or reject offered actions. Noninteractive execution fails closed instead of waiting.
7. The final agent response appears on `stdout`.
8. A normalized terminal status appears on `stderr`, and the process exits.
9. No follow-up prompt, packet artifact, transcript, or product metric is created.

State expectations:

- **Empty:** A missing or blank prompt produces usage guidance before provider startup.
- **Loading:** The terminal shows a stable startup/progress line; no spinner is required to understand state.
- **Success:** The final response is on stdout and success status is on stderr.
- **Failure:** The terminal identifies configuration, permission, provider, refusal, or resource-limit outcomes without raw sensitive payloads.
- **Cancellation:** Ctrl+C leads to a visible cancelled status and bounded cleanup.
- **Recovery:** Messages identify whether the user should correct config, authenticate the provider, change permission policy, or retry.
- **Accessibility:** Output is line-oriented and understandable without color, animation, or special glyphs. Status labels remain readable when copied or redirected.

## High-Level Constraints

- The MVP is human-oriented and performs exactly one fresh prompt turn.
- Runtime precedence is flags → complete repository profile → complete user profile.
- Repository configuration cannot supply effective permission authority.
- Workspace scope is nearest `.spec-finder` ancestor, otherwise exact current directory.
- Config discovery cannot relocate or broaden workspace scope.
- Permission policy is not presented as sandboxing.
- Host workspace access must fail closed when containment cannot be proven.
- Write mode is unavailable until its release gates pass.
- No prompt, response, transcript, session, task artifact, trust state, or metrics state is persisted by Spec Finder.
- Provider-side persistence must be described truthfully rather than denied generically.
- Default output excludes internal thoughts and raw tool payloads.
- Existing commands and packet workflows remain backward compatible.
- The command supports only the providers already supported by Spec Finder.
- V1 introduces no new provider-specific user options.
- V1 must remain usable in interactive and redirected terminal contexts.
- Performance targets apply under normal local/provider conditions and do not promise provider-independent latency.

## Non-Goals

- **Multi-turn conversation or follow-up prompts** — reconsider after repeated demand for continued sessions.
- **Session resume or history browsing** — outside the fresh-turn hypothesis.
- **Prompt input from stdin or files** — quoted positional input is sufficient for MVP.
- **JSON, JSONL, schemas, or other machine-readable output** — reconsider when repeated workflows require automation.
- **Explicit `--cwd` or additional workspace directories** — one invocation-derived workspace is the safety boundary.
- **Field-level repository/user config merging** — whole-profile selection is the approved policy.
- **Repository-controlled permissions** — execution authority remains user-owned.
- **Remembered workspace trust** — unnecessary because repository config cannot elevate permission policy.
- **Persistent validation metrics or telemetry** — the initial hypothesis is measured manually.
- **Per-run budgets, retries, concurrency, or rate controls** — unattended automation is deferred.
- **Custom provider launch commands or provider-specific flags** — reuse existing supported providers.
- **Generalized terminal or shell host capabilities** — V1 does not expand the host tool surface.
- **Task packet, memory, report, checkpoint, archive, or status integration** — `exec` remains distinct from `run`.
- **A guarantee that providers retain no state** — Spec Finder controls only its own persistence boundary.

## Phased Rollout Plan

### MVP

Included:

- F-01 through F-07.
- Human text output with separate progress and final-response channels.
- Whole-profile runtime fallback and four explicit overrides.
- User-owned permission policy.
- Invocation-derived workspace resolution.
- Read-only fallback until all write gates pass.
- Manual workflow-fit validation.

Entry criteria:

- Approved PRD and subsequent technical specification.
- No unresolved material product decision.
- Existing command behavior baselined.

Release criteria:

- Configuration, workspace, permission, output, cancellation, and terminal-outcome journeys are documented.
- Every provider exposed through `exec` completes the live one-turn acceptance matrix; a provider that fails a release gate is withheld from `exec` and documented without changing its existing support elsewhere.
- Zero workspace escapes in adversarial release validation.
- All cancellation cases settle permission state and terminate provider work within five seconds.
- Existing packet workflows remain compatible.
- Write capability is enabled only if every write-safety gate passes; otherwise the released command is visibly read-only.

Exit criteria:

- Ten genuine runs across at least two real work contexts within 30 days.
- At least 80% complete materially without immediate fallback.
- No containment or unbounded-cancellation incident.
- Findings documented manually outside the product.

### Later phases

- **Structured automation:** stdin, JSONL, schemas, and richer exit contracts only after repeated workflows require pipeline composition.
- **Persistent or resumable sessions:** only after users repeatedly need follow-up turns.
- **Shared permission governance:** only after teams demonstrate that user-owned permission policy is insufficient.
- **Optional diagnostics:** only after concise output proves inadequate for support and a safe disclosure boundary is defined.
- **Local metrics:** only after manual validation becomes insufficient and users approve retention and inspection behavior.
- **Broader workspace selection:** only after demand justifies additional-directory or explicit-working-directory authority.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | Genuine ad-hoc executions | Unknown | At least 10 | Manual log excluding scripted acceptance runs | First 30 days |
| M-02 | Workaround-free material completion | Unknown | At least 80% | Manual record of completion and immediate fallback | First 30 days |
| M-03 | Runtime precedence correctness | Unknown | 100% | Release acceptance matrix covering profile sources, overrides, missing files, and invalid files | Before release |
| M-04 | Time to first visible progress | Unknown | Median no more than 10 seconds | Manual timing during genuine runs | First 30 days |
| M-05 | Out-of-workspace host access | Unknown | Zero successful escapes | Adversarial release validation | Before release and ongoing |
| M-06 | Bounded cancellation | Unknown | 100% settled within five seconds | Supported-provider cancellation matrix | Before release |
| M-07 | Existing command compatibility | Current baseline | No observable regression | Existing workflow acceptance suite | Before release |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Repository config unexpectedly grants authority | Config includes `permissions`; comparable tools trust-gate project policy | Medium / High | Ignore repository permissions; show user-owned source | Product owner; reconsider only with demonstrated team-policy need |
| Invalid repository profile silently changes provider behavior | Whole-profile fallback is new | Medium / Medium | Fail clearly; never silently fall back past an existing invalid profile | Product owner; acceptance failure blocks release |
| Workspace access escapes through aliases or symlinks | Current checks are lexical | Medium / High | Keep writes disabled until canonical containment passes adversarial validation | Security owner; any escape blocks write mode |
| Cancellation leaves provider work running | Current cleanup is best-effort | Medium / High | Require semantic cancellation and five-second bounded cleanup | Runtime owner; any unbounded case blocks release |
| Concise output hides necessary recovery information | Raw details are intentionally omitted | Medium / Medium | Include normalized warnings, permission outcomes, and terminal categories | Product owner; repeated support failures trigger diagnostics review |
| Provider emits sensitive data in an unexpected update type | ACP adapters vary | Low / High | Conservatively classify unknown updates and never dump them raw | Security owner; disclosure incident blocks release |
| Direct-provider expectations do not match ACP adapters | Comparator research covers direct CLIs | Medium / Medium | Require live supported-provider acceptance before release | Product owner; provider limitation must be documented |
| Ten maintainer runs overstate demand | No external demand evidence | High / Medium | Count genuine work across multiple contexts and record fallback manually | Product owner; do not promote automation from maintainer runs alone |
| Users interpret permission approval as sandboxing | Current policy and containment are separate | Medium / High | State the distinction in preflight output and docs | Product owner; confusion in validation requires copy revision |
| Provider retains local state despite the no-history claim | Persistence is provider-specific | Medium / Medium | Scope the promise to Spec Finder-owned artifacts and document limitations | Product owner; provider verification updates docs |

## Architecture Decision Records

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — selects the guarded one-turn direction and write-release gates.
- [ADR-002: User-Owned Permissions and Human Exec Contract](adrs/adr-002-user-owned-permissions-human-exec.md) — selects permission ownership, whole-profile fallback, workspace scope, terminal visibility, no-metrics policy, and guarded MVP approach.

## Research Limitations

- No independent evidence quantifies demand for a provider-neutral one-shot wrapper.
- The ten-run and 80% targets are local validation hypotheses with unknown baselines.
- Direct Codex, Claude, and Gemini CLI behavior does not prove identical ACP-adapter behavior.
- A live cross-provider ACP matrix was not run during PRD research.
- Cursor documentation was insufficiently current and consistent to serve as decisive external evidence.
- Provider pricing and cost controls were not decision-useful because V1 does not introduce a new provider or pricing model.
- Provider-side persistence remains unverified and may differ by adapter or authentication mode.
- Performance depends partly on provider startup, model availability, network conditions, and account state.

## Open Questions

- Which exact numeric process results should represent usage/configuration error, provider failure, refusal or limits, permission denial, and cancellation?
- Which normalized status labels and warning vocabulary should be shared across providers?
- Which provider-side persistence limitations must appear in documentation after live validation?
