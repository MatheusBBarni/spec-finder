# Explicit Empty-Run State Product Requirements Document

## Overview

A valid Spec Finder packet with no executable tasks currently appears ambiguous: the cockpit closes immediately and `--no-ui` reports ordinary success without explaining why. This MVP gives the individual operator a default, clear, persistent no-work result while preserving successful completion and the read-only cockpit model.

The selected approach is **default informative no-work feedback**. It applies to every valid zero-executable run, gives a specific all-complete explanation when established, returns success in `--no-ui`, starts no provider work, and adds no new controls, configuration, or telemetry.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | Completed, done, and finished tasks are excluded from the execution plan; taskless packets remain invalid. | `src/tasks.ts:59-68` | 2026-08-08 | MVP covers valid zero-executable packets, not invalid packet loading. |
| Repository | The engine reports `0 tasks completed` after an empty plan, while the command closes the cockpit unconditionally. | `src/engine.ts:102-108`, `src/commands.ts:186-214` | 2026-08-08 | The product needs a distinct, durable no-work result. |
| Repository | The cockpit already has read-only navigation and `q`/Ctrl+C exits. | `src/ui/App.tsx:70-109` | 2026-08-08 | Do not add acknowledgement or workflow controls. |
| External | Skipped GitHub Actions jobs display an explanatory message while reporting success. | [GitHub Actions job conditions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions?apiVersion=2022-11-28) | accessed 2026-08-08 | Treat valid no-work as a successful, explicit outcome. |
| External | GitLab models `skipped` as a named status due to conditions or dependencies. | [GitLab CI/CD jobs](https://docs.gitlab.com/ci/jobs/) | accessed 2026-08-08 | Name the outcome clearly rather than hiding it inside generic success. |
| User decision | Ship by default, return success in `--no-ui`, and keep the cockpit informational. | PRD clarification | 2026-08-08 | No flag, nonzero exit code, or new interaction surface. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Eliminate ambiguity in valid no-work runs | Every eligible run communicates why nothing will execute. |
| G-02 | Preserve successful workflow semantics | Eligible `--no-ui` runs complete successfully with a truthful reason. |
| G-03 | Preserve trust in the read-only cockpit | Operators can read the state, inspect existing information, and exit predictably. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Individual local operator | As an operator rerunning a completed packet, I want to see that no work remains so that I do not mistake the run for a broken cockpit. | The cockpit visibly explains the no-work state and its reason. |
| US-02 | Individual local operator | As an operator, I want the no-work result to remain available until I leave so that I can verify the packet/task counts. | The state remains readable until `q` or Ctrl+C. |
| US-03 | CLI/script consumer | As a terminal user, I want a valid no-work run to explain itself while succeeding so that it does not look like a failure. | `--no-ui` reports the reason and succeeds. |

## Core Features

### F-01: Explicit valid no-work outcome

- **User value:** Operators can distinguish “nothing remains” from an unstarted or failed run.
- **Mapped goals/stories:** G-01, US-01
- **MUST:** Treat every valid run with zero executable tasks as an explicit no-work outcome.
- **SHOULD:** State that all tasks are already complete when that is the established reason; otherwise use a truthful bounded no-work explanation.
- **Acceptance conditions:** Invalid or malformed packets remain errors; valid no-work runs are not presented as failures.

### F-02: Persistent informational cockpit state

- **User value:** Operators can verify the outcome instead of seeing a transient or blank interface.
- **Mapped goals/stories:** G-01, G-03, US-01, US-02
- **MUST:** Display the no-work reason and packet/task counts in the normal cockpit layout.
- **SHOULD:** Retain existing read-only navigation and visible exit affordances.
- **Acceptance conditions:** The no-work state remains visible until the operator uses existing `q` or Ctrl+C exit behavior; it requires no acknowledgement.

### F-03: Truthful successful `--no-ui` result

- **User value:** Terminal users and scripts receive an understandable result without treating valid no-work as failure.
- **Mapped goals/stories:** G-02, US-03
- **MUST:** Report the same no-work meaning in `--no-ui` output and complete successfully.
- **SHOULD:** Keep the reason concise and actionable.
- **Acceptance conditions:** A valid no-work result is distinguishable from normal task completion in its reported text but has successful command semantics.

### F-04: No unnecessary work or added control surface

- **User value:** Operators avoid unnecessary delay or side effects, while the cockpit stays focused.
- **Mapped goals/stories:** G-02, G-03, US-01
- **MUST:** Begin no provider work for a valid no-work run.
- **SHOULD:** Leave normal task-run behavior unchanged.
- **Acceptance conditions:** The MVP adds no retries, task editing, acknowledgement controls, configuration, or telemetry.

## User Experience

The primary journey is: an operator reruns a packet, receives a clear no-work state with packet/task counts and a reason, verifies that all tasks are complete when applicable, optionally uses existing read-only navigation, then exits with `q` or Ctrl+C.

- **Loading:** Retain existing preparation feedback; do not imply provider work when none will begin.
- **No-work:** Make the successful “nothing to run” result more prominent than generic completion text.
- **Normal success and failure:** Preserve existing behavior; do not relabel invalid packets or failed work as no-work.
- **Recovery:** The operator may exit, add or reopen work through existing workflows, and rerun; V1 adds no repair action.
- **Accessibility:** Communicate state in text, not color alone; preserve the existing keyboard-only exit path and compact-layout readability.

## High-Level Constraints

- Ship as the default for all eligible `spec-finder run` invocations; no preview or configuration setting.
- A valid no-work `--no-ui` result completes successfully.
- Preserve the current read-only cockpit model and existing exit behavior.
- Do not collect telemetry, usage analytics, or new user data.
- Keep invalid or malformed packet errors distinct from valid no-work results.
- Do not start provider work when there is no executable task.

## Non-Goals

- **General preflight diagnostics taxonomy** — invalid, cancelled, filtered, and other outcomes remain outside MVP; revisit with evidence of multiple real causes.
- **Dedicated automation result mode** — no special nonzero exit code or new output contract; reconsider with a concrete integration requirement.
- **Guided next steps or acknowledgement controls** — adds interaction beyond the verified need; reconsider if operators cannot understand the informational state.
- **Task repair, retry, or editing actions** — the cockpit remains observational.
- **Telemetry or adoption analytics** — no evidence justifies collection for this corrective UX change.

## Phased Rollout Plan

### MVP

- Deliver F-01 through F-04 as the default experience.
- **Entry criteria:** approved PRD and ADRs.
- **Exit criteria:** all product acceptance conditions are demonstrably satisfied without changing normal or invalid-run semantics.

### Later phases

- **Automation-distinguishable result:** promote only after concrete script/integration demand.
- **Guided operator next steps:** promote only after feedback shows the informative state is insufficient.
- **General diagnostics taxonomy:** promote only after multiple present-day preflight causes justify one shared model.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | Eligible no-work runs with an explicit explanation | No focused baseline | 100% of defined no-work acceptance scenarios | Release acceptance review | Every release |
| M-02 | Provider work begun for eligible no-work runs | Unmeasured | 0 | Release acceptance review | Every release |
| M-03 | Truthful successful `--no-ui` results | Current generic `0 tasks completed` text | 100% of defined no-work scenarios | Release acceptance review | Every release |
| M-04 | Persistent informative cockpit states | Flash-like state reported in issue #1 | 100% of defined interactive no-work scenarios | Release acceptance review | Every release |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Operators do not know how to leave the persistent state | Persistent state is new; exits already exist | Low / Medium | Retain visible existing `q`/Ctrl+C affordances | Packet owner; acceptance review |
| Scripts need a machine-distinguishable no-work result | No current integration evidence | Medium / Medium | Keep success plus clear reason; reconsider after a concrete integration requirement | Product owner; feedback or integration request |
| Generic wording is confused with task failure | Current generic success is ambiguous | Medium / High | Use explicit successful no-work language and all-complete wording when known | Packet owner; acceptance review |
| Scope expands into diagnostics/control features | Comparable systems have broader status models | Medium / Medium | Enforce stated non-goals and later-phase evidence gates | Product owner; PRD change request |

## Architecture Decision Records

- [ADR-001: Show a persistent, explicit no-work outcome](adrs/adr-001-empty-run-state.md) — valid zero-work scope and bounded reason.
- [ADR-002: Ship no-work feedback as a default informative success](adrs/adr-002-default-informative-no-work.md) — default rollout, success semantics, and information-only interaction.

## Research Limitations

- No direct usage-frequency, adoption, or operator-usability baseline exists.
- External sources establish familiar workflow conventions, not direct demand for Spec Finder.
- The precise result/event shape and visual composition are deliberately deferred to the TechSpec.
- Current worktree changes to related source/test files are user-owned and are not treated as shipped behavior.

## Open Questions

- What concise wording best distinguishes “all tasks are already complete” from a generic valid no-work explanation?
- What future evidence threshold should justify a dedicated automation-distinguishable result?
