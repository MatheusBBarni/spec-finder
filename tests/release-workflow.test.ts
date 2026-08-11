import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"
import { parseDocument } from "yaml"

type WorkflowStep = {
  readonly name?: unknown
  readonly id?: unknown
  readonly uses?: unknown
  readonly run?: unknown
  readonly if?: unknown
  readonly env?: Record<string, unknown>
  readonly with?: Record<string, unknown>
}

type WorkflowJob = {
  readonly name?: unknown
  readonly needs?: unknown
  readonly if?: unknown
  readonly "runs-on"?: unknown
  readonly permissions?: Record<string, unknown>
  readonly outputs?: Record<string, unknown>
  readonly strategy?: Record<string, unknown>
  readonly steps?: readonly WorkflowStep[]
}

type WorkflowDocument = {
  readonly on?: Record<string, unknown>
  readonly permissions?: Record<string, unknown>
  readonly concurrency?: Record<string, unknown>
  readonly jobs?: Record<string, WorkflowJob>
}

const workflowPath = join(import.meta.dir, "..", ".github", "workflows", "release.yml")

async function readWorkflow(): Promise<{ source: string; document: WorkflowDocument }> {
  const source = await readFile(workflowPath, "utf8")
  const document = parseDocument(source)
  expect(document.errors).toHaveLength(0)
  return { source, document: document.toJS() as WorkflowDocument }
}

function steps(job: WorkflowJob): readonly WorkflowStep[] {
  return job.steps ?? []
}

function namedStep(job: WorkflowJob, name: string): WorkflowStep {
  const step = steps(job).find((candidate) => candidate.name === name)
  if (!step) throw new Error(`workflow step not found: ${name}`)
  return step
}

function runText(step: WorkflowStep): string {
  return typeof step.run === "string" ? step.run : ""
}

function jobRunText(job: WorkflowJob): string {
  return steps(job).map(runText).join("\n")
}

describe("stable release workflow policy", () => {
  test("exposes only the deliberate modes and rejects non-main dispatches", async () => {
    const { document, source } = await readWorkflow()
    const dispatch = document.on?.workflow_dispatch as Record<string, unknown> | undefined
    const inputs = dispatch?.inputs as Record<string, Record<string, unknown>> | undefined
    const mode = inputs?.mode
    const preflight = document.jobs?.preflight

    expect(mode).toMatchObject({
      required: true,
      type: "choice",
      default: "release",
    })
    expect(mode?.options).toEqual(["release", "reconcile"])
    expect(document.on?.push).toBeUndefined()
    expect(document.on?.pull_request).toBeUndefined()

    const guard = namedStep(preflight ?? {}, "Guard canonical main source")
    expect(guard.env?.SOURCE_REF).toBe("${{ github.ref }}")
    expect(runText(guard)).toContain("refs/heads/main")
    expect(runText(guard)).toContain("exit 1")

    const checkoutIndex = steps(preflight ?? {}).findIndex((step) => step.uses === "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5")
    const guardIndex = steps(preflight ?? {}).indexOf(guard)
    expect(guardIndex).toBeGreaterThanOrEqual(0)
    expect(checkoutIndex).toBeGreaterThan(guardIndex)
    expect(source).toContain("npm publish --access public")
  })

  test("uses a non-cancelling stable-release group and captures a full source identity", async () => {
    const { document } = await readWorkflow()
    const concurrency = document.concurrency
    const preflight = document.jobs?.preflight ?? {}
    const checkout = steps(preflight).find((step) => step.uses === "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5")
    const sourceStep = namedStep(preflight, "Capture full source identity")
    const candidateStep = namedStep(preflight, "Capture accepted candidate and state")
    const uploadStep = namedStep(preflight, "Upload deterministic candidate handoff")
    const acceptedStep = namedStep(preflight, "Mark preflight accepted")

    expect(concurrency).toEqual({
      group: "stable-release",
      "cancel-in-progress": false,
    })
    expect(checkout?.with).toMatchObject({
      ref: "${{ github.sha }}",
      "fetch-depth": 0,
      "persist-credentials": false,
    })
    expect(sourceStep.env?.EVENT_SHA).toBe("${{ github.sha }}")
    expect(runText(sourceStep)).toContain("git rev-parse --verify 'HEAD^{commit}'")
    expect(runText(sourceStep)).toContain("git rev-parse --verify 'HEAD^{tree}'")
    expect(runText(sourceStep)).toContain("checked_out_sha")
    expect(runText(sourceStep)).toContain("tree_sha")

    expect(candidateStep.env?.SOURCE_SHA).toBe("${{ steps.source.outputs.source_sha }}")
    expect(runText(candidateStep)).toContain("release-candidate.json")
    expect(runText(candidateStep)).toContain("mutationEligible: false")
    expect(runText(candidateStep)).toContain("remoteState: null")
    expect(uploadStep.uses).toBe("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")
    expect(uploadStep.with).toMatchObject({
      name: "release-candidate",
      path: "release-candidate.json",
      "if-no-files-found": "error",
    })
    expect(steps(preflight).indexOf(acceptedStep)).toBeGreaterThan(steps(preflight).indexOf(uploadStep))
    expect(runText(acceptedStep)).toContain("test -s release-candidate.json")
    expect(preflight.outputs).toMatchObject({
      accepted: "${{ steps.accepted.outputs.accepted }}",
      candidate_artifact: "${{ steps.accepted.outputs.artifact_name }}",
      source_sha: "${{ steps.source.outputs.source_sha }}",
    })
    expect(document.jobs?.remote_state?.outputs).toMatchObject({
      action: "${{ steps.classify.outputs.action }}",
      state_artifact: "${{ steps.classify.outputs.artifact_name }}",
    })
  })

  test("pins every action and scopes OIDC and contents permissions to one job", async () => {
    const { document, source } = await readWorkflow()
    const jobs = document.jobs ?? {}
    const actionLines = source.split("\n").filter((line) => line.includes("uses:"))

    expect(actionLines.length).toBeGreaterThan(0)
    for (const line of actionLines) {
      expect(line).toMatch(/uses:\s+\S+@[0-9a-f]{40}\s+#\s+v\d/i)
    }

    expect(document.permissions).toEqual({})
    expect(jobs.preflight?.permissions).toEqual({ contents: "read" })
    expect(jobs.remote_state?.permissions).toEqual({ contents: "read" })
    expect(jobs.publish?.permissions).toEqual({ contents: "read", "id-token": "write" })
    expect(jobs.metadata?.permissions).toEqual({ contents: "write" })
    expect(jobs.smoke?.permissions).toEqual({})
    expect(jobs.summary?.permissions).toEqual({ contents: "read" })
    for (const [jobId, job] of Object.entries(jobs)) {
      if (jobId !== "publish") expect(job.permissions?.["id-token"]).toBeUndefined()
    }
    expect(source).toContain("secrets.NPM_TOKEN")
    expect(source).toContain("NODE_AUTH_TOKEN")
    for (const [jobId, job] of Object.entries(jobs)) {
      if (jobId === "publish") continue
      expect(jobRunText(job)).not.toMatch(/(?:NPM_TOKEN|NODE_AUTH_TOKEN|secrets\.NPM)/i)
    }
  })

  test("runs both local gates before accepted handoff and refreshes remote state", async () => {
    const { document } = await readWorkflow()
    const preflight = document.jobs?.preflight ?? {}
    const remoteState = document.jobs?.remote_state ?? {}
    const summary = document.jobs?.summary ?? {}
    const releaseCheck = steps(preflight).find((step) => runText(step).includes("bun run release:check"))
    const verify = steps(preflight).find((step) => runText(step).includes("bun run verify"))
    const remoteQuery = namedStep(remoteState, "Query exact npm version")
    const classify = namedStep(remoteState, "Classify remote state and write handoff")
    const remoteArtifact = namedStep(remoteState, "Upload refreshed remote-state handoff")

    expect(releaseCheck).toBeDefined()
    expect(verify).toBeDefined()
    expect(steps(preflight).indexOf(releaseCheck ?? {})).toBeLessThan(steps(preflight).indexOf(verify ?? {}))
    expect(runText(remoteQuery)).toContain("npm view")
    expect(runText(remoteQuery)).toContain("state=absent")
    expect(runText(remoteQuery)).toContain("state=published")
    expect(runText(namedStep(remoteState, "Query and verify exact annotated tag"))).toContain("git ls-remote")
    expect(runText(namedStep(remoteState, "Query matching GitHub Release"))).toContain("gh api")
    expect(runText(classify)).toContain("classifyState")
    expect(runText(classify)).toContain("remote-preflight")
    expect(remoteArtifact.uses).toBe("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")

    expect(summary.if).toContain("always()")
    expect(summary.needs).toEqual(["preflight", "remote_state", "publish", "metadata", "smoke"])
  })

  test("keeps response bodies enabled for GitHub API metadata reads", async () => {
    const { source } = await readWorkflow()
    const responseReads = source
      .split("\n")
      .filter((line) => line.includes("gh api") && line.includes('releases/tags/${TAG}'))

    expect(responseReads).toHaveLength(3)
    for (const line of responseReads) expect(line).not.toContain("--silent")
  })

  test("runs isolated Ubuntu and Windows post-publication smoke", async () => {
    const { document } = await readWorkflow()
    const smoke = document.jobs?.smoke ?? {}
    const strategy = smoke.strategy ?? {}
    const matrix = strategy.matrix as Record<string, unknown> | undefined
    const include = matrix?.include as readonly Record<string, unknown>[] | undefined
    const smokeText = jobRunText(smoke)

    expect(smoke.if).toContain("always()")
    expect(smoke.if).toContain("needs.metadata.result == 'success'")
    expect(smoke.needs).toEqual(["preflight", "remote_state", "publish", "metadata"])
    expect(smoke["runs-on"]).toBe("${{ matrix.os }}")
    expect(strategy["fail-fast"]).toBe(false)
    expect(include).toEqual(expect.arrayContaining([
      { platform: "ubuntu", os: "ubuntu-latest" },
      { platform: "windows", os: "windows-latest" },
    ]))

    expect(smokeText).toContain("RUNNER_TEMP")
    expect(smokeText).toContain("SMOKE_WORKSPACE")
    expect(smokeText).toContain("SMOKE_HOME")
    expect(smokeText).toContain("USERPROFILE")
    expect(smokeText).toContain("NPM_CONFIG_PREFIX")
    expect(smokeText).toContain("NPM_CONFIG_CACHE")
    expect(smokeText).toContain("PATH=")
    expect(smokeText).toContain("npm install --global")
    expect(smokeText).toContain("spec-finder version")
    expect(smokeText).toContain("spec-finder setup")
    expect(smokeText).toContain("spec-finder upgrade")
    expect(smokeText).toContain("npm.cmd")
    expect(smokeText).toContain("windows-latest")
    expect(namedStep(smoke, "Upload platform smoke evidence").uses).toBe("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")
  })

  test("exercises only the installed exact package and verifies latest before upgrade", async () => {
    const { document } = await readWorkflow()
    const smoke = document.jobs?.smoke ?? {}
    const smokeText = jobRunText(smoke)

    expect(smokeText).toContain('"spec-finder@${VERSION}"')
    expect(smokeText).toContain("spec-finder@latest")
    expect(smokeText).toContain("latest_version")
    expect(smokeText).toContain("upgraded_version")
    expect(smokeText).toContain("exact upgrade evidence is unavailable")
    expect(smokeText).not.toContain("bun run")
    expect(smokeText).not.toContain("src/cli.tsx")
    expect(smokeText).not.toContain("dist/cli.js")
  })

  test("always emits one summary and gates complete on artifacts plus both smoke platforms", async () => {
    const { document } = await readWorkflow()
    const summary = document.jobs?.summary ?? {}
    const download = namedStep(summary, "Download platform smoke evidence")
    const emit = namedStep(summary, "Emit final plain-text release summary")
    const emitText = runText(emit)

    expect(summary.if).toContain("always()")
    expect(summary.needs).toEqual(["preflight", "remote_state", "publish", "metadata", "smoke"])
    expect(download.if).toContain("always()")
    expect(download.uses).toBe("actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093")
    expect(emit.if).toContain("always()")
    expect(emitText).toContain("formatSummary")
    expect(emitText).toContain('result = "blocked"')
    expect(emitText).toContain('result = "partial"')
    expect(emitText).toContain('result = "complete"')
    expect(emitText).toContain("publicLinksReady")
    expect(emitText).toContain("smoke.ubuntu === \"passed\"")
    expect(emitText).toContain("smoke.windows === \"passed\"")
    expect(emitText).toContain("PACKAGE_URL")
    expect(emitText).toContain("TAG_URL")
    expect(emitText).toContain("RELEASE_URL")
    expect((emitText.match(/Next action:/g) ?? []).length).toBe(1)
  })

  test("gates npm publication on an accepted absent-version release state", async () => {
    const { document } = await readWorkflow()
    const publish = document.jobs?.publish ?? {}
    const publishStep = namedStep(publish, "Publish exact stable package")
    const publishText = runText(publishStep)

    expect(publish.if).toContain("inputs.mode == 'release'")
    expect(publish.if).toContain("needs.remote_state.outputs.action == 'publish'")
    expect(publish.needs).toEqual(["preflight", "remote_state"])
    expect(publish.permissions).toEqual({ contents: "read", "id-token": "write" })
    expect(runText(namedStep(publish, "Recheck accepted candidate before publish"))).toContain("bun run release:check")
    expect(publishStep.env?.NODE_AUTH_TOKEN).toBe("${{ secrets.NPM_TOKEN }}")
    expect(publishText).toContain("NODE_AUTH_TOKEN")
    expect(publishText).toContain("NPM_TOKEN repository secret is required")
    expect(publishText).toContain("NPM_CONFIG_USERCONFIG")
    expect(publishText).toContain("npm publish --access public")
    expect(publishText).toContain("--provenance")
    expect(publishText).toContain("npm view")
    expect(publishText).toContain("after retries")
    expect(publishText).toContain("published-package.json")
  })

  test("proves published npm state before reconcile and has no reconcile publish path", async () => {
    const { document } = await readWorkflow()
    const remoteState = document.jobs?.remote_state ?? {}
    const metadata = document.jobs?.metadata ?? {}
    const metadataIf = typeof metadata.if === "string" ? metadata.if : ""

    expect(metadataIf).toContain("inputs.mode == 'reconcile'")
    expect(metadataIf).toContain("needs.remote_state.outputs.npm_state == 'published'")
    expect(metadataIf).toContain("needs.remote_state.outputs.status != 'blocked'")
    expect(jobRunText(metadata)).not.toMatch(/\bnpm\s+publish\b/i)
    expect(runText(namedStep(metadata, "Revalidate candidate and npm publication before metadata mutation"))).toContain("npm view")
    expect(runText(namedStep(remoteState, "Classify remote state and write handoff"))).toContain("reconcile")

    for (const [jobId, job] of Object.entries(document.jobs ?? {})) {
      if (jobId !== "publish") expect(jobRunText(job)).not.toMatch(/\bnpm\s+publish\b/i)
    }
  })

  test("verifies an annotated tag before generated-note Release creation and appends the fixed footer", async () => {
    const { document, source } = await readWorkflow()
    const metadata = document.jobs?.metadata ?? {}
    const metadataSteps = steps(metadata)
    const tagStep = namedStep(metadata, "Create or verify exact annotated tag")
    const releaseStep = namedStep(metadata, "Create or verify GitHub Release with generated notes")

    expect(metadataSteps.indexOf(tagStep)).toBeLessThan(metadataSteps.indexOf(releaseStep))
    expect(runText(tagStep)).toContain("git tag -a")
    expect(runText(tagStep)).toContain("git push origin")
    expect(runText(tagStep)).toContain("FETCH_HEAD^{commit}")
    expect(runText(tagStep)).not.toMatch(/--force|--clobber|--delete/)
    expect(runText(releaseStep)).toContain("gh release create")
    expect(runText(releaseStep)).toContain("--verify-tag")
    expect(runText(releaseStep)).toContain("--generate-notes")
    expect(runText(releaseStep)).toContain("gh release edit")
    expect(runText(releaseStep)).toContain("formatReleaseFooter")
    expect(runText(releaseStep)).toContain("tag_name")
    expect(runText(releaseStep)).toContain("target_commitish")
    expect(runText(releaseStep)).toContain("npm install --global")
    expect(runText(releaseStep)).toContain("spec-finder upgrade")
    expect(source).not.toMatch(/git\s+push[^\n]*(?:--force|--force-with-lease)/i)
  })

  test("keeps metadata mismatches blocked and records partial recovery outcomes", async () => {
    const { document, source } = await readWorkflow()
    const remoteState = document.jobs?.remote_state ?? {}
    const metadata = document.jobs?.metadata ?? {}
    const summary = document.jobs?.summary ?? {}
    const metadataBoundary = namedStep(metadata, "Record metadata recovery boundary")
    const finalSummary = namedStep(summary, "Emit final plain-text release summary")

    expect(jobRunText(remoteState).toLowerCase()).toContain("mismatch")
    expect(runText(metadataBoundary)).toContain("npm publication is immutable")
    expect(runText(metadataBoundary)).toContain("Result: partial")
    expect(runText(finalSummary)).toContain("Run reconcile mode")
    expect(runText(finalSummary)).toContain("do not republish npm")
    expect(source).not.toMatch(/git\s+push[^\n]*--force/i)
    expect(source).not.toMatch(/gh\s+release\s+(?:create|edit)[^\n]*--clobber/i)
  })
})
