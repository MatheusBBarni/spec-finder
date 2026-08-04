# [Feature] Technical Specification

## Executive Summary

State the selected design, how it fits the existing architecture, the primary trade-off, and any approved traceability gap.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository / Official docs / Inference | [Finding] | [Path or URL] | [Version/date] | [Consequence] |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|

Map every PRD goal, story, feature, constraint, and metric.

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|

### Data and Control Flow

Describe normal, failure, cancellation, and recovery paths.

## Implementation Design

### Core Interfaces

Use the repository's language. Keep each example under 20 lines and specify errors, ownership, and compatibility.

### Data Models and Lifecycle

Define entities, validation, ownership, retention, migration, concurrency, and consistency only when applicable.

### External Interfaces

Define method/protocol, request, response, errors, authentication/authorization, retries, idempotency, and compatibility.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|

## Security and Privacy

- Trust boundaries, permissions, secrets, sensitive data, abuse cases, auditability, and fail-closed behavior.

## Compatibility, Migration, and Rollback

- Versioning, schema/config migration, rollout ordering, backward compatibility, rollback trigger, and cleanup.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|

Include direct consumers and dependent tests, not only edit targets.

## Testing and Evidence

### Unit Tests

- Named contracts, inputs, boundaries, and expected outcomes.

### Integration Tests

- Component boundaries, fixtures, environments, and failure scenarios.

### End-to-End or Platform Evidence

- Native platform, packaging, accessibility, performance, security, or manual evidence that unit tests cannot prove.

### Verification Gates

- Exact focused commands and repository-wide gate.

## Observability

- Structured events, metrics, logs, redaction, diagnostic context, alerts, and success/failure signals.

## Development Sequencing

1. [Step] — no dependencies.
2. [Step] — depends on step 1 because [reason].

Include external prerequisites and parallelizable work.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|

## Architecture Decision Records

- [ADR-NNN: Title](adrs/adr-NNN.md) — [Decision summary]
