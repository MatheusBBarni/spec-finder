# Pi as a packet-only ACP provider Product Requirements Document

## Overview

Spec Finder cannot run task packets through Pi today.
The closed provider set is Claude, Codex, Cursor, and Grok Build.
Operators who already use Pi in this workspace must switch harnesses or leave the cockpit.

V1 adds Pi as a packet-only provider for those operators.
They can choose Pi in setup, get Spec Finder skills in `.agents/skills`, and run packets from the cockpit or `--no-ui`.
Spec Finder still owns task order, lifecycle, permissions, and reports.
Pi remains the coding agent.
Setup does not install Pi or log anyone in.
Missing credentials fail before useful packet work, with a retry message.
`exec` stays unavailable.
Setup does not curate Pi's model list.

This is the Grok-shaped approach in [ADR-001](adrs/adr-001-packet-only-pi-provider.md).

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | Provider menu, setup picker, help, and config accept only `claude`, `codex`, `cursor`, `grok`. | `src/config.ts`, `src/setup-profile.ts`, `src/providers.ts`, `src/cli.tsx` | 2026-08-28 | Pi is not selectable. |
| Repository | Setup copies skills and writes config. It does not install or authenticate a provider. | `README.md`, `src/commands.ts` | 2026-08-28 | Pi setup must follow the same boundary. |
| Repository | Packet `run` is available once a provider can launch. `exec` is blocked for every provider. | `src/providers.ts`, `src/exec.ts` | 2026-08-28 | Packet-only Pi matches the current exec freeze. |
| Repository | Grok is packet-only, `auto` in setup, auth outside Spec Finder, leftover Cursor skills not migrated. | `README.md`, issue #9 | 2026-08-28 | Reuse that product shape for Pi. |
| External | ACP lets a host add agents without a custom per-agent workflow. | [ACP introduction](https://agentclientprotocol.com/overview/introduction) | Accessed 2026-08-28 | Pi should appear as another harness, not a new Spec Finder mode. |
| External | Pi loads project skills from `.agents/skills` and `.pi/skills`, and user skills from `~/.agents/skills` and `~/.pi/agent/skills`. | [Pi skills docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md) | Accessed 2026-08-28 | `.agents/skills` is a truthful destination. Do not invent a `.pi/skills` install path. |
| External | Pi has no built-in permission sandbox. | [Pi README](https://github.com/earendil-works/pi) | Accessed 2026-08-28 | Spec Finder keeps permission policy. |
| External | Zed lists Pi as an external ACP agent. Login stays with the agent. | [Zed External Agents](https://zed.dev/docs/ai/external-agents) | Accessed 2026-08-28 | Spec Finder should not host Pi login. |
| External | A published Pi ACP adapter exists. Issue #15 probed 0.4.0 on 2026-08-13. npm latest was 0.6.1 on 2026-08-28. | [npm `@automatalabs/pi-acp`](https://registry.npmjs.org/@automatalabs/pi-acp), issue #15 | 2026-08-28 | Docs must record the live-packet pair, not freeze 0.4.0 in user config. |
| External | The Zed-centered `pi-acp` adapter uses terminal login and expects `pi` on PATH. | [svkozak/pi-acp](https://github.com/svkozak/pi-acp) | Accessed 2026-08-28 | Unusable for Spec Finder setup, cockpit, and `--no-ui`. |
| User decision | V1 is for existing local Pi operators running packets, not onboarding or CI. | PRD clarification | 2026-08-28 | Scope stays packet-only. |
| User decision | Success is one redacted live packet, same bar as Grok. | PRD clarification | 2026-08-28 | No adoption telemetry. |
| Inference | Demand is operator-driven in this workspace. There is no Spec Finder usage data for a fifth provider. | Synthesis | 2026-08-28 | Do not build exec, CI, or a model catalogue on unproven demand. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Let existing Pi operators run Spec Finder packets through Pi. | One redacted live packet completes from the cockpit or `--no-ui` with provider Pi. |
| G-02 | Make Pi a truthful setup choice, including where skills land. | A completed Pi setup names provider Pi and destination `.agents/skills` (or `~/.agents/skills` for global). |
| G-03 | Keep authentication outside Spec Finder, with a clear failure when Pi is unusable. | A packet with missing or unusable Pi auth fails before useful work and tells the operator to run `pi` `/login` or set a provider API key, then rerun. |
| G-04 | Preserve the current one-provider contract and the exec freeze. | Claude, Codex, Cursor, and Grok still work. `exec` with Pi is refused. |
| G-05 | Make the packet-only Pi contract discoverable. | Help and README describe the same Pi prerequisites, packet-only status, and skill path. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Local Pi operator | As an operator who already uses Pi, I want to choose Pi in setup so that this repo's skills and runtime provider match the agent I already run. | Setup summary shows Pi and `.agents/skills`. |
| US-02 | Local Pi operator | As that operator, I want to run a packet from the cockpit or `--no-ui` through Pi so that I do not switch harnesses to use Spec Finder. | One packet run completes with provider Pi and no packet-lifecycle change for other providers. |
| US-03 | Local Pi operator | As that operator, I want `--provider pi` plus optional `--model` and `--reasoning` so that a one-off run can use Pi without a permanent setup change, and an explicit model or reasoning choice is applied or clearly refused. | Runtime overrides are visible in the run outcome. Unsupported speed stays non-fatal. |
| US-04 | Local Pi operator | As that operator, I want a clear stop when Pi is not authenticated so that I know to log in outside Spec Finder instead of waiting on a cockpit login. | The run fails before useful work with a retry message. No credential value is stored. |
| US-05 | Existing Pi user with `.pi/skills` | As an operator with leftover `.pi/skills`, I want setup to leave that tree alone so that adopting `.agents/skills` does not move or delete my files. | Outcome does not claim a `.pi/skills` migration. |
| US-06 | Exec user | As someone using `spec-finder exec`, I want Pi to stay unavailable until that path is actually certified so that help does not over-claim. | `exec --provider pi` is refused. |
| US-07 | Existing Claude/Codex/Cursor/Grok user | As a user of another provider, I want adding Pi to leave my setup and packet journeys unchanged. | Those providers remain selectable and documented. |

## Core Features

### F-01: Pi as a setup agent

- **User value:** One setup decision maps this repo to the Pi the operator already uses.
- **Mapped goals/stories:** G-02, G-05; US-01, US-05, US-07
- **MUST:** Offer Pi as exactly one additional single-select setup agent. Derive destination `.agents/skills` (local) or `~/.agents/skills` (global). Default setup model to `auto`. Do not present a Pi model catalogue. Do not install Pi. Do not log in. Do not read or copy credential files.
- **SHOULD:** Use the label `Pi` and a hint that skills go in `.agents/skills`, matching the other picker rows.
- **Acceptance conditions:** `spec-finder setup --agent pi` and the interactive picker can complete with provider Pi. The summary names provider, `auto` model, destination, and scope. Cancellation still does not claim success.

### F-02: Packet runs through Pi

- **User value:** The operator can execute Spec Finder work with Pi as the coding agent.
- **Mapped goals/stories:** G-01, G-04; US-02, US-07
- **MUST:** Let a configured Pi workspace run packets from the cockpit and `--no-ui`. Implementation and final-report turns of a task share one Pi session, as they do for other providers. Spec Finder still owns ordering, permissions, cancellation, and reports.
- **SHOULD:** Show Pi in the cockpit as the effective provider using the existing observational chrome, not a Pi-specific control panel.
- **Acceptance conditions:** `spec-finder run <slug>` and `spec-finder run <slug> --no-ui` can complete a packet with provider Pi. Other providers' packet journeys remain available.

### F-03: Runtime provider and option overrides

- **User value:** A one-off run can use Pi, or an explicit model/reasoning, without pretending every option is supported.
- **Mapped goals/stories:** G-01; US-03
- **MUST:** Accept `--provider pi`. Leave `auto` model and reasoning to Pi's defaults. Apply an explicit model or reasoning, or fail clearly if Pi cannot apply it. Treat speed as optional. If Pi does not support the requested speed, continue and say so.
- **SHOULD:** Keep the same override grammar as other providers.
- **Acceptance conditions:** A run with `--provider pi --model <id> --reasoning high` either applies those choices or fails with a clear reason before useful work. A requested speed that Pi does not support does not abort the packet by itself.

### F-04: Fail-closed Pi authentication

- **User value:** Operators are not stranded in a login UI Spec Finder does not host.
- **Mapped goals/stories:** G-03; US-04
- **MUST:** Allow Pi setup without credentials. If a packet cannot authenticate to Pi, fail before useful work. Tell the operator to run `pi` and `/login`, or set a provider API key, then rerun. Never store, print, or fixture credential values.
- **SHOULD:** Use one actionable message for both missing stored credentials and an unusable key.
- **Acceptance conditions:** A packet with no usable Pi auth does not create a successful task completion. Config, reports, logs, and fixtures contain no secret values.

### F-05: Packet-only honesty

- **User value:** Help matches what actually runs.
- **Mapped goals/stories:** G-04, G-05; US-06
- **MUST:** Keep `spec-finder exec --provider pi` unavailable. README and CLI help say Pi is packet-only until a later exec certification. Name that Spec Finder does not install Pi.
- **SHOULD:** Record the Pi and ACP-adapter pair used in the live packet, in the same style as Grok's README note.
- **Acceptance conditions:** Exec with Pi is refused before a provider starts. Docs do not claim exec or first-time Pi onboarding.

### F-06: Leftover `.pi/skills` preservation

- **User value:** Adopting the shared `.agents` destination does not rewrite Pi-only skill trees.
- **Mapped goals/stories:** G-02; US-05
- **MUST:** Install managed Spec Finder skills only to the Pi destination `.agents/skills` (or `~/.agents/skills`). Leave `.pi/skills` and `~/.pi/agent/skills` untouched. Do not migrate, merge, or delete them.
- **SHOULD:** Document that `.pi/skills` is leftover user content, same idea as leftover `.cursor/skills`.
- **Acceptance conditions:** A workspace that already has `.pi/skills` can complete Pi setup with that tree unchanged.

### F-07: Consistent Pi guidance

- **User value:** Interactive, `--no-ui`, and README users get one contract.
- **Mapped goals/stories:** G-05; US-01, US-06, US-07
- **MUST:** Add Pi to setup help, runtime `--provider` grammar, the provider table, and README prerequisites. State packet-only status, auth-outside-Spec-Finder, `.agents/skills`, and no `.pi/skills` migration.
- **SHOULD:** Warn that the published ACP adapter can move, and that the README pair is what was tested, not a compatibility promise for later adapter releases.
- **Acceptance conditions:** Help examples and README tables include Pi and still list Claude, Codex, Cursor, and Grok.

## User Experience

An operator who already ran `pi` `/login` runs `spec-finder setup`, chooses Pi, sees skills in `.agents/skills`, leaves model at `auto`, and gets a summary with provider Pi.

They run a packet from the cockpit or `--no-ui`.
The cockpit shows Pi as the provider through existing chrome.
Task implementation and the final report happen in one Pi session.
Permissions, cancel, and reports behave as they do for other providers.

If they pass `--provider pi` on a repo still configured for Grok, that run uses Pi.
Explicit `--model` or `--reasoning` is applied or the run stops with a clear reason.
Unsupported speed is reported and the run continues.

If Pi has no usable credentials, setup can still succeed.
The packet run stops before useful work and tells them to authenticate outside Spec Finder, then rerun.

If they try `spec-finder exec --provider pi`, the command is refused.
If they have `.pi/skills`, those files stay put.

Keyboard setup navigation, confirmation, and cancel stay the same single-select flow.
Empty, loading, success, and failure states use the existing cockpit and `--no-ui` contracts.
Meaning is not carried by color alone.

## High-Level Constraints

- One provider per setup and per runtime config.
- Setup does not launch Pi, install Pi, or inspect credential files to decide success.
- Credentials never enter `.spec-finder/config.json`, packets, logs, reports, or fixtures.
- Spec Finder does not host terminal login.
- Packet support does not imply exec support.
- User config does not pin an ACP adapter version.
- Leftover `.pi/skills` is user-owned.
- Compatibility claim is the live-packet pair, not every future Pi or adapter release.
- Accessibility: setup remains keyboard-operable. `--no-ui` remains usable without the cockpit.

## Non-Goals

- **First-time Pi onboarding** - V1 is for operators who already use Pi. Reconsider if Spec Finder starts acquiring users who only know Pi through this CLI.
- **CI or unattended Pi packets as a promised surface** - no evidence those runs are required for V1. Reconsider with a dedicated unattended failure budget.
- **`spec-finder exec --provider pi`** - exec is frozen for every provider. Reconsider only after exec certification has live evidence.
- **A setup catalogue of Pi models** - Pi advertises a large shifting list. Reconsider if `auto` plus `--model` is not enough.
- **Native `pi acp`** - current Pi has RPC and JSON modes, not ACP. Reconsider if Earendil ships it.
- **Shipping the Zed-centered `pi-acp` adapter** - terminal login and no session close. Reconsider only if the chosen adapter is unmaintained and no native Pi ACP exists.
- **Migrating `.pi/skills` into `.agents/skills`** - user-owned content. Reconsider only with an explicit recovery story.
- **Pi-specific cockpit controls or Pi RPC in the UI** - cockpit stays observational.
- **Storing Pi session files under `.spec-finder/`** - Pi already owns its sessions.
- **Extending Spec Finder reasoning values with Pi's `off` / `minimal` in V1** - `auto` uses Pi's default. Reconsider if operators cannot express the thinking they need.
- **Usage telemetry** - no collection contract.

## Phased Rollout Plan

### MVP

- Pi is selectable in setup and as `--provider pi`.
- Skills install to `.agents/skills` / `~/.agents/skills`.
- Packet runs work from the cockpit and `--no-ui` for an already-authenticated local operator.
- Missing auth fails before useful work.
- Exec stays blocked.
- README and help describe packet-only Pi and the tested pair from the live packet.

Entry: approach A accepted, this PRD approved.
Exit: one redacted live packet in this workspace meets M-01 through M-03, and other providers still complete their documented setup/run journeys.

### Later phases

- **Exec for Pi** - promote only after the existing exec certification path has live evidence for Pi.
- **Setup model catalogue** - promote only if operators cannot work with `auto` and `--model`.
- **Native `pi acp`** - promote only if Earendil ships it and it meets the packet contract without a third-party adapter.
- **CI / unattended** - promote only with explicit unattended auth and failure evidence.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | Redacted live Pi packet | 0 Pi packet runs in Spec Finder | 1 completed packet (cockpit or `--no-ui`) with provider Pi | Manual live packet in this workspace, redacted evidence on issue #15 | Implementation of this packet |
| M-02 | Missing-auth failure | No Pi auth path | 1 observed failure before useful work, with retry guidance and no successful task completion | Manual run without usable Pi credentials, or equivalent live check recorded with the packet | Same window |
| M-03 | Credential leakage | Grok rule: no secrets in config, logs, reports, fixtures | 0 credential values in those artifacts during the live packet and auth-failure check | Review of config, reports, logs, and fixtures used in validation | Same window |
| M-04 | Other providers unchanged | Claude, Codex, Cursor, Grok remain the supported set | Those four remain selectable. Their documented setup/run journeys still complete | Existing provider setup/run coverage plus README/help still listing them | Same window |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Published Pi ACP adapter differs from the issue #15 0.4.0 probe | npm 0.6.1 on 2026-08-28 vs probe 2026-08-13 | High / medium | Record the pair actually used in the live packet. Do not pin a version in user config. Stop and revisit the PRD if a packet cannot complete. | Implementer; trigger: live packet cannot complete |
| Operators expect Spec Finder to install or log in Pi | Zed and Grok keep auth with the agent. Setup never logs in. | Medium / medium | Fail before useful work. Document prerequisites. Do not add setup-time auth inspection. | Docs + runtime message |
| Exec users assume Pi works in `exec` | Help currently lists grok in exec grammar while exec is blocked | Medium / low | Keep Pi exec unavailable. Say packet-only in help and README. | Help/README review |
| Leftover `.pi/skills` confuses skill discovery | Pi loads both `.agents/skills` and `.pi/skills` | Low / low | Install only to `.agents/skills`. Document leftover `.pi/skills` as untouched. | Setup + README |
| Credential leakage | Grok required the same rule | Low / high | Never persist or print secrets. Include M-03 in the live check. | Implementer |

## Architecture Decision Records

- [ADR-001: Packet-only Pi provider](adrs/adr-001-packet-only-pi-provider.md) - Add Pi as a Grok-shaped packet-only provider for existing local Pi operators.

## Research Limitations

- This session did not re-probe a live ACP initialize against adapter 0.6.1.
- Issue #15's probe is 0.4.0 on 2026-08-13. Adapter auth advertisements changed by 0.6.1 (single `pi-stored-credentials` method).
- No Spec Finder usage telemetry exists for Pi demand.
- ACP public docs are editor-centric (Zed, JetBrains). Spec Finder is a cockpit, not an IDE.
- Issue #15 has no comment thread beyond the frozen implementation request.

## Open Questions

- Which exact Pi and ACP-adapter versions will the live packet record? Non-blocking for this PRD. The README pair follows that packet, not the 0.4.0 probe by default.
- When, if ever, to certify Pi for `exec`. Blocked on the existing exec certification path.
- Whether operators will need Pi thinking levels `off` / `minimal` as first-class Spec Finder values. V1 uses `auto` and the current reasoning list.
