import { afterEach, describe, expect, test } from "bun:test"
import { access, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { setupWorkspace } from "../src/setup.ts"
import { DEFAULT_CONFIG } from "../src/config.ts"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

describe("setup", () => {
  test("creates config, task root, and skills for selected agents", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-setup-"))
    roots.push(root)
    const result = await setupWorkspace(root, ["codex", "cursor"])
    expect(result.configCreated).toBe(true)
    expect(JSON.parse(await readFile(join(root, ".spec-finder", "config.json"), "utf8")).provider).toBe("codex")
    await access(join(root, ".spec-finder", "tasks"))
    await access(join(root, ".agents", "skills", "sf-create-prd", "SKILL.md"))
    await access(join(root, ".cursor", "skills", "sf-task-report", "SKILL.md"))
    expect(result.copied).toHaveLength(12)
    expect(result.linked).toHaveLength(0)
    expect(result.canonical).toBeNull()
  })

  test("installs global skills below the supplied home directory while retaining project scaffolding", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-setup-"))
    roots.push(root)
    const homeDirectory = join(root, "home")
    const result = await setupWorkspace(root, ["claude"], {
      scope: "global",
      mode: "copy",
      homeDirectory,
    })

    await access(join(root, ".spec-finder", "config.json"))
    await access(join(homeDirectory, ".claude", "skills", "sf-create-prd", "SKILL.md"))
    expect(result.scope).toBe("global")
    expect(result.copied).toHaveLength(6)
    expect(result.copied).toContain(join(homeDirectory, ".claude", "skills", "sf-create-prd"))
  })

  test("rewrites a legacy verbose configuration to compact version 2", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-setup-"))
    roots.push(root)
    await mkdir(join(root, ".spec-finder"), { recursive: true })
    await writeFile(join(root, ".spec-finder", "config.json"), JSON.stringify({
      version: 1,
      provider: "codex",
      model: "auto",
      reasoning: "high",
      speed: "normal",
      mode: "agent",
      permissions: "prompt",
      report: { enabled: true, directory: "reports" },
      execution: { continueOnError: false, includeCompleted: false },
      providers: { codex: { command: "custom-command" } },
    }))

    const result = await setupWorkspace(root, ["codex"])

    expect(result.configCreated).toBe(false)
    expect(JSON.parse(await readFile(join(root, ".spec-finder", "config.json"), "utf8"))).toEqual(DEFAULT_CONFIG)
  })

  test("uses Codex as the canonical copied target and links other selected providers", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-setup-"))
    roots.push(root)
    const options = { scope: "local" as const, mode: "symlink" as const }
    const first = await setupWorkspace(root, ["claude", "codex", "cursor"], options)
    const canonicalSkill = join(root, ".agents", "skills", "sf-create-prd")
    const claudeSkill = join(root, ".claude", "skills", "sf-create-prd")
    const cursorSkill = join(root, ".cursor", "skills", "sf-create-prd")

    expect(first.canonical).toBe("codex")
    expect(first.copied).toHaveLength(6)
    expect(first.linked).toHaveLength(12)
    expect((await lstat(canonicalSkill)).isSymbolicLink()).toBe(false)
    expect((await lstat(claudeSkill)).isSymbolicLink()).toBe(true)
    expect((await lstat(cursorSkill)).isSymbolicLink()).toBe(true)
    expect(await realpath(claudeSkill)).toBe(await realpath(canonicalSkill))
    expect(await realpath(cursorSkill)).toBe(await realpath(canonicalSkill))

    const unrelatedSkill = join(root, ".agents", "skills", "unrelated-skill", "SKILL.md")
    const replacedFile = join(canonicalSkill, "replace-on-rerun.txt")
    await mkdir(join(root, ".agents", "skills", "unrelated-skill"), { recursive: true })
    await writeFile(unrelatedSkill, "keep me")
    await writeFile(replacedFile, "replace me")

    await setupWorkspace(root, ["claude", "codex", "cursor"], options)

    await access(unrelatedSkill)
    await expect(access(replacedFile)).rejects.toThrow()
    expect((await lstat(claudeSkill)).isSymbolicLink()).toBe(true)
  })

  test("uses the first selected provider as canonical when Codex is not selected", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-setup-"))
    roots.push(root)
    const result = await setupWorkspace(root, ["cursor", "claude"], { mode: "symlink" })

    expect(result.canonical).toBe("cursor")
    expect((await lstat(join(root, ".cursor", "skills", "sf-task-report"))).isSymbolicLink()).toBe(false)
    expect((await lstat(join(root, ".claude", "skills", "sf-task-report"))).isSymbolicLink()).toBe(true)
  })

  test("rejects local provider paths redirected through symlinks without touching external data", async () => {
    for (const nestedSkills of [false, true]) {
      const root = await mkdtemp(join(tmpdir(), "spec-finder-setup-"))
      const outside = await mkdtemp(join(tmpdir(), "spec-finder-outside-"))
      roots.push(root, outside)
      const externalSkills = nestedSkills ? outside : join(outside, "skills")
      const sentinel = join(externalSkills, "sf-create-prd", "sentinel.txt")
      await mkdir(join(externalSkills, "sf-create-prd"), { recursive: true })
      await writeFile(sentinel, "keep me")

      if (nestedSkills) {
        await mkdir(join(root, ".agents"), { recursive: true })
        await symlink(outside, join(root, ".agents", "skills"), "dir")
      } else {
        await symlink(outside, join(root, ".agents"), "dir")
      }

      await expect(setupWorkspace(root, ["codex"])).rejects.toThrow("local skill path contains a symlink")
      expect(await readFile(sentinel, "utf8")).toBe("keep me")
    }
  })

  test("rejects an empty provider selection", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-setup-"))
    roots.push(root)
    await expect(setupWorkspace(root, [])).rejects.toThrow("select at least one setup provider")
  })
})
