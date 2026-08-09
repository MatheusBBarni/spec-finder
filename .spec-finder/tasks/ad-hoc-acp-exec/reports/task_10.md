# Task 10 Final Report: Publish Exec Documentation and Release Evidence

## Outcome

- Verdict: blocked
- Date: 2026-08-09
- Provider/session: no live provider was certified; this report uses the immediately preceding implementation-session handoff, task 09's certification report, and terminal evidence from the current Darwin 25.6 ARM64 host.

The implementation published the packet-free exec contract without overstating unavailable capabilities. Task 09 remains blocked, so all real exec providers remain unavailable and host access remains read-only. The repository-wide verification gate also remains non-green because seven already-dirty cockpit/store assertions fail outside the task-owned documentation surfaces.

## Changes

- `src/cli.tsx` — added the exact exec grammar, prompt and flag rules, precedence, recognized provider values, read-only certification boundary, stream contract, exit mapping, cancellation, and no-history help.
- `README.md` — documented runtime/profile resolution, canonical workspace discovery, user-owned permissions, direct host access versus sandboxing, guarded-write conditions, streams, outcomes, recovery, persistence, compatibility, rollback, non-goals, the M-03–M-07 review, and the external M-01/M-02 measurement handoff.
- `tests/cli.test.ts` — locked the public help and README contract to the parser, stream/exit/security language, disabled provider/write claims, release evidence, and manual-handoff text.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_10.md` — recorded the final evidence, certification blocker, and repository-gate blocker.
- `.spec-finder/tasks/ad-hoc-acp-exec/reports/task_10.md` — this evidence-backed report.

Unrelated dirty worktree changes were preserved. Task frontmatter remains `status: in_progress`; lifecycle ownership remains with Spec Finder.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Document the exact command grammar, prompt/flag rules, supported runtime flags, and `CLI flags > nearest repository .spec-finder/config.json > ~/.spec-finder/config.json` precedence. | Satisfied | `src/cli.tsx` and the README exec section document one non-empty positional prompt, flag placement and repetition, recognized `claude`/`codex`/`cursor` values, model/reasoning/speed validation, whole-profile fallback, and pre-spawn validation. The focused CLI/commands/exec gate passed 33 tests with 196 expectations. |
| 2. Document workspace discovery, canonical containment, permission modes, guarded writes, direct host access, and the absence of sandbox guarantees. | Satisfied | README documents canonical nearest-marker discovery, exact-cwd fallback, user-only `prompt`/`approve-all`/`deny`, fail-closed noninteractive behavior, symlink/traversal/alias/sibling rejection, parent revalidation, and the explicit direct-host-access/not-an-OS-sandbox boundary. It states that current host access is read-only because task 09 is blocked. |
| 3. Document stderr/stdout behavior, exits `0`/`1`/`2`/`130`, cancellation and cleanup, normalized outcomes, and recovery. | Satisfied | CLI help and README define sanitized human stderr, success-only stdout after `end_turn` plus confirmed cleanup, normalized refusal/limit/permission/provider/cleanup outcomes, semantic Ctrl-C cancellation, pending-permission settlement, bounded cleanup, and recovery guidance. Contract tests passed in the focused gate. |
| 4. Document packet/history isolation, certified-provider boundaries, capability-gated close, compatibility, rollback, and non-goals. | Satisfied | README states that exec creates no packet, task, report, memory, checkpoint, transcript, history, trust, telemetry, or usage state; real providers are rejected before spawn while uncertified; `session/close` is called only when advertised; compatibility/rollback and V1 non-goals are explicit. This cross-checks ADR-001, ADR-002, and ADR-003. |
| 5. Review M-03–M-07 evidence and provide an owner-ready M-01/M-02 handoff without instrumentation. | Satisfied with release caveats | README links task 09's blocked report, records the M-03–M-07 evidence/decision matrix, and gives M-01/M-02 owner, method, sample, timing, and external-ledger rules. M-04 genuine-run timing and M-06 native Linux/Windows/live-provider evidence remain open as stated; no product instrumentation was added. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/cli.test.ts ./tests/commands.test.ts ./tests/exec.test.ts` | Passed | 33 tests, 0 failures, 196 expectations. |
| `rtk bun test ./tests/cli.test.ts` (final documentation recheck) | Passed | 5 tests, 0 failures, 74 expectations. |
| `rtk bun run check` | Passed | `tsc --noEmit` exited 0. |
| `rtk bun run build` | Passed | Bun bundled 27 modules; `dist/cli.js` was 0.29 MB. |
| `rtk git diff --check` | Passed | No whitespace errors reported. |
| `rtk bun run verify` | Blocked | Terminal exit 1 after 236 tests: 229 passed, 7 failed, 1,149 expectations. The failures are two `tests/store.test.ts` assertions and five `tests/cockpit.test.tsx` rendering assertions in already-dirty, unrelated cockpit/store surfaces; the build stage was separately verified successfully. |

The task 09 report remains the source for platform/provider certification evidence: native macOS fixture cleanup passed for the exercised scenarios, but native Linux/Windows cleanup and complete Claude/Codex/Cursor live/read-write matrices were unavailable. The source registry therefore correctly keeps all real exec providers disabled and host access read-only.

## Risks and Follow-ups

- Obtain native Linux and Windows descendant-cleanup evidence and complete Claude, Codex, and Cursor live matrices before enabling any real exec provider or guarded writes.
- Complete guarded-write containment and cancellation-rollback validation across every required host/provider combination.
- Measure M-04 first-visible-progress timing manually during genuine runs; keep M-01/M-02 in an external ledger owned by the release owner, with no telemetry or product state.
- Resolve the seven unrelated cockpit/store failures before the repository-wide verification gate can become green; do not weaken those tests or alter task 10 documentation to hide the blocker.
- Preserve the current fail-closed policy: `EXEC_PROVIDER_CERTIFICATION` remains false for every provider and exec host access remains read-only until the mandatory evidence passes.

## Final Verdict

Blocked. The task-owned documentation, contract tests, memory handoff, and focused verification are complete and accurately describe only the capabilities enabled by task 09. However, the required repository-wide `rtk bun run verify` exited 1 because seven unrelated cockpit/store assertions remain failing, while task 09's mandatory cross-platform/live-provider certification is also blocked. The task frontmatter and lifecycle status were intentionally left unchanged for Spec Finder to own.
