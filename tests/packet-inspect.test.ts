import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initLoopState, writeLoopState } from "../src/loop-state.ts"
import { inspectPacket, listActivePackets } from "../src/packet-inspect.ts"
import type { GlanceRow } from "../src/packet-inspect.ts"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

const baseHead = "a".repeat(40)
const baselineDigest = "b".repeat(64)

function taskMarkdown(number: number, title: string, extra = "", body = "Test task."): string {
  return `---
status: pending
title: ${title}
type: backend
complexity: low
dependencies: []
${extra}---

# Task ${number}: ${title}

## Overview
${body}
`
}

function completedTask(number: number, title: string, extra = ""): string {
  return taskMarkdown(number, title, extra).replace("status: pending", "status: completed")
}

function blockedCheckpoint(): string {
  return `checkpoint:
  state: blocked
  base_head: ${baseHead}
  baseline_digest: ${baselineDigest}
  paths:
    - src/example.ts
  error: gitignore blocked delivery
`
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-ls-"))
  roots.push(root)
  return root
}

async function workspace(): Promise<{ root: string; tasks: string }> {
  const root = await tempRoot()
  const tasks = join(root, ".spec-finder", "tasks")
  await mkdir(tasks, { recursive: true })
  return { root, tasks }
}

async function packetDir(tasks: string, slug: string): Promise<string> {
  const directory = join(tasks, slug)
  await mkdir(directory, { recursive: true })
  return directory
}

function bySlug(rows: GlanceRow[], slug: string): GlanceRow {
  const row = rows.find((candidate) => candidate.slug === slug)
  if (row === undefined) throw new Error(`missing glance row ${slug}`)
  return row
}

describe("listActivePackets", () => {
  test("classifies remaining, early-stage, blocked, invalid, and all-complete packets", async () => {
    const { root, tasks } = await workspace()

    const remaining = await packetDir(tasks, "remaining-work")
    await writeFile(join(remaining, "task_01.md"), completedTask(1, "Done remaining"))
    await writeFile(join(remaining, "task_02.md"), taskMarkdown(2, "Still open", "", "SECRET_BODY_PROSE"))

    await packetDir(tasks, "early-stage")

    const blockedCheckpointDir = await packetDir(tasks, "blocked-checkpoint")
    await writeFile(
      join(blockedCheckpointDir, "task_01.md"),
      completedTask(1, "Blocked delivery", blockedCheckpoint()),
    )

    const blockedHandoff = await packetDir(tasks, "blocked-handoff")
    await writeFile(
      join(blockedHandoff, "task_01.md"),
      taskMarkdown(1, "Handoff error", "handoff:\n  phase: report\n  error: report process exited\n"),
    )

    const handoffNoError = await packetDir(tasks, "handoff-remaining")
    await writeFile(
      join(handoffNoError, "task_01.md"),
      taskMarkdown(1, "Handoff pending", "handoff:\n  phase: report\n"),
    )

    const invalidParse = await packetDir(tasks, "invalid-parse")
    await writeFile(join(invalidParse, "task_01.md"), "not yaml\n")

    const invalidDeps = await packetDir(tasks, "invalid-deps")
    await writeFile(
      join(invalidDeps, "task_01.md"),
      taskMarkdown(1, "Unknown dep").replace("dependencies: []", "dependencies: [task_99]"),
    )

    await packetDir(tasks, "Invalid_Slug")

    const allComplete = await packetDir(tasks, "all-complete")
    await writeFile(join(allComplete, "task_01.md"), completedTask(1, "Finished one"))
    await writeFile(join(allComplete, "task_02.md"), completedTask(2, "Finished two"))

    await writeFile(join(tasks, ".gitkeep"), "")
    await writeFile(join(tasks, "notes.txt"), "not a packet")
    await mkdir(join(root, ".spec-finder", "tasks_done", "archived"), { recursive: true })
    await writeFile(
      join(root, ".spec-finder", "tasks_done", "archived", "task_01.md"),
      taskMarkdown(1, "Archived"),
    )

    const result = await listActivePackets(root)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.rows.map((row) => row.slug)).not.toContain("archived")
    expect(result.rows.map((row) => row.slug)).not.toContain(".gitkeep")
    expect(result.rows.map((row) => row.slug)).not.toContain("notes.txt")

    expect(bySlug(result.rows, "remaining-work")).toEqual({
      slug: "remaining-work",
      kind: "remaining",
      completed: 1,
      total: 2,
    })
    expect(bySlug(result.rows, "early-stage")).toEqual({
      slug: "early-stage",
      kind: "early-stage",
      completed: 0,
      total: 0,
    })
    expect(bySlug(result.rows, "blocked-checkpoint")).toEqual({
      slug: "blocked-checkpoint",
      kind: "blocked",
      completed: 0,
      total: 1,
    })
    expect(bySlug(result.rows, "blocked-handoff")).toEqual({
      slug: "blocked-handoff",
      kind: "blocked",
      completed: 0,
      total: 1,
    })
    expect(bySlug(result.rows, "handoff-remaining")).toEqual({
      slug: "handoff-remaining",
      kind: "remaining",
      completed: 0,
      total: 1,
    })
    expect(bySlug(result.rows, "all-complete")).toEqual({
      slug: "all-complete",
      kind: "remaining",
      completed: 2,
      total: 2,
    })

    const parseRow = bySlug(result.rows, "invalid-parse")
    expect(parseRow.kind).toBe("invalid")
    expect(parseRow.completed).toBe(0)
    expect(parseRow.total).toBe(0)
    expect(parseRow.detail).toContain("missing YAML frontmatter")

    const depsRow = bySlug(result.rows, "invalid-deps")
    expect(depsRow.kind).toBe("invalid")
    expect(depsRow.detail).toContain("unknown dependency task_99")

    expect(bySlug(result.rows, "Invalid_Slug")).toEqual({
      slug: "Invalid_Slug",
      kind: "invalid",
      completed: 0,
      total: 0,
      detail: "invalid slug",
    })
  })

  test("omits non-directories and returns an empty success list", async () => {
    const { root, tasks } = await workspace()
    await writeFile(join(tasks, ".gitkeep"), "")
    await writeFile(join(tasks, "orphan.md"), "# not a packet\n")

    expect(await listActivePackets(root)).toEqual({ ok: true, rows: [] })
  })

  test("fails when tasks/ is missing", async () => {
    const root = await tempRoot()
    await mkdir(join(root, ".spec-finder"), { recursive: true })

    const result = await listActivePackets(root)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe("tasks_unreadable")
    expect(result.message).toContain("cannot read .spec-finder/tasks")
  })

  test("marks a symlink that escapes the workspace as invalid", async () => {
    const { root, tasks } = await workspace()
    const outside = await tempRoot()
    await symlink(outside, join(tasks, "escaped-packet"))

    const result = await listActivePackets(root)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = bySlug(result.rows, "escaped-packet")
    expect(row.kind).toBe("invalid")
    expect(row.detail).toContain("path escapes workspace")
  })
})

describe("inspectPacket", () => {
  test("includes pending ids and blocked checkpoint reason", async () => {
    const { root, tasks } = await workspace()
    const directory = await packetDir(tasks, "blocked-work")
    await writeFile(
      join(directory, "task_01.md"),
      completedTask(1, "Blocked delivery", blockedCheckpoint()),
    )
    await writeFile(join(directory, "task_02.md"), taskMarkdown(2, "Still open"))

    const result = await inspectPacket(root, "blocked-work")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.kind).toBe("blocked")
    expect(result.remaining.map((task) => task.id)).toEqual(["task_01", "task_02"])
    expect(result.blockers).toEqual([
      { taskId: "task_01", kind: "checkpoint", message: "gitignore blocked delivery" },
    ])
    expect(result.loop).toEqual({ state: "absent" })
  })

  test("treats report handoff without error as remaining work", async () => {
    const { root, tasks } = await workspace()
    const directory = await packetDir(tasks, "handoff-remaining")
    await writeFile(
      join(directory, "task_01.md"),
      taskMarkdown(1, "Handoff pending", "handoff:\n  phase: report\n"),
    )

    const result = await inspectPacket(root, "handoff-remaining")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.kind).toBe("remaining")
    expect(result.blockers).toEqual([])
    expect(result.remaining).toEqual([{ id: "task_01", status: "pending" }])
  })

  test("maps loop absent, none, terminal, and invalid without failing the packet", async () => {
    const { root, tasks } = await workspace()

    const absentDir = await packetDir(tasks, "loop-absent")
    await writeFile(join(absentDir, "task_01.md"), taskMarkdown(1, "No ledger"))

    const noneDir = await packetDir(tasks, "loop-none")
    await writeFile(join(noneDir, "task_01.md"), taskMarkdown(1, "Null terminal"))
    await initLoopState(noneDir, { slug: "loop-none" })

    const doneDir = await packetDir(tasks, "loop-done")
    await writeFile(join(doneDir, "task_01.md"), taskMarkdown(1, "Done terminal"))
    const doneState = await initLoopState(doneDir, { slug: "loop-done" })
    await writeLoopState(doneDir, { ...doneState, terminal: "done" })

    const invalidDir = await packetDir(tasks, "loop-invalid")
    await writeFile(join(invalidDir, "task_01.md"), taskMarkdown(1, "Bad ledger"))
    await mkdir(join(invalidDir, "loop"), { recursive: true })
    await writeFile(join(invalidDir, "loop", "state.json"), "{")

    const absent = await inspectPacket(root, "loop-absent")
    expect(absent.ok).toBe(true)
    if (absent.ok) {
      expect(absent.loop).toEqual({ state: "absent" })
      expect(JSON.stringify(absent.loop)).not.toContain("done")
      expect(JSON.stringify(absent.loop)).not.toContain("no_op")
    }

    const none = await inspectPacket(root, "loop-none")
    expect(none.ok).toBe(true)
    if (none.ok) expect(none.loop).toEqual({ state: "none", terminal: null })

    const done = await inspectPacket(root, "loop-done")
    expect(done.ok).toBe(true)
    if (done.ok) expect(done.loop).toEqual({ state: "terminal", terminal: "done" })

    const invalid = await inspectPacket(root, "loop-invalid")
    expect(invalid.ok).toBe(true)
    if (!invalid.ok) return
    expect(invalid.loop.state).toBe("invalid")
    if (invalid.loop.state === "invalid") {
      expect(invalid.loop.message).toContain("invalid JSON")
    }
  })

  test("returns invalid_packet with issues for unreadable or invalid tasks", async () => {
    const { root, tasks } = await workspace()
    const unreadable = await packetDir(tasks, "invalid-parse")
    await writeFile(join(unreadable, "task_01.md"), "not yaml\n")
    const invalidDeps = await packetDir(tasks, "invalid-deps")
    await writeFile(
      join(invalidDeps, "task_01.md"),
      taskMarkdown(1, "Unknown dep").replace("dependencies: []", "dependencies: [task_99]"),
    )

    const parseResult = await inspectPacket(root, "invalid-parse")
    expect(parseResult.ok).toBe(false)
    if (!parseResult.ok) {
      expect(parseResult.code).toBe("invalid_packet")
      expect(parseResult.message).toContain("missing YAML frontmatter")
    }

    const depsResult = await inspectPacket(root, "invalid-deps")
    expect(depsResult.ok).toBe(false)
    if (!depsResult.ok) {
      expect(depsResult.code).toBe("invalid_packet")
      expect(depsResult.issues).toEqual(["unknown dependency task_99"])
    }
  })

  test("returns missing and invalid_slug failures", async () => {
    const { root } = await workspace()
    const missing = await inspectPacket(root, "no-such")
    expect(missing).toEqual({ ok: false, code: "missing", message: "packet is missing: no-such" })

    const invalidSlug = await inspectPacket(root, "Invalid_Slug")
    expect(invalidSlug).toEqual({
      ok: false,
      code: "invalid_slug",
      message: "invalid task slug: Invalid_Slug",
    })
  })

  test("inspects early-stage packets with zero remaining and no blockers", async () => {
    const { root, tasks } = await workspace()
    await packetDir(tasks, "early-stage")
    const result = await inspectPacket(root, "early-stage")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.kind).toBe("early-stage")
    expect(result.remaining).toEqual([])
    expect(result.blockers).toEqual([])
    expect(result.completed).toBe(0)
    expect(result.total).toBe(0)
  })
})
