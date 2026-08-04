import { afterEach, describe, expect, test } from "bun:test"
import { access, mkdtemp, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { setupWorkspace } from "../src/setup.ts"

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
  })
})

