# Single-provider setup Technical Specification

## Executive Summary

Implement issue #2 as a focused setup-flow redesign: one provider is selected, a provider descriptor derives its destination and curated model choices, setup persists a strict v3 setup profile, and an installer transaction commits managed skills and config safely. The existing runtime provider and ACP layers remain unchanged authorities for real provider availability; setup records requested values only.

The primary trade-off is a more involved filesystem transaction and a one-time explicit scope decision for v2 configurations. This is accepted to avoid inventing legacy scope metadata or leaving config and managed skills in contradictory states after an error. There are no approved traceability gaps.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | Setup parses repeated `--agent`, multi-selects targets, and defaults to all providers. | `src/commands.ts` | 2026-08-08 | Replace target arrays with one resolved provider and single-select flow. |
| Repository | Claude, Codex, and Cursor currently map to `.claude/skills`, `.agents/skills`, and `.cursor/skills`. | `src/setup.ts` | 2026-08-08 | Centralize the new Claude/Codex/Cursor mapping; Cursor moves to `.agents/skills`. |
| Repository | v2 config is strict, singular, and direct-write; it has no setup metadata. | `src/config.ts` | 2026-08-08 | Add a v3 discriminated setup state and transaction-staged config serialization. |
| Repository | `run --provider` applies a temporary provider override and reparses the resulting runtime configuration. | `src/commands.ts` | 2026-08-08 | Parse stored v3 setup state before layering runtime-only overrides, so an ephemeral provider never invalidates persisted destination metadata. |
| Repository | The picker supports selection/cancel but starts selected and has a multi-select mode. | `src/ui/setup-picker.ts` | 2026-08-08 | Add explicit initial/no-selection behavior needed for single selects and v2 scope migration. |
| Repository | ACP option support appears after session initialization and runtime reports application/default/unsupported outcomes. | `src/acp-client.ts` | 2026-08-08 | Do not launch a provider in setup; label configuration values as requested. |
| Official docs | Codex lists `gpt-5.6-luna` as a current model slug. | [Codex model catalogue](https://github.com/openai/codex/blob/main/codex-rs/models-manager/models.json) | Accessed 2026-08-08 | Use the user-approved Codex default in the static setup profile. |
| Official docs | Claude Code accepts aliases such as `fable`, but Fable availability depends on version and organization policy. | [Claude model configuration](https://code.claude.com/docs/en/model-config) | Accessed 2026-08-08 | Offer `fable` as a requested default and retain truthful runtime feedback. |
| Official docs | Cursor accepts `--model` and can dynamically list models, but its static documentation is not a complete availability catalogue. | [Cursor CLI parameters](https://cursor.com/docs/cli/reference/parameters) | Accessed 2026-08-08 | Use static `auto` by default; do not query `--list-models` during setup. |
| Official docs | ACP session configuration selectors are a runtime protocol capability. | [ACP session configuration announcement](https://agentclientprotocol.com/announcements/session-config-options-stabilized) | 2026-02-04 | Setup never promises model/speed entitlement. |
| User decision | Persist setup data in a versioned validated config section. | Technical clarification | 2026-08-08 | Version 3 owns a strict setup state. |
| User decision | Use full staging, rollback, and local/global traversal protection. | Technical clarification | 2026-08-08 | Implement an exclusive transaction with failure injection tests. |
| User decision | Reject repeated `--agent` and `--symlink`; retain copying only. | Technical clarification | 2026-08-08 | Remove multi-target/mode semantics from setup options. |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| G-01 | Each completed setup has exactly one provider. | `commands.ts` parser/resolver; `SetupRequest.provider` | Parser and command-flow tests reject repeats and assert one result. | Covered |
| G-02 | Every result has the correct provider-derived destination and scope. | `setup-profile.ts`; v3 `setup`; summary renderer | Six provider-by-scope setup tests. | Covered |
| G-03 | New defaults are current while omitted valid values persist. | Setup resolver/model and speed pickers | Fresh, changed-provider, same-provider, and non-interactive rerun tests. | Covered |
| G-04 | Legacy Cursor content is never migrated or deleted. | `setup.ts` transaction target allowlist | Legacy path fixture before/after assertions. | Covered |
| G-05 | Help, README, and behavior describe one contract. | `cli.tsx`, `README.md`, command tests | Help snapshot/content assertions and documentation review. | Covered |
| US-01 | Keyboard users choose one provider normally. | `ui/setup-picker.ts`; `commands.ts` | Arrow/Enter/cancel picker tests; no space-toggle assertion. | Covered |
| US-02 | Omitted non-interactive provider/model/speed preserve valid intent. | `resolveSetupOptions` | Existing v3 config fixture with omitted flags. | Covered |
| US-03 | Fresh non-interactive setup chooses Codex and its catalogue default. | Setup resolver/profile | Empty workspace command test. | Covered |
| US-04 | Existing Cursor users receive preservation clarity. | `SetupResult.legacyCursor`; CLI summary | Fixture verifies untouched `.cursor/skills` and no-migration output. | Covered |
| US-05 | Maintainers can document deterministic flags and paths. | CLI usage and README examples | Documentation contract test/review. | Covered |
| F-01 | Require one provider; reject repeated/conflicting flags. | Parser and single-select provider picker | Flag matrix and interactive selection tests. | Covered |
| F-02 | Derive `.claude` or `.agents` and choose scope independently. | `SetupProviderProfile`; scope resolver | All provider/scope roots asserted. | Covered |
| F-03 | Offer `auto`, curated model choices, and `auto`/`normal`/`fast`; preserve valid omissions. | Setup profile; model/speed resolver | Default, custom-keep, and invalid flag tests. | Covered |
| F-04 | Persist and summarize provider/model/speed/destination/scope. | Config v3 serializer; `SetupResult` | Config validation plus summary assertions. | Covered |
| F-05 | New destination every run; preserve legacy/unrelated files. | Transaction allowlist and path guards | Legacy, unrelated, and injected-failure tests. | Covered |
| F-06 | Documentation removes multi-provider guidance. | `cli.tsx`, `README.md` | Usage and README assertions/review. | Covered |
| Constraint: singular provider | No target arrays or multi-provider install loop remain on the public setup path. | `SetupRequest` and `setupWorkspace` | Type/check plus parser tests. | Covered |
| Constraint: scope independent | Scope is a separate resolved input and persisted only after successful setup. | `SetupState` | Local/global plus v2 migration tests. | Covered |
| Constraint: provider-derived path | No setup argument accepts an arbitrary destination. | Parser/profile API | Parser negative tests. | Covered |
| Constraint: no live discovery | Setup performs no provider launch, ACP session, or `--list-models` call. | `commands.ts`, `setup.ts` | Dependency/mock negative tests and source review. | Covered |
| Constraint: preserve unrelated/legacy paths | Only known managed skill names in the selected derived root may move. | Transaction allowlist | Filesystem fixtures and failure injection. | Covered |
| Constraint: strict user config | v3 rejects unknown keys and inconsistent persisted destinations; runtime overrides remain a separate validated layer. | Zod schema/migrator and run override resolver | Config and run-override regression tests. | Covered |
| Constraint: terminal usability/determinism | Picker cancel and non-interactive resolution are explicit. | Picker API/resolver | Keyboard, cancellation, and argument tests. | Covered |
| M-01 | Cover all issue #2 acceptance paths. | Test matrix below | Focused suite evidence. | Covered |
| M-02 | Prove all six provider-by-scope outcomes. | `setup.test.ts` table test | 3 providers × 2 scopes. | Covered |
| M-03 | Preserve every valid omitted provider/model/speed case. | `commands.test.ts` | Matrix with v3 configured fixture. | Covered |
| M-04 | Observe no legacy/unrelated entry loss. | Transaction failure tests | Snapshot before/after each injected failure point. | Covered |
| M-05 | Run the repository release gate. | Package scripts | Fresh `bun run verify` evidence. | Covered |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| `src/setup-profile.ts` | New | Own reviewed setup provider descriptors, destination mapping, curated model choices/defaults, and profile lookup. | Provider → profile; no filesystem or ACP output. | Existing `Provider` type only. |
| `src/config.ts` | Modified | Strictly parse v1/v2/v3, migrate legacy input in memory, validate v3 setup state, serialize config. | Disk JSON ↔ `ConfigV3`. | Zod, setup-profile validator boundary. |
| `src/commands.ts` | Modified | Parse one setup request, resolve saved/fresh defaults, prompt interactively, render summary. | argv/config/TTY → `SetupRequest`/result. | Config, setup profile, picker, setup service. |
| `src/ui/setup-picker.ts` | Modified | Render accessible single-choice options, an optional initial choice, and a required-unselected state. | Choices/initial state → value/cancel. | Terminal input only. |
| `src/setup.ts` | Modified | Preflight, lock, stage, commit, roll back, and summarize a single derived target. | Valid request → transactional `SetupResult`. | Config serialization, setup profile, Node/Bun filesystem. |
| `src/providers.ts` / `src/acp-client.ts` | Existing, contract-preserved | Launch provider and report actual runtime model/speed outcomes. | Stored requested config → ACP/runtime events. | ACP/provider binaries. |
| `src/cli.tsx`, `README.md` | Modified | Publish the same command contract. | User help/docs. | Command option definitions. |

### Data and Control Flow

1. The CLI parser accepts zero or one `--agent`, zero or one `--model`, zero or one `--speed`, one scope flag at most, compatible `--copy`, and rejects `--symlink` before resolution. Repeated values and opposing scope flags are errors.
2. The resolver loads strict config. A valid configured v3 rerun uses saved provider/model/speed/scope when that input is omitted. A fresh non-interactive run defaults to Codex, its profile default model, `normal` speed, and local scope. A v2-migrated `unconfigured` config requires an explicit scope non-interactively; an interactive flow requires the user to choose one.
3. Interactive setup asks provider, scope, model, and speed as single-choice steps. A provider change selects that profile's default model. A same-provider custom stored model appears only as a `Keep existing custom model (<value>)` action. The model list itself remains curated.
4. `setupWorkspace` resolves the selected descriptor, including Claude → `.claude/skills`, Codex/Cursor → `.agents/skills`. It acquires a scope-specific exclusive lock and preflights source directories, config parent, destination parent, and every existing path ancestor for traversal/symlink safety.
5. The transaction copies every managed `sf-*` source skill into a unique sibling staging area and serializes a v3 config candidate without changing the live config. It neither reads as a target nor changes legacy `.cursor/skills`.
6. Commit moves only existing selected-root managed entries to private backups, promotes staged entries, then atomically replaces config. It records each completed move. On an expected error, it reverses recorded moves in reverse order and restores the prior config before releasing the lock.
7. Successful cleanup removes private stage/backup artifacts, releases the lock, and returns a summary containing requested provider/model/speed, logical destination, scope, installed entries, and legacy Cursor preservation status. Cleanup/rollback failure retains recovery artifacts and produces an actionable failure, never a success claim.

## Implementation Design

### Core Interfaces

`src/setup-profile.ts` owns setup policy. Runtime launch translation stays in `providers.ts`; the profile is not a claim that an account can use every listed value.

```ts
export type SetupDestination = ".agents/skills" | ".claude/skills";

export interface SetupProviderProfile {
  provider: ProviderName;
  label: string;
  destination: SetupDestination;
  models: readonly string[]; // excludes universal "auto"
  defaultModel: string;
}

export function getSetupProfile(provider: Provider): SetupProviderProfile;
export function isCuratedSetupModel(provider: Provider, model: string): boolean;
```

The initial catalogue is release-owned data: Codex includes `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` with `gpt-5.6-luna` as the selected default; Claude includes `fable`, `opus`, `sonnet`, and `haiku` with `fable` as the selected default; Cursor offers `auto` as its provider-directed default. `auto` is universally prepended by the UI/resolver rather than duplicated in each descriptor.

```ts
export type SetupState =
  | { status: "unconfigured" }
  | {
      status: "configured";
      scope: "local" | "global";
      destination: SetupDestination;
    };

export interface ConfigV3 extends RuntimeConfigFields {
  version: 3;
  setup: SetupState;
}
```

`config.ts` uses a strict discriminated Zod schema. For a persisted `configured` document, a cross-field validation verifies `destination === getSetupProfile(provider).destination`. It preserves existing non-empty custom model strings so old runtime configurations remain readable; only setup flag/picker inputs must be `auto` or curated entries. v1 and v2 parse into in-memory v3 with `setup: { status: "unconfigured" }`; no file is rewritten until a successful setup transaction. Runtime commands must load this stored document before applying temporary provider/model overrides, which validate runtime fields without modifying or re-validating `setup` metadata.

```ts
export interface SetupRequest {
  provider: ProviderName;
  model: string;
  speed: "auto" | "normal" | "fast";
  scope: "local" | "global";
  origin: { provider: "flag" | "saved" | "default"; model: string; speed: string };
}

export interface SetupResult {
  configPath: string;
  provider: ProviderName;
  model: string;
  speed: "auto" | "normal" | "fast";
  destination: SetupDestination;
  scope: "local" | "global";
  installed: string[];
  legacyCursor: "preserved" | "absent";
}
```

`setup.ts` owns transaction state and receives a narrow injectable filesystem adapter in tests. Production uses the existing Bun/Node filesystem implementation; callers cannot supply arbitrary destination paths.

```ts
interface SetupTransaction {
  preflight(): Promise<void>;
  stage(): Promise<void>;
  commit(): Promise<void>; // skills, then config
  rollback(cause: unknown): Promise<void>;
  cleanup(): Promise<void>;
}
```

### Data Models and Lifecycle

| Entity | Owner | Lifecycle and validation |
|---|---|---|
| `ConfigV3` | `config.ts`; user-owned file | v1/v2 become in-memory v3/unconfigured. A successful setup atomically writes v3/configured. Unknown keys, unknown setup states, invalid enum values, and provider/destination mismatches fail parsing. |
| `SetupProviderProfile` | Source-controlled `setup-profile.ts` | Static release data. It may change only with reviewed provider documentation; it has no account or telemetry state. |
| `SetupRequest` | `commands.ts` | Ephemeral, fully resolved before filesystem writes. Flags override saved values only where supplied; custom saved models are preserved according to the selected policy. |
| Transaction lock | `setup.ts` | Exclusive `wx` lock scoped to the selected root. Contains minimal diagnostic timestamp/process context, no secrets. Existing lock fails closed; stale-lock recovery is an explicit operator action. |
| Staged skill/config and backups | `setup.ts` | Private, same-parent temporary names. Only known managed `sf-*` entries move. Remove after successful commit; retain and report on cleanup/rollback failure. |
| Legacy `.cursor/skills` | User-owned external content | Never a transaction source, destination, backup, or cleanup path. Its existence only affects the preservation status text. |

The transaction is single-writer per selected root. The lock avoids two local runs or two global runs sharing the same derived destination. The config and skill destination may be in different directories for global setup, so the implementation guarantees ordered commit plus rollback rather than claiming one filesystem-level atomic rename across both roots.

### External Interfaces

| Interface | Request/contract | Response | Errors/compatibility |
|---|---|---|---|
| CLI | `spec-finder setup [--agent <claude|codex|cursor>] [--model <auto|curated>] [--speed <auto|normal|fast>] [--local|--global] [--copy]` | One setup summary. | Repeated `--agent`, duplicate model/speed, opposing scope, invalid model, and `--symlink` fail before writes. `--copy` remains accepted compatibility syntax. |
| Config JSON | Strict v3 as above. | Runtime reads familiar provider/model/reasoning/speed fields plus setup state. | v1/v2 migrate in memory; edited invalid v3 fails with a correction message. Persisted setup pairing is validated before any runtime-only override is applied. |
| Provider launch/ACP | No new setup request is sent. Existing runtime reads stored model/speed. | Existing applied/default/unsupported runtime events. | Entitlement, binary version, and protocol errors remain runtime outcomes; setup summary says requested, not applied. |
| Filesystem | Fixed descriptor-derived target and known managed names only. | Installed copies and config. | Root/path symlink traversal, lock contention, staging/commit errors fail closed and roll back when possible. |

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| CLI → command resolver | Target list and `SkillInstallMode`. | Singular request with model/speed/scope origins; no symlink mode. | Parse/prompt error writes nothing. | Keep `--copy`; reject repeated `--agent` and `--symlink` clearly. |
| Command resolver → config | v2 runtime-only config. | Load legacy in memory; write v3 only through transaction. | Invalid config/actionable correction; unknown scope requires choice. | No guessed v2 scope or destination. |
| Command resolver → picker | Multi-select supports space toggles. | Single-choice steps with initial/required-unselected state. | Cancel returns no summary/no writes. | Provider/scope/model/speed remain keyboard accessible. |
| Setup service → filesystem | Direct `rm` then copy/symlink per target. | Fixed selected root, lock, stage/backup/commit/rollback. | Retain recovery artifacts if rollback cannot finish. | Preserve unrelated and legacy files; Cursor uses `.agents/skills`. |
| Config → provider runtime | Stored strings are passed to provider launch/ACP. | Parse stored v3 first, then layer `run` overrides without mutating setup state. | Invalid override fails independently; existing runtime truthfully reports unavailable requested options. | Existing custom non-empty models continue to load and `run --provider` remains usable. |
| Documentation → CLI | README documents all providers/multi-select and old Cursor path. | Show singular flag/defaults/path table and capability boundary. | N/A. | Remove obsolete repeated-agent and symlink guidance. |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Repeated provider, duplicate option, invalid curated model, or `--symlink` | Parser validation | Concise error with valid syntax; no lock or write. | User corrects invocation. | Command parser tests. |
| Invalid/edited config | Strict Zod parse/cross-field validation | Error identifies config path and invalid field. | User corrects config; no rewrite. | Config tests. |
| Runtime-only provider override | Override resolver after stored v3 config parse | Requested run uses the override without changing setup provider/destination. | Invalid override fails without rewriting config. | Command runtime-override regression test. |
| v2 config lacks scope in non-interactive run | `setup.status === unconfigured` and scope omitted | Stop with `--local`/`--global` guidance. | Rerun with scope; interactive user explicitly chooses. | Migration/resolver tests. |
| User cancels picker | Picker cancellation result | Return cancellation status; do not claim success. | Rerun setup. | Keyboard/cancel tests. |
| Existing lock | Exclusive create fails | Fail closed; show scoped lock path and stale-lock recovery guidance. | Operator confirms no active setup then removes only named lock. | Lock contention test. |
| Symlink traversal/path escape | Root and ancestor `lstat`/realpath validation | Refuse before staging or replacement. | Fix target path; no write. | Local and global malicious-symlink tests. |
| Stage copy/config serialization fails | Transaction stage error | No live entries changed. | Remove only private stage; report cause. | Injected stage failure test. |
| Managed-skill or config commit fails | Recorded move/promote failure | Suppress success summary and begin reverse rollback. | Restore backups and prior config in reverse order. | Failure at each commit phase. |
| Rollback/cleanup failure | Rollback/cleanup operation error | Preserve stage/backup files and report exact paths; no destructive retry. | Operator recovery with retained artifacts; future setup may proceed after recovery. | Injected rollback/cleanup failure test. |
| Legacy Cursor path exists | Non-mutating existence check | Summary says preserved; no migration. | None required. | Before/after fixture. |
| Runtime rejects model/speed | Existing ACP/launch result | Runtime output says unsupported/defaulted; setup did not claim application. | User selects `auto` or a supported value and reruns. | Existing/new ACP contract tests. |

## Security and Privacy

- The only installation roots are descriptor-derived local workspace paths and provider-home paths. No CLI flag, config field, or documentation example accepts an arbitrary destination.
- Preflight protects both scopes: resolve the allowed base, reject an escaping target, and reject symlinked ancestor components before staging or replacing entries. It also verifies that each promoted/backup path is a known managed `sf-*` name.
- The transaction never removes `.cursor/skills` and never moves/removes an unrelated entry in the selected root. Existing managed `sf-*` content is treated as recoverable data until cleanup completes.
- Locks, errors, and summaries include provider/path/state diagnostics only. They must not print environment variables, provider credentials, ACP payloads, or copied skill contents.
- Setup makes no network/authentication/provider launch calls. Runtime keeps its existing permission and ACP validation boundaries.
- Fail closed on malformed config, lock contention, traversal, stage, commit, or rollback error; success is emitted only after commit and cleanup complete.

## Compatibility, Migration, and Rollback

- **Schema:** `version: 2` and v1 inputs remain readable through in-memory migration. Newly successful setup persists `version: 3` with `setup.status: "configured"`.
- **Unknown historic state:** v2/v1 do not imply local installation. Migration writes no guessed scope/path. Their first non-interactive setup must receive a scope; interactive setup must explicitly select one. Fresh workspaces retain local default behavior.
- **Runtime compatibility:** Provider/model/reasoning/speed/permissions retain current semantics. Non-empty saved custom models remain legal runtime config values, even though they are not picker/flag additions. `run --provider` and related temporary runtime overrides apply only after the persisted v3 document has passed its setup-pairing validation; they never rewrite or invalidate setup metadata.
- **CLI compatibility:** One existing `--agent` and `--copy` remain usable. Repeated `--agent` and `--symlink` now fail by design with a migration message. Help and README make this intentional breaking change visible.
- **Path migration:** Cursor's selected destination changes to `.agents/skills`; legacy `.cursor/skills` remains untouched. There is no automatic migration, cleanup, or merger.
- **Rollback trigger:** Any transaction failure triggers automatic best-effort rollback. If a release must be reverted, retain the v3 reader or use the retained transaction backup before removing v3-writing behavior; do not bulk-delete generated skills/config.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/config.ts` | Introduce v3 strict schema, legacy migration, config candidate serialization/atomic replacement support. | High: config compatibility. | Preserve v1/v2 reads; add exhaustive schema/migration tests. |
| `src/setup-profile.ts` | New source-of-truth setup descriptor/catalogue module. | Medium: catalogue drift. | Document reviewed defaults and exhaustive provider tests. |
| `src/commands.ts` | Replace arrays/multi-select resolution; parse model/speed and new compatibility errors; summary; preserve post-load runtime overrides. | High: automation behavior. | Test all setup paths plus `run --provider` over configured v3 metadata. |
| `src/ui/setup-picker.ts` | Support true single-select initial/no-selection state. | Medium: keyboard regression. | Test navigation, required selection, and cancellation. |
| `src/setup.ts` | Replace modes/multi-target loop with lock/stage/commit/rollback one-target transaction. | High: user file safety. | Use fixed allowlist, injectable failure seam, local/global guards. |
| `src/cli.tsx` | Publish changed usage. | Low. | Update syntax and remove multi/symlink wording. |
| `src/providers.ts` / `src/acp-client.ts` | No behavioral redesign; preserve requested-value/runtime-outcome boundary. | Medium: accidental coupling. | Avoid setup launches; expand outcome assertions only if presentation changes. |
| `README.md` | Rewrite setup walkthrough/default/path table. | Medium: stale contract. | Describe v2 scope prompt, Cursor legacy preservation, and runtime availability caveat. |
| `tests/config.test.ts` | v3/migration validation. | Medium. | Cover strict states and no false scope. |
| `tests/commands.test.ts` | Parser/resolution/interactive flow contract. | High. | Replace old multi-provider assertions. |
| `tests/setup.test.ts` | Target mapping and transactional filesystem behavior. | High. | Add roots, unrelated/legacy, lock, traversal, and failure matrix. |
| `tests/providers.test.ts`, `tests/acp-client.test.ts` | Preserve runtime model/speed truthfulness. | Low. | Add boundary regression coverage if interfaces are touched. |

## Testing and Evidence

### Unit Tests

- `config.test.ts`: v1/v2 → v3/unconfigured in-memory migration; v3 configured local/global parsing; strict unknown-key rejection; invalid destination/provider pairing; no rewrite on load; saved custom model remains readable.
- `setup-profile` tests: exhaustive provider labels, destination mapping, curated models, defaults (`fable`, `gpt-5.6-luna`, `auto`), and every default belongs to its declared policy.
- `commands.test.ts`: no-agent saved/fresh resolution; changed-provider model default; valid saved model/speed preservation; custom-model keep action; repeated/conflicting/missing option errors; `--copy` compatibility; `--symlink` rejection; v2 no-scope non-interactive error; and `run --provider` over a configured v3 destination without config mutation.
- `setup-picker` tests (or existing command picker harness): single selection, no space toggle, initial selection, required-unselected scope, Enter behavior, escape/Ctrl-C cancellation, and raw-input restoration.

### Integration Tests

- `setup.test.ts`: all 3 provider × 2 scope destinations; generated v3 config contents; only one selected target receives managed copies; unrelated skills survive.
- Legacy Cursor fixture: seed `.cursor/skills` with managed-looking and unrelated entries, run Cursor setup, assert byte-for-byte preservation and a no-migration summary while `.agents/skills` receives only staged managed entries.
- Traversal fixture: malicious symlink ancestor in local and global roots, assert refusal before mutation.
- Transaction fixture with injected filesystem failure at stage, first backup move, first promote, later promote, config promote, rollback, and cleanup. Assert former config/managed entries restore for rollback-capable failures; assert artifacts remain and success is absent when rollback/cleanup fails.
- Lock fixture: a pre-created exact lock causes no config or skill mutation.

### End-to-End or Platform Evidence

- Exercise `spec-finder setup` in a pseudo-terminal/integration harness with arrows, Enter, and cancellation to prove the interactive contract without relying on a manually observed terminal.
- Manually inspect `--help` and README examples against actual summary wording before release. No new native, package, network, or provider-account validation is required because setup intentionally performs no live discovery.

### Verification Gates

Run focused suites while developing, then capture fresh output for:

```sh
bun test tests/config.test.ts tests/commands.test.ts tests/setup.test.ts
bun test tests/providers.test.ts tests/acp-client.test.ts
bun run check
bun run build
bun run verify
```

`bun run verify` is the release gate. No check is considered passed until its terminal output is captured after implementation.

## Observability

There is no telemetry in scope. The command's existing terminal result becomes the diagnostic surface and must distinguish `requested` model/speed from runtime application. Successful summaries contain provider, requested model, requested speed, logical destination, scope, installed managed-entry count, and legacy Cursor preservation state. Failure output includes the operation phase and recoverable stage/backup/lock path when relevant, but never secrets or copied content. Existing runtime ACP events remain the source for applied/defaulted/unsupported capability observations.

## Development Sequencing

1. Add `setup-profile.ts` and config v3 read/validation/migration tests — no dependency; establishes typed policy and safe legacy state.
2. Refactor setup request parsing and picker state for one provider, model/speed, scope migration, and summary contracts — depends on step 1's types/defaults.
3. Replace `setupWorkspace` target/mode logic with preflight, lock, stage, commit, rollback, and failure injection seam — depends on steps 1–2 because it consumes resolved request and serializes v3 config.
4. Add exhaustive transaction, compatibility, and runtime-boundary regressions — depends on step 3; can parallelize config/profile test expansion with step 2.
5. Update CLI help and README, then run focused suites and the full verification gate — depends on stabilized behavior and summary wording.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Static catalogue becomes stale | Provider docs and plan availability change independently of Spec Finder releases. | A requested default may be unavailable. | Maintainer updates `setup-profile` when official docs change or runtime feedback demonstrates sustained friction. |
| Claude Fable may be unavailable | Claude documents version and organization constraints. | Runtime may reject/default the requested model. | Existing runtime message remains truthful; user can choose `auto` or another curated model. |
| Cross-root transaction cannot be one kernel-atomic rename | Global skills and workspace config can be separate roots. | Crash/recovery must handle partial commit. | Ordered moves, retained backups, lock, and rollback failure tests; no false atomicity claim. |
| v2 has unknown historical scope | v2 config contains no scope/destination. | First non-interactive migration needs an extra flag. | User-approved explicit-scope policy; revisit only with safe migration evidence. |
| Cursor legacy skills can be user-owned | Destination changes from `.cursor/skills` to `.agents/skills`. | Users may expect a migration. | Keep explicit no-migration message; separate future ADR required for opt-in migration. |
| Exact recovery UX for retained artifacts | New transaction adds rare rollback/cleanup failure path. | Operators need clear instructions. | Implementation task must specify deterministic artifact names and actionable output; review during test implementation. |

## Architecture Decision Records

- [ADR-001: Single-provider setup contract](adrs/adr-001-single-provider-setup-contract.md) — accepted single-provider scope and runtime-capability boundary.
- [ADR-002: Safe single-provider transition](adrs/adr-002-safe-single-provider-transition.md) — accepted default/reuse and legacy-path policy.
- [ADR-003: Versioned setup profile and transactional installation](adrs/adr-003-versioned-setup-profile-and-transaction.md) — accepted v3 metadata, static policy, and staged rollback design.
