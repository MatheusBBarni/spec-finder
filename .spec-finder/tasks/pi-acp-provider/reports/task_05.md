# Task 05 Final Report: Record live Pi packet evidence

## Outcome

- Verdict: completed
- Date: 2026-08-27
- Provider/session: manual sf-batch-tasks / sf-execute-task; live packet used `--provider pi` in a disposable workspace

## Changes

- `README.md` — Replaced the tested-pair placeholder with `pi 0.84.3` and `@automatalabs/pi-acp` 0.6.1 on Darwin 25.6.0 arm64.
- GitHub issue #15 — Redacted live evidence comment: https://github.com/MatheusBBarni/spec-finder/issues/15#issuecomment-5446879231

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Attempt one redacted live Pi packet with two-turn handoff, auto defaults, close/cleanup, no secrets (M-01, M-03, F-02). | Satisfied | Disposable `--no-ui --provider pi` packet completed: implementation then `final report handoff starting in active ACP session`, `ok: 1 task completed`. Stderr redacted. Probe config has `model/reasoning/speed: auto` and no secrets. |
| 2. Attempt missing-auth failure before useful work (M-02, G-03). Explicit apply-or-fail when credentials exist (F-03). | Satisfied | Empty-HOME run initialized then failed with `Internal error` before useful work (exit 1). Explicit `--model anthropic/claude-sonnet-4 --reasoning high` failed before prompt: `model anthropic/claude-sonnet-4 is not an advertised configuration value`. Advertised-method unavailable message remains fixture-covered. |
| 3. Record host OS, adapter version, and `pi` version on issue #15; replace README placeholder on success (G-05). | Satisfied | Issue comment and README: Darwin 25.6.0 arm64, `pi 0.84.3`, `@automatalabs/pi-acp` 0.6.1. No user-config pin. |
| 4. Do not persist, print, or fixture credential values. | Satisfied | Probe config/stdout/report contain no secrets. Issue comment has no secrets. Credential files were not read into this repository. |
| 5. If live Pi cannot run, document skip and still pass the automated gate. | Not applicable | Live packet succeeded. Automated gate still passed. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| Live `--provider pi` auto packet | pass | stdout: `final report handoff starting in active ACP session` then `ok: 1 task completed` |
| Live explicit model apply-or-fail | pass | `model anthropic/claude-sonnet-4 is not an advertised configuration value` |
| Empty-HOME missing-auth attempt | pass (failed before useful work) | exit 1, `Internal error` after initialize; no completed task |
| Secret review of probe config/stdout/report | pass | no credential values |
| `bun test tests/cli.test.ts` | pass | 6 pass, 0 fail |
| `bun run verify` | pass | `tsc --noEmit`; 407 pass, 0 fail, 2373 expects; `bun build` wrote `dist/cli.js` |

## Risks and Follow-ups

- Empty-HOME live missing-auth did not emit `Pi authentication unavailable...` because the adapter still initialized. Fixture coverage of missing advertised `pi-stored-credentials` is unchanged.
- Unpinned npx can resolve a newer adapter than 0.6.1.

## Final Verdict

Completed: a redacted live Pi packet succeeded with auto defaults and a two-turn handoff, explicit model apply-or-fail was observed, versions were recorded on issue #15 and in README, no secrets were persisted, and the automated gate passed.
