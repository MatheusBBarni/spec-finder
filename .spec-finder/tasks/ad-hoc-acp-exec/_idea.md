# Guarded One-Turn ACP Exec

## Overview

Spec Finder users need a direct way to run an ad-hoc prompt through their configured ACP provider without creating a task packet or invoking the provider CLI separately.

V1 introduces `spec-finder exec "<prompt>"`: one fresh ACP session in the current repository, human-readable streamed output, workspace tools governed by existing permissions and hardened containment, then a truthful terminal result and exit.

This is a compounding capability: V1 remains narrow, while establishing a reusable provider-neutral execution boundary for later automation if usage proves demand.

## Problem

Spec Finder currently supports structured task-packet execution, but not one-off repository work. A user who wants an agent to inspect, explain, or modify something must either:

- invoke Claude, Codex, or Cursor directly and reproduce the desired configuration; or
- create a Spec Finder task packet, which initializes memory, mutates task status, executes a separate report turn, and produces lifecycle artifacts unrelated to an ad-hoc request.

The frequency baseline is unknown. The initial hypothesis is that an existing user will encounter this workflow at least ten times within 30 days.

### Evidence

| Kind | Finding | Source | Date | Confidence |
|---|---|---|---|---|
| Repository | The CLI has no `exec` command. | `src/cli.tsx`, `src/commands.ts` | 2026-08-08 | High |
| Repository | Packet execution initializes memory, changes task state, and requires implementation and report turns. | `src/engine.ts` | 2026-08-08 | High |
| Repository | `runAcpTurn` already implements most of a fresh one-turn ACP lifecycle. | `src/acp-client.ts` | 2026-08-08 | High |
| Repository | Existing CLI flags overlay configuration and pass through strict validation. | `src/commands.ts`, `src/config.ts` | 2026-08-08 | High |
| Repository | Nearest-config resolution, user-config fallback, response streaming to the console, semantic cancellation, and bounded cleanup are not implemented. | `src/paths.ts`, `src/commands.ts`, `src/acp-client.ts` | 2026-08-08 | High |
| Repository | Workspace containment is lexical and does not protect writes against symlink traversal. | `src/paths.ts` | 2026-08-08 | High |
| External | ACP v1 supports initialization, session creation, streamed prompt turns, permission requests, cancellation, and typed completion. | [ACP prompt lifecycle](https://agentclientprotocol.com/protocol/v1/prompt-turn) | 2026-08-08 | High |
| External | Codex, Claude Code, and Gemini offer first-class one-shot or headless agent commands. | [Codex](https://developers.openai.com/codex/noninteractive/), [Claude](https://code.claude.com/docs/en/headless), [Gemini](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md) | 2026-08-08 | High |
| External | Layered CLI, project, and user configuration is established behavior in comparable tools. | [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-basic), [Claude settings](https://code.claude.com/docs/en/settings) | 2026-08-08 | High |
| Inference | Provider-neutral configuration is the clearest initial differentiation. | Repository and competitor synthesis | 2026-08-08 | Medium |
| Inference | Ten genuine runs can validate local workflow fit, but not broad demand or defensibility. | User target and council critique | 2026-08-08 | Medium |

## Target Users

| Persona | Context | Need | Current workaround |
|---|---|---|---|
| Existing Spec Finder user | Working inside a repository and needing one bounded agent turn | Use the configured ACP provider without creating planning artifacts | Invoke a provider CLI or create an artificial task packet |
| Spec Finder maintainer | Exercising provider/configuration behavior during real repository work | Validate provider-neutral execution and overrides through the public CLI | Use task execution, focused tests, or provider-specific commands |
| Team adopting shared configuration | Repository supplies common defaults while individuals sometimes override a run | Predictable project/user/flag precedence | Reproduce provider-specific settings manually |

## Core Features

| ID | Priority | Feature | Observable user value | Evidence |
|---|---|---|---|---|
| F-01 | Critical | `spec-finder exec "<prompt>"` runs exactly one fresh ACP prompt turn | Completes ad-hoc work without task artifacts or a provider-specific command | Missing CLI route; reusable `runAcpTurn` |
| F-02 | Critical | Resolve flags → nearest `.spec-finder/config.json` → `~/.spec-finder/config.json` | Uses predictable defaults while permitting explicit one-run overrides | Existing override seam and comparable CLI precedence |
| F-03 | Critical | Stream human-readable agent and tool progress, followed by a terminal outcome | Users can observe progress and know whether the requested turn completed | Current console discards `session_update` events |
| F-04 | Critical | Enforce canonical workspace containment and fail-closed permission mediation | Write-capable tools cannot escape the resolved workspace through path aliases or symlinks | Verified lexical-boundary gap and council consensus |
| F-05 | Critical | Handle Ctrl+C through ACP cancellation and bounded provider cleanup | Cancellation does not leave pending permissions or orphaned provider work | ACP cancellation contract and current cleanup gap |
| F-06 | High | Map configuration errors, ACP stop reasons, cancellation, and runtime failures to stable terminal behavior | Shell users receive truthful, actionable outcomes | Comparable CLIs and ACP typed stop reasons |
| F-07 | High | Document effective configuration, permission behavior, workspace scope, and V1 exclusions | Users understand what will run and what authority it has | Approval policy is not equivalent to sandboxing |
| F-08 | Medium | Record privacy-minimizing local validation outcomes without prompt or response content | The 30-day hypothesis can be evaluated without collecting sensitive repository data | KPI requirement and council critique |

## KPIs

| ID | KPI | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| KPI-01 | Genuine ad-hoc executions | Unknown | At least 10 independently initiated runs | Content-free local run counter; exclude scripted acceptance tests | First 30 days |
| KPI-02 | Workaround-free material completion | Unknown | At least 80% of genuine runs complete without immediate provider-CLI or task-packet fallback | Terminal outcome plus manual/local fallback record | First 30 days |
| KPI-03 | Configuration precedence correctness | Unknown | 100% pass rate | Acceptance matrix covering flags, nearest repository config, user config, missing config, and invalid config | Before release |
| KPI-04 | Time to first visible output | Unknown | Median no more than 10 seconds under normal local conditions | Timestamp invocation and first agent output | First 30 days |
| KPI-05 | Workspace containment | Unknown | Zero successful out-of-workspace writes | Adversarial path, symlink, and alias integration tests | Before release and ongoing |
| KPI-06 | Cancellation cleanup | Unknown | 100% of cancellation tests resolve pending permissions and terminate provider work within 5 seconds | Mock and real-provider cancellation tests | Before release |

## Feature Assessment

| Criterion | Score | Evidence-backed rationale |
|---|---|---|
| Impact | Strong | Removes unrelated packet lifecycle and duplicated provider configuration from a missing workflow. |
| Reach | Maybe | V1 targets existing configured Spec Finder users; the size of that population is unknown. |
| Frequency | Maybe | Ten runs in 30 days is a validation hypothesis, not an observed baseline. |
| Differentiation | Maybe | One-shot execution is established, but provider-neutral Spec Finder configuration adds focused value. |
| Defensibility | Pass | The command itself is easy to copy; deeper value would require later workflow integration. |
| Feasibility | Strong | The existing ACP turn, provider launch, permission, and override seams cover much of the feature. |

## Independent Critique

### Consensus

Four independent advisors—pragmatic engineering, architecture, security/privacy, and product/devil's advocate—agreed that V1 should:

- use a distinct execution path over the existing ACP primitive;
- run exactly one fresh human-oriented turn;
- preserve flags → nearest repository config → user config precedence;
- avoid packet lifecycle artifacts;
- exclude automation and persistent-session features;
- treat containment, permission handling, cancellation, cleanup, output, and exit semantics as release contracts.

### Unresolved Tensions

| Tension | Position A | Position B | Decision consequence |
|---|---|---|---|
| Write-enabled launch timing | Ship read-only first or require experimental write opt-in until hardening is proven | Permit writes in V1 once canonical containment and bounded cancellation pass adversarial verification | Selected direction permits writes only after the release gates pass; otherwise the command remains read-only |
| Meaning of ten runs | Ten maintainer runs can be novelty or functional testing rather than demand | Ten genuine, task-motivated runs are proportionate validation for a narrow local feature | Count only real work across multiple contexts; do not treat the result as broad-market validation |
| Approval versus containment | Existing permission settings govern user consent | Permission settings do not provide OS-level isolation | Documentation and runtime behavior must describe permissions as approval policy and enforce workspace safety independently |

### Position Evolution and Dissent

The engineering advisor initially supported write-capable V1 after hardening, then partially conceded that a read-only initial state or experimental write opt-in is safer until adversarial tests pass.

The security advisor initially preferred the essence-first direction, then partially conceded that a separate read-only release is unnecessary if canonical containment, fail-closed mediation, and bounded cancellation are completed before launch.

The product advisor partially conceded that ten runs can validate V1 usability when they represent genuine work and record completion, fallback, permission, and latency outcomes. The advisor held firm that those runs cannot establish broad demand or justify automation.

The retained dissent is that write access may still be premature even after host-boundary tests because approval is not sandboxing and trusted users can authorize mistaken repository changes.

### Recommended Direction

Ship the refined guarded V1: full requested configuration precedence, one human-streamed ACP turn, and workspace writes only after the containment and lifecycle gates pass. If they do not pass, retain the command with read-only access rather than weakening the safety claim.

## Opportunity Decision

| Direction | Outcome | Effort | Principal risk | Decision |
|---|---|---:|---|---|
| Refined guarded V1 | Human-streamed one-turn execution, full configuration precedence, conditionally write-capable workspace tools | Medium | Containment and lifecycle correctness | **Selected** |
| Read-only essence-first | Same one-turn command without workspace writes | Low–Medium | Does not validate edit-oriented usage | Rejected as the target; retained as fallback if release gates fail |
| Automation surface | Stdin, JSONL, schemas, explicit CWD, budgets, and resume | High | Premature security and compatibility scope | Deferred pending usage evidence |

The selected direction preserves the requested provider-neutral capability while accepting host hardening as its principal cost.

## Out of Scope (V1)

- **Multi-turn conversations, session loading, and resume** — V1 tests a fresh one-turn job; reconsider after repeated follow-up demand.
- **JSON, JSONL, output schemas, and machine-readable event contracts** — automation demand is unproven; reconsider when a majority of repeated jobs need pipeline composition.
- **Prompt input from stdin or files** — quoted prompt input is sufficient for the initial human workflow.
- **Explicit `--cwd` or additional workspace directories** — execution remains anchored to the current repository and one containment boundary.
- **Per-run budgets, retries, concurrency, and rate controls** — these belong to an unattended automation surface.
- **New provider command configuration or provider-specific V1 flags** — reuse the existing supported provider and runtime configuration.
- **Task memory, reports, task status, checkpoints, archives, or packet creation** — `exec` must remain independent from `run`.
- **Persistent prompt, response, transcript, or sensitive telemetry storage** — validation records only content-free outcomes.
- **A generalized host terminal tool** — V1 does not expand the ACP client's current host capability set.

## Architecture Decision Records

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — selects the refined one-turn direction, configuration precedence, release gates, and V1 exclusions.

## Research Limitations

- No independent evidence quantifies one-shot usage frequency among Spec Finder users.
- Competitor documentation validates the workflow shape but does not prove demand for a provider-neutral wrapper.
- Cursor's current CLI documentation was partially inaccessible or contradictory, so it was not used as decisive evidence.
- No live cross-provider execution matrix was run during idea discovery.
- Cost and pricing vary by provider, authentication method, model, and agent behavior; V1 does not claim cross-provider cost predictability.
- The 10-run target is a user-selected hypothesis with an unknown baseline.

## Open Questions

- What exact formatting should distinguish progress/tool activity from the final agent response?
- What stable exit-code mapping should represent refusal, token or turn limits, cancellation, configuration failure, and provider failure?
- How should privacy-minimizing local validation outcomes be stored and inspected?
- Should the five-second cancellation target remain universal or become provider-specific during technical design?
