# Testing Rules

- Add or update a Bun test for every behavior change. Match the nearest suite: engine, config, provider, task, transcript, store, or cockpit.
- Test outcomes and error paths, not implementation details. Keep fixtures minimal and deterministic.
- For cockpit changes, assert the rendered OpenTUI frame as well as the state or transcript transformation that drives it.
- Run the smallest relevant test file while iterating. Before handoff, run `bun run verify` and report exact failures rather than claiming success.
- Do not delete or weaken a regression test to accommodate a behavior change without replacing its intended coverage.
