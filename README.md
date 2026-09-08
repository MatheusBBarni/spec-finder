# Spec Finder

[![npm](https://img.shields.io/npm/v/spec-finder.svg)](https://www.npmjs.com/package/spec-finder)
[![Bun](https://img.shields.io/badge/bun-%3E%3D1.3-black)](https://bun.sh)

A skill-driven specification framework with a local ACP cockpit, heavily inspired by Compozy. It brings back the compact workflow that made pre-0.3 Compozy useful—idea → PRD → TechSpec → executable tasks—without adding a daemon or a second source of truth.

Task packets stay local in `.spec-finder/tasks/` and `.spec-finder/tasks_done/`. Simplified-path specs stay local in `.spec-finder/specs/`. Setup writes `.spec-finder/.gitignore` so committed specs cannot poison later agent context. Skills are portable Agent Skills. Claude, Codex, Cursor, Grok Build, and Pi run through their own ACP harnesses while Spec Finder owns task ordering, lifecycle state, permissions, and evidence reports.

## Features

- **Closed specification pipeline** — idea, PRD, TechSpec, and numbered tasks live in `.spec-finder/tasks/<slug>/`.
- **Simplified spec path** - `sf-write-spec` writes `.spec-finder/specs/<slug>-spec.md` for an agent to execute, plus the same runner packet, in one research-and-approve pass.
- **Five ACP providers** — Claude, Codex, Cursor, plus packet-only Grok Build and Pi.
- **Read-only cockpit** — watch provider, task graph, ACP activity, and tool calls without extra UI chrome.
- **One session per task** — implementation and the final report share one ACP session.
- **Ordered batch runs** — `spec-finder run --multiple slug1,slug2` is serial and fail-fast.
- **Continuous packet loop** — `spec-finder loop <task_slug>` keeps driving one packet through recoveries until a named terminal; `run` stays a single pass.
- **Local checkpoints** — optional `auto_commit` writes recovery commits after verified tasks; never pushes.
- **Optional TDD pack** — red-before-green skills when a task changes product behavior.

## Getting started

Requires **Bun 1.3 or newer** and exactly one supported ACP provider already usable on the machine.

```bash
npm install --global spec-finder
cd /path/to/project
spec-finder setup
spec-finder run my-feature
```

`setup` creates:

```text
.spec-finder/
├── .gitignore
├── config.json
├── specs/
└── tasks/
```

`.spec-finder/.gitignore` ignores `tasks/`, `tasks_done/`, and `specs/` when those entries are missing. Packet and spec files stay out of git. The workspace root `.gitignore` is left alone. `.spec-finder/config.json` remains eligible to commit.

In an interactive terminal, `setup` resolves exactly one provider and asks for its installation scope, model, and speed. Use `↑`/`↓` to move, `Enter` to confirm, and `Esc` to cancel; the provider and every other choice are single-select. Supplying a flag skips only that choice's picker. `--copy` remains accepted for compatibility and is the only installation mode.

```text
spec-finder setup [--agent claude|codex|cursor|grok|pi] [--model auto|CURATED] \
  [--speed auto|normal|fast] [--local|--global] [--copy]
```

Each `--agent`, `--model`, and `--speed` option is optional and accepts at most one value. `--model` accepts the universal `auto` value or a curated model for the selected provider. `--speed` accepts auto, normal, or fast. `--local` and `--global` are independent scope flags; supply at most one. Repeated or duplicate setup options, conflicting scopes, and `--symlink` are rejected before any writes; the error directs users to `--copy`.

Fresh setup defaults to Codex, `gpt-5.6-luna`, `normal` speed, and local scope. A valid configured v3 rerun reuses omitted provider, model, speed, and scope values, including a saved custom model. Selecting a different provider uses that provider's newest catalogue model while an omitted speed still reuses the saved speed. `auto` remains available for every provider.

```bash
spec-finder run my-feature --no-ui
spec-finder run my-feature --provider pi --model auto --reasoning auto
spec-finder loop my-feature --dry-run
spec-finder loop my-feature
```

## Supported providers

| Provider | Packet `run` | Setup models | Skills |
|---|---|---|---|
| Claude | yes | `auto`, `fable`, `opus`, `sonnet`, `haiku` | `.claude/skills` |
| Codex | yes | `auto`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` | `.agents/skills` |
| Cursor | yes | `auto` | `.agents/skills` |
| Grok Build | packet-only | `auto` | `.agents/skills` |
| Pi | packet-only | `auto` | `.agents/skills` |

Launch recipes are source-owned, not user config:

- Claude: `@agentclientprotocol/claude-agent-acp`
- Codex: `@agentclientprotocol/codex-acp`
- Cursor: `cursor-agent acp`
- Grok Build: `grok --no-auto-update agent stdio`
- Pi: `npx --yes @automatalabs/pi-acp`

The default Claude, Codex, and Pi profiles use `npx --yes`, so their adapters can be resolved on demand. Cursor requires the Cursor CLI on `PATH`; Grok Build requires the `grok` binary on `PATH`. Spec Finder does not install provider binaries, authenticate providers, or run provider update commands.

> [!IMPORTANT]
> Grok Build and Pi are packet-only. Use packet `run` with `--provider grok` or `--provider pi`. Switching a run to Grok or Pi defaults omitted `--model` and `--reasoning` to `auto` so a saved Codex/Claude id is not sent.

### Grok Build prerequisites

Grok Build is currently packet-only in source. [Issue #9's redacted validation evidence](https://github.com/MatheusBBarni/spec-finder/issues/9) records `grok 1.0.0 (3cd0d0cbcebe) [stable]` on Darwin 25.6.0 arm64: with `XAI_API_KEY` absent, cached-login packet execution completed with `auto` model, reasoning, and speed defaults plus confirmed cleanup. Its `_meta["x.ai/sessionConfig"].options` metadata was normalized into neutral runtime choices. On that version, explicit model or reasoning reaches the generic ACP `session/set_config_option` setter, which Grok rejects before prompting; Spec Finder surfaces a bounded clear failure and does not fall back. This is not a compatibility promise for later Grok Build releases.

Before selecting Grok Build in `setup` or running a packet with `--provider grok`:

- Confirm that `grok` is available on `PATH` and run `grok --version`. If the binary is missing, install or repair Grok Build using xAI's documented method, put the resulting executable on `PATH`, start a fresh shell if needed, and repeat the version check. Spec Finder does not install, replace, or update the binary.
- Authenticate outside Spec Finder with `grok login`. An existing cached login is sufficient. In a headless or non-browser environment, a nonblank `XAI_API_KEY` is an alternative: when it is set and the ACP agent advertises `xai.api_key`, Spec Finder selects that method; blank values are treated as absent, and otherwise it uses advertised cached-token authentication. The API-key selection path has redacted fixture coverage; no live API key is required. Keep credentials out of configuration files, task packets, logs, and this repository; Spec Finder never stores or prints a key value.

### Pi prerequisites

Pi is currently packet-only in source. [Issue #15's redacted validation evidence](https://github.com/MatheusBBarni/spec-finder/issues/15) records `pi 0.84.3` with unpinned `npx --yes @automatalabs/pi-acp@0.6.1` on Darwin 25.6.0 arm64: with stored Pi credentials, `--provider pi` packet execution completed with `auto` model, reasoning, and speed defaults plus a final-report handoff in the same ACP session. Explicit model `anthropic/claude-sonnet-4` failed before prompting because it was not an advertised configuration value. Stderr was redacted to the generic diagnostic. This is not a compatibility promise for later Pi or adapter releases; unpinned `npx` can resolve a newer adapter than this probe. Do not pin an adapter version in user config.

Before selecting Pi in `setup` or running a packet with `--provider pi`:

- Confirm that you already use Pi locally. Spec Finder does not install Pi, start `/login`, or inspect credential files. If `npx` cannot resolve `@automatalabs/pi-acp`, repair network or npm access outside Spec Finder and rerun.
- Authenticate outside Spec Finder with `pi` and `/login`, or set a provider API key, then rerun. Packet runs fail before useful work when advertised `pi-stored-credentials` is missing. Keep credentials out of configuration files, task packets, logs, and this repository; Spec Finder never stores or prints a key value.
- Leftover `.pi/skills` and `~/.pi/agent/skills` content is user-owned. Setup copies managed skills only to `.agents/skills` (or `~/.agents/skills` for global scope) and does not migrate, merge, or delete `.pi/skills`.

### Skill destinations

The `.spec-finder/config.json`, `.spec-finder/tasks/`, and `.spec-finder/specs/` scaffolding always remain in the current project. Packet and spec directories are ignored by `.spec-finder/.gitignore`. Skill destinations are derived from the selected provider and scope:

| Provider | Curated setup models | Default model | Local skills | Global skills |
|---|---|---|---|---|
| Claude | `auto`, `fable`, `opus`, `sonnet`, `haiku` | `fable` | `.claude/skills` | `~/.claude/skills` |
| Codex | `auto`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` | `gpt-5.6-luna` | `.agents/skills` | `~/.agents/skills` |
| Cursor | `auto` | `auto` | `.agents/skills` | `~/.agents/skills` |
| Grok Build | `auto` | `auto` | `.agents/skills` | `~/.agents/skills` |
| Pi | `auto` | `auto` | `.agents/skills` | `~/.agents/skills` |

Existing v1 and v2 configuration files are read through an in-memory migration and are not rewritten until setup succeeds. Their historic installation scope is unknown: an interactive first setup requires an explicit scope choice, while a non-interactive first setup must include `--local` or `--global`; Spec Finder never guesses the old scope. A fresh workspace keeps the local default. Successful setup writes version 3 metadata with the provider-derived logical destination and selected scope.

Cursor always installs managed skills in `.agents/skills` (or `~/.agents/skills` for global scope). Existing `.cursor/skills` content is legacy user content and is preserved untouched: setup performs no automatic migration, cleanup, merger, or deletion. When that path exists, the completion line says `legacy Cursor skills: preserved (not migrated)`; otherwise it reports that the path was absent and not migrated. Unrelated skills in the selected destination are preserved as well.

Pi always installs managed skills in `.agents/skills` (or `~/.agents/skills` for global scope). Existing `.pi/skills` content is leftover user content and is preserved untouched: setup performs no automatic migration, cleanup, merger, or deletion.

Setup does not launch a provider or perform live capability discovery. Completion lines intentionally say `requested model` and `requested speed`; those values describe setup intent, not a guarantee that an account or client can apply them. Runtime ACP feedback is authoritative and may report a capability as applied, defaulted, or unsupported after a session starts.

## Specification pipeline

| Skill | Artifact |
|---|---|
| `sf-write-spec` | Simplified path: `.spec-finder/specs/<slug>-spec.md` (agent-executable spec) plus the runner packet (`_prd.md`, `_techspec.md`, `_tasks.md`, `task_NN.md`) |
| `sf-idea-factory` | `.spec-finder/tasks/<slug>/_idea.md` |
| `sf-create-prd` | `.spec-finder/tasks/<slug>/_prd.md` |
| `sf-create-techspec` | `.spec-finder/tasks/<slug>/_techspec.md` |
| `sf-create-tasks` | `_tasks.md` and `task_NN.md` |
| `sf-memory` | `memory/MEMORY.md` and `memory/task_NN.md` |
| `sf-execute-task` | bounded implementation and verification |
| `sf-task-report` | `reports/task_NN.md` |
| `sf-batch-tasks` | dependency-safe manual range execution |
| `sf-tdd-plan` | additive `## TDD Plan` on an existing task |
| `sf-tdd-execute` | red → green vertical slices for opted-in behavioral work |
| `sf-tdd-report` | red+green evidence report, or a one-line not-applicable reason |
| `sf-tdd-batch` | TDD-only range runner; stop on failure |
| `sf-archive-tasks` | completed-packet archival and reports |

Every stage keeps the approval gates from the original Compozy skills. Research and interactive decisions happen before artifacts are saved. Tasks form an acyclic dependency graph and carry their own tests.

Use `sf-write-spec` when a feature request is clear enough for one research-and-approve pass.
It writes `.spec-finder/specs/<slug>-spec.md` so an agent can execute from one file, and still writes the runner packet.
Keep using idea, PRD, TechSpec, and tasks when you need discovery, a product-only PRD, a design-only TechSpec, or task regeneration.

### When to use TDD versus core

The four `sf-tdd-*` skills are an optional pack for honest red-before-green work. Use them when a task adds or changes product behavior and you need a failing public-seam test before production code. Keep using core `sf-execute-task`, `sf-task-report`, and `sf-batch-tasks` for research, docs, chore, config-only, or any packet that does not need a red phase. `spec-finder run` stays on the core skills until a separate opt-in design; invoking TDD skills is a manual choice.

## Packet inspection

Glance active packets, then inspect one slug, without starting `run` or `loop`:

```bash
spec-finder ls
spec-finder inspect my-feature
```

`spec-finder ls` lists active packets as remaining, early-stage, blocked, or invalid in plain text. Empty ls succeeds with no active packets. Invalid rows do not fail the command.

`spec-finder inspect <task_slug>` shows remaining task ids, checkpoint and report-handoff blockers, and loop state when a ledger exists. Missing or invalid packets exit 2.

Inspection exits 0 or 2 only. It starts no provider, takes no run-lock, and writes nothing. It is not archive-ready.

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

### Continuous loop vs run

`spec-finder run` is one dependency-safe pass. `spec-finder loop <task_slug>` is the opt-in continuous driver for **one packet**. It shares the workspace run-lock and the same runtime flags (`--no-ui`, `--provider`, `--model`, `--reasoning`, `--speed`), then keeps recovering report handoffs and pending checkpoint delivery and executing remaining work until a named terminal. After process death, rerun the same `loop` command; completed work is not redone.

```bash
spec-finder loop my-feature
spec-finder loop my-feature --no-ui --max-iterations 20 --no-progress-window 3
spec-finder loop my-feature --dry-run
spec-finder loop my-feature --reset-state
```

`--dry-run` prints pending and recovery actions and writes nothing. `--reset-state` rewrites the packet-local `loop/state.json` bootstrap after packet validation. Defaults are 50 iterations and a no-progress window of 3. Loop rejects `--multiple` and adds no required `loop` key in `.spec-finder/config.json`.

Every invocation ends as one of: `done`, `no_op`, `blocked`, `failed`, `exhausted`, `stalled`, or cancelled. Exits are `0` (`done`/`no_op`), `1` (`blocked`/`failed`/`exhausted`/`stalled`), `2` (invalid invocation, packet, or ledger), and `130` (cancelled). `run` still exits `0`/`1` only.

Cockpit iteration meters, a portable loop skill, QA/review/ship-as-done, continue-on-error, and multi-packet loop are later.

### Ordered batch runs

Batch mode is an opt-in command for a declared sequence. Use exactly one comma-separated list with
`--multiple`; packets run serially in the order supplied and the first failure or cancellation stops the sequence:

```bash
spec-finder run --multiple first-packet,second-packet,third-packet
spec-finder run --multiple first-packet,second-packet,third-packet --no-ui \
  --provider pi --model auto --reasoning auto --speed auto
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
  --provider pi \
  --model auto \
  --reasoning high \
  --speed auto
```

## Configuration

`.spec-finder/config.json` is strict: unknown keys and invalid values fail before a provider process starts.

```json
{
  "version": 3,
  "provider": "pi",
  "model": "auto",
  "reasoning": "auto",
  "speed": "normal",
  "permissions": "prompt",
  "auto_commit": false,
  "setup": {
    "status": "configured",
    "scope": "local",
    "destination": ".agents/skills"
  }
}
```

Key behavior:

- `provider`: `claude`, `codex`, `cursor`, `grok`, or `pi`. Grok and Pi are supported by packet `run`. Switching an existing packet run to Grok or Pi defaults omitted model and reasoning overrides to `auto`, so values saved for another provider are not sent; explicit `--model` and `--reasoning` values still win.
- `model`: `auto` or a provider model ID. Claude uses `ANTHROPIC_MODEL`; Cursor receives `--model`; Codex uses advertised ACP session options. Grok Build and Pi leave `auto` to provider defaults and apply an explicit model through an advertised ACP session option or fail clearly.
- `reasoning`: `auto`, `low`, `medium`, `high`, `xhigh`, `max`, or `ultra`. Grok Build and Pi leave `auto` to provider defaults and apply an explicit choice through an advertised ACP session option or fail clearly; other providers apply it only when advertised.
- `speed`: `auto`, `normal`, or `fast`. Unsupported providers continue with a truthful `unsupported` cockpit outcome.
- `permissions`: cockpit `prompt` waits for allow-once / reject-once (`a` / `r`) and shows `Waiting for permission`. The decision applies to that request only and is not remembered. `--no-ui` still prompts in an interactive terminal and cancels when input is unavailable. `approve-all` automatically chooses an allow option; `deny` automatically chooses a reject option.
- `auto_commit`: `false` by default. Set it to `true` to enable one local recovery checkpoint after each task that passes implementation, verification, report, and status gates. The setting is configuration-only; invocation tokens such as `auto-commit=true|false` are rejected.

### Local checkpoint recovery

Checkpoints are local Git commits created through the shared service. They never push, open pull requests, bypass hooks or signing, or imply review, merge, or remote acceptance. With `auto_commit: true`, the manual batch skill calls these phases around each task:

```bash
spec-finder checkpoint begin <task_slug> <task_id>
spec-finder checkpoint complete <task_slug> <task_id>
```

`begin` must succeed before task execution, except when Git HEAD is missing (unborn branch / no commits): checkpoints are skipped, no initial commit is created, and task work continues. `complete` runs only after the report and `status: completed` gate. A blocked delivery stops downstream tasks while preserving the verified task record. Resolve the local Git condition and rerun the packet normally; the rerun retries delivery without rerunning the verified implementation. Set `auto_commit` back to `false` to keep the existing no-commit flow.

Provider process commands are built into Spec Finder for Claude, Codex, Cursor, Grok Build, and Pi. They are implementation details rather than user configuration. The Grok packet launch is `grok --no-auto-update agent stdio`; it requires the external binary and authentication prerequisites above. The Pi packet launch is `npx --yes @automatalabs/pi-acp`; it requires the authentication prerequisites above and is not a user-config pin. Spec Finder also follows each provider's default ACP mode: mode IDs are advertised by the agent and are not portable across providers. Final reports are always required in `reports/`, completed tasks are skipped, and the run stops after a task failure.

Version 1 and version 2 configuration files are accepted for migration. They are read in memory as version 3 with an `unconfigured` setup state; rerun `spec-finder setup` and choose `--local` or `--global` (or make the interactive scope choice) to write configured version 3 metadata. Historic scope is never guessed.

Validate and inspect the effective file:

```bash
spec-finder config
```

## One-turn `exec`

One-turn `exec` is not shipped. It is unavailable as a public command and is not a current one-turn workflow. Use `spec-finder run` or `spec-finder loop` for ACP work.

## CLI

```text
spec-finder setup [--agent claude|codex|cursor|grok|pi] [--model auto|CURATED] [--speed auto|normal|fast] [--local|--global] [--copy]
spec-finder upgrade
spec-finder run <task_slug> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
spec-finder run --multiple <slug1,slug2,...> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
spec-finder loop <task_slug> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE] [--max-iterations N] [--no-progress-window N] [--dry-run] [--reset-state]
spec-finder checkpoint begin <task_slug> <task_id>
spec-finder checkpoint complete <task_slug> <task_id>
spec-finder ls
spec-finder inspect <task_slug>
spec-finder config
spec-finder version
```

The `--provider` option accepts `claude`, `codex`, `cursor`, `grok`, or `pi`. Grok Build and Pi remain packet-only via `run`.

`upgrade` runs `npm install --global spec-finder@latest`, keeping npm as the package authority. It refreshes the installed package only and does not recopy agent skill destinations. Existing workspaces must re-run `spec-finder setup` to install newly shipped skills such as the TDD pack.

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

## Stable npm releases (maintainers)

The stable release workflow is a deliberate, stable-only dispatch from `main`. It reads the version from the reviewed `package.json`; there is no dispatch-time version override. The workflow creates the matching `v<version>` tag and GitHub Release, then runs the installed-package smoke checks.

This runbook applies the TechSpec sections **Compatibility, Migration, and Rollback**, **Failure and Recovery Behavior**, and **Observability** without replacing them with workflow implementation detail.

### Prerequisites

Before the first live release, confirm all of the following:

- You have permission to run Actions and write repository contents, and the intended version is merged on `main` as a stable SemVer.
- The repository has authority over the public `spec-finder` npm package name. A `release` run requires the exact `spec-finder@<version>` to be absent; a `reconcile` run requires that exact version to already be published.
- The repository secret `NPM_TOKEN` is set to an npm automation or granular access token that can publish `spec-finder`. The publish job authenticates with that secret via a step-local `.npmrc`.
- The publish job also keeps `id-token: write` so `npm publish --provenance` can attach OIDC provenance when npm accepts it on GitHub Actions. Provenance is additive; publication still requires `NPM_TOKEN`.

The workflow runs `bun run release:check`, `bun run verify`, and the packed-file allowlist checks before any release-mode publication. These local gates do not prove npm ownership, OIDC exchange, GitHub API writes, or native Windows behavior; the first live release and Windows evidence happen in GitHub Actions.

### Dispatch procedure

1. Merge the intended stable version to `main` and confirm the package, tag (`v<version>`), and public identity are not already in a mismatched state.
2. Open **Actions → Stable release → Run workflow**, select the `main` branch, and choose exactly one mode:

   | Mode | Use it when | What it may do |
   |---|---|---|
   | `release` | npm, the tag, and the GitHub Release are all absent for this version. | Publish the package with `NPM_TOKEN` (and provenance when available), then create or verify the exact tag and generated GitHub Release. |
   | `reconcile` | The exact npm version is already published and matching metadata or smoke evidence is incomplete. | Create or verify only missing matching metadata and rerun smoke; it never runs `npm publish`. |

3. Wait for candidate preflight and remote-state refresh. A candidate is not mutation-eligible until the local gates and the retained `release-candidate` and `release-state` handoffs pass.
4. In `release` mode, the workflow publishes with `NPM_TOKEN`, verifies the package, creates the annotated tag before the GitHub Release, appends the fixed installer footer, and runs the Ubuntu/Windows matrix. In `reconcile` mode, it rechecks the published npm version and performs no npm publication.
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

## Design references

- [Compozy](https://github.com/compozy/compozy) and its documented [v0.2 → v0.3 migration](https://github.com/compozy/compozy/blob/main/MIGRATION_GUIDE.md)
- [Agent Client Protocol TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk)
- [OpenTUI](https://github.com/anomalyco/opentui)
- [Agent Skills ecosystem](https://skills.sh/docs)
