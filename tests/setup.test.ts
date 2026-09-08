import { afterEach, describe, expect, test } from "bun:test"
import { access, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { DEFAULT_CONFIG, PROVIDERS, loadConfig } from "../src/config.ts"
import {
  PACKET_GITIGNORE_COMMENT,
  PACKET_GITIGNORE_PATHS,
} from "../src/gitignore.ts"
import {
  SPEC_FINDER_SKILLS,
  SetupTransactionError,
  refreshManagedSkills,
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
  test("installs fourteen managed skills including the simplified write-spec path and the TDD pack at every provider-derived local/global destination", async () => {
    expect(SPEC_FINDER_SKILLS).toEqual([
      "sf-idea-factory",
      "sf-create-prd",
      "sf-create-techspec",
      "sf-create-tasks",
      "sf-write-spec",
      "sf-memory",
      "sf-execute-task",
      "sf-task-report",
      "sf-batch-tasks",
      "sf-tdd-plan",
      "sf-tdd-execute",
      "sf-tdd-report",
      "sf-tdd-batch",
      "sf-archive-tasks",
    ])
    expect(SPEC_FINDER_SKILLS).toHaveLength(14)
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
        expect(await realpath(result.skillRoot)).toBe(await realpath(join(base, destination)))
        expect(result.installed).toHaveLength(SPEC_FINDER_SKILLS.length)
        for (const skill of SPEC_FINDER_SKILLS) {
          const skillMd = await readFile(join(base, destination, skill, "SKILL.md"), "utf8")
          expect(skillMd.trim().length).toBeGreaterThan(0)
        }
        const writeSpec = await readFile(join(base, destination, "sf-write-spec", "SKILL.md"), "utf8")
        expect(writeSpec.trim().length).toBeGreaterThan(0)
        await access(join(base, destination, "sf-write-spec", "references", "doctrine.md"))
        await access(join(base, destination, "sf-write-spec", "references", "spec-template.md"))
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
    await access(join(root, ".spec-finder", "specs"))
    const raw = JSON.parse(await readFile(join(root, ".spec-finder", "config.json"), "utf8"))
    expect(raw).toMatchObject({ provider: "codex", model: "auto", speed: "fast", version: 3 })
    expect(result.legacyCursor).toBe("absent")
    expect(result.gitignoreStatus).toBe("created")
    expect(result.gitignorePath).toBe(join(root, ".spec-finder", ".gitignore"))
    expect(await readFile(join(root, ".spec-finder", ".gitignore"), "utf8")).toBe(
      `${PACKET_GITIGNORE_COMMENT}\n${PACKET_GITIGNORE_PATHS.join("\n")}\n`,
    )
    await expect(access(join(root, ".gitignore"))).rejects.toThrow()
    expect(raw.setup).toEqual({ status: "configured", scope: "local", destination: ".agents/skills" })
    expect(DEFAULT_CONFIG.reasoning).toBe("high")
  })

  test("appends packet ignore rules without rewriting unrelated spec-finder gitignore content", async () => {
    const root = await tempRoot()
    await mkdir(join(root, ".spec-finder"), { recursive: true })
    await writeFile(join(root, ".spec-finder", ".gitignore"), "*.tmp\n")
    await writeFile(join(root, ".gitignore"), "node_modules/\n")
    const result = await setupWorkspace(root, request("codex"))

    expect(result.gitignoreStatus).toBe("updated")
    expect(await readFile(join(root, ".spec-finder", ".gitignore"), "utf8")).toBe(
      `*.tmp\n\n${PACKET_GITIGNORE_COMMENT}\n${PACKET_GITIGNORE_PATHS.join("\n")}\n`,
    )
    expect(await readFile(join(root, ".gitignore"), "utf8")).toBe("node_modules/\n")
  })

  test("leaves an already complete packet gitignore unchanged on rerun", async () => {
    const root = await tempRoot()
    const first = await setupWorkspace(root, request("codex"))
    const ignore = await readFile(join(root, ".spec-finder", ".gitignore"), "utf8")
    const second = await setupWorkspace(root, request("codex"))

    expect(first.gitignoreStatus).toBe("created")
    expect(second.gitignoreStatus).toBe("unchanged")
    expect(await readFile(join(root, ".spec-finder", ".gitignore"), "utf8")).toBe(ignore)
  })

  test("does not change gitignore when config commit fails", async () => {
    const root = await tempRoot()
    await mkdir(join(root, ".spec-finder"), { recursive: true })
    await writeFile(join(root, ".spec-finder", ".gitignore"), "*.tmp\n")
    await writeFile(join(root, ".spec-finder", "config.json"), JSON.stringify({
      ...DEFAULT_CONFIG,
      model: "saved-model",
    }))

    await expect(setupWorkspace(root, request("codex"), { failAt: "config" })).rejects.toThrow("setup failed during commit")
    expect(await readFile(join(root, ".spec-finder", ".gitignore"), "utf8")).toBe("*.tmp\n")
  })

  test("rolls back a created gitignore when gitignore promotion fails", async () => {
    const root = await tempRoot()
    await expect(setupWorkspace(root, request("codex"), { failAt: "gitignore" })).rejects.toThrow("setup failed during commit")
    await expect(access(join(root, ".spec-finder", ".gitignore"))).rejects.toThrow()
    await expect(access(join(root, ".spec-finder", "config.json"))).rejects.toThrow()
  })

  test("fails closed before writes when the packet gitignore is a symlink", async () => {
    const root = await tempRoot()
    const outside = await tempRoot("spec-finder-ignore-outside-")
    await mkdir(join(root, ".spec-finder"), { recursive: true })
    await writeFile(join(outside, "ignore"), "outside\n")
    await symlink(join(outside, "ignore"), join(root, ".spec-finder", ".gitignore"))
    await expect(setupWorkspace(root, request("codex"))).rejects.toThrow("packet gitignore path contains a symlink")
    await expect(access(join(root, ".agents", "skills", "sf-create-prd"))).rejects.toThrow()
    expect(await readFile(join(outside, "ignore"), "utf8")).toBe("outside\n")
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

  test("uses auto reasoning for changed-to-Pi setup without overwriting saved Pi intent", async () => {
    const changedRoot = await tempRoot("spec-finder-pi-changed-")
    await mkdir(join(changedRoot, ".spec-finder"), { recursive: true })
    await writeFile(join(changedRoot, ".spec-finder", "config.json"), JSON.stringify({
      ...DEFAULT_CONFIG,
      provider: "codex",
      reasoning: "high",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    }))
    await setupWorkspace(changedRoot, request("pi"))
    expect((await loadConfig(changedRoot)).provider).toBe("pi")
    expect((await loadConfig(changedRoot)).reasoning).toBe("auto")
    expect((await loadConfig(changedRoot)).setup).toMatchObject({ destination: ".agents/skills" })

    const savedRoot = await tempRoot("spec-finder-pi-saved-")
    await mkdir(join(savedRoot, ".spec-finder"), { recursive: true })
    await writeFile(join(savedRoot, ".spec-finder", "config.json"), JSON.stringify({
      ...DEFAULT_CONFIG,
      provider: "pi",
      reasoning: "low",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    }))
    await setupWorkspace(savedRoot, request("pi"))
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
    await expect(setupWorkspace(localRoot, request("codex"))).rejects.toThrow("local skill path escapes allowed root")
    await expect(access(join(localOutside, "sf-create-prd"))).rejects.toThrow()

    const globalRoot = await tempRoot()
    const globalHome = await tempRoot("spec-finder-home-")
    const globalOutside = await tempRoot("spec-finder-outside-")
    await mkdir(globalHome, { recursive: true })
    await symlink(globalOutside, join(globalHome, ".agents"), "dir")
    await expect(setupWorkspace(globalRoot, request("codex", "global"), { homeDirectory: globalHome }))
      .rejects.toThrow("global skill path escapes allowed root")
    await expect(access(join(globalOutside, "sf-create-prd"))).rejects.toThrow()
  })

  test("installs managed skills through an in-root global destination symlink", async () => {
    const root = await tempRoot()
    const home = await tempRoot("spec-finder-home-")
    const realSkills = join(home, "dotfiles", "claude", "skills")
    await mkdir(realSkills, { recursive: true })
    await mkdir(join(home, ".claude"), { recursive: true })
    await symlink(realSkills, join(home, ".claude", "skills"), "dir")

    const result = await setupWorkspace(root, request("claude", "global"), { homeDirectory: home })

    expect(await realpath(result.skillRoot)).toBe(await realpath(realSkills))
    await access(join(realSkills, "sf-execute-task", "SKILL.md"))
    await access(join(home, ".claude", "skills", "sf-execute-task", "SKILL.md"))
  })

  test("serializes every provider and scope through one workspace transaction lock", async () => {
    const root = await tempRoot()
    const home = await tempRoot("spec-finder-home-")
    const lockPath = setupLockPath(root)
    await mkdir(dirname(lockPath), { recursive: true })
    await writeFile(lockPath, "active")

    await expect(setupWorkspace(root, request("codex"))).rejects.toThrow("already locked")
    await expect(setupWorkspace(root, request("claude", "global"), { homeDirectory: home })).rejects.toThrow("already locked")
    await expect(access(join(root, ".agents", "skills", "sf-task-report"))).rejects.toThrow()
    await expect(access(join(home, ".claude", "skills", "sf-task-report"))).rejects.toThrow()
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

  test("CLI global setup copies managed skills into HOME rather than the current workspace", async () => {
    const home = await tempRoot("spec-finder-cli-home-")
    const cwd = await tempRoot("spec-finder-cli-cwd-")
    const cli = join(import.meta.dir, "../src/cli.tsx")
    const proc = Bun.spawn([
      "bun",
      cli,
      "setup",
      "--agent",
      "pi",
      "--global",
      "--model",
      "auto",
      "--speed",
      "normal",
      "--copy",
    ], {
      cwd,
      env: { ...process.env, HOME: home, USERPROFILE: home },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    if (code !== 0) {
      throw new Error(`setup CLI exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`)
    }
    expect(stdout).toContain("scope: global")
    expect(stdout).toContain(`skill root: ${await realpath(join(home, ".agents/skills"))}`)
    await access(join(home, ".agents", "skills", "sf-execute-task", "SKILL.md"))
    await expect(access(join(cwd, ".agents", "skills", "sf-execute-task", "SKILL.md"))).rejects.toThrow()
  })
})

describe("refreshManagedSkills", () => {
  test("recopies managed skills without rewriting config or packet gitignore", async () => {
    const root = await tempRoot()
    await mkdir(join(root, ".spec-finder"), { recursive: true })
    const configBytes = JSON.stringify({
      ...DEFAULT_CONFIG,
      model: "saved-refresh-model",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })
    const gitignoreBytes = "*.tmp\n# operator ignore\n"
    await writeFile(join(root, ".spec-finder", "config.json"), configBytes)
    await writeFile(join(root, ".spec-finder", ".gitignore"), gitignoreBytes)

    const result = await refreshManagedSkills(root, { provider: "codex", scope: "local" })

    expect(result.destination).toBe(".agents/skills")
    expect(result.scope).toBe("local")
    expect(result.installed).toHaveLength(SPEC_FINDER_SKILLS.length)
    expect(await realpath(result.skillRoot)).toBe(await realpath(join(root, ".agents", "skills")))
    for (const skill of SPEC_FINDER_SKILLS) {
      const skillMd = await readFile(join(root, ".agents", "skills", skill, "SKILL.md"), "utf8")
      expect(skillMd.trim().length).toBeGreaterThan(0)
    }
    expect(await readFile(join(root, ".spec-finder", "config.json"), "utf8")).toBe(configBytes)
    expect(await readFile(join(root, ".spec-finder", ".gitignore"), "utf8")).toBe(gitignoreBytes)
    await expect(access(join(root, ".spec-finder", "tasks"))).rejects.toThrow()
    await expect(access(join(root, ".spec-finder", "specs"))).rejects.toThrow()
  })

  test("preserves unrelated destination skills and leftover Cursor or Pi paths", async () => {
    const root = await tempRoot()
    const leftoverCursor = join(root, ".cursor", "skills")
    const leftoverPi = join(root, ".pi", "skills")
    const unrelated = join(root, ".agents", "skills", "unrelated-skill")
    await mkdir(leftoverCursor, { recursive: true })
    await mkdir(leftoverPi, { recursive: true })
    await mkdir(unrelated, { recursive: true })
    await writeFile(join(leftoverCursor, "legacy.md"), "cursor leftover")
    await writeFile(join(leftoverPi, "legacy.md"), "pi leftover")
    await writeFile(join(unrelated, "SKILL.md"), "unrelated bytes")

    const result = await refreshManagedSkills(root, { provider: "codex", scope: "local" })

    expect(result.legacyCursor).toBe("preserved")
    expect(await readFile(join(leftoverCursor, "legacy.md"), "utf8")).toBe("cursor leftover")
    expect(await readFile(join(leftoverPi, "legacy.md"), "utf8")).toBe("pi leftover")
    expect(await readFile(join(unrelated, "SKILL.md"), "utf8")).toBe("unrelated bytes")
    await expect(access(join(root, ".cursor", "skills", "sf-task-report"))).rejects.toThrow()
    await access(join(root, ".agents", "skills", "sf-task-report", "SKILL.md"))
  })

  test("rolls back managed entries on stage or promote failure without touching config", async () => {
    for (const phase of ["stage", "promote"] as const) {
      const root = await tempRoot(`spec-finder-refresh-${phase}-`)
      const prior = join(root, ".agents", "skills", "sf-create-prd")
      await mkdir(prior, { recursive: true })
      await writeFile(join(prior, "sentinel.txt"), `prior refresh ${phase}`)
      const beforeConfig = JSON.stringify({
        ...DEFAULT_CONFIG,
        model: `refresh-before-${phase}`,
      })
      await mkdir(join(root, ".spec-finder"), { recursive: true })
      await writeFile(join(root, ".spec-finder", "config.json"), beforeConfig)

      await expect(refreshManagedSkills(root, { provider: "codex", scope: "local" }, { failAt: phase })).rejects.toThrow()
      expect(await readFile(join(prior, "sentinel.txt"), "utf8")).toBe(`prior refresh ${phase}`)
      expect(await readFile(join(root, ".spec-finder", "config.json"), "utf8")).toBe(beforeConfig)
      await expect(access(join(root, ".agents", "skills", "sf-task-report"))).rejects.toThrow()
    }
  })
})
