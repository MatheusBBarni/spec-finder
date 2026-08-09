# npm Release Automation Technical Specification

## Executive Summary

A `main`-only, manually dispatched GitHub Actions workflow will release `spec-finder` through small, Bun-tested repository helpers. It validates the reviewed `package.json` version and packed contents before mutation; publishes via npm trusted publishing; then creates the exact version tag, generated GitHub Release with installer guidance, and Ubuntu/Windows clean-install proof.

The trade-off is a small release-helper layer, in return for deterministic no-publish tests and safe reconciliation of partial releases. The installed CLI, ACP engine, and config remain unchanged.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | `package.json` owns version, package contents, and `bun run verify`. | `package.json` | 2026-08-08 | The checked-out `main` version is authoritative; existing verification is mandatory. |
| Repository | `version`, `setup`, and `upgrade` are existing product commands. | `src/commands.ts` | 2026-08-08 | Release code stays outside `src/cli.tsx` and `src/commands.ts`. |
| Official docs | npm trusted publishing requires GitHub-hosted Actions and `id-token: write`. | https://docs.npmjs.com/trusted-publishers/ | 2026-06-04 | Publish runs in a dedicated least-privilege job, without a long-lived npm token. |
| Official docs | `npm pack` reports the package file set. | https://docs.npmjs.com/cli/v11/commands/npm-pack | 2026-08-08 | Preflight rejects unexpected packed paths before publication. |
| Official docs | GitHub generated notes can require a pre-existing tag. | https://cli.github.com/manual/gh_release_create | 2026-08-08 | Create and verify the exact tag before creating the release. |
| User decision | Stable releases source only from `main`; reconciliation is explicit. | TechSpec clarification and approach selection | 2026-08-08 | The workflow rejects non-`main` invocations and never republishes in reconciliation mode. |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| G-01, F-03 | One version across npm, tag, release, notes, and smoke evidence. | Candidate/state helpers and release workflow | Unit state tests; workflow release/reconcile evidence | Covered |
| G-02, US-01, F-01 | Manual workflow dispatch from `main` only. | `release.yml` dispatch and candidate validator | Workflow review and dispatch validation tests | Covered |
| G-03, US-03, F-04 | Plain-text result summary with artifacts and recovery state. | Summary formatter and final workflow job | Helper unit tests and job-summary inspection | Covered |
| G-04, US-04, F-05 | Generated GitHub notes contain package/install/upgrade guidance. | Release-note footer helper and release metadata job | Footer tests and live-release review | Covered |
| G-05, US-05, F-06 | Deterministic no-publish validation plus Ubuntu/Windows smoke. | `release:check`, smoke workflow matrix | Local command and workflow matrix | Covered |
| US-02, F-02 | Candidate blocks before remote mutation with remediation. | Candidate validator and preflight job | Fixture-driven helper tests | Covered |
| US-06, F-07 | Explicit partial-state classification and reconcile path. | State classifier, runbook, workflow mode | Reconciliation fixture tests and runbook review | Covered |
| Constraints and metrics M-01--M-05 | Stable-only, no telemetry, current CLI compatibility, release evidence. | Workflow guards, README, tests and summary | Live-release review and deterministic validation | Covered; first live release remains an external prerequisite |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| `.github/workflows/release.yml` | New | Manual dispatch, runtime setup, job routing, permissions, concurrency. | Mode input; candidate/state artifacts; job summary. | GitHub-hosted Actions, npm registry, GitHub API. |
| `scripts/release/` | New | Pure candidate validation, packed-path allowlist, state classification, note/footer and summary formatting. | Explicit JSON/arguments; JSON/plain-text results. | Bun standard runtime only. |
| `tests/release*.test.ts` | New | Deterministic no-publish contracts for release helpers. | Fixtures and helper APIs. | Bun test. |
| `package.json` | Modified | Expose no-publish release-validation command. | `release:check` script. | Bun. |
| `README.md` | Modified | Maintainership prerequisites, dispatch path, reconciliation and corrective recovery. | Human-facing instructions. | GitHub and npm account configuration. |

### Data and Control Flow

Normal control flow:

```text
manual dispatch on main
  -> read-only preflight
  -> publish (release mode only)
  -> tag + GitHub Release reconciliation
  -> Ubuntu and Windows clean-install smoke
  -> always-run concise summary
```

The workflow uses a non-cancelling concurrency group so two versions cannot mutate public state concurrently. The checked-out `main` SHA, package name, version, expected tag, packed-file result, and observed remote state are serialized as a workflow artifact; downstream jobs revalidate that artifact before mutation.

Failure paths never silently continue: a preflight failure ends as `blocked` before remote mutation; a post-publish failure is `partial` and directs the maintainer to explicit `reconcile` mode. Cancellation produces a final summary with the last known artifact state; it is never reported as a completed release.

## Implementation Design

### Core Interfaces

`workflow_dispatch` exposes one required input:

```yaml
mode:
  description: "Release a new version or reconcile an existing partial release"
  required: true
  type: choice
  options: [release, reconcile]
```

The workflow rejects unless `github.ref` is `refs/heads/main`, the checked-out SHA is recorded as the release source, `package.json` contains one stable non-prerelease SemVer version, and the expected tag is exactly `v<version>`.

Helpers are Bun-executed TypeScript modules, not user-facing CLI commands. They accept JSON/stdin or explicit arguments and emit JSON/plain text suitable for Actions outputs:

```ts
type ReleaseMode = "release" | "reconcile";

type RemoteState = {
  npm: "absent" | "published" | "mismatch";
  tag: "absent" | "matching" | "mismatch";
  release: "absent" | "matching" | "mismatch";
};

function validateCandidate(input: CandidateInput): CandidateResult;
function validatePackedPaths(paths: string[]): AllowlistResult;
function classifyState(mode: ReleaseMode, state: RemoteState): NextAction;
function formatReleaseFooter(version: string): string;
function formatSummary(input: SummaryInput): string;
```

Helpers must fail closed on malformed JSON, invalid version, unexpected packed path, remote mismatch, or unknown state. They own no network or mutation work, keeping their test execution deterministic.

### Data Models and Lifecycle

The ephemeral candidate artifact is the source of workflow coordination, not a new persistent repository format:

| Field | Owner | Validation | Retention |
|---|---|---|---|
| `name`, `version` | checked-out `package.json` | expected package name and stable SemVer | one workflow run |
| `sourceSha`, `sourceRef` | GitHub Actions context | `main` ref and exact checkout SHA | one workflow run |
| `tag` | candidate helper | exactly `v<version>` | one workflow run |
| `packedPaths` | `npm pack --dry-run --json` | explicit allowlist only | one workflow run |
| `remoteState` | preflight queries | absent, matching, or mismatch for each artifact | refreshed before mutation |
| `smoke` | matrix jobs | one result each for Ubuntu and Windows | one workflow run |

No user configuration, production data schema, or retained telemetry is introduced. Artifact content is public release metadata only and expires under the repository's normal Actions artifact retention policy.

### External Interfaces

| Interface | Operation | Authentication/authorization | Failure/idempotency |
|---|---|---|---|
| npm registry | Read exact version; dry-run pack; publish public package. | Publish job uses trusted-publisher OIDC with `id-token: write`. | `release` accepts only absent exact version; `reconcile` never publishes. |
| Git remote | Read, create, and verify annotated `v<version>` tag. | Metadata job `contents: write`. | Existing matching tag is accepted; a wrong target is a manual mismatch. |
| GitHub Release | Read, create generated notes, update footer. | Metadata job `contents: write`. | Existing matching release is accepted; mismatched release blocks. |
| GitHub Actions | Dispatch from `main`, job artifacts, summary. | Repository maintainer dispatch permission; explicit per-job permissions. | Concurrency prevents overlapping stable-release mutations. |

The workflow must create and verify the exact remote tag before creating the GitHub Release. GitHub generated notes are requested first; the resulting release body is then updated to include a fixed repository-owned footer containing the package URL and documented global install/upgrade commands. The workflow asserts that the completed public body includes both generated content and footer.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| `package.json` | Existing version/files/build/verify contract. | Add `release:check`; do not rewrite version during release. | Invalid identity blocks preflight. | Existing package consumers unchanged. |
| User CLI | `version`, `setup`, `upgrade` are public behavior. | No source or interface change. | Smoke catches distribution regressions. | Fully compatible. |
| GitHub repository | No release workflow or tags today. | Add manual `main` workflow, tagged Releases. | Partial state is explicit. | First release requires trusted-publisher configuration. |
| npm registry | No published package. | Public `spec-finder` stable versions. | Immutable publish failure never retries as success. | Versioned package contract. |
| README | Install and upgrade guidance exists. | Add maintainer release and recovery runbook. | Docs identify manual recovery. | Installer commands unchanged. |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Verification, version, or packed-file failure | Preflight helper or `bun run verify` failure. | `blocked`; no remote mutation. | Fix source on `main`, then dispatch `release`. | Preflight summary and helper tests. |
| npm version exists in `release` mode | Exact npm version query. | `blocked`; never call it a retry. | Inspect state, then use `reconcile` only when exact artifacts match. | State-transition tests. |
| Publish succeeds, tag/release fails | Post-mutation command failure or state refresh. | `partial`; list available package artifact. | Dispatch `reconcile` for same `main` version. | Workflow summary. |
| Tag/release targets wrong SHA/version | Remote-state mismatch. | Fail closed; no force push or automatic overwrite. | Manual correction and documented follow-up. | State-transition tests. |
| One platform smoke fails | Matrix result. | `partial`; no completed-release result. | Fix compatibility issue, then `reconcile` reruns smoke. | Ubuntu/Windows logs and final summary. |
| Defective published package | Maintainer discovers functional defect. | Do not unpublish automatically. | Deprecate exact version, publish corrective version, update Release notes. | README runbook. |
| OIDC/trusted-publisher failure | `npm publish` auth failure. | Publish job fails without token fallback. | Confirm namespace and exact registered workflow path. | Job log and README prerequisites. |

A reconciled release must still be the npm `latest` version before real `upgrade` smoke can be attributed to it. An older partial version after a newer stable release requires manual recovery documentation, not misleading smoke success.

## Security and Privacy

- No long-lived npm publishing token is stored in repository secrets.
- The publish job alone receives `id-token: write`; tag/release metadata receives `contents: write`; preflight and smoke use read-only permissions.
- Every `uses:` action is pinned to a reviewed immutable commit SHA with an adjacent version comment. Floating action tags are prohibited.
- Trusted publishing uses GitHub-hosted runners only.
- Remote state is checked before and after mutations; unexpected state fails closed.
- Logs and summaries include only public version/artifact data. They must not dump tokens, OIDC claims, or environment state.
- The workflow is maintainer-dispatched and `main`-only; contributor PRs cannot trigger publication.

## Compatibility, Migration, and Rollback

Existing user-facing commands and config formats remain unchanged. The only new operator interface is the manual workflow mode.

Before public publication, a failed release is safely repeatable after source correction. After publication, npm versions are immutable: recovery is reconciliation, version-specific deprecation, a corrective version, and GitHub Release metadata updates. The workflow/helper layer can be removed or replaced without changing already-published versions.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `.github/workflows/release.yml` | New public-release orchestration. | High: remote mutation and permissions. | Implement least privilege, `main` guard, concurrency, and summary. |
| `scripts/release/*` | New deterministic release contract. | Medium: incorrect state classification. | Unit-test all accepted/rejected states. |
| `tests/release*.test.ts` | New regression coverage. | Low. | Cover validator, allowlist, formatter, recovery fixtures. |
| `package.json` | New local no-publish command. | Low: script drift. | Keep `verify` unchanged; test command in CI/local validation. |
| `README.md` | New operator runbook. | Medium: unsafe recovery wording. | Document no token fallback, reconcile, deprecate, corrective release. |
| `src/cli.tsx`, `src/commands.ts` | Direct smoke consumers only. | Medium: packaging/platform regression. | Do not modify; prove behavior on both platforms. |

## Testing and Evidence

### Unit Tests

- Stable version parsing and prerelease rejection.
- Exact packed-path allowlist acceptance and rejection.
- `release` and `reconcile` remote-state transition tables.
- Summary language, artifact links, and recovery next actions.
- Release footer package/install/upgrade guidance.
- Malformed input and mismatch fail-closed behavior.

### Integration Tests

- `bun run release:check` runs deterministic helper tests and fixture validation without npm publication, Git tag changes, GitHub Release API calls, or credentials.
- Existing `bun run verify` remains a required preflight command.
- Workflow review confirms `release` cannot reach mutating jobs until preflight emits an accepted candidate artifact.

### End-to-End or Platform Evidence

The live release workflow must demonstrate:

- actual `npm pack --dry-run --json` contents satisfy the allowlist;
- npm package, tag, GitHub Release, and notes resolve to the same version;
- public release body includes generated notes and installer footer;
- isolated Ubuntu and Windows smoke jobs install `spec-finder@<version>` to a temporary global prefix;
- `spec-finder version` reports `<version>`;
- `spec-finder setup` succeeds in a fresh temporary workspace;
- `spec-finder upgrade` succeeds through that isolated prefix.

### Verification Gates

- Focused deterministic gate: `bun run release:check`
- Repository-wide gate: `bun run verify`
- Live platform gate: the release workflow's Ubuntu/Windows clean-install matrix and final summary.

## Observability

Each job writes concise status to the GitHub Actions summary. An always-run final summary combines version/source SHA, mode, result (`complete`, `blocked`, or `partial`), package/tag/release URLs when available, preflight and platform-smoke states, and exactly one explicit next action when recovery is needed.

Structured JSON state artifacts are retained only for the workflow run and used solely to construct the final summary. No telemetry, adoption analytics, or public dashboard is introduced.

## Development Sequencing

1. Add pure release models, validators, fixtures, and Bun tests — no external prerequisites.
2. Add `release:check` and prove local deterministic evidence — depends on step 1.
3. Add maintainer runbook and recovery documentation — depends on the defined state model in step 1.
4. Implement manually dispatched workflow with pinned actions, least-privilege jobs, and candidate artifact handoff — depends on steps 1-2.
5. Add package/tag/release orchestration and generated-note footer — depends on step 4.
6. Add Ubuntu/Windows isolated smoke matrix and always-run summary — depends on step 5.
7. Configure npm trusted publishing for the exact workflow filename, then perform the first live release — external prerequisite after steps 4-6.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| npm namespace/trusted-publisher setup cannot be proved in repository tests. | External configuration. | First publish cannot succeed until configured. | Maintainer verifies exact repo/workflow registration before live release. |
| Exact action commit SHAs change over time. | Action releases evolve. | Floating tags would weaken supply-chain integrity. | Implementation selects reviewed immutable SHAs with version comments. |
| `upgrade` targets `latest`, not arbitrary historical versions. | Existing `upgrade` contract. | Old partial release cannot gain truthful exact-version upgrade proof after a newer release. | Maintainer reconciles before next stable release; otherwise follows manual recovery. |
| No protected branch/environment exists today. | Repository inspection. | Manual dispatch is the only V1 approval boundary. | Reassess after operational evidence; out of MVP scope. |

## Architecture Decision Records

- [ADR-001: Maintainer-dispatched stable npm releases](adrs/adr-001-maintainer-dispatched-stable-npm-releases.md) — stable public-release boundary.
- [ADR-002: Guided stable-release experience](adrs/adr-002-guided-stable-release-experience.md) — maintainer summary, public guidance, and launch proof.
- [ADR-003: Repository-owned release workflow and helpers](adrs/adr-003-repository-owned-release-workflow-and-helpers.md) — `main` source, tested helpers, and explicit reconciliation.
