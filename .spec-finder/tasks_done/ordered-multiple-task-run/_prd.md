# Ordered Multi-Packet Run Product Requirements Document

## Overview

Spec Finder operators currently repeat one `run` command for every approved packet in a planned sequence. The MVP gives solo local operators one opt-in command that accepts an ordered packet list, runs packets serially, stops on the first failure or cancellation, and presents compact per-packet plus aggregate outcomes.

The product approach is a compact fail-safe sequence: active-packet detail remains available, prior packets retain compact outcomes, recovery guidance is manual only, and existing single-slug behavior remains unchanged.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | The CLI currently accepts one slug and invokes one packet run. | [`src/commands.ts:186`](/Users/matheusbbarni/projects/spec-finder/src/commands.ts:186) | 2026-08-05 | Multi-packet execution is a new opt-in product path. |
| Repository | The existing packet engine already provides dependency-safe ordering and stops after a task failure. | [`src/engine.ts:29`](/Users/matheusbbarni/projects/spec-finder/src/engine.ts:29) | 2026-08-05 | MVP can preserve familiar execution semantics. |
| Repository | The cockpit shows task status, active task detail, transcripts, and reduced-color text semantics. | [`src/ui/store.ts:40`](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts:40), [`tests/cockpit.test.tsx:298`](/Users/matheusbbarni/projects/spec-finder/tests/cockpit.test.tsx:298) | 2026-08-05 | Keep detailed focus on the active packet and make status understandable without color. |
| Repository | `--no-ui` output and single-slug documentation already exist. | [`README.md:67`](/Users/matheusbbarni/projects/spec-finder/README.md:67), [`src/commands.ts:192`](/Users/matheusbbarni/projects/spec-finder/src/commands.ts:192) | 2026-08-05 | MVP must support both cockpit and terminal workflows. |
| External | Task accepts multiple task names and exposes fail-fast, exit-code, and JSON output conventions. | [Task CLI reference](https://taskfile.dev/docs/reference/cli) | 2026-08-05 | Ordered input, explicit failure behavior, and clear terminal results are familiar workflow patterns. |
| External | Nx supports multi-task execution, dependency-aware ordering, and explicit sequential execution. | [Nx running tasks](https://nx.dev/docs/getting-started/tutorials/running-tasks) | 2026-08-05 | Sequential execution should be an explicit product promise, not an accidental side effect. |
| External | GitHub Actions distinguishes fail-fast cancellation from continue-on-error. | [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) | 2026-08-05 | Failure and cancellation should remain distinguishable while sharing a non-success aggregate result. |
| External | GitHub CLI provides human-readable run summaries, structured fields, and non-zero failure status. | [GitHub CLI `gh run view`](https://cli.github.com/manual/gh_run_view), [formatting](https://cli.github.com/manual/gh_help_formatting) | 2026-08-05 | Terminal users need concise outcome summaries and truthful exit behavior. |
| Inference | A compact batch summary is the smallest experience that satisfies the verified workflow without creating a history browser. | Research synthesis and ADR-002 | 2026-08-05 | MVP retains outcomes but not full prior transcripts. |
| User decision | The user selected compact summaries, manual recovery guidance, already-complete-as-succeeded detail, opt-in rollout, and a combined correctness/usability launch bar. | PRD clarification decisions | 2026-08-05 | These decisions define the MVP boundary. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Remove repeated manual invocation | A planned sequence can be started with one command. |
| G-02 | Make sequence progress legible | Every declared packet receives a visible outcome: succeeded, failed, cancelled, or not started. |
| G-03 | Preserve fail-safe control | The first failure or cancellation prevents later packets from starting. |
| G-04 | Preserve compatibility | Existing single-slug runs remain unchanged and the feature is opt-in. |
| G-05 | Validate operator usability | At least 4 of 5 evaluators can run a three-packet sequence and identify the stopping packet without manual command chaining. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Solo operator | As an operator, I want to provide several packet slugs in a declared order so that I do not repeat the run command. | One invocation begins the sequence in the supplied order. |
| US-02 | Solo operator | As an operator, I want to see which packet is active and how earlier packets ended so that I can orient myself during a long run. | The active packet has detailed view; every prior packet has a compact outcome. |
| US-03 | Solo operator | As an operator, I want a failed or cancelled sequence to stop clearly so that later work does not begin unexpectedly. | The stopping packet is identified and later packets are marked not started. |
| US-04 | Repository maintainer | As a maintainer, I want a concise explanation after a stop so that I know what to resolve before rerunning manually. | Output states failure/cancellation, later not-started packets, and that no retry occurred. |
| US-05 | Automation maintainer | As a script author, I want one aggregate success or non-success result so that the sequence can be handled as one operation. | All-success sequences return success; failed or cancelled sequences return non-zero. |
| US-06 | Existing operator | As an existing Spec Finder user, I want the current single-slug command to continue working unchanged. | Existing single-run behavior and documentation remain valid. |

## Core Features

### F-01: Ordered sequence entry and preflight

- **User value:** The operator can declare the exact packet sequence before any work begins.
- **Mapped goals/stories:** G-01, G-03, US-01, US-03
- **MUST:** Accept the documented comma-separated packet list for `--multiple`.
- **MUST:** Reject malformed, empty, duplicate, unknown, or invalid packet entries before starting any packet.
- **SHOULD:** Explain which entry caused preflight failure.
- **Acceptance conditions:**
  - A valid list preserves the exact declared order.
  - An invalid list starts zero packets.
  - Preflight feedback is understandable in both cockpit and terminal workflows.

### F-02: Serial fail-safe execution

- **User value:** The operator receives predictable, ordered progress.
- **Mapped goals/stories:** G-02, G-03, US-01, US-03
- **MUST:** Run one packet at a time in declared order.
- **MUST:** Stop when a packet fails or is cancelled.
- **MUST:** Never start a later packet after the stopping outcome.
- **SHOULD:** Show the current position within the declared sequence.
- **Acceptance conditions:**
  - All-success sequences reach every declared packet.
  - Failure and cancellation sequences leave later packets visibly not started.
  - No parallel or continue-on-error behavior occurs in MVP.

### F-03: Compact batch summary with active-packet detail

- **User value:** The operator can understand the whole sequence without losing detailed context for current work.
- **Mapped goals/stories:** G-02, US-02
- **MUST:** Retain a compact outcome for every declared packet.
- **MUST:** Keep detailed task/transcript inspection focused on the active packet.
- **MUST:** Use text labels that remain understandable without color.
- **SHOULD:** Keep completed packet summaries visible after the active packet changes.
- **Acceptance conditions:**
  - The active packet is clearly identified.
  - Prior packets show compact outcomes.
  - The compact summary does not require opening a separate history view.

### F-04: Stopped-sequence explanation and manual recovery guidance

- **User value:** The operator knows what happened and what to resolve next.
- **Mapped goals/stories:** G-03, G-04, US-03, US-04
- **MUST:** Distinguish failure from cancellation.
- **MUST:** Identify every later packet that was not started.
- **MUST:** State that no automatic retry occurred.
- **SHOULD:** Suggest rerunning manually after the underlying issue is resolved.
- **Acceptance conditions:**
  - A failed sequence names the failed packet and later not-started packets.
  - A cancelled sequence uses cancellation language rather than failure language.
  - Recovery guidance does not imply rollback or automatic retry.

### F-05: Already-complete packet semantics

- **User value:** Previously completed work is transparent without creating confusing new statuses.
- **Mapped goals/stories:** G-02, US-02, US-04
- **MUST:** Count a packet with no remaining work as succeeded.
- **MUST:** Include an informational already-complete detail.
- **Acceptance conditions:**
  - The packet contributes to aggregate success.
  - The operator can distinguish “already complete” from “new work executed.”

### F-06: Opt-in compatibility and dual workflow support

- **User value:** Existing users can adopt the capability without changing their current habits.
- **Mapped goals/stories:** G-04, US-05, US-06
- **MUST:** Keep `spec-finder run <task_slug>` behavior unchanged.
- **MUST:** Support the compact sequence experience in both cockpit and `--no-ui` workflows.
- **MUST:** Document the new command in help and README examples.
- **Acceptance conditions:**
  - Existing single-slug usage remains valid.
  - The new feature is discoverable but does not alter default execution.
  - Terminal users receive the same essential outcomes as cockpit users.

## User Experience

1. The operator discovers the opt-in command through help or README documentation.
2. They provide an ordered list of packet slugs.
3. The product validates the complete list before starting.
4. The cockpit or terminal shows sequence progress and the active packet.
5. Each completed packet receives a compact outcome.
6. If a packet fails or is cancelled, the product identifies the stopping point, marks later packets not started, and explains that recovery is manual.
7. If all packets succeed, the product shows an aggregate success result.

Expected states:

- **Empty or malformed input:** Explain the invalid entry; start nothing.
- **Preflight failure:** Identify the problem and confirm that no packet started.
- **Active:** Identify the current packet and its position in the sequence.
- **Success:** Show all packet outcomes and aggregate success.
- **Failure:** Show the failed packet, later not-started packets, and manual recovery guidance.
- **Cancellation:** Show cancellation distinctly and preserve the same fail-safe stop boundary.
- **Already complete:** Show succeeded with an informational already-complete detail.
- **Accessibility:** Never rely on color alone; retain text labels and keyboard-readable navigation in the cockpit.
- **Reversibility:** No automatic retry, rollback, or irreversible batch action is introduced.

## High-Level Constraints

- The feature is opt-in and local; existing single-slug behavior remains unchanged.
- Execution is sequential and fail-fast in MVP.
- No retries, parallelism, continue-on-error, resume state, durable batch history, or rollback.
- Compact outcomes must be available in both interactive and non-interactive workflows.
- The product must not add persistent transcript retention or telemetry solely for this feature.
- Earlier successful packets remain completed if a later packet fails; the experience is fail-safe sequencing, not transactional delivery.
- Exact event shapes, internal state structures, and implementation technology belong in the TechSpec.

## Non-Goals

- **Automatic retries or recovery** — failure policy is not part of the verified MVP need.
- **Generated rerun commands** — manual guidance is sufficient for the first release.
- **Full historical transcript browsing** — the active packet remains detailed; prior packets retain compact outcomes only.
- **Parallel execution** — declared order and readable output are the selected value.
- **Continue-on-error execution** — the chosen product behavior is fail-fast.
- **Durable sequence history or resume** — no cross-session batch state is required.
- **Cross-packet dependency graphs** — packets retain their existing independent dependency semantics.
- **Analytics or telemetry** — launch validation uses acceptance checks and a small usability evaluation.

## Phased Rollout Plan

### MVP

Include:

- Ordered packet entry and full preflight.
- Serial fail-fast execution.
- Compact per-packet outcomes and active-packet detail.
- Distinct failure and cancellation messaging.
- Already-complete-as-succeeded detail.
- Manual recovery guidance.
- Cockpit and `--no-ui` support.
- Opt-in help and README documentation.
- Preservation of single-slug behavior.

Entry criteria:

- Product acceptance conditions are defined for success, failure, cancellation, preflight failure, and already-complete packets.
- Existing single-run behavior remains compatible.
- A three-packet usability evaluation is prepared.

Exit criteria:

- All acceptance cases pass.
- At least 4 of 5 evaluators identify the stopping packet without manual command chaining.
- No material confusion is observed between failure, cancellation, and not-started outcomes.

### Later phases

- **History-rich review:** Promote only if compact summaries fail the stopping-packet usability target.
- **Generated rerun guidance:** Promote only if manual recovery is repeatedly reported as cumbersome.
- **Automation-first structured output:** Promote only if script users demonstrate recurring demand beyond aggregate exit status.
- **Retries, resume, or parallelism:** Require separate product decisions and evidence of operational need.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | Ordered execution correctness | unknown | 100% of valid sequences preserve declared order | Acceptance scenarios with ordered packet fixtures | Every release candidate |
| M-02 | Fail-safe stopping | unknown | 100% of failure/cancellation scenarios start no later packet | Acceptance scenarios with controlled stopping outcomes | Every release candidate |
| M-03 | Stopping-packet comprehension | unknown | At least 4 of 5 evaluators identify the stopping packet and later not-started packets | Short usability evaluation using a three-packet sequence | Before release and first review |
| M-04 | Manual command reduction | unknown | Median one command per planned sequence | Two-week usage diary or scripted workflow comparison | First two weeks after release |
| M-05 | Single-run compatibility | Existing single-run behavior | 100% of existing single-slug acceptance cases remain valid | Regression verification | Every release candidate |
| M-06 | Preflight safety | unknown | 100% of malformed or invalid sequences start zero packets | Preflight acceptance scenarios | Every release candidate |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Compact summaries are too terse for diagnosis | No current multi-packet UX baseline | Medium / Medium | Measure stopping-packet comprehension; promote history-rich review if target is missed | Product review after first usability check |
| Users expect automatic retry after recovery guidance | Existing engine stops on failure; retries are out of scope | Medium / High | Explicitly state that no retry occurred and later packets were not started | Product owner; revisit only with repeated feedback |
| Cancellation is confused with failure | Current engine has cancellation edge cases | Medium / High | Use distinct user-facing language and acceptance cases | Product and TechSpec review |
| Long sequences make summaries difficult to scan | Existing cockpit is optimized for packet-local navigation | Medium / Medium | Keep summary compact and prioritize active packet; evaluate a representative long sequence | UX review before release |
| Feature remains undiscovered | This is an opt-in command | Medium / Medium | Add help text and README examples without changing default behavior | Release owner |
| Earlier completed work is mistaken for transactional delivery | The coordinator does not roll back prior packets | Low / High | Explain that earlier success remains durable and later failure stops future packets | Product copy review |

## Architecture Decision Records

- [ADR-001: Ordered Multi-Packet Run Coordinator](adrs/adr-001-ordered-multiple-task-run.md) — Records ordered preflight, serial fail-fast execution, outcomes, and active-packet boundaries.
- [ADR-002: Compact Fail-Safe Sequence Product Scope](adrs/adr-002-compact-fail-safe-sequence-product-scope.md) — Records the selected product approach, recovery guidance, already-complete semantics, and rollout.

## Research Limitations

- No direct adoption, demand, or pricing evidence exists for this feature.
- No baseline exists for how often operators manually chain packet commands.
- Exact batch-summary wording and layout remain to be refined in the TechSpec.
- Current cancellation behavior has edge cases that require implementation-level validation.
- External documentation was refreshed on 2026-08-05 and may evolve independently of Spec Finder.

## Open Questions

- What compact summary wording best distinguishes `succeeded`, `failed`, `cancelled`, `not_started`, and `already complete`?
- What maximum sequence length should receive a documented readability check?
- Should the README include a troubleshooting example for manually rerunning failed and not-started packets?
- Which evaluator task and packet fixtures best represent a realistic first-release sequence?
