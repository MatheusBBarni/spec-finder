import { afterEach, describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  CheckpointService,
  checkpointCommitMessage,
  parseCachedDiff,
  parsePorcelainStatus,
  runGit as runCheckpointGit,
} from "../src/checkpoints.ts"
import { parseTask, updateTaskStatus, type TaskFile } from "../src/tasks.ts"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("checkpoint Git parsing", () => {
  test("parses clean, staged, modified, untracked, renamed, unusual, and NUL-delimited status", () => {
    const entries = parsePorcelainStatus(
      " M src/working file.ts\0A  src/staged.ts\0?? src/untracked\nfile.ts\0R  src/new name.ts\0src/old name.ts\0",
    )

    expect(entries).toHaveLength(4)
    expect(entries[0]).toMatchObject({ status: " M", indexStatus: " ", worktreeStatus: "M", path: "src/working file.ts", kind: "ordinary" })
    expect(entries[1]).toMatchObject({ status: "A ", indexStatus: "A", worktreeStatus: " ", path: "src/staged.ts" })
    expect(entries[2]).toMatchObject({ status: "??", kind: "untracked", path: "src/untracked\nfile.ts" })
    expect(entries[3]).toMatchObject({
      status: "R ",
      kind: "rename",
      path: "src/new name.ts",
      originalPath: "src/old name.ts",
      paths: ["src/new name.ts", "src/old name.ts"],
    })
    expect(() => parsePorcelainStatus("UU conflict.ts\0")).not.toThrow()
    expect(parsePorcelainStatus("UU conflict.ts\0")[0]?.ambiguous).toBe(true)
  })

  test("parses cached name-status paths and rejects malformed NUL output", () => {
    const entries = parseCachedDiff("M\tsrc/file.ts\0R100\tsrc/new.ts\0src/old.ts\0")
    expect(entries).toEqual([
      { status: "M", paths: ["src/file.ts"], ambiguous: false },
      { status: "R100", paths: ["src/new.ts", "src/old.ts"], ambiguous: false },
    ])
    expect(parseCachedDiff("U\0conflict.ts\0")[0]?.ambiguous).toBe(true)
    expect(() => parsePorcelainStatus(" M file.ts")).toThrow("NUL-delimited")
    expect(() => parseCachedDiff("M\tfile.ts")).toThrow("NUL-delimited")
  })

  test("produces the deterministic task checkpoint message", () => {
    expect(checkpointCommitMessage("task_03")).toBe("chore(spec-finder): checkpoint task_03")
    expect(() => checkpointCommitMessage("task;push")).toThrow("invalid task ID")
  })
})

describe("safe Git checkpoint service", () => {
  test("creates one local commit containing only temporal candidate paths", async () => {
    const fixture = await createFixture()
    const calls: string[][] = []
    const service = new CheckpointService({
      enabled: true,
      git: async (args, cwd) => {
        calls.push([...args])
        return runCheckpointGit(args, cwd)
      },
    })

    expect((await service.begin(fixture.input)).state).toBe("created")
    await mkdir(join(fixture.root, ".spec-finder", "tasks", "demo", "memory"), { recursive: true })
    await mkdir(join(fixture.root, ".spec-finder", "tasks", "demo", "reports"), { recursive: true })
    await mkdir(join(fixture.root, "src"), { recursive: true })
    await writeFile(join(fixture.root, "src", "implementation.ts"), "export const delivered = true\n")
    await writeFile(join(fixture.root, "src", "unusual name\n.ts"), "export const unusual = true\n")
    await writeFile(join(fixture.root, ".spec-finder", "tasks", "demo", "memory", "task_01.md"), "# Task memory\n")
    await writeFile(join(fixture.root, ".spec-finder", "tasks", "demo", "reports", "task_01.md"), "# Evidence\n\n" + "Verified.\n".repeat(24))
    await updateTaskStatus(await readTask(fixture.taskPath), "completed")

    const outcome = await service.complete(fixture.input)
    expect(outcome.state).toBe("created")
    expect(outcome.commit).toMatch(/^[a-f0-9]{40,64}$/)
    expect(await gitText(fixture.root, ["rev-list", "--count", "HEAD"])).toBe("2")
    expect(await gitText(fixture.root, ["show", "-s", "--format=%s", "HEAD"])).toBe("chore(spec-finder): checkpoint task_01")
    expect(await gitText(fixture.root, ["status", "--porcelain"])).toBe("")

    const tree = await gitText(fixture.root, ["-c", "core.quotePath=false", "ls-tree", "-r", "-z", "--name-only", "HEAD"])
    expect(tree).toContain("src/implementation.ts")
    expect(tree).toContain("src/unusual name\n.ts")
    expect(tree).toContain(".spec-finder/tasks/demo/reports/task_01.md")
    expect(tree).toContain(".spec-finder/tasks/demo/memory/task_01.md")
    expect(tree).toContain(".spec-finder/tasks/demo/task_01.md")
    expect(tree).not.toContain("unrelated.txt")
    expect((await readTask(fixture.taskPath)).frontmatter.checkpoint).toBeUndefined()

    const forbidden = new Set(["push", "stash", "reset", "clean"])
    expect(calls.some((args) => forbidden.has(args[0] ?? ""))).toBe(false)
    expect(calls.some((args) => args.includes("--no-verify") || args.includes("--author"))).toBe(false)
    expect(calls.some((args) => args[0] === "add" && args[1] === "--")).toBe(true)
    expect(calls.find((args) => args[0] === "commit")).toEqual(["commit", "-m", "chore(spec-finder): checkpoint task_01"])
  })

  test("refuses dirty, staged, and untracked baselines without a commit", async () => {
    for (const mode of ["modified", "staged", "untracked"] as const) {
      const fixture = await createFixture()
      const path = join(fixture.root, "unrelated.txt")
      await writeFile(path, "unrelated\n")
      if (mode === "staged") await runGit(fixture.root, ["add", "--", "unrelated.txt"])
      const service = new CheckpointService({ enabled: true })

      const outcome = await service.begin(fixture.input)
      expect(outcome.state).toBe("blocked")
      expect(outcome.message).toContain("pre-existing Git changes")
      expect(await gitText(fixture.root, ["rev-list", "--count", "HEAD"])).toBe("1")
      expect((await readTask(fixture.taskPath)).frontmatter.checkpoint).toBeUndefined()
    }
  })

  test("restores candidate staging after cached diff check failure", async () => {
    const fixture = await createFixture()
    const service = new CheckpointService({ enabled: true })
    await service.begin(fixture.input)
    await mkdir(join(fixture.root, "src"), { recursive: true })
    await writeFile(join(fixture.root, "src", "bad.ts"), "const bad = true  \n")
    await writeEvidenceAndComplete(fixture)

    const outcome = await service.complete(fixture.input)
    expect(outcome.state).toBe("blocked")
    expect(outcome.message).toContain("cached diff check failed")
    expect(await gitText(fixture.root, ["diff", "--cached", "--quiet"])).toBe("")
    expect((await readTask(fixture.taskPath)).frontmatter.checkpoint?.state).toBe("blocked")
    expect(await gitText(fixture.root, ["rev-list", "--count", "HEAD"])).toBe("1")
  })

  test("restores a partially staged candidate when git add fails", async () => {
    const fixture = await createFixture()
    let addAttempted = false
    const calls: string[][] = []
    const service = new CheckpointService({
      enabled: true,
      git: async (args, cwd) => {
        calls.push([...args])
        if (args[0] === "add" && !addAttempted) {
          addAttempted = true
          const partial = await runCheckpointGit(["add", "--", args[2] ?? ""], cwd)
          expect(partial.exitCode).toBe(0)
          return { exitCode: 1, stdout: "", stderr: "synthetic add failure" }
        }
        return runCheckpointGit(args, cwd)
      },
    })
    await service.begin(fixture.input)
    await mkdir(join(fixture.root, "src"), { recursive: true })
    await writeFile(join(fixture.root, "src", "partial.ts"), "export const partial = true\n")
    await writeEvidenceAndComplete(fixture)

    const outcome = await service.complete(fixture.input)
    expect(outcome.state).toBe("blocked")
    expect(outcome.message).toContain("git add failed")
    expect(await gitText(fixture.root, ["diff", "--cached", "--quiet"])).toBe("")
    expect(calls.some((args) => args[0] === "restore" && args[1] === "--staged")).toBe(true)
    expect((await readTask(fixture.taskPath)).frontmatter.checkpoint?.state).toBe("blocked")
  })

  test("surfaces a native hook failure and retries after the hook is removed", async () => {
    const fixture = await createFixture()
    const service = new CheckpointService({ enabled: true })
    await service.begin(fixture.input)
    await mkdir(join(fixture.root, "src"), { recursive: true })
    await writeFile(join(fixture.root, "src", "hooked.ts"), "export const hooked = true\n")
    await writeEvidenceAndComplete(fixture)

    const hook = join(fixture.root, ".git", "hooks", "pre-commit")
    await writeFile(hook, "#!/bin/sh\nprintf 'native hook rejected\\n' >&2\nexit 1\n")
    await chmod(hook, 0o755)

    const blocked = await service.complete(fixture.input)
    expect(blocked.state).toBe("blocked")
    expect(blocked.message).toContain("native hook rejected")
    expect((await readTask(fixture.taskPath)).frontmatter.checkpoint?.state).toBe("blocked")
    expect(await gitText(fixture.root, ["diff", "--cached", "--quiet"])).toBe("")

    await unlink(hook)
    const retried = await service.retry(fixture.input)
    expect(retried.state).toBe("created")
    expect(retried.commit).toMatch(/^[a-f0-9]{40,64}$/)
    expect((await readTask(fixture.taskPath)).frontmatter.checkpoint).toBeUndefined()
    expect(await gitText(fixture.root, ["rev-list", "--count", "HEAD"])).toBe("2")
  })

  test("refuses retry after base HEAD drift without staging", async () => {
    const fixture = await createFixture()
    const calls: string[][] = []
    const service = new CheckpointService({
      enabled: true,
      git: async (args, cwd) => {
        calls.push([...args])
        return runCheckpointGit(args, cwd)
      },
    })
    await service.begin(fixture.input)
    await mkdir(join(fixture.root, "src"), { recursive: true })
    await writeFile(join(fixture.root, "src", "drifted.ts"), "export const drifted = true\n")
    await writeEvidenceAndComplete(fixture)
    const hook = join(fixture.root, ".git", "hooks", "pre-commit")
    await writeFile(hook, "#!/bin/sh\nexit 1\n")
    await chmod(hook, 0o755)
    await service.complete(fixture.input)

    await writeFile(join(fixture.root, "drift.txt"), "new base\n")
    await unlink(hook)
    await runGit(fixture.root, ["add", "--", "drift.txt"])
    await runGit(fixture.root, ["commit", "-m", "drift"])
    const beforeAdd = calls.filter((args) => args[0] === "add").length
    const retry = await service.retry(fixture.input)
    expect(retry.state).toBe("blocked")
    expect(retry.message).toContain("HEAD changed")
    expect(calls.filter((args) => args[0] === "add")).toHaveLength(beforeAdd)
    expect(await gitText(fixture.root, ["rev-list", "--count", "HEAD"])).toBe("2")
  })

  test("returns disabled without touching Git", async () => {
    const fixture = await createFixture()
    let invoked = false
    const service = new CheckpointService({
      enabled: false,
      git: async () => {
        invoked = true
        return { exitCode: 0, stdout: "", stderr: "" }
      },
    })
    expect((await service.begin(fixture.input)).state).toBe("disabled")
    expect((await service.preserve(fixture.input)).state).toBe("disabled")
    expect((await service.complete(fixture.input)).state).toBe("disabled")
    expect((await service.retry(fixture.input)).state).toBe("disabled")
    expect(invoked).toBe(false)
  })
})

interface Fixture {
  root: string
  taskPath: string
  task: TaskFile
  input: { root: string; slug: string; task: TaskFile }
}

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-checkpoint-"))
  roots.push(root)
  const taskPath = join(root, ".spec-finder", "tasks", "demo", "task_01.md")
  await mkdir(join(root, ".spec-finder", "tasks", "demo"), { recursive: true })
  await mkdir(join(root, "src"), { recursive: true })
  await writeFile(join(root, "README.md"), "fixture\n")
  await writeFile(taskPath, `---
status: pending
title: Checkpoint task
type: backend
complexity: low
dependencies: []
---

# Task 01: Checkpoint task

## Overview
Fixture task.
`)
  await runGit(root, ["init", "-q"])
  await runGit(root, ["config", "user.name", "Spec Finder Test"])
  await runGit(root, ["config", "user.email", "spec-finder@example.test"])
  await runGit(root, ["add", "--", "README.md", ".spec-finder/tasks/demo/task_01.md"])
  await runGit(root, ["commit", "-m", "initial"])
  const task = await readTask(taskPath)
  return { root, taskPath, task, input: { root, slug: "demo", task } }
}

async function writeEvidenceAndComplete(fixture: Fixture): Promise<void> {
  const packet = join(fixture.root, ".spec-finder", "tasks", "demo")
  await mkdir(join(packet, "reports"), { recursive: true })
  await mkdir(join(packet, "memory"), { recursive: true })
  await writeFile(join(packet, "reports", "task_01.md"), "# Evidence\n\n" + "Verified.\n".repeat(24))
  await writeFile(join(packet, "memory", "task_01.md"), "# Task memory\n")
  await updateTaskStatus(await readTask(fixture.taskPath), "completed")
}

async function readTask(path: string): Promise<TaskFile> {
  return parseTask(path, await readFile(path, "utf8"))
}

async function runGit(root: string, args: readonly string[]): Promise<string> {
  const result = await runCheckpointGit(args, root)
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

async function gitText(root: string, args: readonly string[]): Promise<string> {
  return runGit(root, args)
}
