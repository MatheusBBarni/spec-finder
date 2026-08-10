import { afterEach, describe, expect, test } from "bun:test"
import { access, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_CONFIG, PROVIDERS, loadConfig } from "../src/config.ts"
import {
  SPEC_FINDER_SKILLS,
  SetupTransactionError,
  setupLockPath,
  setupWorkspace,
  type SetupRequest,
} from "../src/setup.ts"
import { getSetupProfile } from "../src/setup-profile.ts"

const roots: string[] = []

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

function request(provider: SetupRequest["provider"], scope: SetupRequest["scope"] = "local"): SetupRequest {
  return {
    provider,
    model: getSetupProfile(provider).defaultModel,
    speed: "normal",
    scope,
    origin: { provider: "default", model: "default", speed: "default" },
  }
}

async function tempRoot(prefix = "spec-finder-setup-"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

describe("setup", () => {
  test("installs exactly nine managed skills at every provider-derived local/global destination", async () => {
    for (const provider of PROVIDERS) {
      for (const scope of ["local", "global"] as const) {
        const root = await tempRoot()
        const home = await tempRoot("spec-finder-home-")
        const result = await setupWorkspace(root, request(provider, scope), { homeDirectory: home })
        const base = scope === "local" ? root : home
        const destination = getSetupProfile(provider).destination

        expect(result.provider).toBe(provider)
        expect(result.scope).toBe(scope)
        expect(result.destination).toBe(destination)
        expect(result.installed).toHaveLength(SPEC_FINDER_SKILLS.length)
        for (const skill of SPEC_FINDER_SKILLS) {
          await access(join(base, destination, skill, "SKILL.md"))
        }
        const config = await loadConfig(root)
        expect(config.setup).toEqual({ status: "configured", scope, destination })
      }
    }
  })

  test("creates task scaffolding and persists requested values without live provider discovery", async () => {
    const root = await tempRoot()
    const setupRequest = { ...request("codex"), model: "auto", speed: "fast", origin: { provider: "flag", model: "flag", speed: "flag" } } satisfies SetupRequest
    const result = await setupWorkspace(root, setupRequest)

    await access(join(root, ".spec-finder", "tasks"))
    const raw = JSON.parse(await readFile(join(root, ".spec-finder", "config.json"), "utf8"))
    expect(raw).toMatchObject({ provider: "codex", model: "auto", speed: "fast", version: 3 })
    expect(result.legacyCursor).toBe("absent")
    expect(raw.setup).toEqual({ status: "configured", scope: "local", destination: ".agents/skills" })
    expect(DEFAULT_CONFIG.reasoning).toBe("high")
  })

  test("uses auto reasoning for fresh and changed-to-Grok setup without overwriting saved Grok intent", async () => {
    const freshRoot = await tempRoot("spec-finder-grok-fresh-")
    await setupWorkspace(freshRoot, request("grok"))
    expect((await loadConfig(freshRoot)).reasoning).toBe("auto")

    const changedRoot = await tempRoot("spec-finder-grok-changed-")
    await mkdir(join(changedRoot, ".spec-finder"), { recursive: true })
    await writeFile(join(changedRoot, ".spec-finder", "config.json"), JSON.stringify({
      ...DEFAULT_CONFIG,
      provider: "codex",
      reasoning: "high",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    }))
    await setupWorkspace(changedRoot, request("grok"))
    expect((await loadConfig(changedRoot)).reasoning).toBe("auto")

    const savedRoot = await tempRoot("spec-finder-grok-saved-")
    await mkdir(join(savedRoot, ".spec-finder"), { recursive: true })
    await writeFile(join(savedRoot, ".spec-finder", "config.json"), JSON.stringify({
      ...DEFAULT_CONFIG,
      provider: "grok",
      reasoning: "low",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    }))
    await setupWorkspace(savedRoot, request("grok"))
    expect((await loadConfig(savedRoot)).reasoning).toBe("low")
  })

  test("preserves legacy Cursor content and unrelated selected-root skills byte-for-byte", async () => {
    const root = await tempRoot()
    const legacy = join(root, ".cursor", "skills")
    const unrelated = join(root, ".agents", "skills", "unrelated-skill")
    const unknownManagedLooking = join(root, ".agents", "skills", "sf-not-managed")
    await mkdir(legacy, { recursive: true })
    await mkdir(unrelated, { recursive: true })
    await mkdir(unknownManagedLooking, { recursive: true })
    await writeFile(join(legacy, "legacy.md"), "legacy bytes")
    await writeFile(join(unrelated, "SKILL.md"), "unrelated bytes")
    await writeFile(join(unknownManagedLooking, "SKILL.md"), "unknown bytes")

    const result = await setupWorkspace(root, request("cursor"))

    expect(result.legacyCursor).toBe("preserved")
    expect(await readFile(join(legacy, "legacy.md"), "utf8")).toBe("legacy bytes")
    expect(await readFile(join(unrelated, "SKILL.md"), "utf8")).toBe("unrelated bytes")
    expect(await readFile(join(unknownManagedLooking, "SKILL.md"), "utf8")).toBe("unknown bytes")
    await expect(access(join(root, ".cursor", "skills", "sf-task-report"))).rejects.toThrow()
    await access(join(root, ".agents", "skills", "sf-task-report", "SKILL.md"))
  })

  test("replaces only known managed entries while restoring the prior config on commit failure", async () => {
    const root = await tempRoot()
    const prior = join(root, ".agents", "skills", "sf-create-prd")
    await mkdir(prior, { recursive: true })
    await writeFile(join(prior, "sentinel.txt"), "prior managed bytes")
    await mkdir(join(root, ".spec-finder"), { recursive: true })
    await writeFile(join(root, ".spec-finder", "config.json"), JSON.stringify({
      ...DEFAULT_CONFIG,
      model: "saved-model",
    }))
    const beforeConfig = await readFile(join(root, ".spec-finder", "config.json"), "utf8")

    await expect(setupWorkspace(root, request("codex"), { failAt: "config" })).rejects.toThrow("setup failed during commit")
    expect(await readFile(join(prior, "sentinel.txt"), "utf8")).toBe("prior managed bytes")
    expect(await readFile(join(root, ".spec-finder", "config.json"), "utf8")).toBe(beforeConfig)
    await expect(access(join(root, ".agents", "skills", "sf-task-report"))).rejects.toThrow()
  })

  test("rolls back injected stage, backup, and promotion failures without losing prior state", async () => {
    for (const phase of ["stage", "backup", "promote"] as const) {
      const root = await tempRoot(`spec-finder-${phase}-failure-`)
      const prior = join(root, ".agents", "skills", "sf-create-prd")
      await mkdir(prior, { recursive: true })
      await writeFile(join(prior, "sentinel.txt"), `prior ${phase}`)
      const beforeConfig = JSON.stringify({ ...DEFAULT_CONFIG, model: `before-${phase}` })
      await mkdir(join(root, ".spec-finder"), { recursive: true })
      await writeFile(join(root, ".spec-finder", "config.json"), beforeConfig)

      await expect(setupWorkspace(root, request("codex"), { failAt: phase })).rejects.toThrow()
      expect(await readFile(join(prior, "sentinel.txt"), "utf8")).toBe(`prior ${phase}`)
      expect(await readFile(join(root, ".spec-finder", "config.json"), "utf8")).toBe(beforeConfig)
    }
  })

  test("fails closed before changing managed entries when local or global ancestors are symlinks", async () => {
    const localRoot = await tempRoot()
    const localOutside = await tempRoot("spec-finder-outside-")
    await symlink(localOutside, join(localRoot, ".agents"), "dir")
    await expect(setupWorkspace(localRoot, request("codex"))).rejects.toThrow("local skill path contains a symlink")
    await expect(access(join(localOutside, "sf-create-prd"))).rejects.toThrow()

    const globalRoot = await tempRoot()
    const globalHome = await tempRoot("spec-finder-home-")
    const globalOutside = await tempRoot("spec-finder-outside-")
    await mkdir(globalHome, { recursive: true })
    await symlink(globalOutside, join(globalHome, ".agents"), "dir")
    await expect(setupWorkspace(globalRoot, request("codex", "global"), { homeDirectory: globalHome }))
      .rejects.toThrow("global skill path contains a symlink")
    await expect(access(join(globalOutside, "sf-create-prd"))).rejects.toThrow()
  })

  test("fails closed on an existing selected-root transaction lock", async () => {
    const root = await tempRoot()
    const lockPath = setupLockPath(root, "codex", "local")
    await mkdir(join(root, ".agents"), { recursive: true })
    await writeFile(lockPath, "active")

    await expect(setupWorkspace(root, request("codex"))).rejects.toThrow("already locked")
    await expect(access(join(root, ".agents", "skills", "sf-task-report"))).rejects.toThrow()
    await expect(access(join(root, ".spec-finder", "config.json"))).rejects.toThrow()
  })

  test("retains recovery paths and withholds success when rollback or cleanup fails", async () => {
    const rollbackRoot = await tempRoot()
    let rollbackFailure = false
    const rollbackError = await setupWorkspace(rollbackRoot, request("codex"), {
      failure: async (phase) => {
        if (phase === "promote" && !rollbackFailure) {
          rollbackFailure = true
          throw new Error("injected promote failure")
        }
        if (phase === "rollback") throw new Error("injected rollback failure")
      },
    }).catch((error: unknown) => error)
    expect(rollbackError).toBeInstanceOf(SetupTransactionError)
    expect((rollbackError as SetupTransactionError).message).toContain("recovery artifacts retained")
    for (const path of (rollbackError as SetupTransactionError).recoveryPaths) {
      if (path.endsWith(".lock")) await access(path)
    }

    const cleanupRoot = await tempRoot()
    const cleanupError = await setupWorkspace(cleanupRoot, request("codex"), { failAt: "cleanup" }).catch((error: unknown) => error)
    expect(cleanupError).toBeInstanceOf(SetupTransactionError)
    expect((cleanupError as SetupTransactionError).phase).toBe("cleanup")
    expect((cleanupError as SetupTransactionError).message).toContain("recovery artifacts retained")
  })
})
