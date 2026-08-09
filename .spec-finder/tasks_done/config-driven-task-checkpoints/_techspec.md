# Config-Driven Per-Task Git Checkpoints Technical Specification

## Executive Summary

Implement a shared checkpoint module that captures a clean temporal Git baseline, records task delivery state in task frontmatter, stages the task delta explicitly, verifies the cached diff, and creates one local commit after verified task completion.

The ACP runtime calls the module directly. The manual batch skill invokes a narrow two-phase CLI surface:

```text
spec-finder checkpoint begin <slug> <task_id>
spec-finder checkpoint complete <slug> <task_id>
```

Checkpoint delivery state is separate from the existing task lifecycle `status`. A task can remain `status: completed` while its delivery state is `blocked`; a normal rerun retries delivery without rerunning verified implementation.

The primary trade-off is broad lifecycle-consumer work across task parsing, events, UI, execution ordering, archive classification, and tests. This is preferred over a second packet ledger or isolated worktree subsystem because it preserves one task-owned recovery boundary and one implementation across both workflows.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | Configuration is strict v2 and defaults are centralized. | [src/config.ts](/Users/matheusbbarni/projects/spec-finder/src/config.ts) | 2026-08-04 | Add `auto_commit: boolean` to schema/default/migration paths. |
| Repository | Runtime owns implementation, report, status, and run result. | [src/engine.ts](/Users/matheusbbarni/projects/spec-finder/src/engine.ts) | 2026-08-04 | Runtime is the lifecycle owner for direct checkpoint calls. |
| Repository | Manual batch execution is a skill document, not a runtime module. | [sf-batch-tasks](/Users/matheusbbarni/projects/spec-finder/skills/sf-batch-tasks/SKILL.md) | 2026-08-04 | A CLI bridge is required for shared behavior. |
| Repository | Packet memory is initialized before task execution. | [src/memory.ts](/Users/matheusbbarni/projects/spec-finder/src/memory.ts) | 2026-08-04 | Pre-memory cleanliness and post-memory baseline must be distinct phases. |
| Repository | `TaskStatus` has no delivery state; UI/archive/execution consumers assume completed status is final. | [src/tasks.ts](/Users/matheusbbarni/projects/spec-finder/src/tasks.ts), [src/ui/store.ts](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts), archive classifier | 2026-08-04 | Add optional task-level checkpoint metadata and update all consumers. |
| Official docs | Porcelain v1 is stable for scripts and exposes index, worktree, and untracked state. | [git status](https://git-scm.com/docs/git-status) | Git 2.53.0 manual, accessed 2026-08-04 | Use `--porcelain=v1 -z` for baseline/delta parsing. |
| Official docs | Explicit pathspec staging limits the index scope. | [git add](https://git-scm.com/docs/git-add) | Accessed 2026-08-04 | Never use blanket staging. |
| Official docs | Cached diff shows the proposed next commit. | [git diff](https://git-scm.com/docs/git-diff) | Accessed 2026-08-04 | Verify staged content before commit. |
| Official docs | Normal commit records the current index. | [git commit](https://git-scm.com/docs/git-commit) | Git 2.55.0 manual, accessed 2026-08-04 | Require clean/index-safe baselines and restore staged paths on failure. |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| G-01 | Retry blocked delivery without rerunning verified implementation | `src/engine.ts`, checkpoint metadata, `executionOrder` | Rerun fixture with blocked task | Planned |
| G-02 | One checkpoint contains complete task record | checkpoint path set and commit flow | Commit-content integration test | Planned |
| G-03 | Fail closed and default off | config + Git helper | Config, dirty-state, and no-commit tests | Planned |
| G-04 | Same behavior in ACP/manual paths | shared module + CLI bridge | Cross-path acceptance matrix | Planned |
| US-01 | Documented deliberate opt-in | `README.md`, config output | Docs/config assertions | Planned |
| US-02 | One checkpoint after verified completion | engine/checkpoint complete | Exact-one-commit test | Planned |
| US-03 | Preserve implementation, report, memory, status | temporal candidate paths | Commit tree inspection | Planned |
| US-04 | Explain refusal and stop downstream work | events/result/UI | Failure-path test | Planned |
| US-05 | Task-sized local history | deterministic message and path set | Commit log/tree fixture | Planned |
| US-06 | Omitted/false preserves current behavior | config parser/runtime | Default-off regression tests | Planned |
| US-07 | Runtime/manual parity | CLI and engine calls | Equivalent scenario matrix | Planned |
| F-01 | Strict boolean `auto_commit`, default false | `src/config.ts` | Config tests | Planned |
| F-02 | Checkpoint only after implementation/report/status success | `src/engine.ts`, checkpoint service | Failed/report-incomplete tests | Planned |
| F-03 | Complete task record | candidate path calculation | Commit-content test | Planned |
| F-04 | Dirty/index/untracked/ambiguous refusal | `src/checkpoints.ts` | Git fixture tests | Planned |
| F-05 | Persist blocked state and retry on normal rerun | task metadata + engine | Restart/retry test | Planned |
| F-06 | Shared module plus CLI bridge | `src/checkpoints.ts`, `src/commands.ts` | Cross-path tests | Planned |
| F-07 | No push, identity changes, bypass, stash/reset/clean | Git invocation wrapper | Argument/audit tests | Planned |
| C-01 | Default-off explicit opt-in | config schema/default | Config tests | Planned |
| C-02 | Local-only Git history | checkpoint command surface | No-remote integration test | Planned |
| C-03 | Preserve hooks/signing/authorship | normal Git commit invocation | Hook/signing failure fixture | Planned |
| C-04 | Fail closed on unrelated/ambiguous state | baseline parser | Dirty-state matrix | Planned |
| C-05 | Never blanket-stage | explicit candidate pathspecs | Staged-tree assertion | Planned |
| C-06 | Both execution paths | engine + manual CLI | Cross-path matrix | Planned |
| C-07 | Separate implementation/delivery language | events/UI/result | Snapshot/text tests | Planned |
| C-08 | No telemetry/durable analytics | observability boundary | Event payload inspection | Planned |
| M-01 | ≥90% eligible stopped runs recover without rerun | checkpoint-blocked recovery report | 30-day operational review | Measurement gap |
| M-02 | Zero unrelated files committed | Git fixture audit | Every verification run | Planned |
| M-03 | 100% default-off compatibility | config scenarios | Every verification run | Planned |
| M-04 | 100% refusal stops downstream and explains recovery | engine/events/UI | Failure-path matrix | Planned |
| M-05 | 100% defined runtime/manual parity | acceptance matrix | Before release | Planned |
| NG-01 | No push/PR/remote sync | CLI scope/Git wrapper | Negative integration tests | Planned |
| NG-02 | No failed/blocked task commits | completion gate | Failure tests | Planned |
| NG-03 | No dirty-worktree reconciliation | clean baseline refusal | Dirty-state tests | Planned |
| NG-04 | No interactive setup enablement | setup/docs unchanged except config field | Setup regression tests | Planned |
| NG-05 | No automatic retry bypass | error/recovery flow | Hook/refusal tests | Planned |
| NG-06 | No analytics/dashboard | event/result scope | API review | Planned |
| NG-07 | No reviewed/merged implication | output/docs text | Copy assertions | Planned |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| `src/config.ts` | Existing | Parse/default/migrate `auto_commit` | Config JSON → validated config | Zod |
| `src/checkpoints.ts` | New | Baseline, delta, staging, commit, delivery metadata | Task/packet context → checkpoint outcome | Git executable, task metadata |
| `src/engine.ts` | Existing | Runtime lifecycle and recovery ordering | Task execution → checkpoint calls/events | `checkpoints.ts`, tasks |
| `src/tasks.ts` | Existing | Parse/validate checkpoint metadata and order blocked retries | Task files → `TaskFile` | YAML/Zod |
| `src/events.ts` | Existing | Publish checkpoint-created/blocked events | Outcome → listener event | Task IDs |
| `src/commands.ts` | Existing | Implement `checkpoint begin|complete` bridge | CLI args → checkpoint result | `checkpoints.ts`, config |
| `src/cli.tsx` | Existing | Register/help/argument routing | argv → command | commands |
| `src/ui/store.ts` | Existing | Track delivery state and reasons | events → cockpit state | events |
| `src/ui/App.tsx` | Existing | Render checkpoint outcome | state → TUI text/labels | UI store |
| `skills/sf-batch-tasks/SKILL.md` | Existing | Invoke begin/complete CLI phases; reject legacy flag | Skill workflow → CLI | Spec Finder binary |
| `skills/sf-archive-tasks/scripts/scan-tasks.sh` | Existing | Keep blocked-delivery packets unarchived | task metadata → verdict | YAML/frontmatter |
| `README.md` | Existing | Document config and local-only behavior | Docs → operator understanding | Config contract |

### Data and Control Flow

#### Initial run

1. Load and validate configuration.
2. If `auto_commit` is false, follow the existing no-commit path.
3. If true, capture a pre-memory porcelain/index baseline. Any unrelated pre-existing change blocks checkpoint mode before task mutation.
4. Initialize packet memory.
5. Capture the post-memory packet baseline, allowing only known memory-bootstrap changes.
6. For each task, capture a task baseline before setting `in_progress`.
7. Execute implementation and report.
8. Validate the report and set normal task status to `completed`.
9. Remove transient `active` metadata, calculate the temporal candidate delta, stage explicit paths, inspect the cached diff, and commit.
10. On success, emit checkpoint-created with commit ID and continue.
11. On failure, unstage only candidate paths, persist `blocked` metadata, emit checkpoint-blocked, stop before downstream tasks.

#### Normal rerun

1. Load tasks and detect a completed task with checkpoint state `blocked`.
2. If `auto_commit` is false, stop with a configuration-required recovery message.
3. Revalidate stored base head, baseline digest, candidate paths, and current Git state.
4. Retry checkpoint delivery without implementation/report execution.
5. On success, clear blocked metadata, emit checkpoint-created, and continue dependency order.
6. On another failure, update the blocked error and stop.

#### Cancellation

- Cancellation during implementation/report preserves current runtime behavior.
- Cancellation before checkpoint completion does not create a commit.
- A task left `in_progress` is eligible for existing rerun behavior; no checkpoint is claimed.

### Core Interfaces

```ts
export type DeliveryState = "active" | "blocked"

export interface CheckpointRecord {
  state: DeliveryState
  baseHead: string
  baselineDigest: string
  paths: string[]
  error?: string
}

export interface CheckpointOutcome {
  state: "disabled" | "created" | "blocked"
  commit?: string
  message?: string
}
```

```ts
export interface CheckpointService {
  begin(input: { root: string; slug: string; task: TaskFile }): Promise<void>
  complete(input: { root: string; slug: string; task: TaskFile }): Promise<CheckpointOutcome>
  retry(input: { root: string; slug: string; task: TaskFile }): Promise<CheckpointOutcome>
}
```

Errors are typed by outcome rather than thrown for expected safety refusals. Process failures, malformed metadata, and Git executable failures include a user-safe message and preserve the blocked state when recovery is possible.

### Data Models and Lifecycle

`TaskFrontmatter` gains an optional validated field:

```yaml
checkpoint:
  state: active
  base_head: <oid>
  baseline_digest: <sha256>
  paths:
    - src/example.ts
```

Blocked state adds `error`. Successful delivery removes the transient field before committing, so the task commit contains the task record but no stale `active` marker.

Lifecycle:

```text
absent → active → absent       successful checkpoint
absent → active → blocked      task delivery failure
blocked → absent               successful retry
blocked → blocked              retry refusal/failure
```

The existing `status` remains `completed`, `failed`, or another lifecycle value. `checkpoint.state` is delivery metadata, not a replacement status.

Ownership and retention:

- The task file owns delivery metadata.
- Baseline OID, digest, candidate paths, and error are retained only while active/blocked.
- Successful commit identity is emitted and reported; no extra ledger is created.
- Metadata from absent/older packets defaults to no checkpoint state.
- The archive classifier treats `status: completed` with `checkpoint.state: blocked` as remaining.

### External Interfaces

#### CLI

```text
spec-finder checkpoint begin <task_slug> <task_id>
spec-finder checkpoint complete <task_slug> <task_id>
```

- `begin` requires a valid packet/task and `auto_commit: true`; it captures the task baseline and writes `active`.
- `complete` requires task completion/report evidence, stages the temporal candidate paths, verifies the cached diff, and commits.
- A blocked task may use `complete` or normal `run` recovery; normal rerun is the supported operator path.
- Legacy `auto-commit=true|false` tokens are rejected with a config-only error.
- No command accepts remote, push, identity, hook-bypass, stash, reset, or clean options.

#### Git process boundary

- Invoke Git with argument arrays and an explicit working directory; never use a shell command string.
- Use `status --porcelain=v1 -z`, `rev-parse HEAD`, exact `add -- <paths>`, `diff --cached --name-status -z`, `diff --cached --check`, and plain `commit -m <message>`.
- The commit message is deterministic: `chore(spec-finder): checkpoint <task_id>`.
- On failure after staging, restore only the candidate paths to the pre-stage index state; if restoration fails, report an unrecoverable manual cleanup requirement.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| Config parser | Strict v2 keys | Add boolean `auto_commit` | Invalid type remains config error | Missing key parses false |
| Runtime engine | Completion then next task | Begin/complete/retry checkpoint calls | Blocked delivery stops loop | Existing false path unchanged |
| Task frontmatter | Lifecycle status only | Optional checkpoint metadata | Invalid metadata blocks packet validation | Absent metadata remains valid |
| Run events | Status/activity/run-finished | Add checkpoint outcome event | Message includes reason/task ID | Existing consumers updated |
| Console output | `ok/failed` run summary | Show created/blocked checkpoint | `ok=false` for blocked delivery | No-commit output unchanged |
| Cockpit UI | Completed/failed/blocked states | Separate delivery label/reason | Plain text reason, no color-only meaning | Existing status rendering preserved |
| Manual skill | Invocation auto-commit token | Two-phase CLI calls; reject legacy token | Stop on CLI refusal | Documentation migration required |
| Archive classifier | All statuses completed → DONE | Blocked delivery remains REMAINING | No packet move | Existing packets unaffected |
| Setup/README | Default config/docs | Include field and explanation | No interactive opt-in | Existing setup choices unchanged |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| `auto_commit` false/omitted | Config parse | No Git mutation; current flow | None required | F-01, US-06 |
| Pre-memory dirty state | Porcelain output non-empty | Checkpoint mode refuses before tasks | Operator cleans/resolves state, reruns | F-04 |
| Unexpected post-memory changes | Baseline delta includes non-memory paths | Checkpoint mode blocks | Resolve and rerun | C-04 |
| Missing task/report completion | Status/report assertion | No commit; normal task failure path | Fix task/report and rerun | F-02 |
| Staged/untracked/index drift | Baseline revalidation | Checkpoint-blocked; no downstream task | Restore Git state and rerun | F-04 |
| Candidate path mismatch | Cached diff differs from candidate set | Unstage candidates; checkpoint-blocked | Resolve manually; rerun | F-03/F-04 |
| Hook/signing/commit failure | Git exit code | Preserve error, unstage candidates, checkpoint-blocked | Fix hook/signing/repo and rerun; never bypass | F-07 |
| Process cancellation | Abort signal | No commit claim; preserve normal cancellation semantics | Rerun task under existing lifecycle rules | F-02 |
| Retry base HEAD drift | Stored OID differs | Refuse retry; no staging | Operator reconciles manually | F-05 |
| Retry with `auto_commit` false | Config check | Stop with explicit enablement requirement | Enable config and rerun | F-01/F-05 |
| Legacy CLI auto-commit token | Argument parser | Reject with config-only guidance | Remove token and configure JSON | F-01/F-06 |
| Git executable unavailable | Spawn error | Checkpoint-blocked with actionable message | Install/repair Git and rerun | F-04/F-07 |
| Archive with blocked metadata | Classifier | Keep packet in remaining set | Resolve checkpoint first | F-05 |

## Security and Privacy

- Trust boundary is the local workspace and its Git metadata; no remote credentials or network operations are used.
- Git identity, hooks, signing, and branch protections remain operator-controlled.
- Git arguments are passed without shell interpolation; slugs, task IDs, and paths are validated against the workspace.
- No `--no-verify`, `--author`, push, stash, reset, clean, or credential access.
- Candidate paths are derived from a clean temporal baseline and revalidated before staging.
- Hook/commit output is surfaced as bounded diagnostic text; do not include secrets or full diffs in events.
- The task report and memory may contain sensitive project content; checkpointing preserves existing repository content but adds no new telemetry or export.
- Concurrent/racing changes fail closed rather than being merged into the candidate set.
- Symlink/path traversal behavior follows existing workspace safety rules; pathspecs resolve relative to the repository root.

## Compatibility, Migration, and Rollback

- Configuration version remains `2`; missing `auto_commit` parses as `false`.
- `DEFAULT_CONFIG`, setup-created config, README examples, and config tests include the field.
- Existing task files without checkpoint metadata remain valid.
- Existing task statuses remain valid; delivery metadata is optional.
- Existing packets with no checkpoint metadata archive exactly as before.
- Legacy manual auto-commit arguments are rejected by the updated skill/command contract.
- Rollback is setting `auto_commit` false and removing new checkpoint calls; no Git history rewrite is performed.
- If blocked metadata must be removed manually, only the task frontmatter field is edited; implementation/report changes remain untouched.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/config.ts` | Schema/default/migration | Medium | Add boolean and tests |
| `src/checkpoints.ts` | New Git/lifecycle module | High | Implement with typed outcomes and safe process boundary |
| `src/tasks.ts` | Metadata schema/order | High | Parse delivery field; include blocked retries |
| `src/engine.ts` | Begin/complete/retry integration | High | Preserve lifecycle ownership and stop semantics |
| `src/commands.ts` | New checkpoint command | Medium | Route CLI phases and errors |
| `src/cli.tsx` | Help/dispatch | Low | Register command and reject legacy flags |
| `src/events.ts` | New checkpoint event | Medium | Define created/blocked payload |
| `src/ui/store.ts` | Delivery state/reason | Medium | Track independent checkpoint state |
| `src/ui/App.tsx` | Labels/summary | Medium | Render checkpoint outcomes without color-only meaning |
| `src/memory.ts` | Baseline sequencing contract | Medium | Expose initialization boundary to engine/helper |
| `skills/sf-batch-tasks/SKILL.md` | Workflow contract | High | Replace invocation flag with begin/complete calls |
| `skills/sf-archive-tasks/scripts/scan-tasks.sh` | Metadata inspection | Medium | Parse optional checkpoint state |
| `README.md` | User documentation | Low | Document opt-in/local-only/recovery |
| `tests/config.test.ts` | Config coverage | Low | Add default/parse/migration cases |
| `tests/tasks.test.ts` | Metadata/order coverage | Medium | Add blocked retry ordering |
| `tests/engine.test.ts` | Lifecycle/Git integration | High | Add temp-repo checkpoint scenarios |
| `tests/commands.test.ts` | CLI coverage | Medium | Add begin/complete/rejection cases |
| `tests/store.test.ts`/`tests/cockpit.test.tsx` | UI delivery outcomes | Medium | Add created/blocked rendering |
| `tests/archive-skill.test.ts` | Archive compatibility | Medium | Add blocked-delivery remaining case |

## Testing and Evidence

### Unit Tests

- Config accepts `auto_commit: false|true`, defaults omitted values to false, rejects non-boolean values, and migrates v1.
- Checkpoint metadata validates state, OID/digest format, paths, and required blocked error.
- Porcelain parser handles staged, unstaged, untracked, rename, unusual path, and NUL-delimited entries.
- Candidate set comparison rejects paths outside the baseline delta.
- Commit-message formatting is deterministic.
- Task ordering includes checkpoint-blocked completed tasks and skips created/absent completed tasks.
- Event/store selectors distinguish completion from checkpoint delivery.

### Integration Tests

Use temporary repositories initialized with a known commit and a fake ACP provider.

- Default/false config produces no commit.
- Clean enabled task creates exactly one commit.
- Commit contains task implementation, report, task memory, and completed status evidence.
- Pre-existing modified, staged, and untracked paths refuse checkpointing.
- Known packet-memory bootstrap is included in the baseline contract.
- Cached-diff mismatch refuses and restores staging.
- Hook failure produces blocked metadata and stops downstream tasks.
- Removing the hook and rerunning retries delivery without another implementation prompt.
- Base-HEAD drift refuses retry.
- Two-task packet does not start task two after task-one checkpoint failure.
- Runtime and `checkpoint begin|complete` CLI paths produce equivalent outcomes.
- Legacy `auto-commit=true|false` input is rejected.
- No Git remote/push/identity/bypass operation is invoked.
- Archive classifier keeps checkpoint-blocked packets in remaining state.
- Existing packets with absent metadata retain current behavior.

### End-to-End or Platform Evidence

- Run the Git integration suite on supported development platforms with `git --version` captured.
- Verify macOS and Linux behavior in CI or local evidence; add Windows-native Git evidence if the release matrix includes Windows.
- Verify hooks/signing failure behavior with native Git configuration, not mocked exit codes alone.
- Manually inspect one successful commit and one blocked-recovery rerun for plain-text clarity.
- No remote repository, credential, or PR evidence is required because remote operations are out of scope.

### Verification Gates

Focused:

```bash
bun test tests/config.test.ts tests/tasks.test.ts tests/engine.test.ts tests/commands.test.ts tests/store.test.ts tests/cockpit.test.tsx tests/archive-skill.test.ts
```

Repository gate:

```bash
bun run verify
```

All long-running commands must reach terminal exit before results are reported.

## Observability

- Emit `checkpoint` events with task ID, `created|blocked` state, commit OID when created, and a bounded reason when blocked.
- Include checkpoint outcome in console run summaries and `RunResult`; checkpoint-blocked makes the run non-successful.
- Cockpit shows delivery state/reason separately from lifecycle status.
- Do not emit full diffs, credentials, hook environments, or sensitive report contents.
- No telemetry, remote metrics, alerts, or durable analytics are introduced.
- Controlled recovery review uses reports and operator evidence for M-01; it is not an always-on analytics system.

## Development Sequencing

1. Extend config schema/default/migration and README examples — no implementation dependency.
2. Add checkpoint metadata validation and task ordering rules — depends on step 1 for config terminology.
3. Implement Git baseline/parser/staging/commit module and unit tests — depends on step 2.
4. Integrate runtime begin/complete/retry and run-result/event outcomes — depends on step 3.
5. Add CLI `checkpoint begin|complete` and legacy-token rejection — depends on step 3.
6. Update manual batch skill to invoke the CLI phases — depends on step 5.
7. Update UI store/cockpit delivery labels and archive classifier — depends on step 4.
8. Add cross-path, hook-failure, retry, and archive integration tests — depends on steps 4–7.
9. Run focused tests, platform evidence, and `bun run verify` — depends on all prior steps.

Steps 4, 5, and 7 can proceed in parallel after step 3 if their interfaces are stabilized.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Git rename/submodule/path quoting | Git porcelain has special NUL/path rules | Candidate-path comparison may misattribute changes | Add bounded parser spike and fixtures before implementation sign-off |
| Metadata removal before commit | Commit OID cannot be written into the same committed tree without circularity | Successful state must be represented by commit/event, while blocked state persists | Confirm no metadata on success and event/report provide commit identity |
| Staged restoration after commit failure | Hooks can fail after staging | Retry could be blocked by leftover index state | Prove `git restore --staged -- <candidate paths>` restores clean index in fixtures |
| Manual CLI phase interruption | Skill can stop between begin and complete | `active` metadata may remain | Normal rerun treats active as stale and safely reinitializes only after baseline validation |
| Legacy token migration | Existing skill documents invocation-level control | Users may receive a breaking error | Update skill/docs and include explicit error/help text |
| Recovery after user commits unrelated changes | Stored base OID no longer matches | Safe retry refuses instead of merging histories | Document that task changes must remain while unrelated state is resolved |
| Current dirty workspace | Existing unrelated changes are present | Local implementation verification cannot use root Git state as a clean fixture | Use temporary repositories; preserve root changes |

## Architecture Decision Records

- [ADR-001: Config-Driven Per-Task Git Checkpoints](adrs/adr-001-config-driven-task-checkpoints.md) — configuration and safety contract.
- [ADR-002: Automatic Local Recovery Checkpoints as the MVP Product Approach](adrs/adr-002-automatic-local-recovery-checkpoints.md) — product scope and recovery boundary.
- [ADR-003: Shared Checkpoint Module and Task Delivery State](adrs/adr-003-shared-checkpoint-module-and-task-delivery-state.md) — selected technical architecture and persistence model.
