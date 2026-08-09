# ADR-002: Guided stable-release experience

## Status

Accepted

## Date

2026-08-08

## Context

ADR-001 selected a maintainer-dispatched stable public npm release workflow. Product clarification was still needed to decide what a maintainer and an installer must experience when that workflow runs, and what initial launch evidence is sufficient.

The selected experience must make a completed release distinguishable from a partial release, give installers consistent public guidance, and keep the V1 launch bar focused on the distribution contract rather than unmeasured adoption.

## Decision Drivers

- A repository maintainer needs one controlled release outcome instead of reading raw workflow logs to determine what happened.
- Current README installation and upgrade guidance becomes credible only when a public release can prove those paths work.
- The user selected generated public release notes with package, install, and upgrade guidance.
- The user selected one complete release plus clean-install and deterministic no-publish evidence as the V1 launch-success signal.
- The approved V1 deliberately excludes automated versioning, prerelease channels, release scheduling, and adoption tracking.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | The package, global installation instructions, and `upgrade` command already define the user-facing distribution contract. | `package.json`, `README.md`, `src/commands.ts` | 2026-08-08 |
| Repository | No release workflow, GitHub Release, tag, or npm package exists today. | Read-only repository and registry inspection | 2026-08-08 |
| External | A manually dispatched workflow can be run through GitHub, CLI, or API and requires write access. | https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow | 2026-08-08 |
| External | npm trusted publishing ties a configured workflow to short-lived OIDC publishing credentials. | https://docs.npmjs.com/trusted-publishers/ | 2026-06-04 |
| External | Comparable release tooling combines version PRs, publishing, tags, and GitHub Releases, but needs broad write permissions for that expanded scope. | https://github.com/changesets/action | 2026-08-08 |
| User decision | Select the guided stable-release contract after choosing maintainer summary, generated public guidance, and distribution-contract launch proof. | PRD clarification and approach decision | 2026-08-08 |

## Decision

V1 will provide a guided stable-release experience for the deliberate maintainer:

- A concise maintainer-facing release summary must identify the result of every required release gate, link the completed npm package, tag, and GitHub Release when available, and explicitly name the recovery state when a release is partial.
- A completed public GitHub Release must contain concise generated notes, the npm package link, and install and upgrade guidance for installers.
- The release is considered a completed V1 success only when its product gates, public artifacts, and selected clean-install smoke evidence all succeed. A partial state is not presented as a completed release.
- V1 launch validation is one successful maintainer release with passing clean-install and deterministic no-publish evidence. It does not require external tester recruitment, download analytics, or a public status dashboard.

## Alternatives Considered

### Bare publishing pipeline

- **User value:** Fastest path to a published package and GitHub Release.
- **Costs/risks:** Maintainers must infer partial state from raw logs; installers receive little consistent guidance; successful publication is weaker evidence of the documented distribution contract.
- **Why not selected:** It gives up the user-selected summary, guidance, and full success proof that make the release path trustworthy.

### Launch-confidence program

- **User value:** Adds independent installer reports and adoption visibility after release.
- **Costs/risks:** Requires recruiting, support follow-up, retention or measurement policy, and public-status scope before the basic distribution path is proven.
- **Why not selected:** No adoption baseline or verified demand justifies it for V1.

## Consequences

### Positive

- Maintainers receive a legible outcome and recovery context without interpreting raw workflow logs.
- Installers receive consistent public package and command guidance at every completed release.
- V1 success has a concrete, privacy-preserving measurement boundary tied directly to the documented install and upgrade promise.

### Negative and trade-offs

- Generated notes prioritize consistency over bespoke release narrative.
- A release that publishes a package but lacks tag, release, or smoke evidence remains incomplete until reconciled.
- The first release does not claim market validation or adoption based solely on technical success.

### Risks and mitigations

- **Generated notes omit material context** — include version, package link, install/upgrade guidance, and concise change information; revisit human-authored notes if releases need more narrative.
- **Partial states confuse maintainers** — summary must name completed artifacts, missing artifacts, and the next manual recovery action.
- **Technical release success is mistaken for adoption** — keep the launch metric limited to contract proof and add user validation only when an adoption initiative exists.

## Reversibility

The summary and generated-note policy can later add editorial notes, external installer validation, or public reporting without changing published package versions. The V1 success metric can be expanded when a credible adoption baseline and consent-appropriate measurement plan exist.

## Follow-ups

- Define the stable IDs and observable PRD acceptance conditions for summary content, public guidance, completed versus partial results, and launch proof.
- Decide the exact release-note change summary format and the operator-visible recovery wording during technical specification.
- Revisit independent installer validation after the first stable release is complete.

## References

- [ADR-001: Maintainer-dispatched stable npm releases](adr-001-maintainer-dispatched-stable-npm-releases.md)
- `_idea.md`
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- https://docs.npmjs.com/trusted-publishers/
- https://github.com/changesets/action
