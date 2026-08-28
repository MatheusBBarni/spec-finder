# ADR-001: Packet-only Pi provider

## Status

Accepted

## Date

2026-08-28

## Context

Spec Finder currently offers four ACP harnesses: Claude, Codex, Cursor, and Grok Build.
Pi is already used as a coding agent in this workspace, but it is not a setup agent or runtime `--provider`.
Operators who already authenticate with Pi cannot drive Spec Finder packets through that same agent.
They must switch to another harness or leave the cockpit.

Issue #15 asks for Pi as a first-class provider.
Pi itself has no native ACP mode in current releases.
Comparable hosts such as Zed treat Pi as an external agent whose login and billing stay with Pi.
Spec Finder's `exec` path is separately certification-gated and is currently blocked for every provider.

The user confirmed V1 is for existing local Pi operators, not Pi onboarding or CI.
They selected a Grok-shaped packet-only approach: setup, skill copy, packet run, runtime overrides, and fail-closed auth.
`exec`, a setup model catalogue, and first-time Pi login stay out.

## Decision Drivers

- Existing Pi operators need to run packets from the cockpit or `--no-ui` without a second workflow.
- Setup must stay non-authenticating and must not install Pi.
- One provider per setup and runtime remains the product contract.
- `exec` must not gain a new uncertified provider.
- Pi already loads project skills from `.agents/skills` and leftover `.pi/skills`.
- Grok already proved a packet-only fifth-provider shape.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | Closed provider set is `claude`, `codex`, `cursor`, `grok`. | `src/config.ts`, `src/setup-profile.ts`, `src/providers.ts`, `src/cli.tsx` | 2026-08-28 |
| Repository | Setup copies skills and writes config. It does not install or log in a provider. | `README.md`, `src/commands.ts` | 2026-08-28 |
| Repository | Packet `run` is not exec-gated. `exec` is blocked for every provider. | `src/providers.ts`, `src/exec.ts` | 2026-08-28 |
| Repository | Grok is packet-only, `auto` setup models, auth outside Spec Finder. | `README.md`, GitHub issue #9 | 2026-08-28 |
| External | ACP exists so hosts can add agents without a custom workflow language. | https://agentclientprotocol.com/overview/introduction | Accessed 2026-08-28 |
| External | Pi loads `.agents/skills` and `.pi/skills`. It has no built-in permission sandbox. | https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md | Accessed 2026-08-28 |
| External | Zed lists Pi as an external ACP agent. Auth stays with the agent. | https://zed.dev/docs/ai/external-agents | Accessed 2026-08-28 |
| External | A published in-process Pi ACP adapter exists. Latest npm was 0.6.1 when researched, while issue #15 probed 0.4.0. | https://registry.npmjs.org/@automatalabs/pi-acp | 2026-08-28 |
| User decision | V1 solves packet runs for existing Pi operators, not Pi onboarding. | PRD clarification, need | 2026-08-28 |
| User decision | Primary user is a local operator using cockpit or `--no-ui`. | PRD clarification, users | 2026-08-28 |
| User decision | V1 is setup, skill copy, packet run, and runtime overrides. No exec. Setup model is `auto` only. | PRD clarification, capabilities | 2026-08-28 |
| User decision | Missing auth fails at packet start. Setup never logs in. | PRD clarification, auth | 2026-08-28 |
| User decision | Success is one redacted live packet, same bar as Grok. | PRD clarification, success | 2026-08-28 |
| User decision | Selected Grok-shaped packet-only Pi over labels-first and full parity. | PRD approach selection | 2026-08-28 |

## Decision

Add Pi as a packet-only Spec Finder provider for operators who already use Pi.

- Setup offers exactly one additional agent choice, labeled Pi.
- Pi uses the shared `.agents/skills` destination (and `~/.agents/skills` for global scope).
- Operators can run packets with Pi as the configured provider or `--provider pi`.
- Runtime `--model` and `--reasoning` overrides remain available. Setup does not curate Pi's model list. The setup default is `auto`.
- Spec Finder does not install Pi, start `/login`, or store credentials.
- If Pi authentication is missing or unusable, setup may still complete. The packet run fails before useful work with an actionable retry message.
- `spec-finder exec --provider pi` stays unavailable.
- Leftover `.pi/skills` content is user-owned and is not migrated, merged, or deleted.
- Help and README describe the same packet-only contract, including that Pi is not a first-time onboarding path.

## Alternatives Considered

### Labels first, packets later

- **User value:** Docs stay conservative if the ACP adapter is still moving.
- **Costs/risks:** The operator still cannot run packets through Pi.
- **Why not selected:** It does not meet the verified need.

### Full fifth-provider parity

- **User value:** Pi would appear finished in setup, `run`, and `exec`, with a setup model list.
- **Costs/risks:** `exec` is uncertified for every provider. Pi's advertised model list is large and shifting.
- **Why not selected:** The user rejected exec and a setup catalogue for V1.

## Consequences

### Positive

- Existing Pi operators can keep using Pi while Spec Finder still owns task order, permissions, and reports.
- The product shape matches Grok, so operators already know packet-only vs exec.
- Setup stays safe: no login, no credential files, no leftover `.pi/skills` rewrite.

### Negative and trade-offs

- First-time Pi users are not a V1 audience.
- CI and `exec` are not promised.
- Operators pick a specific Pi model only at run time, not in setup.
- The published ACP adapter may differ from the issue #15 probe. README must record the pair used in the live packet rather than treat 0.4.0 as a forever pin.

### Risks and mitigations

- **Adapter drift between the 0.4.0 probe and current npm** - document the tested pair from the live packet. Do not store an adapter version in user config. Revisit if the live packet cannot complete.
- **Operators expect Spec Finder to install or log in Pi** - fail before useful work with a retry message. Keep setup non-authenticating.
- **Credential leakage through logs or reports** - never persist, print, or fixture credential values. Same privacy rule as Grok.
- **Exec users try `--provider pi`** - keep exec blocked and say so in help and README.

## Reversibility

High.
Removing the Pi setup and runtime choice restores the previous four-provider menu.
User-owned `.agents/skills` and `.pi/skills` trees stay in place.
No new user config key is required beyond the existing `provider` field.

## Follow-ups

- Record the redacted live packet and the exact Pi / adapter pair actually used.
- Revisit `exec` only after the existing exec certification path has live evidence.
- Revisit a setup model catalogue only if operators cannot work with `auto` plus run-time `--model`.
- Revisit native `pi acp` only if Earendil ships it.

## References

- GitHub issue #15: https://github.com/MatheusBBarni/spec-finder/issues/15
- GitHub issue #9 (Grok packet-only analog): https://github.com/MatheusBBarni/spec-finder/issues/9
- [ACP introduction](https://agentclientprotocol.com/overview/introduction)
- [Pi skills documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)
- [Zed external agents](https://zed.dev/docs/ai/external-agents)
- npm `@automatalabs/pi-acp` latest 0.6.1 on 2026-08-28
