# Task 02 Final Report: Apply Pi session-config policy and ACP fixtures

## Outcome

- Verdict: completed
- Date: 2026-08-27
- Provider/session: manual sf-batch-tasks / sf-execute-task

## Changes

- `src/acp-client.ts` — Pi reasoning is required session-config, matching Grok; speed remains optional; Claude/Cursor launch-time model policy unchanged.
- `tests/acp-client.test.ts` — Pi auto-default, apply-or-fail, missing-reasoning, unsupported-speed, and redact fixtures using standard `model` + `thinkingLevel` (`thought_level`).
- `tests/acp-turn.test.ts` — Missing `pi-stored-credentials` fail-closed; advertised method selected; launch env stays empty of API keys.
- `tests/engine.test.ts` — Implementation and report turns share one Pi process/session.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Pi model and reasoning required; speed optional (F-03, G-01). | Satisfied | Auto fixtures emit `default` with no `session/set_config_option`. Explicit model/`high` emit `applied`. Missing reasoning fails before prompt. Speed `fast` emits `unsupported` and the turn completes. |
| 2. Fail before `session/new` when `pi-stored-credentials` is not advertised (G-03, F-04, US-04). | Satisfied | `tests/acp-turn.test.ts` throws the Pi unavailable message; lifecycle is `["initialize"]`. Advertised method is selected. |
| 3. Implementation and report share one ACP session (F-02, US-02). | Satisfied | Engine Pi fixture: two `session/prompt` lines, one process id, one `test-session`, phases implementation+report. |
| 4. Redact Pi stderr like Grok (ADR-002). | Satisfied | Activity is the generic redacted diagnostic; sentinel text is absent from events. |
| 5. No Pi session-config normalizer; no Claude/Codex/Cursor launch-time change. | Satisfied | Fixtures omit `sessionConfigNormalizer`. Diff is `acp-client.ts` policy plus tests. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `bun test tests/acp-client.test.ts tests/acp-turn.test.ts tests/engine.test.ts tests/providers.test.ts` | pass | 79 pass, 0 fail |
| `bun run verify` | pass | `tsc --noEmit`; 403 pass, 0 fail, 2354 expects; `bun build` wrote `dist/cli.js` |

## Risks and Follow-ups

- Live adapter advertisement of `pi-stored-credentials` and `thinkingLevel` is still task_05 evidence.
- Setup picker, `--provider pi` auto-on-switch, and README remain task_03/task_04.

## Final Verdict

Completed: Pi packet sessions require model and reasoning, treat speed as optional, fail closed on missing stored-credential auth, redact stderr, and keep implementation plus report on one ACP session, with no Pi metadata normalizer.
