# Workflow Memory

## Current State

- Packet `pi-acp-provider` task_01 through task_05 implemented.

## Shared Decisions

- Pi is a packet-only provider: launch `npx --yes @automatalabs/pi-acp`, empty env, `pi-stored-credentials`, redact stderr, exec false.
- Auto-on-switch uses `defaultsRuntimeToAutoOnProviderSwitch` for `grok` and `pi`.
- Runtime options: model required, reasoning required, speed optional; no Pi metadata normalizer.
- Live-tested pair (2026-08-27): `pi 0.84.3` and `@automatalabs/pi-acp` 0.6.1 on Darwin 25.6.0 arm64. Not a user-config pin.

## Shared Learnings

- `SKILL_TARGETS` must include `pi` when the enum gains it.
- `findConfigOption` matches Pi reasoning via `category: "thought_level"`.
- Empty HOME still lets the adapter initialize; missing advertised `pi-stored-credentials` is the fail-closed fixture path.

## Open Risks

- Unpinned npx can resolve a newer adapter than 0.6.1.
- Empty-HOME live missing-auth produced `Internal error` rather than the unavailable retry message.

## Handoffs

- None. Packet complete.
