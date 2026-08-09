---
id: ADR-003
title: Command-owned retained failure-review lifecycle
status: accepted
date: 2026-08-08
deciders:
  - Product owner
  - Spec Finder maintainers
---

# ADR-003: Command-owned retained failure-review lifecycle

## Context

ADR-001 establishes failure-only cockpit diagnostics and ADR-002 makes failure
review the default release behavior. The cockpit currently owns renderer teardown
alongside keyboard handling, while commands close it unconditionally once a run
settles. That prevents an operator from reliably inspecting a terminal failure.

Single-packet and aggregate batch commands share the cockpit and both need the
same failure-review behavior. Cancellation must remain an immediate escape path,
and non-interactive invocations must never wait for input.

## Decision

The command layer owns the retained-failure lifecycle. `startCockpit` returns an
idempotent cockpit session with `close()` and `waitForDismissal()`. The UI only
requests cancellation or dismissal through callbacks; it does not destroy the
renderer directly.

An eligible interactive command awaits dismissal only after a terminal failure
that was not caused by cancellation. This applies to both single-packet and
aggregate batch failures. Command-owned cancellation aborts the active controller
and closes the session immediately. Non-interactive commands, including `--no-ui`
and invocations without both stdin and stdout TTYs, keep their existing nonzero
failure return without waiting.

The cockpit store captures the full surfaced failure message from existing task
activity events. No public runtime event type is added.

## Consequences

- Command and UI teardown responsibilities are explicit and testable.
- Both supported interactive run modes have consistent retained-failure review.
- Existing event producers and consumers remain compatible.
- Session lifecycle tests and a real-PTY smoke gate are required to protect
  dismissal, cancellation, and non-interactive behavior.

## Alternatives considered

### UI-owned lifecycle

Rejected because renderer destruction and terminal exit semantics would remain
coupled to React keyboard handlers, making command cancellation and failure
waiting race-prone.

### New failure-review runtime events

Rejected because existing failed task activity already carries the surfaced error
message; expanding the event contract adds compatibility cost without a product
need.

