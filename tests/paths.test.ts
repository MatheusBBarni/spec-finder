import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { assertInsideWorkspace } from "../src/paths.ts"

describe("workspace paths", () => {
  test("resolves relative ACP paths from the workspace root", () => {
    expect(assertInsideWorkspace("/tmp/spec-finder-root", "src/index.ts"))
      .toBe(join("/tmp/spec-finder-root", "src/index.ts"))
  })

  test("rejects parent traversal and sibling prefix tricks", () => {
    expect(() => assertInsideWorkspace("/tmp/spec-finder-root", "../outside.txt")).toThrow("path escapes workspace")
    expect(() => assertInsideWorkspace("/tmp/spec-finder-root", "/tmp/spec-finder-root-evil/file.txt"))
      .toThrow("path escapes workspace")
  })
})
