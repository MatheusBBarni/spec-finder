# ADR-003: Repository-owned release workflow and helpers

## Status

Accepted

## Date

2026-08-08

## Context

ADR-001 establishes a maintainer-dispatched stable public npm release, and ADR-002 establishes the required maintainer and installer experience. The technical design must now make package validation, remote release state, reconciliation, and human-readable summaries deterministic without expanding Spec Finder's user-facing CLI, ACP workflow engine, or configuration surface.

The current package is built and verified with Bun, publishes a deliberately small file set, and has no release workflow or existing release-script layer. npm publication, tag creation, GitHub Release creation, and clean-install proof are non-atomic. The workflow therefore needs an explicit partial-state model and a no-publish validation seam. The user selected the reviewed `package.json` version on the canonical `main` branch as the only authority for a stable release, and selected an explicit reconciliation mode rather than retrying an immutable npm publication.

## Decision Drivers

- F-01 through F-07 require a deliberate stable release, a candidate gate, unified public identity, readable summary, installer guidance, proof, and truthful recovery.
- `package.json` already supplies the distributable identity and `bun run verify` is the repository verification gate.
- `src/cli.tsx` and `src/commands.ts` are product-facing CLI boundaries, not release-orchestration boundaries.
- npm trusted publishing requires a configured GitHub-hosted workflow and an `id-token: write` permission, while GitHub release automation needs explicit repository-content authority.
- Published npm versions are immutable, so a duplicate version cannot be treated as a successful publish retry.
- The user selected Ubuntu and Windows clean-install smoke evidence and generated GitHub notes with repository-owned installer guidance.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | `package.json` owns the package version, published-file contract, and `bun run verify` gate. | `package.json` | 2026-08-08 |
| Repository | `version`, `setup`, and `upgrade` are existing CLI behavior; release logic does not belong in that interface. | `src/cli.tsx`, `src/commands.ts` | 2026-08-08 |
| Repository | No workflow or release-helper layer exists today. | Repository inspection | 2026-08-08 |
| Official docs | Trusted publishing uses a GitHub-hosted workflow, a registered workflow filename, and `id-token: write`. | https://docs.npmjs.com/trusted-publishers/ | 2026-06-04 |
| Official docs | `npm pack` can report the files that would be included in a tarball. | https://docs.npmjs.com/cli/v11/commands/npm-pack | 2026-08-08 |
| Official docs | GitHub generated notes can be used only after the required tag exists when `gh release create --verify-tag` is used. | https://cli.github.com/manual/gh_release_create | 2026-08-08 |
| User decision | Use one manually dispatched workflow with small repository-owned release helpers; source stable releases from `main` only. | TechSpec clarifications and approach selection | 2026-08-08 |

## Decision

V1 will add one manually dispatched workflow at `.github/workflows/release.yml`, defined on the canonical `main` branch. It will reject a stable-release or reconciliation invocation whose checked-out source is not `main`. The reviewed commit's `package.json` version is the sole release version; dispatch inputs never edit it.

The workflow will orchestrate existing Bun checks and a small, tested `scripts/release/` helper surface. Helpers own deterministic candidate validation, tarball allowlist evaluation, remote-state classification, release-note guidance, concise summary formatting, and safe reconciliation decisions. The GitHub Actions YAML owns environment setup, explicitly minimal permissions, and calls to npm, Git, and GitHub's release API/CLI. No production CLI, ACP, configuration, or external release dependency will be added.

The workflow will expose two deliberate modes:

- `release` may publish only after all no-remote-mutation preflight checks pass and the exact npm version is absent.
- `reconcile` may complete missing tag, GitHub Release, or smoke evidence for the exact `main` version only after it proves that the npm version is already published. It must never call `npm publish`.

Each path will emit a plain-text summary with package, tag, GitHub Release, and platform-smoke states. A release is complete only after all four are present and both Ubuntu and Windows clean-install smoke tests pass. Generated GitHub notes will be supplemented by a repository-owned package link plus global install and upgrade guidance.

## Alternatives Considered

### Release behavior embedded in the Spec Finder CLI

- **Benefits:** A familiar executable surface for maintainers.
- **Costs/risks:** Conflates user-facing local commands with CI credentials and remote release administration; expands the installed package and CLI compatibility boundary.
- **Why not selected:** It conflicts with the repository's CLI/orchestration boundaries and does not provide a safer no-publish workflow seam.

### One large GitHub Actions YAML workflow without helpers

- **Benefits:** Fewer source files and no release-script module.
- **Costs/risks:** Complex state classification, path validation, and summaries become difficult to test deterministically; duplicated shell logic is error-prone across runners.
- **Why not selected:** The selected proof requirement needs testable, deterministic no-publish behavior.

### Any maintainer-selected source ref

- **Benefits:** Supports release branches and hotfixes without merging first.
- **Costs/risks:** A stable public package could diverge from the canonical release history, complicating package/tag/release traceability and recovery.
- **Why not selected:** The user selected `main` as the sole stable-release source for V1.

### Re-running `npm publish` after any partial failure

- **Benefits:** A simple apparent retry path.
- **Costs/risks:** Published npm versions are immutable; it can mask a partial state and cannot repair missing tag, release, or smoke evidence.
- **Why not selected:** The user selected a separate explicit reconciliation mode with no republish behavior.

## Consequences

### Positive

- Keeps public release mechanics outside the installed CLI and preserves existing user behavior.
- Gives no-publish checks direct unit-test seams and a maintainable summary/reconciliation contract.
- Makes stable artifacts traceable to one `main` commit and one `package.json` version.
- Prevents an accidental duplicate publish from being presented as recovery.

### Negative and trade-offs

- Adds a small release-helper module and workflow-specific documentation.
- Stable hotfixes must first be represented on `main`; V1 has no release-branch lane.
- The first public release remains dependent on one-time npm trusted-publisher and namespace setup outside the repository.

### Risks and mitigations

- **A remote artifact exists in an unexpected state** — classify it explicitly, fail closed, and direct the maintainer to `reconcile` or manual remediation rather than guessing.
- **A package includes unexpected files** — compare `npm pack --dry-run --json` file paths to an explicit allowlist before remote mutation.
- **A runner-specific installer path fails** — require isolated Ubuntu and Windows smoke jobs before completion, and retain their logs in the workflow summary.
- **Workflow authority is broader than required** — scope `contents: write` and `id-token: write` to only the jobs that require them and leave all other permissions unset.

## Reversibility and Rollback

The workflow and helper modules can be removed or replaced without changing published versions. `reconcile` is intentionally additive for existing public artifacts. A bad npm version cannot be rolled back by unpublish in the V1 contract; maintainers deprecate the exact version, issue a corrective version, and amend the GitHub Release as documented.

## Implementation Notes

- Keep all release-specific parsing and state decisions in `scripts/release/` with Bun tests; workflow YAML remains orchestration glue.
- Define an explicit path allowlist for `npm pack` output and reject unexpected entries.
- Create and verify the exact version tag before creating the GitHub Release; do not allow GitHub to create an implicit tag at the default branch.
- Keep a public-release status separate from a blocked preflight status and from a partial/reconciliation status.
- Put maintainer prerequisites and manual recovery instructions in `README.md` or a linked repository-owned runbook.

## Follow-ups

- In the implementation task, pin third-party Actions to reviewed immutable revisions and record the selected revisions in the workflow.
- Configure the npm trusted publisher for the exact repository and `.github/workflows/release.yml` filename before the first live release.
- Reconsider protected GitHub environments and a release-branch policy only after V1 operating evidence exists.

## References

- [ADR-001: Maintainer-dispatched stable npm releases](adr-001-maintainer-dispatched-stable-npm-releases.md)
- [ADR-002: Guided stable-release experience](adr-002-guided-stable-release-experience.md)
- `package.json`
- `src/cli.tsx`
- `src/commands.ts`
- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/cli/v11/commands/npm-pack
- https://cli.github.com/manual/gh_release_create
