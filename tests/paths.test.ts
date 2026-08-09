import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "bun:test"
import { assertInsideWorkspace, findExecWorkspace } from "../src/paths.ts"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

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

  test("finds the nearest real marker without consulting configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-paths-"))
    roots.push(root)
    const nested = join(root, "packages", "app", "src")
    await mkdir(join(root, ".spec-finder"), { recursive: true })
    await mkdir(nested, { recursive: true })

    expect(await findExecWorkspace(nested)).toBe(await realpath(root))

    const nearest = join(root, "packages", "app", ".spec-finder")
    await mkdir(nearest)
    expect(await findExecWorkspace(nested)).toBe(await realpath(join(root, "packages", "app")))
  })

  test("skips a symlink marker and falls back to the canonical invocation directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-paths-"))
    const markerTarget = await mkdtemp(join(tmpdir(), "spec-finder-marker-"))
    roots.push(root, markerTarget)
    const nested = join(root, "nested")
    await mkdir(nested, { recursive: true })
    await symlink(markerTarget, join(root, ".spec-finder"), "dir")

    expect(await findExecWorkspace(nested)).toBe(await realpath(nested))
  })

  test("returns the canonical exact cwd when no marker exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-paths-"))
    roots.push(root)
    const nested = join(root, "nested")
    await mkdir(nested, { recursive: true })

    expect(await findExecWorkspace(nested)).toBe(await realpath(nested))
  })
})
