# Spec Finder

Spec Finder is a skill-driven specification framework with a local ACP cockpit, heavily inspired by Compozy. It brings back the compact workflow that made pre-0.3 Compozy useful—idea → PRD → TechSpec → executable tasks—without adding a daemon or a second source of truth.

Specifications stay in the repository. Skills are portable Agent Skills. Claude, Codex, and Cursor run through their own ACP harnesses while Spec Finder owns task ordering, lifecycle state, permissions, and evidence reports.

## Requirements

- Bun 1.3 or newer
- One supported ACP provider:
  - Claude: `@agentclientprotocol/claude-agent-acp`
  - Codex: `@agentclientprotocol/codex-acp`
  - Cursor: `cursor-agent acp`

The default Claude and Codex profiles use `npx --yes`, so their adapters can be resolved on demand. Cursor requires the Cursor CLI on `PATH`.

## Install

```bash
npm install --global spec-finder
cd /path/to/project
spec-finder setup
```

`setup` creates:

```text
.spec-finder/
├── config.json
└── tasks/
```

In an interactive terminal, `setup` opens keyboard pickers for providers, installation scope, and copy or symlink mode. Use `↑`/`↓` to move, `Space` to toggle providers, `Enter` to confirm, and `Esc` to cancel. All providers start selected; local scope and copied skills are the defaults. Supply any choice as a flag to skip only its corresponding picker. Non-interactive setup defaults to all providers, local scope, and copied skills.

Limit setup to one or more targets when needed; repeat `--agent` to select more than one:

```bash
spec-finder setup --agent codex --agent cursor --global --symlink
```

The `.spec-finder/config.json` and `.spec-finder/tasks/` scaffolding always remain in the current project. Skill destinations depend on scope:

| Provider | Local | Global |
|---|---|---|
| Claude | `.claude/skills` | `~/.claude/skills` |
| Codex | `.agents/skills` | `~/.agents/skills` |
| Cursor | `.cursor/skills` | `~/.cursor/skills` |

`--copy` copies the seven bundled `sf-*` skills into every selected provider. `--symlink` copies them once to a canonical provider—Codex when selected, otherwise the first selected provider—and creates a per-skill symlink for every other selected provider. Rerunning setup replaces only those seven `sf-*` entries; unrelated skills in the target directories are preserved.

## Stable npm releases (maintainers)

The stable release workflow is a deliberate, stable-only dispatch from `main`. It reads the version from the reviewed `package.json`; there is no dispatch-time version override. The workflow creates the matching `v<version>` tag and GitHub Release, then runs the installed-package smoke checks.

This runbook applies the TechSpec sections **Compatibility, Migration, and Rollback**, **Failure and Recovery Behavior**, and **Observability** without replacing them with workflow implementation detail.

### Prerequisites

Before the first live release, confirm all of the following:

- You have permission to run Actions and write repository contents, and the intended version is merged on `main` as a stable SemVer.
- The repository has authority over the public `spec-finder` npm package name. A `release` run requires the exact `spec-finder@<version>` to be absent; a `reconcile` run requires that exact version to already be published.
- npm trusted publishing is registered for `MatheusBBarni/spec-finder` and the exact `.github/workflows/release.yml` filename. The package must allow the GitHub-hosted Actions workflow to publish with OIDC and provenance.
- The workflow neither requires nor reads a long-lived npm publishing token. If OIDC is unavailable, the run stops; it never falls back to `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or another token.

The workflow runs `bun run release:check`, `bun run verify`, and the packed-file allowlist checks before any release-mode publication. These local gates do not prove npm ownership, OIDC exchange, GitHub API writes, or native Windows behavior; the first live release and Windows evidence happen in GitHub Actions.

### Dispatch procedure

1. Merge the intended stable version to `main` and confirm the package, tag (`v<version>`), and public identity are not already in a mismatched state.
2. Open **Actions → Stable release → Run workflow**, select the `main` branch, and choose exactly one mode:

   | Mode | Use it when | What it may do |
   |---|---|---|
   | `release` | npm, the tag, and the GitHub Release are all absent for this version. | Publish the package through npm trusted publishing, then create or verify the exact tag and generated GitHub Release. |
   | `reconcile` | The exact npm version is already published and matching metadata or smoke evidence is incomplete. | Create or verify only missing matching metadata and rerun smoke; it never runs `npm publish`. |

3. Wait for candidate preflight and remote-state refresh. A candidate is not mutation-eligible until the local gates and the retained `release-candidate` and `release-state` handoffs pass.
4. In `release` mode, the workflow publishes through OIDC, verifies the package, creates the annotated tag before the GitHub Release, appends the fixed installer footer, and runs the Ubuntu/Windows matrix. In `reconcile` mode, it rechecks the published npm version and performs no npm publication.
5. Read the **Stable release outcome summary** in the run. Retained run artifacts include `release-candidate`, `release-state`, `published-package` (release mode), `release-metadata`, and `smoke-ubuntu`/`smoke-windows` when the matrix runs.

Each smoke runner uses an isolated temporary workspace, home/profile, npm cache and global prefix, and executable path. It installs `spec-finder@<version>` and runs the installed `spec-finder version`, `spec-finder setup`, and `spec-finder upgrade` commands. Upgrade evidence is counted only when `npm view spec-finder@latest` is the candidate version; `upgrade` is not proof for an older version after a newer stable release exists.

### Reading the outcome

The summary is plain text and includes the source ref/SHA, package URL, tag URL, GitHub Release URL, preflight state, both smoke states, and one `Next action` line.

| Result | Interpretation and next action |
|---|---|
| `complete` | The package, matching `v<version>` tag, GitHub Release, and both Ubuntu and Windows smoke artifacts passed. No recovery action is required. |
| `blocked` | Preflight or remote identity failed closed. No completed release is declared. Fix the named candidate or identity problem, then dispatch `release` from `main` when the public version is absent; a mismatch requires manual identity correction first. |
| `partial` | Preflight passed, but publication metadata, public links, or platform smoke is incomplete. Treat the listed package/tag/Release links and retained smoke artifacts as partial evidence only, then follow the single recovery action—normally `Run reconcile mode for the same main version; do not republish npm.` |

The GitHub Release body for a completed release retains generated notes and the repository-owned footer:

```text
Package: https://www.npmjs.com/package/spec-finder/v/<version>
Install: npm install --global spec-finder@<version>
Upgrade: spec-finder upgrade
```

### Recovery boundaries

- **Blocked before publication:** correct the source, version, packed contents, or public identity on `main`, then rerun the local gates and dispatch `release`. Do not treat a blocked run as a release.
- **Package published but tag, Release, or smoke incomplete:** dispatch `reconcile` for the same `main` version. Reconciliation requires the exact npm version to be published, is additive, and never republishes npm. If the tag or Release targets the wrong SHA/version, stop for manual identity correction; the workflow does not force-update tags, clobber Releases, or overwrite npm versions.
- **Trusted-publisher/OIDC failure:** fix the npm package authority or the exact repository/workflow registration and rerun the appropriate mode. There is no token fallback.
- **Defective published version:** npm versions are immutable. Deprecate only the exact bad version, bump `package.json` to a new stable version on `main`, publish that corrective version through the normal `release` path, and update the affected GitHub Release notes to explain the correction. For example:

  ```bash
  npm deprecate spec-finder@<bad-version> "Use spec-finder@<corrective-version>: <reason>"
  gh release edit v<bad-version> --notes-file corrected-release-notes.md
  ```

  Use an authenticated maintainer session for these manual operations. The workflow never unpublishes, automatically rolls back, or rewrites an immutable npm version.

For installers, the existing commands remain the compatibility contract:

```bash
npm install --global spec-finder
spec-finder upgrade
```

`spec-finder upgrade` always runs `npm install --global spec-finder@latest`; it does not select a historical version. Install a specific published version explicitly with `npm install --global spec-finder@<version>`.

## Specification pipeline

| Skill | Artifact |
|---|---|
| `sf-idea-factory` | `.spec-finder/tasks/<slug>/_idea.md` |
| `sf-create-prd` | `.spec-finder/tasks/<slug>/_prd.md` |
| `sf-create-techspec` | `.spec-finder/tasks/<slug>/_techspec.md` |
| `sf-create-tasks` | `_tasks.md` and `task_NN.md` |
| `sf-memory` | `memory/MEMORY.md` and `memory/task_NN.md` |
| `sf-execute-task` | bounded implementation and verification |
| `sf-task-report` | `reports/task_NN.md` |
| `sf-batch-tasks` | dependency-safe manual range execution |
| `sf-archive-tasks` | completed-packet archival and reports |

Every stage keeps the approval gates from the original Compozy skills. Research and interactive decisions happen before artifacts are saved. Tasks form an acyclic dependency graph and carry their own tests.

## Run tasks

```bash
spec-finder run my-feature
```

The read-only cockpit shows the effective provider configuration, task graph, ACP activity, and tool calls. It executes dependency-safe tasks sequentially. A task's implementation and final-report turns share one active ACP session so the report receives the implementation context directly. A failed phase is retried once in that session while it remains usable; if the provider process exits, the retry opens a replacement session and resumes only the affected phase. Cancellation remains terminal. If implementation exhausts its retry, the task fails. If the report handoff exhausts its retry, Spec Finder persists a blocked report-only handoff so the next run resumes the report without rerunning implementation. A task becomes `completed` only after the required report exists and contains substantive evidence.

Only one Spec Finder runner may own a workspace at a time. A concurrent single or `--multiple` invocation is refused with an error naming the active runner's PID instead of sharing task files or provider processes.

For logs without the cockpit:

```bash
spec-finder run my-feature --no-ui
```

### Ordered batch runs

Batch mode is an opt-in command for a declared sequence. Use exactly one comma-separated list with
`--multiple`; packets run serially in the order supplied and the first failure or cancellation stops the sequence:

```bash
spec-finder run --multiple first-packet,second-packet,third-packet
spec-finder run --multiple first-packet,second-packet,third-packet --no-ui \
  --provider codex --model gpt-5.6-sol --reasoning xhigh --speed fast
```

The batch branch supports the same runtime flags shown above: `--no-ui`, `--provider NAME`, `--model ID`,
`--reasoning LEVEL`, and `--speed MODE`. It rejects positional slugs, a second `--multiple`, empty or duplicate
entries, malformed or unknown packet slugs, option-like entries, unknown options, and missing flag values before
any packet starts.

Every declared packet receives one outcome:

| Outcome | Meaning and recovery |
|---|---|
| `succeeded` | The packet completed. `already complete` means no tasks remained and still counts as success. |
| `failed` | The packet stopped after an implementation retry was exhausted or a report handoff became blocked; later packets are `not_started`. Rerun to retry a blocked report handoff without repeating implementation. |
| `cancelled` | The operator or ACP cancelled the packet; later packets are `not_started`. Rerun manually when ready. |
| `not_started` | The packet was declared after the stopping packet and was never launched. |

An all-success (including already-complete) sequence exits 0. Preflight rejection, failure, and cancellation exit 1.
Batch mode is serial and fail-fast after the task-level retry is exhausted. It performs no automatic packet retry,
continue-on-error, parallel execution, or resume, and introduces no persistence or durable batch history, rollback,
or telemetry. Earlier successful packets remain completed when a later packet stops.

Runtime overrides are explicit and validated:

```bash
spec-finder run my-feature \
  --provider codex \
  --model gpt-5.6-sol \
  --reasoning xhigh \
  --speed fast
```

## Configuration

`.spec-finder/config.json` is strict: unknown keys and invalid values fail before a provider process starts.

```json
{
  "version": 2,
  "provider": "codex",
  "model": "auto",
  "reasoning": "high",
  "speed": "normal",
  "permissions": "prompt",
  "auto_commit": false
}
```

Key behavior:

- `model`: `auto` or a provider model ID. Claude uses `ANTHROPIC_MODEL`; Cursor receives `--model`; Codex uses advertised ACP session options.
- `reasoning`: `auto`, `low`, `medium`, `high`, `xhigh`, `max`, or `ultra`. It is applied only when advertised.
- `speed`: `auto`, `normal`, or `fast`. Unsupported providers continue with a truthful `unsupported` cockpit outcome.
- `permissions`: `prompt` cancels permission requests in the read-only cockpit with a visible notice; with `--no-ui`, it prompts in an interactive terminal and cancels when input is unavailable. `approve-all` automatically chooses an allow option; `deny` automatically chooses a reject option.
- `auto_commit`: `false` by default. Set it to `true` to enable one local recovery checkpoint after each task that passes implementation, verification, report, and status gates. The setting is configuration-only; invocation tokens such as `auto-commit=true|false` are rejected.

### Local checkpoint recovery

Checkpoints are local Git commits created through the shared service. They never push, open pull requests, bypass hooks or signing, or imply review, merge, or remote acceptance. With `auto_commit: true`, the manual batch skill calls these phases around each task:

```bash
spec-finder checkpoint begin <task_slug> <task_id>
spec-finder checkpoint complete <task_slug> <task_id>
```

`begin` must succeed before task execution; `complete` runs only after the report and `status: completed` gate. A blocked delivery stops downstream tasks while preserving the verified task record. Resolve the local Git condition and rerun the packet normally; the rerun retries delivery without rerunning the verified implementation. Set `auto_commit` back to `false` to keep the existing no-commit flow.

Provider process commands are built into Spec Finder for Claude, Codex, and Cursor. They are implementation details rather than user configuration. Spec Finder also follows each provider's default ACP mode: mode IDs are advertised by the agent and are not portable across providers. Final reports are always required in `reports/`, completed tasks are skipped, and the run stops after a task failure.

## One-turn `exec`

`exec` is the packet-free, human-oriented one-turn command. It performs one fresh ACP prompt in the invocation-derived workspace and then exits. It does not create a task packet or any Spec Finder run history.

### Invocation and runtime resolution

The exact grammar is:

```text
spec-finder exec "<prompt>" \
  [--provider NAME] \
  [--model ID] \
  [--reasoning LEVEL] \
  [--speed MODE]
```

Exactly one non-empty positional prompt is required. Prompt text is quoted positional input; flags may appear before or after it, and stdin is not used as prompt input. Unknown options, additional positionals, option-like or missing flag values, and blank or missing prompts fail before a provider starts with exit `2`. Repeating a recognized override uses its last value.

The four overrides are validated against the existing configuration schema:

- `--provider NAME`: `claude`, `codex`, or `cursor`.
- `--model ID`: any non-empty model ID; `auto` is the default profile value.
- `--reasoning LEVEL`: `auto`, `low`, `medium`, `high`, `xhigh`, `max`, or `ultra`.
- `--speed MODE`: `auto`, `normal`, or `fast`.

Overrides apply after profile selection. Model values use the existing provider adapter mapping (Claude environment, Cursor launch argument, or Codex ACP option); reasoning and speed are applied only when the certified provider advertises them, otherwise exec emits the fixed `runtime option omitted` warning. Exec adds no provider-specific flags.

Runtime precedence is exactly `CLI flags > nearest repository .spec-finder/config.json > ~/.spec-finder/config.json`. The repository and user files are complete runtime profiles selected by fallback; fields are not merged. An existing but invalid repository profile fails clearly and does not fall through to the user file. When no repository profile exists, the user profile must be valid. Configuration resolution completes before provider startup.

The names above are the values accepted by the shared configuration schema, not a claim that every value is currently launchable through `exec`. Task 09's certification is currently blocked, so the source-owned `exec` registry marks Claude, Codex, and Cursor unavailable for real exec launches. A real provider is rejected before spawn until its complete certification matrix passes. Packet `run` provider support is a separate compatibility path and is not disabled by this exec gate.

### Workspace, permissions, and host access

Workspace discovery is independent from config selection. Exec canonicalizes the invocation directory, chooses the nearest real (non-symlink) `.spec-finder` ancestor, and otherwise uses the canonical exact current directory. Selecting `~/.spec-finder/config.json` never relocates or broadens that workspace.

The permission policy is user-owned: `prompt`, `approve-all`, or `deny`, with invalid or missing user permission data defaulting to `prompt`. Repository `permissions` is ignored for authority. In an interactive terminal, `prompt` presents a sanitized choice; without both TTY streams it fails closed instead of waiting. Approval policy controls mediated actions; it is not an OS sandbox.

Exec's ACP filesystem callbacks use direct canonical host access under that policy. This is a capability boundary, not a sandbox: it does not constrain provider-owned tools, direct provider filesystem access, or other operating-system behavior. The current source path is `read-only` because task 09 is blocked. Writes are not available through the source policy.

A future write-capable release may advertise writes only after every required gate passes on every required host/provider combination. Each mediated read or write must use an absolute path that remains canonically inside the workspace: parent traversal, sibling-prefix tricks, aliases, symlinked components, unsafe or unresolved ancestors, and out-of-workspace targets are rejected. A write asks for permission only after a safe normalized relative identity is established, revalidates the deepest existing parent immediately before mutation, validates each created directory, and fails closed on any uncertainty. Permission approval never overrides containment. The V1 guarantee covers these Spec Finder ACP callbacks only; it is not generalized shell or terminal access and it retains the documented same-user pathname-replacement race outside the V1 threat model.

### Streams, outcomes, and recovery

Exec keeps human progress separate from the final answer:

- `stderr` receives fixed preflight lines for workspace, runtime source, permission policy, and host-access mode, plus sanitized tool/permission activity, warnings, and the normalized terminal result. Internal thoughts, plans, raw tool arguments/results, provider stderr, and unknown payloads are omitted.
- `stdout` receives buffered agent message text only after an `end_turn` result and confirmed process cleanup. Every non-success outcome leaves stdout empty, even when partial text was received. Redirecting stdout therefore captures only a successful final response.

Terminal outcomes are provider-neutral: `end_turn` is `completed`; `cancelled` is `cancelled`; refusal is `refused`; token or turn exhaustion is `limited`; permission rejection is `permission-denied`; protocol, authentication, transport, provider, and cleanup failures are `provider-error` or `cleanup-error` as applicable. Optional `session/close` is called only when the provider advertises that capability; unsupported close is not treated as a turn failure.

| Exit | Meaning | Recovery |
|---:|---|---|
| `0` | `completed`: end-of-turn text and cleanup were confirmed | Use the final answer on stdout. |
| `1` | Permission denied, refusal, token/turn limit, provider failure, or cleanup failure | Read the normalized stderr result; change the prompt, permission policy, authentication, provider availability, or local cleanup condition, then retry. |
| `2` | Invalid invocation, configuration/profile error, or uncertified exec provider | Correct the command/configuration, or wait for the provider certification gate; no provider was started for preflight failures. |
| `130` | User or ACP cancellation | Retry when ready; the command settles pending permissions and performs bounded cleanup. |

Ctrl-C starts semantic ACP cancellation, settles every pending permission request exactly once, continues consuming trailing updates during the grace period, and then escalates the supervised process tree if needed. Release validation requires terminal cleanup within five seconds; a provider or host without that evidence is not exposed through exec. A second Ctrl-C skips the remaining grace and requests forced cleanup. There are no automatic retries.

### Persistence, compatibility, and non-goals

Exec creates no task, memory, report, checkpoint, archive, task status, transcript, prompt/response history, session history, trust record, telemetry, usage counter, or validation counter. Permission and cancellation registries are in-memory and are destroyed when the process closes. This promise covers Spec Finder-owned state only; provider-side persistence is provider-specific and is not denied generically.

The existing configuration version and `run`/cockpit contracts remain compatible, and the ACP SDK is pinned to the certified `1.2.1` v1 surface. If shared-core work ever regresses packet execution, rollback restores the prior packet adapter while leaving the isolated exec modules; if any write-safety or platform cleanup gate fails, the safe rollback is to keep exec read-only or withhold it entirely. There is no migration for tasks, reports, memory, or config files.

Exec intentionally does not provide multi-turn or resumed sessions, stdin/file prompt input, JSON/JSONL or other machine-readable output, an explicit `--cwd` or extra workspace roots, field-level config merging, repository-controlled permissions, remembered trust, persistent metrics, custom provider commands/flags, budgets/retries/concurrency, or generalized shell capabilities.

### Release evidence and manual validation handoff

The reviewed task 09 certification record is [here](.spec-finder/tasks/ad-hoc-acp-exec/reports/task_09.md). Its verdict is **blocked**: all real exec providers remain disabled and host access remains read-only. The following M-03 through M-07 review is the release boundary, not a readiness claim:

| Metric | Reviewed evidence | Current decision |
|---|---|---|
| M-03 — runtime precedence | The task 09 report records passing focused provider/config/exec tests and a full repository gate. | Automated contract covered; retain the documented flags → repository → user order. |
| M-04 — first visible progress | Preflight ordering is covered by the reporter contract; no genuine-run timing sample was certified in task 09. | Keep the ≤10-second median as a manual post-release measurement. |
| M-05 — host escapes | Current-host canonical containment/adversarial fixtures passed; cross-host/provider guarded-write evidence is absent. | Keep host access read-only and do not enable writes. |
| M-06 — bounded cancellation | Native macOS fixture scenarios passed with recorded sub-five-second timings; native Linux and Windows evidence is missing. | Keep the release blocked until all required supervisors pass. |
| M-07 — existing command compatibility | The task 09 report records packet/exec separation tests and `bun run verify` passing to terminal exit. | Preserve packet provider behavior independently from exec certification. |

M-01 and M-02 are external, manual measurements; they add no product instrumentation or persistent state.

| Measurement | Owner | Method and sample | Timing |
|---|---|---|---|
| M-01 — at least 10 genuine executions | Release owner (assign a named maintainer in the release record) | Keep an external ledger with date, work context, provider, terminal outcome, and whether the run was genuine; exclude scripted acceptance runs and omit prompt/response content. Sample at least 10 real executions across at least two work contexts. | Start at release; review weekly and at day 30. |
| M-02 — at least 80% without immediate fallback | Same release owner and ledger | For the same genuine sample, record whether material work completed without immediately switching to a provider CLI or task packet; record the fallback reason without sensitive payloads. | Calculate at day 30 alongside M-01. |

Do not add telemetry, counters, trust persistence, history, or a Spec Finder-owned measurement file to satisfy these handoffs.

Version 1 configuration files are accepted for migration. Rerun `spec-finder setup` to rewrite an existing verbose file to the compact version 2 format.

Validate and inspect the effective file:

```bash
spec-finder config
```

## CLI

```text
spec-finder setup [--agent claude|codex|cursor]... [--local|--global] [--copy|--symlink]
spec-finder upgrade
spec-finder run <task_slug> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
spec-finder run --multiple <slug1,slug2,...> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
spec-finder exec "<prompt>" [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
spec-finder checkpoint begin <task_slug> <task_id>
spec-finder checkpoint complete <task_slug> <task_id>
spec-finder config
spec-finder version
```

`upgrade` runs `npm install --global spec-finder@latest`, keeping npm as the package authority.

## Task contract

Task files are named `task_01.md`, `task_02.md`, and so on. Required frontmatter:

```yaml
---
status: pending
title: Implement the runtime
type: backend
complexity: medium
dependencies:
  - task_01
---
```

The first H1 must match `title`. Dependencies use task IDs and must be acyclic. A failed task stops the run; dependent tasks remain incomplete for a later run.

Each packet has workflow-scoped memory:

```text
.spec-finder/tasks/<slug>/memory/
├── MEMORY.md
└── task_NN.md
```

`MEMORY.md` contains durable context shared across the packet. Each `task_NN.md` contains only operational context for that task. Spec Finder initializes missing memory files before execution and never overwrites existing memory during initialization.

ACP filesystem requests are constrained to the workspace root. Spec Finder sends cancellation through ACP and terminates the provider process when the operator quits.

## Development

```bash
bun install
bun run verify
```

The full gate runs strict TypeScript, Bun tests, an OpenTUI frame test, and the distributable build.

## Design references

- [Compozy](https://github.com/compozy/compozy) and its documented [v0.2 → v0.3 migration](https://github.com/compozy/compozy/blob/main/MIGRATION_GUIDE.md)
- [Agent Client Protocol TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk)
- [OpenTUI](https://github.com/anomalyco/opentui)
- [Agent Skills ecosystem](https://skills.sh/docs)
