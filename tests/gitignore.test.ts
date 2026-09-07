import { describe, expect, test } from "bun:test"
import {
  PACKET_GITIGNORE_COMMENT,
  PACKET_GITIGNORE_PATHS,
  gitignoreCovers,
  mergeWorkspaceGitignore,
} from "../src/gitignore.ts"

describe("packet gitignore", () => {
  test("creates the packet ignore block when no gitignore exists", () => {
    const merged = mergeWorkspaceGitignore(undefined)
    expect(merged.changed).toBe(true)
    expect(merged.content).toBe(
      `${PACKET_GITIGNORE_COMMENT}\n${PACKET_GITIGNORE_PATHS.join("\n")}\n`,
    )
  })

  test("appends only missing packet paths and preserves existing rules", () => {
    const merged = mergeWorkspaceGitignore("*.tmp\n")
    expect(merged.changed).toBe(true)
    expect(merged.content).toBe(
      `*.tmp\n\n${PACKET_GITIGNORE_COMMENT}\n${PACKET_GITIGNORE_PATHS.join("\n")}\n`,
    )
  })

  test("adds only the missing ignore paths when some are already ignored", () => {
    const merged = mergeWorkspaceGitignore("/tasks/\n/tasks_done/\n")
    expect(merged.changed).toBe(true)
    expect(merged.content).toContain("/tasks/\n")
    expect(merged.content).toContain("/tasks_done/\n")
    expect(merged.content).toContain("/specs/\n")
    expect(merged.content.match(/\/tasks\//g)).toHaveLength(1)
    expect(merged.content.match(/\/specs\//g)).toHaveLength(1)
  })

  test("leaves an already complete gitignore byte-for-byte unchanged", () => {
    const existing = "*.tmp\n/tasks/\n/tasks_done/\n/specs/\n"
    expect(mergeWorkspaceGitignore(existing)).toEqual({ content: existing, changed: false })
  })

  test("treats unanchored tasks/, tasks_done/, and specs/ as already covering those dirs", () => {
    expect(gitignoreCovers("tasks/\n", "/tasks/")).toBe(true)
    expect(gitignoreCovers("/tasks_done/\n", "/tasks_done/")).toBe(true)
    expect(gitignoreCovers("specs/\n", "/specs/")).toBe(true)
    expect(mergeWorkspaceGitignore("tasks/\ntasks_done/\nspecs/\n")).toEqual({
      content: "tasks/\ntasks_done/\nspecs/\n",
      changed: false,
    })
  })

  test("does not treat comments or negations as coverage", () => {
    expect(gitignoreCovers("# /tasks/\n", "/tasks/")).toBe(false)
    expect(gitignoreCovers("!/tasks/\n", "/tasks/")).toBe(false)
  })

  test("preserves CRLF when appending to a Windows gitignore", () => {
    const merged = mergeWorkspaceGitignore("*.tmp\r\n")
    expect(merged.changed).toBe(true)
    expect(merged.content).toBe(
      `*.tmp\r\n\r\n${PACKET_GITIGNORE_COMMENT}\r\n${PACKET_GITIGNORE_PATHS.join("\r\n")}\r\n`,
    )
  })
})
