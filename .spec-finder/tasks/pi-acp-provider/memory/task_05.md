# Task Memory: task_05

## Objective Snapshot

Record redacted live Pi packet evidence on issue #15, or document why the environment cannot run it.

## Important Decisions

- Used a disposable `/tmp` workspace so the live packet could not recurse into this packet.
- Replaced the README tested-pair placeholder after the live packet succeeded: `pi 0.84.3` + `@automatalabs/pi-acp` 0.6.1 on Darwin 25.6.0 arm64.
- Did not pin the adapter in user config.
- Empty-HOME missing-auth still initialized the adapter, then failed with `Internal error` before useful work. The source-owned unavailable message remains fixture-covered.

## Learnings

- Live `--provider pi` auto packet completed with implementation then report handoff in one session.
- Explicit `anthropic/claude-sonnet-4` is not advertised by this adapter pair and fails before prompt.

## Files / Surfaces

- `README.md` tested-pair paragraph
- GitHub issue #15 comment

## Errors / Corrections

- None in repository code. Missing-auth live path did not emit the unavailable message because initialize still succeeded without stored credentials.

## Ready for Next Run

- Packet complete. No further tasks.
