# ADR-002: Registry-only Pi ACP integration

## Status

Accepted

## Date

2026-08-28

## Context

The approved PRD adds Pi as a packet-only Spec Finder provider for operators who already use Pi.
Grok already occupies the packet-only, `auto` setup, auth-outside-host, `.agents/skills` slot.
Pi has no native ACP mode.
Issue #15 chose `@automatalabs/pi-acp` over svkozak `pi-acp`.
npm latest of that adapter was 0.6.1 when researched.
The issue probed 0.4.0.

Existing seams already isolate provider recipes in `src/providers.ts`, setup policy in `src/setup-profile.ts`, and runtime-option policy in `src/acp-client.ts`.
`providerLabel` currently falls through to `"Grok Build"`.
Switching to Grok already defaults omitted model and reasoning to `auto`.

The user selected a registry-only extension of those seams.
They also locked unpinned `npx --yes @automatalabs/pi-acp`, required model and reasoning session-config, auto defaults on switch to Pi, Grok-style stderr redaction, and one Grok-shaped live packet as completion evidence.

## Decision Drivers

- PRD F-01 through F-07 and G-01 through G-05
- Architecture rule: keep provider-specific behavior behind existing provider and ACP seams
- Do not bump `@agentclientprotocol/sdk` 1.2.1 for this feature
- Do not add a session-config normalizer when the adapter advertises standard `model` and `thought_level` options
- Exec stays uncertified
- Credentials never enter config, launch env, events, or fixtures

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | Closed provider registries and Grok packet-only pattern. | `src/config.ts`, `src/providers.ts`, `src/setup-profile.ts`, `src/acp-client.ts` | current |
| Repository | `providerLabel` returns `"Grok Build"` for any non-Claude/Codex/Cursor id. | `src/providers.ts` | current |
| Repository | Switching to Grok defaults omitted model/reasoning to `auto`. | `src/commands.ts`, `src/setup.ts` | current |
| Official docs | `@automatalabs/pi-acp` is an in-process ACP v1 server. Latest npm 0.6.1. Auth method `pi-stored-credentials`. | npm registry, adapter README | 2026-08-28 |
| User decision | Unpinned `npx --yes @automatalabs/pi-acp`. | TechSpec clarification | 2026-08-28 |
| User decision | Model and reasoning `required`; speed `optional`. | TechSpec clarification | 2026-08-28 |
| User decision | Auto model/reasoning when switching to Pi. | TechSpec clarification | 2026-08-28 |
| User decision | Stderr `redact` like Grok. | TechSpec clarification | 2026-08-28 |
| User decision | One Grok-shaped live packet on issue #15. | TechSpec clarification | 2026-08-28 |
| User decision | Registry-only extension, not a Pi module or generic provider table. | TechSpec approach selection | 2026-08-28 |

## Decision

Integrate Pi by extending the existing provider registries and Grok-shaped branches.

- Add `"pi"` to `PROVIDERS`.
- Setup profile: label `Pi`, destination `.agents/skills`, `models: []`, `defaultModel: "auto"`.
- Launch recipe: `npx --yes @automatalabs/pi-acp`, empty `env`, `authMethod: null`, `authPreference.methodIds: ["pi-stored-credentials"]`, `stderrPolicy: "redact"`, no `sessionConfigNormalizer`.
- `EXEC_PROVIDER_CERTIFICATION.pi.exec = false`.
- Packet runtime-option policy: model `required`, reasoning `required`, speed `optional`. Auto still means provider default.
- When setup or `--provider` switches to Pi, omitted model and reasoning become `auto`. Explicit flags still win.
- `providerLabel("pi")` returns `"Pi"`. It must not fall through to Grok Build.
- No new npm dependency, module, config key, or schema version.
- README records the Pi and adapter pair from the live packet, not a user-config pin.
- Completion evidence is one redacted live packet on issue #15, plus fixture tests.

## Alternatives Considered

### Dedicated Pi adapter module

- **Benefits:** Isolates Pi launch/auth from Grok helpers.
- **Costs/risks:** Extra file and import graph. Grok did not ship that way. Setup and run still need switch-to-auto changes.
- **Why not selected:** User chose the smallest registry extension.

### Generic session-config provider table

- **Benefits:** Less special-casing for a future sixth provider.
- **Costs/risks:** Refactors working Claude/Codex/Cursor/Grok paths.
- **Why not selected:** No PRD need. Higher regression risk.

## Consequences

### Positive

- Pi follows the same files and tests as Grok.
- No SDK bump and no metadata normalizer.
- Switching from Codex/Claude/Grok to Pi does not send a foreign model id.
- Stderr cannot leak adapter or npm text into cockpit events.

### Negative and trade-offs

- Unpinned npx can resolve a newer adapter than the 0.4.0 probe.
- Redacted stderr is less useful for first-run npx debugging.
- `provider === "grok" || provider === "pi"` branches remain, instead of a generic table.

### Risks and mitigations

- **Adapter drift** - live packet records the pair. Stop if that packet cannot complete.
- **`providerLabel` mislabels Pi as Grok Build** - add an explicit Pi branch and a test.
- **Cleanup vs in-process children** - always use advertised `session/close` before the existing 5s process-tree deadline.

## Reversibility and Rollback

High.
Remove the `pi` registry rows, help strings, and switch-to-auto cases.
Existing four-provider configs stay valid.
User-owned skill trees are untouched.

## Implementation Notes

- Do not copy `XAI_API_KEY` or Pi auth files into launch `env`.
- Do not read `~/.pi/agent/auth.json` during setup.
- Do not install to `.pi/skills`.
- Do not extend `REASONING_VALUES` with `off` or `minimal`.
- Do not change cockpit components to parse Pi payloads.
- Auth unavailable message: `Pi authentication unavailable. Run \`pi\` and \`/login\`, or set the provider API key, then rerun.`

## Follow-ups

- Record the redacted live packet and versions on issue #15.
- Revisit exec only after the existing exec certification path has live evidence.
- Revisit a version pin in launch args only if unpinned npx cannot complete the live packet.

## References

- [ADR-001: Packet-only Pi provider](adr-001-packet-only-pi-provider.md)
- `_prd.md`
- GitHub issue #15
- GitHub issue #9
