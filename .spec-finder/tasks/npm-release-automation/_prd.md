# Guided Stable-Release Contract Product Requirements Document

## Overview

Spec Finder already promises public npm installation and upgrades, but has no published package or repeatable release experience. The MVP gives the repository maintainer a deliberate stable-release path that makes the full distribution outcome legible: validated package, matching public release, installer guidance, clean-install proof, and explicit recovery when only part of the release succeeds.

The primary user is the repository maintainer. Installers are the secondary user: they need a public package and a GitHub Release that consistently explain installation and upgrade. The MVP excludes automated versioning, prerelease channels, release schedules, public status dashboards, and adoption tracking.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | `spec-finder` has an executable, explicit package contents, and `prepack` verification. | [`package.json`](/Users/matheusbbarni/projects/spec-finder/package.json:2) | 2026-08-08 | A release candidate can be evaluated as one clear package contract. |
| Repository | The README promises global install and upgrade; the CLI upgrades from `spec-finder@latest`. | [README](/Users/matheusbbarni/projects/spec-finder/README.md:20), [`commands.ts`](/Users/matheusbbarni/projects/spec-finder/src/commands.ts:217) | 2026-08-08 | V1 must prove these documented user paths, not just publish an artifact. |
| Repository | No workflow, tag, GitHub Release, or published registry package exists. | Repository and registry inspection | 2026-08-08 | Release outcomes and recovery need an explicit initial product contract. |
| External | GitHub supports deliberate manually triggered workflows for maintainers with repository write access. | [GitHub documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) | 2026-08-08 | Deliberate maintainer initiation is a familiar workflow. |
| External | npm trusted publishing binds release authorization to a configured CI workflow and produces provenance for public packages from public repositories. | [npm documentation](https://docs.npmjs.com/trusted-publishers/) | 2026-06-04 | The product must protect a credible, auditable public-release boundary. |
| External | Comparable tools expand into release PRs and broad publishing permissions. | [Changesets action](https://github.com/changesets/action) | 2026-08-08 | Automated versioning remains a deliberate later-phase capability. |
| Inference | Public npm publication, tag creation, and GitHub Release creation cannot be treated as one atomic user-visible event. | Research synthesis | 2026-08-08 | Completed and partial release states must be distinct. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Make the public distribution contract trustworthy | A completed release proves package, tag, GitHub Release, and clean-install behavior agree on one version. |
| G-02 | Preserve deliberate maintainer control | A stable release begins only through the selected maintainer-controlled path. |
| G-03 | Make release state legible | Every release ends with a concise summary that identifies completed artifacts or recovery state. |
| G-04 | Give installers consistent release guidance | Every completed public release includes package, install, and upgrade information. |
| G-05 | Validate V1 without surveillance or adoption claims | One successful release and repeatable no-publish evidence meet the launch bar. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Repository maintainer | As a maintainer, I want to deliberately start a stable release so that publication remains controlled. | The release path is explicitly initiated and identifies the intended version. |
| US-02 | Repository maintainer | As a maintainer, I want invalid or inconsistent release candidates stopped before publication so that I do not expose a bad package. | A blocked candidate names the reason and shows no completed public artifact. |
| US-03 | Repository maintainer | As a maintainer, I want a concise end-state summary so that I can tell whether release, recovery, or follow-up is required. | Summary identifies each gate, available artifact links, and recovery state. |
| US-04 | CLI installer | As an installer, I want each completed release to show how to install or upgrade so that I can use the published package confidently. | Public release includes package link and installation/upgrade guidance. |
| US-05 | Repository maintainer | As a maintainer, I want clean-install proof after publishing so that the documented CLI path is evidenced. | Clean environment validates `version`, `setup`, and `upgrade`. |
| US-06 | Repository maintainer | As a maintainer, I want a partial release to give me clear next steps so that I can recover without pretending it rolled back. | Recovery guidance distinguishes completed from missing artifacts. |

## Core Features

### F-01: Deliberate stable-release initiation

- **User value:** The maintainer retains clear approval over each public stable release.
- **Mapped goals/stories:** G-02, US-01
- **MUST:** Require a deliberate maintainer action to start a stable release.
- **MUST:** Identify the release version before publication begins.
- **SHOULD:** Make the selected release path discoverable to the maintainer.
- **Acceptance conditions:** A maintainer can identify the intended version and consciously begin one stable release.

### F-02: Candidate confidence gate

- **User value:** Obvious package, version, and release-candidate problems are stopped before public publication.
- **Mapped goals/stories:** G-01, G-02, US-02
- **MUST:** Block a candidate whose verification, package contents, or public-release identity is incomplete or inconsistent.
- **MUST:** Explain the blocking reason and state that no completed release exists.
- **SHOULD:** Present remediation in maintainer-facing language.
- **Acceptance conditions:** A blocked release gives an actionable reason and never appears as successfully released.

### F-03: Unified public release identity

- **User value:** Installers and maintainers can trust that package, source tag, and public release describe the same version.
- **Mapped goals/stories:** G-01, US-01, US-04
- **MUST:** Treat the npm package version, Git tag, GitHub Release, and public notes as one release identity.
- **MUST:** Reject or explicitly reconcile a mismatch rather than presenting a partial state as complete.
- **Acceptance conditions:** A completed release has one consistent version across every public artifact.

### F-04: Maintainer release summary

- **User value:** The maintainer understands the result without inferring it from raw logs.
- **Mapped goals/stories:** G-03, US-03, US-06
- **MUST:** Summarize the outcome of every required release gate.
- **MUST:** Link available package, tag, and GitHub Release artifacts.
- **MUST:** Explicitly name partial state and manual recovery when applicable.
- **SHOULD:** Use concise, text-first status language rather than color-only meaning.
- **Acceptance conditions:** The maintainer can tell whether the release is complete, blocked, or requires recovery from one summary.

### F-05: Installer-ready public release notes

- **User value:** Installers receive repeatable, actionable guidance at every completed release.
- **Mapped goals/stories:** G-04, US-04
- **MUST:** Publish concise generated notes with the package link and install/upgrade guidance.
- **MUST:** Publish public guidance only for a completed release.
- **SHOULD:** Include concise change information with the released version.
- **Acceptance conditions:** An installer can locate the package and use the documented commands from the public release.

### F-06: Distribution-contract proof

- **User value:** The maintainer knows the published package works for the paths users are told to run.
- **Mapped goals/stories:** G-01, G-05, US-05
- **MUST:** Require clean-install evidence for `version`, `setup`, and `upgrade` before calling a release complete.
- **MUST:** Require repeatable no-publish validation for the release contract.
- **Acceptance conditions:** A completed V1 release has passing clean-install and no-publish evidence.

### F-07: Truthful manual recovery

- **User value:** A maintainer can respond safely to a partially completed or defective release.
- **Mapped goals/stories:** G-03, US-06
- **MUST:** Distinguish a partial state from a completed release.
- **MUST:** Provide manual reconciliation, deprecation, corrective-release, and GitHub Release-update guidance where applicable.
- **SHOULD:** Avoid framing recovery as automatic rollback or unpublish.
- **Acceptance conditions:** A maintainer receives an explicit next action for every non-complete release state.

## User Experience

1. The maintainer discovers the stable-release path through release documentation.
2. They deliberately start a release for an identified version.
3. If the candidate is unsuitable, they receive a concise block reason and remediation; it is not portrayed as published.
4. During a valid release, the maintainer can follow concise gate outcomes.
5. On completion, the summary links the package, tag, GitHub Release, and clean-install evidence.
6. Installers see generated public notes with package, install, and upgrade guidance.
7. If only part of the public identity exists, the maintainer receives explicit recovery guidance; no automatic rollback is implied.

All status content must remain understandable in plain text, including in non-interactive output. The workflow is reversible before public publication; after publication, recovery is corrective and communicative rather than destructive.

## High-Level Constraints

- Stable public npm releases only; no prerelease channel in MVP.
- A release is maintainer-initiated and is not scheduled or contributor-triggered.
- Public artifacts must describe one consistent version.
- The release must not depend on long-lived publishing credentials when trusted publishing is available.
- V1 does not introduce user telemetry, adoption tracking, or a public status dashboard.
- Existing `spec-finder` installation, `version`, `setup`, and `upgrade` expectations remain the compatibility contract.
- Product requirements define observable outcomes; implementation mechanics belong to the TechSpec.

## Non-Goals

- **Automated versioning and release PRs** — defer until stable-release operation demonstrates a need for higher velocity.
- **Prerelease, staged, or multi-registry release channels** — the verified V1 need is one stable public npm channel.
- **Automatic rollback or unpublish** — recovery remains deprecation, corrective release, and release-metadata update.
- **Mandatory protected release environments** — reconsider as a hardening measure after V1 evidence.
- **External installer recruitment, analytics, or public release dashboards** — no adoption baseline justifies this V1 scope.
- **Custom human-authored release narratives** — generated concise notes are the selected consistency boundary.

## Phased Rollout Plan

### MVP

Include F-01 through F-07.

Entry criteria:

- Package namespace and publishing authority are confirmed.
- The maintainer has configured the approved public-release authorization path.
- Candidate verification, package contents, and release identity are ready for evaluation.

Exit criteria:

- One stable public release has complete maintainer summary, public guidance, and clean-install evidence.
- No-publish validation demonstrates the same release gates without remote publication.
- Any partial-state result is clearly distinguishable and has manual recovery guidance.

### Later phases

- Add optional editorial release notes if generated notes prove insufficient.
- Add protected release environments if operational risk justifies a second approval boundary.
- Add independent installer validation only with an explicit recruitment and measurement plan.
- Consider automated versioning or prerelease channels only after evidence shows a stable-release cadence need.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---:|---:|---|---|
| M-01 | Completed release-contract rate | unknown | 100% | Compare completed release summary against package, tag, release, and smoke evidence | Every stable release |
| M-02 | Candidate-gate correctness | unknown | 100% | No-publish validation rejects invalid/inconsistent candidates before public artifacts | Every verification run |
| M-03 | Clean-install success | unknown | 100% | Isolated `version`, `setup`, and `upgrade` evidence | Every stable release |
| M-04 | Public-guidance completeness | unknown | 100% | Review completed release notes for package link and install/upgrade guidance | Every stable release |
| M-05 | V1 launch proof | unknown | 1 completed release | Maintain release summary plus no-publish and clean-install evidence | First stable release |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Namespace or publisher authority is unavailable | Registry returns no package metadata; ownership is unconfirmed | Medium / High | Confirm authority before first release; block public publication otherwise | Maintainer / before MVP entry |
| Partial public identity confuses users | Package, tag, and release are non-atomic | Medium / High | Distinct partial state, artifact links, and manual reconciliation guidance | Maintainer / every non-complete result |
| Generated notes omit important context | Selected consistency over bespoke prose | Medium / Medium | Include version, change summary, package link, and install/upgrade guidance; revisit editorial notes with evidence | Maintainer / post-MVP feedback |
| Technical release success is mistaken for adoption | No adoption baseline exists | High / Medium | Keep V1 success metric limited to contract proof | Product owner / adoption initiative |
| Documentation drifts from the package experience | README already promises install and upgrade | Medium / High | Treat public guidance and clean-install proof as release-completion requirements | Maintainer / every stable release |

## Architecture Decision Records

- [ADR-001: Maintainer-dispatched stable npm releases](adrs/adr-001-maintainer-dispatched-stable-npm-releases.md) — stable release scope and supply-chain boundary.
- [ADR-002: Guided stable-release experience](adrs/adr-002-guided-stable-release-experience.md) — selected maintainer summary, public guidance, and launch-proof policy.

## Research Limitations

- No real public publish has been performed.
- npm namespace ownership and trusted-publisher configuration remain unverified.
- No external installer or adoption baseline exists.
- External release-tool conventions inform alternatives but do not demonstrate demand for them in this repository.
- Current external documentation may evolve after 2026-08-08.

## Open Questions

- What concise change-summary information should generated public notes include beyond version and user command guidance?
- What wording best distinguishes a blocked candidate from a partial public-release state?
- When should the maintainer revisit external installer validation after the first stable release?
