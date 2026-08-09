# Guarded One-Turn ACP Exec Technical Specification

## Executive Summary

Implement `spec-finder exec "<prompt>"` through a new packet-free orchestrator backed by a shared, task-neutral ACP v1 turn core. The existing packet workflow retains a compatibility adapter; `exec` receives its own configuration resolver, safe terminal renderer, canonical host filesystem capability, permission broker, and cross-platform process supervisor.

The primary trade-off is a security-sensitive refactor of the existing ACP lifecycle in exchange for one authoritative implementation of protocol negotiation, cancellation, permissions, and cleanup. Existing `run` behavior must be frozen with regression tests before extraction.

Writes may ship after the approved containment gates pass. Symlinks are rejected and write parents are revalidated immediately before use; hostile concurrent same-user filesystem mutation is explicitly outside the V1 threat model. No release may occur until descendant cleanup passes on macOS, Linux, and Windows.

## Technical Evidence

| Kind | Finding or constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | Packet execution creates memory, changes task state, and runs implementation and report turns. | `src/engine.ts` | 2026-08-08 | `exec` cannot call the packet engine. |
| Repository | The existing ACP client already initializes, authenticates, creates a fresh session, configures it, and sends one prompt. | `src/acp-client.ts` | 2026-08-08 | Extract a shared turn core instead of duplicating the protocol. |
| Repository | Existing ACP events are task-shaped; the cockpit renderer exposes thoughts and raw tool payloads. | `src/events.ts`, `src/ui/transcript.ts` | 2026-08-08 | Neutral core events and a deny-by-default exec renderer are required. |
| Repository | Config loading currently reads one workspace config and couples config source with workspace selection. | `src/config.ts`, `src/paths.ts` | 2026-08-08 | Resolve workspace, runtime profile, and permission authority separately. |
| Repository | Host path checks are lexical and allow symlink escapes. | `src/paths.ts` | 2026-08-08 | Add an asynchronous canonical workspace capability. |
| Repository | Cancellation immediately signals only the direct child and does not await bounded cleanup. | `src/acp-client.ts` | 2026-08-08 | Add semantic cancellation and platform tree supervision. |
| Official docs | ACP v1 requires negotiated initialization, fresh sessions, streamed updates, semantic cancellation, and fixed stop reasons. | https://agentclientprotocol.com/protocol/v1/initialization, https://agentclientprotocol.com/protocol/v1/prompt-turn | ACP v1, 2026-08-08 | Remain on stable v1 and normalize its terminal states. |
| Official docs | Pending permission requests must be settled as cancelled when a turn is cancelled. | https://agentclientprotocol.com/protocol/v1/tool-calls | ACP v1, 2026-08-08 | Maintain an exactly-once pending-permission registry. |
| Official docs | ACP filesystem paths are absolute and methods may only be called when corresponding capabilities were advertised. | https://agentclientprotocol.com/protocol/v1/file-system | ACP v1, 2026-08-08 | Reject relative requests and advertise writes only when enabled. |
| Official docs | Session close is optional and capability-gated. | https://agentclientprotocol.com/protocol/v1/session-setup | ACP v1, 2026-08-08 | Close only when advertised; unsupported close cannot fail the turn. |
| Official docs | Bun/Node direct-child termination does not establish descendant cleanup. | https://nodejs.org/api/child_process.html, https://bun.sh/docs/runtime/child-process | 2026-08-08 | Implement and certify platform-specific tree supervisors. |
| Official docs | Windows `taskkill /T` terminates a PID and child processes started by it; Job Objects manage processes as a unit. | https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill, https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects | 2026-08-08 | Validate `taskkill /T /F`; escalate to a Job Object helper if it cannot satisfy fixtures. |
| Dependency | `package.json` permits SDK upgrades through `^1.2.1`, while the lockfile resolves 1.2.1. | `package.json`, `bun.lock` | SDK 1.2.1 | Pin 1.2.1 for the validated implementation. |

## Requirement Traceability

High-level constraints are assigned `HC-01` through `HC-16` in their PRD presentation order.

| PRD IDs | Technical obligation | Component or interface | Verification | Status |
|---|---|---|---|---|
| G-01; US-01; F-01; HC-01 | Accept exactly one prompt and execute exactly one fresh turn outside packet lifecycle. | CLI parser, `exec.ts`, neutral ACP core | Invocation and one-prompt fixture tests; filesystem snapshot | Covered |
| G-02; US-02; F-02, F-03; HC-02, HC-03, HC-04, HC-05 | Resolve flags, complete runtime profile, workspace, and user permission independently. | `exec-config.ts`, workspace discovery | Table-driven precedence and malformed-config tests | Covered |
| G-03; US-03, US-04; F-04; HC-11, HC-15, HC-16 | Provide immediate sanitized stderr progress and success-only stdout. | `exec-output.ts` | Byte-for-byte stdout/stderr fixtures and manual timing | Covered |
| G-04; US-05; F-05, F-06; HC-06, HC-07, HC-08 | Fail closed on unsafe host access and provide bounded semantic cancellation. | `workspace-access.ts`, permission broker, process supervisor | Adversarial paths and real descendant cleanup matrix | Covered with release gates |
| G-05; US-07; F-01, F-07; HC-09, HC-12 | Create no Spec Finder state and preserve all existing commands. | Packet-free dependency boundary and packet adapter | Import-boundary, filesystem-diff, and regression tests | Covered |
| G-06; US-06; F-06, F-07; HC-10, HC-13, HC-14 | Normalize existing providers without adding provider-specific options or false persistence claims. | Provider launch context and certification registry | Claude/Codex/Cursor live matrix | Covered with provider gates |
| M-01 | Measure at least ten genuine executions. | No product component | Manual log outside Spec Finder | Deliberately external |
| M-02 | Measure at least 80% completion without fallback. | No product component | Manual completion/fallback log | Deliberately external |
| M-03 | Achieve complete precedence correctness. | Config acceptance matrix | Focused config tests | Covered |
| M-04 | Median first visible progress ≤10 seconds. | Synchronous preflight reporter | Ordering assertion plus manual genuine-run timing | Covered |
| M-05 | Zero successful host callback escapes. | Canonical workspace capability | Traversal, alias, symlink, and missing-parent tests | Covered within approved threat model |
| M-06 | Settle cancellation within five seconds. | Cancel coordinator and process supervisors | Mock and live platform/provider matrix | Release blocker |
| M-07 | No existing-command regression. | Packet compatibility adapter | Existing suite plus frozen `run` baseline | Release blocker |
| HC-16 | Do not promise provider-independent performance. | Documentation and preflight | Documentation review | Covered |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs and outputs | Dependencies |
|---|---|---|---|---|
| `src/cli.tsx` | Existing | Add help and `exec` dispatch. | argv → process result | `commands.ts` |
| `src/commands.ts` | Existing | Strict exec parsing, injected terminal streams, SIGINT binding, exit code. | argv/stdin/stdout/stderr → numeric result | `exec.ts` |
| `src/exec.ts` | New | Packet-free preflight and one-turn orchestration. | prompt and overrides → `ExecOutcome` | Config, reporter, ACP turn |
| `src/exec-config.ts` | New | Workspace, runtime profile, overrides, user permission, provider certification. | cwd, flags, config files → resolved context | Existing schemas/providers |
| `src/acp-turn.ts` | New | Task-neutral ACP v1 lifecycle and typed events. | launch, prompt, host access, signal → turn result | SDK and supervisor |
| `src/acp-client.ts` | Existing | Preserve packet-facing `runAcpTurn` contract through an adapter. | Existing packet inputs/events | Neutral core |
| `src/exec-output.ts` | New | Sanitize progress, buffer agent text, publish terminal status. | Neutral updates → stderr/stdout | None beyond stream types |
| `src/workspace-access.ts` | New | Canonical host read/write capability and authorization. | Absolute ACP paths → content/write result | Filesystem, permission broker |
| `src/process-supervisor.ts` | New | Spawn, stream, semantic-grace timing, tree termination, confirmed closure. | Provider launch → supervised process | `node:child_process`, OS facilities |
| `src/providers.ts` | Existing | Provide packet- or exec-specific launch context and certification. | Provider/config/mode → launch spec | Existing adapters |
| Mock agent and tests | Existing/expanded | Model cancellation, permissions, hostile updates, direct filesystem calls, failures, descendants. | Fixture modes → deterministic ACP behavior | Neutral core |
| README/help | Existing | Document usage, authority, output, persistence, limits, and recovery. | User-facing documentation | Approved contracts |

### Data and Control Flow

Normal flow:

1. CLI parsing rejects missing prompts, extra positional arguments, unknown flags, or missing flag values before provider startup.
2. Workspace discovery finds the nearest non-symlink `.spec-finder` ancestor; absent one, it uses the canonical exact cwd.
3. Runtime selection chooses the complete repository runtime profile or complete user runtime profile, then applies explicit overrides.
4. User permission is parsed independently. Missing or invalid permission becomes `prompt`.
5. Preflight writes workspace, runtime source, overrides, permission source, and host access mode to stderr.
6. The process supervisor launches the selected certified ACP provider with the canonical workspace as cwd.
7. The neutral core negotiates ACP v1, authenticates only when advertised, creates one session, and applies advertised configuration options.
8. It sends exactly one prompt and consumes session updates. Safe tool state goes to stderr; agent text remains buffered.
9. After the terminal prompt response, the core performs optional session close and bounded process cleanup.
10. Only a clean `end_turn` plus confirmed cleanup publishes buffered text to stdout and returns `0`.

Cancellation flow:

1. First Ctrl+C atomically changes the turn to `cancelling`.
2. All pending permission prompts become cancelled exactly once.
3. If a session exists, the core sends `session/cancel`; generic JSON-RPC request cancellation may also be used.
4. Updates remain accepted for a two-second semantic grace period.
5. POSIX then signals the isolated group with `SIGTERM`, waits 1.5 seconds, sends `SIGKILL`, and uses the remaining 1.5 seconds to confirm closure.
6. Windows uses `taskkill /PID <pid> /T /F` after the semantic grace and confirms both supervisor and recorded descendants are gone. If this cannot pass reliably, a Job Object helper is required.
7. A second Ctrl+C skips the remaining semantic grace and starts forced cleanup.
8. Cancellation returns `130`; inability to confirm cleanup returns `1` with `cleanup-error`.

Recovery flow:

- No automatic retries occur.
- Configuration errors identify the invalid source.
- Authentication/provider errors give a normalized provider-specific recovery action without dumping raw stderr.
- Unsafe paths and denied permissions fail closed.
- A provider or platform missing certification is rejected before spawn.

## Implementation Design

### Core Interfaces

```ts
export interface ResolvedExecContext {
  workspace: string
  runtime: ExecRuntimeProfile
  runtimeSource: "repository" | "user"
  permission: PermissionPolicy
  permissionSource: "user" | "default"
  hostAccess: "read-only" | "write-capable"
}
```

```ts
export interface AcpTurnResult {
  stopReason?: AcpStopReason
  finalText: string
  permissionDenied: boolean
  cleanup: "confirmed" | "failed"
  failure?: "protocol" | "provider" | "transport"
}
```

```ts
export interface WorkspaceAccess {
  readTextFile(absolutePath: string): Promise<string>
  writeTextFile(
    absolutePath: string,
    content: string,
    authorize: WriteAuthorizer,
  ): Promise<void>
}
```

```ts
export interface ProcessSupervisor {
  spawn(spec: ProviderLaunch): Promise<SupervisedProcess>
}

export interface SupervisedProcess {
  pid: number
  closed: Promise<ProcessExit>
  cancelTree(deadlineMs: number): Promise<CleanupResult>
}
```

```ts
export type ExecOutcome =
  | "completed"
  | "cancelled"
  | "permission-denied"
  | "refused"
  | "limited"
  | "invalid-invocation"
  | "config-error"
  | "provider-error"
  | "cleanup-error"
```

### CLI Parsing

Supported grammar:

```text
spec-finder exec "<prompt>" \
  [--provider <provider>] \
  [--model <model>] \
  [--reasoning <reasoning>] \
  [--speed <speed>]
```

Rules:

- Exactly one non-empty positional prompt is required.
- Stdin is ignored as prompt input in V1.
- Unknown flags, additional positionals, and missing values fail with exit `2`.
- Repeated recognized overrides use the last value, matching the existing `run` override convention.
- Provider, reasoning, and speed use existing schema validation; model must be non-empty.
- Provider startup cannot happen until parsing and configuration succeed.

### Runtime and Permission Resolution

Runtime profile selection:

1. Determine the execution workspace independently.
2. Read `<workspace>/.spec-finder/config.json` when present.
3. If present, validate `version`, `provider`, `model`, `reasoning`, and `speed` as one runtime profile. Repository `permissions` is ignored and does not participate in exec runtime validation.
4. If no repository profile exists, require a valid user runtime profile from `~/.spec-finder/config.json`.
5. Never fall through an existing invalid repository runtime profile.
6. Apply explicit overrides and revalidate the effective runtime.

Permission selection:

1. Parse the user file as JSON independently from runtime-profile validity.
2. If `permissions` is valid, use it even when unrelated user runtime fields are invalid and repository runtime is selected.
3. Missing file, malformed JSON, or missing/invalid permission produces `prompt`.
4. Repository permission data is never consulted.

The existing `loadConfig()` and `run` behavior remain unchanged.

### ACP Lifecycle

The neutral core must:

- Use the SDK's modern `client(...).connectWith(...)` API.
- Negotiate protocol version `1` and reject mismatch before session creation.
- Authenticate only through an advertised authentication method.
- Use the canonical absolute workspace for `session/new`.
- Preserve the complete current configuration-option state returned by each response/update.
- Send exactly one `session/prompt`.
- Consume all updates until the terminal prompt response.
- Call `session/close` only if advertised, with a short bounded timeout.
- Never treat local update-handler disposal as remote session closure.
- Keep raw ACP stop reason internally while exposing normalized outcomes.

The SDK dependency changes from `^1.2.1` to exact `1.2.1`.

### Permission Lifecycle

A per-turn registry owns every pending permission request.

- `approve-all` prefers an offered `allow_once`, then another offered allow option.
- `deny` prefers an offered `reject_once`, then another offered reject option.
- `prompt` writes sanitized options to stderr only when stdin and stderr are both TTYs.
- Noninteractive `prompt` selects an offered rejection or cancelled result and never waits.
- No "always" selection is persisted by Spec Finder.
- Abort closes interactive input and settles every unresolved request as cancelled once.
- Any denied request marks the overall turn `permission-denied`, even if the provider later returns `end_turn`.
- Direct `fs/write_text_file` requests pass through the same effective policy independently from agent permission requests.

### Host Filesystem Capability

The workspace capability owns operations rather than returning unchecked paths.

For reads:

1. Require an absolute ACP path.
2. Lexically verify it is within the workspace.
3. Walk existing components with `lstat`; reject every symlink.
4. Resolve the real target and verify canonical containment.
5. Read only after all checks pass.

For writes:

1. Perform the same lexical and component checks.
2. Validate the deepest existing parent.
3. Ask for permission only after the target has a safe normalized workspace-relative identity.
4. Immediately before mutation, repeat ancestor checks.
5. Create missing directories one at a time, validating each created component.
6. Write and report a normalized result.

The guarantee covers Spec Finder's ACP host callbacks. It does not claim to sandbox provider-owned tools or direct provider filesystem access. Concurrent hostile same-user path replacement remains a documented residual risk.

### Output Contract

Stable stderr vocabulary:

```text
[exec] workspace: <absolute path>
[exec] runtime: <provider> <model> <reasoning> <speed> (<source>)
[exec] permissions: <policy> (<source>)
[exec] host-access: read-only|write-capable
[exec] tool: <normalized kind> <status>
[exec] permission: requested|allowed|denied|cancelled
[exec] warning: <fixed safe message>
[exec] result: <normalized outcome>
```

Rules:

- Tool kinds and states come from a fixed whitelist; unknown values become `other`.
- Internal thoughts, plans, raw arguments, raw results, provider stderr, and unknown payloads are never rendered.
- Agent text chunks are appended in protocol order.
- Buffered text is emitted only after `end_turn` and confirmed cleanup.
- If non-empty text lacks a final newline, stdout adds one.
- Every non-success result leaves stdout empty.
- Provider stderr may influence a normalized failure category but is never copied verbatim.

### Exit Mapping

| Condition | Stderr result | Exit |
|---|---|---:|
| Clean `end_turn` and confirmed cleanup | `completed` | 0 |
| Invocation error | `invalid-invocation` | 2 |
| Runtime/profile error | `config-error` | 2 |
| User or ACP cancellation | `cancelled` | 130 |
| Permission rejected | `permission-denied` | 1 |
| ACP refusal | `refused` | 1 |
| Token or turn limit | `limited:max-tokens` or `limited:max-turn-requests` | 1 |
| Provider, authentication, protocol, or transport failure | `provider-error` | 1 |
| Cleanup cannot be confirmed | `cleanup-error` | 1 |

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility |
|---|---|---|---|---|
| CLI dispatch | setup/run/config/version/upgrade | Add strict `exec` route | Exit 2 before spawn | Additive |
| Packet ACP caller | Task-shaped events | Adapter translates neutral events | Existing result semantics retained | Frozen by regression tests |
| Provider launch | Packet-oriented launch context | Add `mode: "packet" \| "exec"` | Uncertified provider rejected | Existing packet launch unchanged |
| Config | One strict workspace file | Separate exec runtime and user-permission projections | Named config error | No schema migration |
| ACP protocol | Stable v1 via SDK | Add version validation, semantic cancel, optional close | Provider error and cleanup | Stable v1 only |
| Host filesystem | Lexical read/write path | Canonical capability and write gating | Fail closed | Packet behavior changes only if deliberately migrated later |
| Terminal | Packet/cockpit output | Dedicated stderr/stdout contract | Stable terminal outcome | No cockpit reuse |
| Process lifecycle | Direct-child SIGTERM | Platform tree supervisor | Cleanup failure blocks success | Existing `run` adapter preserved initially |

## Failure and Recovery Behavior

| Failure mode | Detection | Behavior | Recovery | Evidence |
|---|---|---|---|---|
| Missing/blank prompt | Parser | No spawn; exit 2 | Correct invocation | CLI test |
| Unknown/malformed flag | Parser/schema | No spawn; exit 2 | Correct option | CLI matrix |
| Invalid repository runtime | Runtime schema | No user fallback; exit 2 | Fix repository config | Config matrix |
| Missing/invalid required user runtime | Runtime schema | Exit 2 | Fix user config | Config matrix |
| Invalid user permission only | Permission projection | Default to `prompt`; warning | Fix user permission | Config matrix |
| Provider not certified | Certification registry | No spawn; exit 1 | Use certified provider or await support | Provider matrix |
| ACP version mismatch | Initialize response | Stop before session creation | Upgrade compatible adapter | Protocol fixture |
| Authentication failure | ACP/provider failure | Sanitized provider error | Authenticate using provider CLI | Mock/live matrix |
| Permission denied | Permission registry | Mark non-success; stdout empty | Change user policy or retry | Permission fixture |
| Unsafe host path | Workspace capability | Reject request; warning | Use an in-workspace non-symlink path | Adversarial paths |
| Refusal or limit | Prompt stop reason | Exit 1; discard partial text | Revise prompt/model and retry | Stop-reason fixture |
| First Ctrl+C | Signal coordinator | Semantic cancel then bounded cleanup | Retry later | Cancellation fixture |
| Second Ctrl+C | Signal coordinator | Immediate forced tree cleanup | Retry later | Signal fixture |
| Provider ignores cancellation | Deadline expiry | Platform termination escalation | Withhold provider if live gate fails | Live matrix |
| Child exits but pipes remain | Supervisor close tracking | Wait for close until deadline | Force cleanup or fail | Process fixture |
| Descendant survives | Recorded descendant probe | Cleanup error; release blocked | Replace supervisor implementation | Platform fixture |
| Output contains hostile update | Renderer whitelist | Omit payload; safe warning once | Provider remains usable if no leak | Output fixture |
| Cleanup fails after `end_turn` | Supervisor | Discard text; exit 1 | Fix supervisor/provider | Cleanup fixture |

## Security and Privacy

- Repository config may choose runtime behavior but cannot grant permission authority.
- User config is the only persistent permission authority; missing or invalid data fails to `prompt`.
- Permission approval and canonical containment are independent checks.
- Host write capability is absent until all release gates pass.
- ACP filesystem paths must be absolute and canonically contained.
- Every symlinked target component is rejected.
- The residual concurrent same-user path-swap risk is documented.
- Provider processes retain their existing environment for authentication compatibility; values are never logged.
- Host capability containment does not claim to sandbox provider-native tools.
- Prompt, response, transcript, session IDs, tool payloads, raw errors, and paths beyond required preflight/normalized relative permission targets are not persisted.
- Spec Finder creates no task, memory, report, checkpoint, trust, telemetry, or validation-counter state.
- Provider-side persistence is documented per provider after live verification.
- Unknown protocol data is omitted rather than serialized.
- Permission and cancellation registries are in-memory and destroyed after process closure.

## Compatibility, Migration, and Rollback

- No task, report, memory, or config-format migration is required.
- Existing config version remains unchanged.
- Existing `loadConfig`, `runCommand`, cockpit, and packet event contracts remain available.
- The packet adapter initially preserves current permission and event behavior while sharing the neutral protocol core.
- SDK 1.2.1 becomes exact; upgrades require explicit ACP fixture and provider verification.
- `exec` is not released until all three platform supervisors pass.
- Individual providers remain absent from the exec certification registry until their live matrix passes.
- If the shared-core extraction regresses packet execution, restore the prior packet adapter implementation while retaining the isolated exec modules.
- If a write-safety gate fails, release remains read-only.
- If cleanup cannot be certified on any platform, do not release `exec`.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/cli.tsx` | New route/help | Low | Add dispatch and usage |
| `src/commands.ts` | Parser, signal and stream wiring | Medium | Dependency-inject terminal/process interfaces |
| `src/exec.ts` | New orchestration | Medium | Keep packet imports prohibited |
| `src/exec-config.ts` | New resolution rules | Medium | Complete matrix tests |
| `src/acp-turn.ts` | Shared lifecycle | High | Freeze baseline first |
| `src/acp-client.ts` | Packet adapter | High | Preserve current public behavior |
| `src/exec-output.ts` | New confidentiality boundary | High | Byte-exact hostile-output tests |
| `src/workspace-access.ts` | New filesystem security boundary | High | Adversarial path suite |
| `src/process-supervisor.ts` | Cross-platform cleanup | High | Real descendant fixtures on each OS |
| `src/providers.ts` | Launch mode/certification | Medium | Exec-specific Codex instruction; unchanged packet mode |
| `tests/fixtures/mock-agent.ts` | Expanded protocol modes | Medium | Cancellation, permissions, failures, descendants |
| `tests/acp-client.test.ts` | Compatibility coverage | Medium | Freeze packet behavior |
| New exec tests | New contracts | Medium | Focused and integration suites |
| `package.json`, `bun.lock` | Exact SDK pin | Low | Pin 1.2.1 and reinstall deterministically |
| `README.md` | New command contract | Low | Document scope and caveats |

## Testing and Evidence

### Unit Tests

- Exec parser: missing prompt, blank prompt, extra positional, unknown flag, missing value, repeated overrides.
- Runtime resolution: repository, user fallback, override matrix, invalid repository, invalid required user profile.
- Permission projection: valid permission with invalid unrelated runtime, missing permission, malformed user JSON.
- Output: every ACP update type, hostile strings, unknown updates, partial responses, exact stdout/stderr.
- Outcome mapping: every ACP stop reason and cleanup state.
- Workspace access: traversal, sibling prefix, absolute path, internal symlink, final symlink, alias, missing parents.
- Permission registry: concurrent requests, exactly-once settlement, abort races.
- Process state machine: normal exit, spawn error, lingering pipes, semantic timeout, forced cleanup.

### Integration Tests

- Exactly one initialize/session/new/session/prompt lifecycle.
- No packet, memory, report, task, or checkpoint calls.
- Configuration failure prevents provider spawn.
- Pending permission request plus semantic cancellation.
- Agent emits trailing update after `session/cancel`.
- Supported and unsupported `session/close`.
- Complete config-option state replacement.
- Direct host read/write calls under each permission mode.
- Descendant process survives direct-child kill but not supervisor cleanup.
- End turn followed by cleanup failure produces empty stdout and exit 1.
- Existing packet execution produces its frozen event/result baseline.

### End-to-End and Platform Evidence

Required before release:

- macOS: detached process-group TERM/KILL fixture with recorded grandchild.
- Linux: identical POSIX fixture.
- Windows: `taskkill /T /F` fixture with recorded grandchild; use a Job Object helper if it fails.
- Claude, Codex, and Cursor:
  - successful one-turn run;
  - redirected stdout;
  - interactive permission request;
  - noninteractive permission request;
  - Ctrl+C during prompt;
  - Ctrl+C during permission;
  - descendant cleanup;
  - session-close capability;
  - provider persistence documentation.
- Every platform/provider cancellation completes within five seconds.
- Manual timing verifies the first preflight line appears immediately and measures genuine-run latency.

### Verification Gates

```sh
rtk bun test tests/exec-args.test.ts tests/exec-config.test.ts
rtk bun test tests/exec-output.test.ts tests/workspace-access.test.ts
rtk bun test tests/process-supervisor.test.ts tests/acp-turn.test.ts
rtk bun test tests/acp-client.test.ts tests/exec.test.ts
rtk bun run verify
```

The same repository-wide gate and platform lifecycle fixture must finish with terminal success on macOS, Linux, and Windows. Partial test output is not evidence.

## Observability

- No persistent telemetry, metrics, transcript, trust record, or diagnostic file.
- In-memory neutral events are consumed only for current stderr rendering and final-text buffering.
- Stable terminal statuses are the sole machine-observable result beyond exit codes.
- Provider stderr is captured only long enough to classify startup failure and is never emitted raw.
- The reporter emits one conservative warning for omitted unknown update categories rather than dumping content.
- Manual M-01, M-02, and M-04 evidence remains outside Spec Finder.

## Development Sequencing

1. Freeze current packet ACP, configuration, CLI, and `run` behavior with focused regression fixtures — no dependencies.
2. Define neutral turn, outcome, reporter, permission, and supervisor interfaces — depends on step 1 so compatibility contracts are explicit.
3. Implement strict exec parsing and runtime/permission resolution — depends on step 2's result types; may proceed in parallel with steps 4 and 5.
4. Implement canonical workspace access and adversarial tests — depends on step 2's host interface.
5. Spike and implement POSIX and Windows supervisors — depends on step 2's supervisor interface.
6. Extract the neutral ACP v1 core and pin SDK 1.2.1 — depends on steps 1, 2, 4, and 5 because lifecycle ownership must be settled.
7. Rebuild the packet-facing adapter and pass frozen regressions — depends on step 6.
8. Implement safe exec output and packet-free orchestration — depends on steps 3, 4, 6, and 7.
9. Expand mock-agent and command integration coverage — depends on step 8.
10. Complete macOS/Linux/Windows and Claude/Codex/Cursor matrices — depends on step 9; any failure blocks release.
11. Enable only certified providers and write capability, update help/README, and run the full gate — depends on step 10.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Bun negative-PID signalling behavior | Bun documents detached groups but not JS group kill | POSIX supervisor may need Node compatibility or helper | Real macOS/Linux descendant spike; runtime owner |
| Windows `taskkill` reliability | Microsoft documents child-tree termination, but adapter behavior is untested | Job Object helper may be required | Real Windows grandchild fixture; runtime owner |
| Provider descendants can leave a process group | POSIX groups are not immutable trees | Cleanup guarantee may fail for a provider | Live provider matrix; withhold failing provider |
| Provider-owned tools bypass ACP host callbacks | ACP capabilities govern protocol callbacks only | Host containment is not an OS sandbox | Explicit documentation and provider validation |
| Same-user concurrent path replacement | Pathname checks retain TOCTOU exposure | Residual write risk | Accepted V1 threat model; revisit after any incident |
| Shared-core packet regression | Existing packet code changes owner | `run` may regress | Frozen packet suite must pass before and after extraction |
| SDK/API drift | Caret range permits later versions | Unreviewed protocol behavior | Exact 1.2.1 pin; explicit upgrade task |
| Provider persistence differs | Direct CLI behavior does not prove adapter behavior | Documentation could overpromise | Provider-specific live evidence before release |
| Concise output hides useful diagnostics | Raw data is intentionally excluded | Recovery may be harder | Usability matrix; add only fixed safe recovery labels |
| Cross-platform gate delays all release | Explicit user decision | Feature may remain unreleased longer | All three supervisors must pass; no platform exception |

No material product or architectural decision remains open. The listed questions are bounded implementation spikes with explicit pass/fail criteria.

## Architecture Decision Records

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — selects the guarded one-turn product direction.
- [ADR-002: User-Owned Permissions and Human Exec Contract](adrs/adr-002-user-owned-permissions-human-exec.md) — defines runtime fallback, permission ownership, workspace selection, output, and no-history policy.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — selects the shared lifecycle core and cross-platform release gate.
