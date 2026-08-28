# Workflow Memory

## Current State

- Packet `pi-acp-provider` task_01 through task_04 implemented; task_05 still pending.

## Shared Decisions

- TypeScript closed `Record<ProviderName, …>` forces launch recipe and exec-false onto task_01 with the enum.
- Setup usage grammar includes `pi` in help and README; exec help still lists claude/codex/cursor/grok without claiming Pi exec certification.
- Pi launch attaches `createPiAuthMethodPreference()` at resolve time (`methodIds: ["pi-stored-credentials"]`, empty env, `stderrPolicy: "redact"`, no session-config normalizer).
- Auto-on-switch uses `defaultsRuntimeToAutoOnProviderSwitch` for both setup writes and `--provider` overrides (`grok` and `pi` only).
- Pi packet runtime-option policy: model required, reasoning required, speed optional.
- README Pi prerequisites include leftover `.pi/skills` preservation and a tested-pair placeholder for issue #15.

## Shared Learnings

- `SKILL_TARGETS` must include `pi` when the enum gains it.
- `findConfigOption` matches Pi reasoning via `category: "thought_level"`; setter logs use option id `thinkingLevel`.

## Open Risks

- Unpinned `@automatalabs/pi-acp` may differ from the issue #15 0.4.0 probe. Live packet on task_05 records the pair or documents why the placeholder stayed.

## Handoffs

- task_05: attempt one redacted live Pi packet; replace README placeholder on success; never persist secrets.
