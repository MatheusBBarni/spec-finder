import { spawn } from "node:child_process"
import { writeFile } from "node:fs/promises"

const mode = process.argv[2] ?? "hold"
const recordPath = process.env.SPEC_FINDER_PROCESS_TREE_RECORD

const descendant = mode === "grandchild" || mode === "detached-grandchild" || mode === "parent-exits"
  ? spawn(process.execPath, ["-e", descendantProgram()], {
      detached: mode === "detached-grandchild",
      stdio: ["ignore", "inherit", "inherit"],
    })
  : undefined

if (descendant !== undefined && descendant.pid === undefined) throw new Error("process-tree fixture could not start its descendant")

if (recordPath !== undefined) {
  const record = {
    parentPid: process.pid,
    descendantPid: descendant?.pid ?? null,
    mode,
  }
  await writeFile(recordPath, `${JSON.stringify(record)}\n`)
}

process.stdout.write(`ready:${process.pid}\n`)

if (mode === "exit") process.exit(0)
if (mode === "exit-nonzero") process.exit(7)
if (mode === "parent-exits") process.exit(0)

setInterval(() => {}, 1_000)

function descendantProgram(): string {
  return [
    "process.on('SIGTERM', () => {})",
    "setInterval(() => {}, 1000)",
  ].join(";")
}
