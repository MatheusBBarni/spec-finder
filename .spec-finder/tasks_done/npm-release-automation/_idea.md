# Maintainer-Dispatched npm Releases

## Overview

Spec Finder documents npm installation and upgrades but has no published package or release workflow. V1 gives a repository maintainer one deliberate path to publish a stable public npm version, create a matching tag and GitHub Release, prove the installed CLI works, and recover truthfully from partial publication.

This is a focused operational quick win: it establishes a reliable distribution contract without adopting prerelease channels, automated versioning, or release scheduling.

## Problem

The repository already promises `npm install --global spec-finder` and `spec-finder upgrade`, but the `spec-finder` package has no registry metadata today. Release work—version validation, package inspection, publication, tagging, release notes, and user-facing verification—would otherwise be manual and error-prone.

### Evidence

| Kind | Finding | Source | Date | Confidence |
|---|---|---|---|---|
| Repository | Package metadata defines `spec-finder@0.1.0`, `dist/cli.js`, explicit published files, and a `prepack` verification gate. | [`package.json`](/Users/matheusbbarni/projects/spec-finder/package.json:2) | 2026-08-08 | High |
| Repository | Global install and `upgrade` are documented; `upgrade` installs `spec-finder@latest`. | [README](/Users/matheusbbarni/projects/spec-finder/README.md:20), [`commands.ts`](/Users/matheusbbarni/projects/spec-finder/src/commands.ts:217) | 2026-08-08 | High |
| Repository | There are no workflows, releases, tags, branch protection, or deployment environments. | Read-only GitHub/API inspection | 2026-08-08 | High |
| External | npm trusted publishing uses GitHub Actions OIDC, needs an exact workflow registration and `id-token: write`, and automatically creates provenance for public packages from public repositories. | [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/) | 2026-06-04 | High |
| External | npm blocks duplicate-version publication by default. | [npm CLI publish implementation](https://github.com/npm/cli/blob/latest/lib/commands/publish.js) | 2026-08-08 | High |
| External | GitHub Releases are based on Git tags. | [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) | 2026-08-08 | High |
| External | npm recommends version deprecation over unpublishing for recovery. | [npm deprecation guidance](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/) | 2024-06-03 | High |
| Inference | A non-atomic release sequence needs idempotent reconciliation and explicit recovery rather than automated rollback. | Research synthesis | 2026-08-08 | Medium |

## Target Users

| Persona | Context | Need | Current workaround |
|---|---|---|---|
| Repository maintainer | Preparing an approved stable release | One controlled, repeatable release path with clear evidence | Manual versioning, commands, and release metadata |
| CLI installer | Installing or upgrading Spec Finder globally | A working public package whose documented commands function | No published package exists |
| Future contributor | Validating a release candidate | Deterministic, no-publish evidence that release gates work | No release validation path exists |

## Core Features

| ID | Priority | Feature | Observable user value | Evidence |
|---|---|---|---|---|
| F-01 | Critical | Maintainer-dispatched stable release entry point | A maintainer deliberately begins one public stable release | User decision; ADR-001 |
| F-02 | Critical | Fail-closed preflight | Invalid version, duplicate state, dirty/rejected candidate, or failed verification causes zero remote release mutations | `prepack`; npm immutability |
| F-03 | Critical | Packed-artifact inspection | The maintainer sees that the published tarball contains only the intended runtime, skills, README, and license | `package.json` files list |
| F-04 | Critical | Trusted npm publication with provenance | A public package is published without a long-lived write token when trusted publishing is configured | npm trusted publishers |
| F-05 | High | Matching source tag and GitHub Release | npm version, tag, release title, and notes describe the same release | GitHub Releases documentation |
| F-06 | High | Clean post-publish smoke test | A clean environment runs `version`, `setup`, and `upgrade` from the public package | User decision; existing CLI |
| F-07 | High | Idempotent reconciliation and recovery guidance | A partial release is identified, reconciled safely, or deprecated and superseded without unpublish automation | npm deprecation guidance |

## KPIs

| ID | KPI | Baseline | Target | Measurement method | Window |
|---|---|---:|---:|---|---|
| KPI-01 | Release-gate compliance | unknown | 100% | Workflow evidence records verification, preflight, and artifact inspection | Every dispatch |
| KPI-02 | Release-version consistency | unknown | 100% | Compare package metadata, npm version, tag, and GitHub Release | Every release |
| KPI-03 | Packed-content integrity | unknown | 100% | Deterministic allowlist test over package contents | Every candidate |
| KPI-04 | Clean-install smoke success | unknown | 100% | Isolated `version`, `setup`, and `upgrade` smoke run | Every release |
| KPI-05 | Duplicate-prevention correctness | unknown | 100% | Fixture/preflight tests reject an existing version before publication | Every verification run |

## Feature Assessment

| Criterion | Score | Evidence-backed rationale |
|---|---|---|
| Impact | Strong | It makes existing installation and upgrade promises deliverable. |
| Reach | Maybe | Every future installer benefits, but adoption is unmeasured. |
| Frequency | Maybe | Releases are periodic; the error cost is high. |
| Differentiation | Pass | This is expected distribution infrastructure. |
| Defensibility | Pass | Competitors can reproduce the workflow. |
| Feasibility | Strong | Package metadata, verification, version reporting, and smoke commands already exist. |

## Independent Critique

### Consensus

Four independent advisors recommended the selected workflow: maintainer dispatch, stable-only publication, OIDC/provenance, fail-closed gates, tarball inspection, isolated smoke testing, idempotent reconciliation, and manual deprecation/corrective-release guidance.

### Unresolved Tensions

| Tension | Position A | Position B | Decision consequence |
|---|---|---|---|
| Release environment | Require a protected environment for stronger approval control | Treat it as future hardening for the solo maintainer | V1 uses explicit maintainer dispatch; environment protection is deferred |
| Remote validation | Use a test registry to prove remote behavior | Use deterministic no-publish validation plus first-release smoke | V1 avoids a second registry and requires real-release smoke |
| Publication order | Publish npm before public release metadata | No ordering removes non-atomicity | V1 requires reconciliation and documented partial-state recovery |

### Position Evolution and Dissent

- Release engineering partially conceded that protected environments add security value, but found them disproportionate as a V1 prerequisite.
- Supply-chain review partially conceded that dispatch is workable for the happy path, while holding that stronger approval controls are desirable hardening.
- Product operations held firm that protected environments and a test registry should not block the initial release path.
- The skeptical review partially conceded both controls are useful, but not justified as mandatory by current evidence.

### Recommended Direction

The selected direction is a maintainer-dispatched stable public release workflow with strict gates, trusted publishing/provenance, matching GitHub Release metadata, clean installation proof, and documented manual recovery.

## Opportunity Decision

| Direction | Outcome | Effort | Principal risk | Decision |
|---|---|---|---|---|
| Refined maintainer workflow | Public stable npm release with evidence and recovery | Medium | First-release configuration and partial-state reconciliation | **Selected** |
| Essence-first checklist | Local validation plus manual publishing | Small | Manual drift and weak end-to-end evidence | Rejected |
| Hardened promotion platform | Protected environment, prereleases, release PRs, staged rollout | Large | Operational complexity before demand is proven | Rejected |

## Out of Scope (V1)

- **Automated versioning and release PRs** — retain deliberate maintainer release decisions; reconsider after stable releases are operating.
- **Prerelease channels, staged releases, or multiple registries** — public stable npm is the selected scope.
- **Automatic rollback or unpublish** — published versions are immutable; recovery is deprecation and corrective release.
- **Mandatory protected release environments** — useful hardening, but not justified as a V1 blocker.
- **Scheduled or contributor-triggered releases** — conflicts with the chosen maintainer-controlled approval boundary.

## Architecture Decision Records

- [ADR-001: Maintainer-dispatched stable npm releases](adrs/adr-001-maintainer-dispatched-stable-npm-releases.md) — selected scope, alternatives, partial-state recovery, and deferrals.

## Research Limitations

- No external adoption, release-frequency, or willingness-to-pay baseline exists.
- Registry ownership and trusted-publisher configuration are not confirmed.
- This research has not performed a real public publish.
- Current npm and GitHub documentation may evolve after 2026-08-08.

## Open Questions

- What exact isolated environment best proves global install, `setup`, and `upgrade` without polluting the release runner?
- What exact reconciliation output and exit statuses should distinguish unpublished, published-only, tagged-only, and fully released states?
- Which release-note source gives maintainers sufficient control while keeping version references consistent?
