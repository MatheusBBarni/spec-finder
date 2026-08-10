import { join } from "node:path"
import { DEFAULT_CONFIG } from "../../src/config.ts"
import { runCommand } from "../../src/commands.ts"
import { parseTask } from "../../src/tasks.ts"

const slug = "failure-review-pty"
const root = process.cwd()
// Keep the fixture's command lock separate from a real run in the checkout.
// The fake runner never reads or writes this synthetic workspace root.
const runRoot = join(root, "tests", "fixtures", `.failure-review-pty-${process.pid}`)
const taskSource = `---
status: pending
title: Deterministic PTY failure
type: infra
complexity: low
dependencies: []
---

# Deterministic PTY failure

The task is intentionally failed by the fake runner.
`
const task = parseTask(join(root, "tests", "fixtures", "task_01.md"), taskSource)

const result = await runCommand([slug], {
  root: runRoot,
  input: process.stdin,
  output: process.stdout,
  loadConfig: async () => DEFAULT_CONFIG,
  runTaskPacket: async ({ emit }) => {
    emit({ type: "run_started", slug, config: DEFAULT_CONFIG, tasks: [task] })
    emit({ type: "task_status", taskId: task.id, status: "in_progress" })
    emit({ type: "activity", taskId: task.id, message: "deterministic fake runner started" })
    emit({ type: "task_status", taskId: task.id, status: "failed" })
    emit({
      type: "activity",
      taskId: task.id,
      message: "PTY fixture failure: line one\nPTY fixture failure: line two\nPTY fixture failure: line three",
    })
    emit({ type: "run_finished", ok: false, message: "Deterministic PTY fixture failed" })
    return { ok: false, completed: 0, failed: 1, blocked: 0 }
  },
})

process.stdout.write(`FIXTURE_EXIT=${result}\n`)
process.exitCode = result
