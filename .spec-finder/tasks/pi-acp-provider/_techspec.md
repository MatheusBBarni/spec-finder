# Pi as a packet-only ACP provider Technical Specification

## Executive Summary

Add `pi` as a fifth source-owned ACP provider by extending the existing Grok-shaped registries.
No new module, npm dependency, config key, schema version, or cockpit parser.
Packet launch is unpinned `npx --yes @automatalabs/pi-acp`.
Auth prefers advertised `pi-stored-credentials`.
Model and reasoning are required session-config.
Speed is optional.
Stderr is redacted.
Exec stays uncertified.
Switching to Pi defaults omitted model and reasoning to `auto`.

Primary trade-off: unpinned npx can pull a newer adapter than the issue #15 0.4.0 probe.
The live packet records the pair actually used.
If that packet cannot complete, stop and revisit rather than pin silently.

No approved traceability gap.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | Closed provider set and Grok packet-only pattern. | `src/config.ts`, `src/providers.ts`, `src/setup-profile.ts` | current | Add `pi` beside `grok`. |
| Repository | `providerLabel` falls through to `"Grok Build"`. | `src/providers.ts` | current | Explicit `"Pi"` branch required. |
| Repository | Switch-to-Grok forces omitted model/reasoning to `auto`. | `src/commands.ts`, `src/setup.ts` | current | Same rule for Pi. |
| Repository | Runtime option policy is per-provider in `acp-client.ts`. Grok reasoning is `required`. | `src/acp-client.ts` | current | Pi uses model+reasoning `required`, speed `optional`. |
| Repository | `findConfigOption` matches reasoning by `category === "thought_level"`. | `src/acp-turn.ts` | current | `thinkingLevel` needs no normalizer. |
| Repository | Stderr `redact` emits one generic line. | `src/acp-turn.ts` | current | Pi uses `redact`. |
| Repository | Packet launch is not exec-gated. Exec certification is all `false`. | `src/providers.ts` | current | `pi.exec = false`. |
| Repository | ACP SDK pinned 1.2.1. | `package.json` | current | Do not bump SDK. |
| Official docs | AutomataLabs adapter is ACP v1 in-process Pi. Latest 0.6.1. Auth `pi-stored-credentials`. | npm + adapter README | 2026-08-28 | Unpinned npx launch. |
| Official docs | Pi loads `.agents/skills`. | Pi skills docs | accessed 2026-08-28 | Existing destination. |
| User decision | Registry-only approach A plus unpinned npx, required options, auto-on-switch, redact, one live packet. | TechSpec clarification | 2026-08-28 | ADR-002 |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| G-01 | Packet runs with `provider: "pi"`. | `providers.ts` launch; `acp-client.ts` session | Fixture two-turn packet; live packet M-01 | Covered |
| G-02 | Setup selects Pi and destination `.agents/skills`. | `setup-profile.ts`; picker; `setup.ts` | Setup command tests | Covered |
| G-03 | Missing auth fails before useful work with retry text. | `authPreference` + `selectAuthMethod` | `acp-turn` / `acp-client` fixture | Covered |
| G-04 | Other providers unchanged. Exec Pi refused. | `PROVIDERS`; `EXEC_PROVIDER_CERTIFICATION` | Exhaustive provider + exec tests | Covered |
| G-05 | Help and README list Pi as packet-only. | `cli.tsx`; `README.md` | `tests/cli.test.ts`; README review | Covered |
| US-01 | Interactive and `--agent pi` setup. | `commands.ts` picker items | Setup tests | Covered |
| US-02 | Cockpit and `--no-ui` packet run. | Existing engine + launch | Fixture + live packet | Covered |
| US-03 | `--provider pi` and explicit model/reasoning. | `applyRunOverrides`; session config | Commands + acp-client tests | Covered |
| US-04 | Auth failure, no stored secrets. | auth preference; redact | Fixture + M-02/M-03 | Covered |
| US-05 | `.pi/skills` untouched. | `setup.ts` destination allowlist | Setup preservation test or documented Cursor analog | Covered |
| US-06 | `exec --provider pi` refused. | `resolveExecProviderLaunch` | `providers.test.ts` | Covered |
| US-07 | Claude/Codex/Cursor/Grok still valid. | enum + tests | Existing suites stay green | Covered |
| F-01 | Pi setup agent, `auto` only, no login. | setup profile + picker | Setup tests reject curated Pi models | Covered |
| F-02 | Shared ACP session for implement+report. | `withAcpSession` | Engine/acp-client two-turn fixture | Covered |
| F-03 | Apply-or-fail model/reasoning; speed optional. | `runtimeOptionPolicy` | acp-client fixtures | Covered |
| F-04 | Fail-closed auth, no credential copy. | `createPiAuthMethodPreference` | providers + acp-turn tests | Covered |
| F-05 | Exec blocked; docs packet-only. | certification + help | providers + cli tests | Covered |
| F-06 | Skills only `.agents/skills`. | setup profile + `SKILL_TARGETS` | setup tests | Covered |
| F-07 | Help/README/provider table. | cli, README | cli tests | Covered |
| Constraint: one provider | Enum still singular. | `config.ts` | config tests | Covered |
| Constraint: setup does not launch Pi | No spawn in setup. | `setup.ts` | source + tests | Covered |
| Constraint: no secrets in artifacts | empty launch env; redact | providers tests | Covered |
| Constraint: no terminal login | only `pi-stored-credentials` | auth preference | Covered |
| Constraint: packet ≠ exec | `exec: false` | certification | Covered |
| Constraint: no adapter pin in user config | version stays 3, no new keys | config schema | Covered |
| Constraint: leftover `.pi/skills` | not a setup target | setup allowlist | Covered |
| Constraint: live-packet compatibility claim | README pair from live evidence | README + issue #15 | Covered after live packet |
| M-01 | One redacted live packet | issue #15 | manual | Covered as completion evidence |
| M-02 | Missing-auth failure | live or equivalent fixture + live | Covered |
| M-03 | Zero credential values in artifacts | review during live packet | Covered |
| M-04 | Other providers unchanged | `bun run verify` | Covered |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| `src/config.ts` | Modified | Add `"pi"` to `PROVIDERS`. | Config JSON | Zod |
| `src/setup-profile.ts` | Modified | Pi profile + `defaultsRuntimeToAutoOnProviderSwitch`. | Provider → profile | `ProviderName` |
| `src/providers.ts` | Modified | Launch recipe, auth preference, label, exec false. | Config → `ProviderLaunch` | acp-turn types |
| `src/acp-client.ts` | Modified | Pi runtime-option policy like Grok. | Session request | providers, acp-turn |
| `src/acp-turn.ts` | Unchanged | Auth select, session config, redact, close, cleanup. | Launch policies | ACP SDK 1.2.1 |
| `src/commands.ts` / `src/cli.tsx` | Modified | Picker row, help grammar, `--provider pi`, auto-on-switch. | argv | config, setup-profile |
| `src/setup.ts` | Modified | `SKILL_TARGETS.pi`; auto reasoning/model on provider change. | SetupRequest | setup-profile |
| `src/engine.ts`, `src/ui/` | Unchanged | Provider-agnostic packet + observational cockpit. | events | acp-client |
| `README.md` | Modified | Prerequisites, packet-only, tested pair, `.pi/skills` leftover. | docs | live packet versions |

### Data and Control Flow

Normal: setup writes `provider: "pi"`, `model: "auto"`, destination `.agents/skills`.
`run` resolves launch, spawns `npx --yes @automatalabs/pi-acp` with cwd = workspace and empty env.
Initialize → select `pi-stored-credentials` if advertised → authenticate no-op ACK → `session/new` → apply explicit model/reasoning or leave auto → implement + report turns on one session → `session/close` if advertised → 5s tree cleanup.

Failure: if `pi-stored-credentials` is not advertised, throw the Pi unavailable message before `session/new`.
Explicit model/reasoning missing or rejected fails before prompt.
Unsupported speed emits `unsupported` and continues.
Provider crash uses existing engine retry/session replace.
Cancel uses existing semantic cancel + bounded cleanup.

Recovery: operator runs `pi` `/login` or sets a provider API key, then reruns.
No Spec Finder credential repair path.

## Implementation Design

### Core Interfaces

Launch recipe (source-owned, under 20 lines):

```ts
pi: {
  command: "npx",
  args: ["--yes", "@automatalabs/pi-acp"],
  env: {},
  authMethod: null,
  stderrPolicy: "redact",
}
```

Auth preference (do not copy keys):

```ts
function createPiAuthMethodPreference(): AuthMethodPreference {
  return {
    methodIds: ["pi-stored-credentials"],
    unavailableMessage:
      "Pi authentication unavailable. Run `pi` and `/login`, or set the provider API key, then rerun.",
  }
}
```

Setup profile:

```ts
pi: {
  provider: "pi",
  label: "Pi",
  destination: ".agents/skills",
  models: [],
  defaultModel: "auto",
}
```

`resolveProviderLaunch` attaches `createPiAuthMethodPreference()` for `pi` the same way Grok attaches its preference.
It must not write API keys into `env`.

`providerLabel("pi")` returns `"Pi"`.
Add the Pi branch before any Grok fallback.

Runtime-option policy in `withAcpSession`:

```ts
reasoning: options.config.provider === "grok"
  || options.config.provider === "pi"
  ? "required"
  : "optional"
```

Model stays `required` for Pi (not Claude/Cursor launch-time).
Speed stays `optional`.

Errors: reuse `AcpTurnError` (`provider` for auth unavailable, `protocol` for missing/rejected config).
`ProviderCertificationError` for exec.
`ConfigError` for unknown provider strings.

Ownership: Pi-specific strings and recipes stay in `providers.ts` / `setup-profile.ts`.
ACP core stays generic.

Compatibility: existing four providers keep current recipes and tests.

### Data Models and Lifecycle

No new persisted entity.
`provider: "pi"` is a new enum member on existing v3 config.
No migration function.
v1/v2 migrate as today; `pi` is only valid after the enum change.
Concurrency: existing run lock unchanged.
Retention: Pi session files stay under Pi's own agent dir, not `.spec-finder/`.

### External Interfaces

Protocol: ACP v1 JSON-RPC stdio via `@automatalabs/pi-acp`.
Spec Finder remains ACP client SDK 1.2.1.
Workspace cwd is the Spec Finder workspace root.
Auth: advertised `pi-stored-credentials` only.
Session config: advertised `model` (category `model`) and `thinkingLevel` (category `thought_level`).
Unknown explicit model: adapter `-32602` → Spec Finder protocol failure before prompt.
Retries: existing one phase retry; no extra Pi retry.
Idempotency: each packet still opens one fresh process/session.
No HTTP API.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| `PROVIDERS` | 4 ids | add `pi` | unknown ids still fail | old configs valid |
| Setup picker/help | 4 rows | Pi row, grammar includes `pi` | reject unknown `--agent` | Codex default unchanged |
| Launch registry | 4 recipes | npx AutomataLabs recipe | spawn/auth errors as today | no pin in config |
| Runtime overrides | Grok auto-on-switch | Pi included | foreign model not sent | explicit flags win |
| Exec certification | all false | `pi: { exec: false }` | certification error | packet path ungated |
| Cockpit | observational | none | n/a | provider string displays via label |
| README | 4 providers | Pi prerequisites + pair | n/a | pair filled after live packet |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Unknown `--agent/--provider pi` before enum change | parser/schema | already N/A after change | n/a | config/cli tests |
| Adapter missing / npx fail | spawn error | bounded provider failure | rerun after network/npx | existing spawn tests |
| `pi-stored-credentials` not advertised | `selectAuthMethod` | fail before session, Pi message | login outside, rerun | acp-turn test |
| Missing/unusable credentials after ACK | adapter reject / session fail | fail before useful work | login or API key, rerun | live M-02 |
| Explicit model/reasoning not advertised | `applyRuntimeOption` | protocol error before prompt | pass `auto` or advertised value | acp-client fixture |
| Adapter rejects set_config | setter error | clear-fail, no fallback | change value | Grok analog fixture |
| Unsupported speed | missing speed option | `unsupported`, continue | none | acp-client |
| Exec `--provider pi` | certification gate | exit 2 class config-error | use `run` | providers.test |
| Cancel | abort signal | existing cancel + cleanup | n/a | existing tests |
| Cleanup timeout | 5s deadline | existing unconfirmed/failed | process-tree kill | existing + live close |
| Stderr with secrets | redact policy | one generic line | n/a | acp-client redact test |

## Security and Privacy

- Trust: Pi process runs as the operator, same as other providers.
- Spec Finder still mediates permissions through the existing packet broker.
- Secrets: never read, copy, log, or fixture `~/.pi/agent/auth.json` or API keys.
- Launch `env` is `{}`. Inherited process env may still contain keys for the adapter; Spec Finder must not snapshot them into events.
- Stderr redacted.
- Auth method ids only, never tokens.
- Abuse: exec remains blocked so this change does not add write-capable `exec`.
- Fail-closed on missing advertised auth and on required runtime options.
- Audit: existing activity/runtime_option events. No new telemetry.

## Compatibility, Migration, and Rollback

- Config version stays 3.
- Adding `pi` is backward compatible for existing files.
- Help grammar adds `pi`.
- Fresh setup default remains Codex.
- Switching *to* Pi (setup or `--provider`) defaults omitted model/reasoning to `auto`, matching Grok.
- Rollback: revert the registry diffs. No data migration to undo.
- Trigger to pin launch args: live packet cannot complete on unpinned npx.
- Cleanup: none. Do not delete `.agents/skills` or `.pi/skills`.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/config.ts` | enum | low | add `pi` |
| `src/setup-profile.ts` | profile + switch helper | low | add Pi; export auto-on-switch predicate |
| `src/setup.ts` | `SKILL_TARGETS`; reasoning default | low | include `pi` |
| `src/providers.ts` | launch, auth, label, cert | medium | explicit label; empty env; redact |
| `src/acp-client.ts` | reasoning policy | low | treat Pi like Grok |
| `src/commands.ts` | picker, overrides | low | Pi row; auto-on-switch |
| `src/cli.tsx` | help strings | low | include `pi`; packet-only exec text |
| `src/exec-config.ts` | uses `PROVIDERS` | none extra | inherit enum |
| `README.md` | docs | low | Grok-style Pi section |
| `tests/setup-profile.test.ts` | exhaustive labels | low | Pi label |
| `tests/providers.test.ts` | launch/auth/exec | medium | Pi cases |
| `tests/commands.test.ts` | setup + `--provider pi` | medium | mirror Grok tests |
| `tests/setup.test.ts` | PROVIDERS loop | low | auto-picks Pi |
| `tests/cli.test.ts` | help snapshots | low | update strings |
| `tests/acp-client.test.ts` | options + redact | medium | Pi fixtures, no Grok metadata |
| `tests/acp-turn.test.ts` | auth preference | low | Pi unavailable message |
| `tests/engine.test.ts` | optional two-turn | low | Pi analog of Grok session test if needed |
| `src/ui/` | none if label used | low | no Pi payload parsing |
| `package.json` | none | none | do not add adapter dep |

## Testing and Evidence

### Unit Tests

- `PROVIDERS` includes `pi`; unknown agents still fail.
- Setup profile: destination `.agents/skills`, models `[]`, default `auto`, label `Pi`.
- `isCuratedSetupModel("pi", "x")` false except `auto`.
- Launch: command `npx`, args `["--yes", "@automatalabs/pi-acp"]`, `env {}`, no normalizer, `stderrPolicy: "redact"`, auth methods `["pi-stored-credentials"]`.
- `providerLabel("pi") === "Pi"`.
- Exec certification false; `resolvePacketProviderLaunch` succeeds; `resolveExecProviderLaunch` throws.
- Auto-on-switch helper true for `grok` and `pi` only.

### Integration Tests

- Non-interactive `setup --agent pi` writes provider Pi, model auto, destination `.agents/skills`.
- `--model` other than auto rejected for Pi setup.
- Saved Pi rerun reuses intent.
- `--provider pi` from Codex config yields model/reasoning `auto` unless flags supplied.
- Explicit `--provider pi --model <id> --reasoning high` keeps those values on the run config.
- Auth: advertised `pi-stored-credentials` selected; none advertised → unavailable message; no env key copy.
- Auto model/reasoning emit `default`; explicit advertised values `applied`; missing required option fails; bad value fails; speed unsupported non-fatal.
- Stderr redact: one generic line, no raw text.
- Two-turn implement+report share one session (engine or acp-client, Grok analog).
- `.pi/skills` not in setup targets; leftover path not migrated.

### End-to-End or Platform Evidence

One redacted live packet in this workspace (PRD M-01–M-03), recorded on issue #15:

- Setup or `--provider pi` with stored Pi credentials.
- Two-turn implementation + report handoff.
- Auto defaults.
- One explicit model or reasoning apply-or-fail.
- Missing-auth failure path.
- Redacted stderr.
- Advertised close + bounded cleanup.
- No secrets in config, reports, logs, fixtures.
- Record host OS, `pi` version if present, and resolved `@automatalabs/pi-acp` version.

Fixtures may merge before the live packet.
The packet is the done bar, not a substitute for tests.

### Verification Gates

- Focused: `bun test tests/providers.test.ts tests/setup-profile.test.ts tests/commands.test.ts tests/cli.test.ts tests/acp-client.test.ts tests/acp-turn.test.ts tests/setup.test.ts tests/config.test.ts`
- Repository: `bun run verify`

## Observability

- Existing `runtime_option` events for applied/default/unsupported.
- Activity: ACP initialized with adapter title/name, not raw protocol dumps.
- Stderr: redacted generic line only.
- Auth failures: user-facing Pi message, no method payload dump.
- Success: packet completion + cleanup event as today.
- No new metrics or alerts.

## Development Sequencing

1. Registries: `PROVIDERS`, setup profile, `SKILL_TARGETS`, `providerLabel`, help grammar, exhaustive tests. No dependencies.
2. Frozen launch recipe, Pi auth preference, exec `false`, providers tests. Depends on step 1 because the enum must include `pi`.
3. Auto-on-switch for setup and `--provider pi`. Depends on step 1 for the Pi id.
4. `acp-client` runtime-option policy + Pi fixtures (auth, apply-or-fail, redact, two-turn). Depends on step 2 for launch/auth shape.
5. README packet-only prerequisites (tested pair placeholder until live). Depends on steps 1–4 for the contract to document.
6. `bun run verify`. Depends on steps 1–5.
7. Live redacted packet on issue #15; fill README versions. Depends on step 6 so the shipped code is what was probed.

External prerequisite: operator already has Pi stored credentials for the live packet.
Parallelizable: step 3 can overlap step 2 after step 1.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Unpinned adapter ≠ 0.4.0 probe | npm 0.6.1 vs issue #15 | First npx may differ | Live packet pair; pin only if packet fails; implementer |
| In-process adapter children vs 5s cleanup | issue #15 residual risk | leftover processes on crash | advertised close first; same class as other forks |
| No live 0.6.1 initialize in this design session | research limitation | auth ads assumed from README | live packet confirms `pi-stored-credentials` |
| `off` / `minimal` thinking not in `REASONING_VALUES` | PRD non-goal | cannot request those levels except via `auto` | reopen PRD if operators need them |
| Exec still false | PRD F-05 | `exec --provider pi` fails | later certification packet |

## Architecture Decision Records

- [ADR-001: Packet-only Pi provider](adrs/adr-001-packet-only-pi-provider.md) - Product: packet-only Pi for existing local operators.
- [ADR-002: Registry-only Pi ACP integration](adrs/adr-002-registry-only-pi-acp-integration.md) - Design: extend Grok seams; unpinned AutomataLabs npx; required model/reasoning; auto-on-switch; redact; exec false.
