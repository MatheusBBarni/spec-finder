# ADR-001: Maintainer-dispatched stable npm releases

## Status

Accepted

## Date

2026-08-08

## Context

Spec Finder documents global installation and upgrades from the public npm package, but it has no workflow, tag, GitHub Release, or published registry package today. The package metadata already identifies the package, executable, distributable contents, verification gate, and matching public GitHub repository.

The selected release boundary must give a repository maintainer a deliberate, repeatable way to publish one stable public npm version and a matching GitHub Release while preventing avoidable package, version, and supply-chain mistakes. npm publication, Git tagging, and GitHub Release creation are not atomic, so the decision must also provide truthful recovery for partial states.

## Decision Drivers

- The user selected a deliberate repository maintainer as the V1 operator.
- The user selected stable public npm releases and matching GitHub Releases only.
- The user requires a clean global-install smoke test for `version`, `setup`, and `upgrade` after publication.
- The user selected documented manual deprecation, corrective releases, and GitHub Release updates instead of automatic rollback.
- npm trusted publishing can use short-lived GitHub Actions OIDC credentials and produce provenance for a public package from a public repository.
- Existing global installation and `upgrade` documentation must become a truthful, verifiable contract.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | The package is `spec-finder@0.1.0`, exposes `dist/cli.js`, limits published files, and runs `bun run verify` through `prepack`. | `package.json` | 2026-08-08 |
| Repository | The README instructs global npm installation and says `upgrade` uses `spec-finder@latest`. | `README.md`, `src/commands.ts` | 2026-08-08 |
| Repository | The public repository has no release workflow, tag, GitHub Release, branch protection, or deployment environment. | Read-only GitHub/API inspection | 2026-08-08 |
| External | GitHub-hosted Actions can publish through npm trusted publishing with OIDC; the configured workflow filename and `id-token: write` permission are required. | https://docs.npmjs.com/trusted-publishers/ | 2026-06-04 |
| External | Existing npm versions cannot be republished by default. | https://github.com/npm/cli/blob/latest/lib/commands/publish.js | 2026-08-08 |
| External | GitHub Releases are based on Git tags. | https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases | 2026-08-08 |
| External | npm recommends deprecating a defective package version rather than unpublishing it. | https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/ | 2024-06-03 |
| User decision | Choose the original/refined release workflow. | Idea-factory opportunity decision | 2026-08-08 |

## Decision

V1 will provide a maintainer-dispatched release workflow for one stable, public npm package version at a time. Before any remote publication, it must run the repository verification gate, inspect the packed artifact, validate version and release uniqueness, and fail without remote mutation when those checks fail.

The release workflow will use npm trusted publishing and provenance when the required npm/GitHub configuration is present, avoid a long-lived npm write token, publish the public package, reconcile the matching version tag and GitHub Release, and run the selected clean global-install smoke test. It must document manual recovery for partial publication through version deprecation, a corrective release, and GitHub Release updates.

The user’s deliberate workflow dispatch is the V1 release approval boundary. A protected GitHub release environment is a future hardening option rather than a prerequisite for the initial stable release path.

## Alternatives Considered

### Essence-first local checklist and script

- **Benefits:** Smallest delivery; no release-automation configuration.
- **Costs/risks:** Leaves npm publication, tagging, GitHub Release creation, and recovery dependent on maintainer memory; provides weaker end-to-end evidence.
- **Why not selected:** It does not satisfy the issue’s repeatable automated-release goal or the selected public-install contract.

### Mandatory protected GitHub release environment

- **Benefits:** Adds an explicit approval boundary and stronger separation of duties for OIDC publication.
- **Costs/risks:** Introduces environment administration and an unverified operational blocker for the current deliberate-maintainer workflow.
- **Why not selected:** Independent critique found it useful, but repository and user evidence do not make it necessary for V1.

### Automated release PRs, prerelease channels, and staged rollout

- **Benefits:** Supports higher release velocity and broader promotion controls.
- **Costs/risks:** Adds versioning, channel, permission, support, and recovery policy before the basic stable release path is proven.
- **Why not selected:** The selected V1 is intentionally stable-only and manually initiated.

## Consequences

### Positive

- Makes the documented npm install and upgrade path verifiable and repeatable.
- Couples public npm publication, source tag, release notes, and post-publish user-facing evidence.
- Uses short-lived workflow authentication and provenance rather than a long-lived publishing credential.
- Makes partial publication states visible and recoverable without pretending they can be rolled back atomically.

### Negative and trade-offs

- The initial release requires npm trusted-publisher configuration, a confirmed package name, and a GitHub workflow before it can succeed.
- A maintainer still deliberately starts each stable release; V1 does not remove that decision.
- A successful npm publication may require reconciliation if tag or GitHub Release creation later fails.

### Risks and mitigations

- **Package name or publisher authority is not confirmed** — verify ownership and trusted-publisher configuration before the first publish; fail closed if unavailable.
- **Unexpected or incomplete tarball** — inspect packed contents against an explicit allowlist before remote mutation.
- **Duplicate version or release** — preflight npm, tag, and GitHub Release state; make reconciliation idempotent rather than republishing.
- **A defective public version** — document version-specific deprecation, corrective version release, and GitHub Release amendment; do not automate unpublish.
- **Workflow/OIDC misconfiguration** — verify exact registered workflow filename, repository linkage, and least-privilege permissions before the first public release.

## Reversibility

The workflow can be disabled or replaced without changing already-published npm versions. Published artifacts are immutable; recovery is a deprecation message, corrective version, and GitHub Release update rather than artifact replacement or automatic unpublishing. A protected environment can be added later without changing the stable package contract.

## Follow-ups

- Confirm npm namespace ownership and configure the trusted publisher before the first real release.
- Define the exact workflow trigger, required GitHub permissions, tag/release reconciliation, and smoke-test isolation in the TechSpec.
- Add deterministic no-publish validation that proves gates and sequencing without remote mutation.
- Decide whether repository risk justifies a protected release environment after the basic release path is operating.

## References

- GitHub issue #3: https://github.com/MatheusBBarni/spec-finder/issues/3
- `package.json`
- `README.md`
- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/
- https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
