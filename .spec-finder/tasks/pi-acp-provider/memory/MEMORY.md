# Workflow Memory

## Current State

- Packet `pi-acp-provider` task_01 through task_03 implemented; task_04 and task_05 still pending.

## Shared Decisions

- TypeScript closed `Record<ProviderName, …>` forces launch recipe and exec-false onto task_01 with the enum.
- `tests/cli.test.ts` shares setup usage between help and README; task_03 updated that line to include `pi`; task_04 owns the full Pi README section.
- Pi launch attaches `createPiAuthMethodPreference()` at resolve time (`methodIds: ["pi-stored-credentials"]`, empty env, `stderrPolicy: "redact"`, no session-config normalizer).
- Auto-on-switch uses `defaultsRuntimeToAutoOnProviderSwitch` for both setup writes and `--provider` overrides (`grok` and `pi` only).
- Pi packet runtime-option policy: model required, reasoning required, speed optional. Standard `thinkingLevel` / `thought_level` advertisements; no Pi metadata normalizer.
- Exec help grammar still lists claude/codex/cursor/grok and does not claim Pi exec certification.

## Shared Learnings

- `SKILL_TARGETS` must include `pi` when the enum gains it; setup `isSkillTarget` would otherwise reject Pi installs even though destination comes from the profile.
- `findConfigOption` matches Pi reasoning via `category: "thought_level"`; setter logs use option id `thinkingLevel`.

## Open Risks

- Unpinned `@automatalabs/pi-acp` may differ from the issue #15 0.4.0 probe. Live packet on task_05 records the pair.

## Handoffs

- task_04: document packet-only Pi, leftover `.pi/skills`, exec unavailable, tested-pair placeholder.
- task_05: live evidence after docs exist.
