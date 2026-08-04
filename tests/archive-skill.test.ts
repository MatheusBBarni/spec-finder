import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

describe("archive skill classifier", () => {
  test("classifies completed, incomplete, and early-stage packets", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-archive-"))
    roots.push(root)
    const tasks = join(root, ".spec-finder", "tasks")
    await mkdir(join(tasks, "done"), { recursive: true })
    await mkdir(join(tasks, "remaining"), { recursive: true })
    await mkdir(join(tasks, "idea-only"), { recursive: true })
    await writeFile(join(tasks, "done", "task_01.md"), "---\nstatus: completed\n---\n\n# Done\n")
    await writeFile(join(tasks, "done", "_tasks.md"), "# Tasks\n\n| Task | Outcome |\n|---|---|\n")
    await writeFile(join(tasks, "remaining", "task_01.md"), "---\nstatus: blocked\n---\n\n# Blocked\n")
    await writeFile(join(tasks, "idea-only", "_idea.md"), "# Idea\n")

    const process = Bun.spawn([
      "bash",
      join(import.meta.dir, "..", "skills", "sf-archive-tasks", "scripts", "scan-tasks.sh"),
      tasks,
    ], { stdout: "pipe", stderr: "pipe" })
    const output = await new Response(process.stdout).text()
    const error = await new Response(process.stderr).text()

    expect(await process.exited).toBe(0)
    expect(error).toBe("")
    expect(output).toContain("VERDICT\tdone\tDONE\t1/1\tuntracked\tindexNoStatus")
    expect(output).toContain("VERDICT\tremaining\tREMAINING\t0/1\tuntracked\tnoIndex")
    expect(output).toContain("VERDICT\tidea-only\tEARLY-STAGE\t0/0\tuntracked\tnoIndex")
    expect(output).toContain("blocked")
  })
})
