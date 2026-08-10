# Task 03 Final Report: Harden Transcript Metadata Projection

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: ACP final-report handoff in the same session; provider identity unavailable

## Changes

- `src/ui/transcript.ts` — added optional phase-aware projection, suppressed
  report-phase session metadata, rendered non-report metadata as a fixed
  payload-free label, and exported the bounded `formatDisplayText` helper.
- `src/ui/transcript.ts` — replaced unbounded unknown serialization with
  deterministic structured formatting that omits `_meta`, redacts common
  absolute paths, neutralizes terminal controls, handles cycles, and caps
  display text at 1,024 characters with an ellipsis.
- `tests/transcript.test.ts` — added reused-session identity, malicious
  session-info, missing/implementation-phase, unknown-payload, path/control,
  truncation, deterministic-ordering, and cyclic-value coverage while retaining
  recognized-category regressions.
- `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and
  `memory/task_03.md` — recorded the phase/identity contract, formatter handoff,
  verification evidence, and report-phase handoff facts.
- `task_03.md` — runtime-owned checkpoint and report-handoff metadata is present;
  task status remains `in_progress` and was not changed by this phase.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Drop report-phase `session_info_update` payloads entirely. | Satisfied | `appendSessionInfoUpdate` returns the existing entries for `phase === "report"`; the focused malicious report metadata test passes with no entry or payload exposure. |
| 2. Use a fixed payload-free label for implementation or missing phase. | Satisfied | Non-report session-info produces only `Session metadata` with empty text; focused implementation and missing-phase assertions pass and exclude title, timestamp, path, and extension data. |
| 3. Keep unknown diagnostics bounded and safe. | Satisfied | `formatDisplayText` sorts structured values, recursively omits `_meta`, redacts POSIX/drive/UNC paths, neutralizes controls, handles cycles, and truncates at 1,024 characters; the adversarial fallback test passes with a visible ellipsis. |
| 4. Preserve recognized behavior and expose a narrow formatter. | Satisfied | Existing message, thought, tool, plan, capability, and tool-observation regressions pass; explicit phase scoping keeps reused provider-session identities separate; `formatDisplayText` is the only reusable display seam added for task 04. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/transcript.test.ts` | Passed | 16 tests passed, 0 failed, 72 assertions. |
| `rtk bun run check` | Passed | `tsc --noEmit` exited 0. |
| `rtk bun run verify` | Passed | Type check passed; 306 tests across 29 files passed, 0 failed, 1,778 assertions; production bundle built successfully with 28 modules (`cli.js` 0.33 MB). |
| `rtk git diff --check` | Passed | No whitespace errors reported. |

The repository has no coverage-threshold tool, so a percentage is not
measurable. Focused scenarios cover recognized categories, phase-separated
reused-session identity, report metadata suppression, fixed metadata labels,
unknown fallback safety, cyclic values, path redaction, control neutralization,
deterministic ordering, and truncation.

## Risks and Follow-ups

- Task 04 must pass each session update's optional phase and reuse
  `formatDisplayText` for interactive activity reasons; it owns store
  projection and no-UI compatibility.
- Task 05 still owns rendered OpenTUI frame evidence for the final cockpit
  presentation. This transcript task is deterministic pure TypeScript, so no
  platform or manual evidence was required here.
- ACP v1 unknown-wire-discriminator compatibility remains out of scope; the
  bounded fallback covers supported adapter/test-level unknown values.
- No live-provider or native-platform verification was required by the packet.

## Final Verdict

Task 03 is completed. Transcript projection now fails closed for report
session metadata, keeps non-report metadata payload-free, and preserves useful
bounded diagnostics for unrelated unknown updates. Recognized transcript
categories and reused-session phase identity remain covered, all required
focused and repository verification gates passed to terminal exit, memory is
current, and lifecycle status remains under Spec Finder ownership.
