# Task Memory: task_03

## Objective Snapshot

- Implemented the secure, read-only release-workflow preflight boundary; lifecycle status and final report remain runtime-owned.

## Important Decisions

- `.github/workflows/release.yml` is manual-only with a required `release`/`reconcile` choice, a fail-closed `refs/heads/main` guard, a fixed non-cancelling `stable-release` concurrency group, and default-deny workflow permissions.
- The `preflight` job captures the dispatched SHA, checked-out commit SHA, tree SHA, source ref, package identity, expected tag, and normalized packed paths only after `bun run release:check` and `bun run verify` pass.
- The candidate handoff is a deterministic `release-candidate.json` artifact with local gate results, `mutationEligible: false`, and no remote mutation state; the job exposes `accepted=true` only after the artifact upload step succeeds, and downstream mutation must also require a successful preflight result.
- Reviewed action pins are checkout `34e114876b0b11c390a56381ad16ebd13914f8d5`, setup-bun `0c5077e51419868618aeaa5fe8019c62421857d6`, and upload-artifact `ea165f8d65b6e75b540449e92b4886f43607fa02`, each with a version comment.

## Learnings

- Static workflow tests can validate YAML policy through the existing `yaml` dependency while keeping hosted-dispatch, token, OIDC, and runner behavior explicitly external evidence.
- The candidate step uses `npm pack --dry-run --json --ignore-scripts` after the required gates to serialize packed paths without introducing a tarball or another lifecycle run; task 02's `release:check` remains the authoritative preflight gate.
- Final handoff evidence is fresh: focused workflow tests passed 4/4 with 54 expectations; `actionlint .github/workflows/release.yml` exited 0; `bun run release:check` exited 0 and reported `spec-finder@0.1.0` with 35 packed paths; `bun run verify` exited 0 with 260 tests passed, 1,388 expectations, and a successful build.

## Files / Surfaces

- Added `.github/workflows/release.yml` with preflight, candidate artifact upload, and always-run accepted/blocked summaries.
- Added `tests/release-workflow.test.ts` covering dispatch/mode/source policy, concurrency/source identity, action pins/permissions, gate ordering, artifact handoff, and blocked summaries.
- Updated packet shared memory with the task-04 handoff; no CLI, ACP, configuration, package-script, or lifecycle/report files were changed.

## Errors / Corrections

- The initial workflow job-level npm offline environment was narrowed to the candidate pack step so locked dependency installation remains able to resolve on hosted runners; `release:check` already owns its own offline cache settings. `actionlint` also required moving the `runner.temp` cache expression from job-level env to that step.

## Ready for Next Run

- Task 04 may add only mutation/reconciliation jobs to the same workflow; they must require a successful preflight plus accepted output and revalidate the artifact before using any write or OIDC permission.
- The final report phase may use the recorded verification results above without rerunning them; hosted GitHub dispatch, artifact service, OIDC, npm registry, and remote metadata behavior remain external evidence.
