import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { afterEach, describe, expect, test } from "bun:test"
import { assertInsideWorkspace, findExecWorkspace, resolveWorkspaceRelativeReference } from "../src/paths.ts"

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

  test("returns a slash-normalized relative reference for an internal artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-paths-"))
    roots.push(root)
    const report = join(root, ".spec-finder", "tasks", "demo", "reports", "task_01.md")
    await mkdir(join(root, ".spec-finder", "tasks", "demo", "reports"), { recursive: true })
    await writeFile(report, "report\n")

    expect(await resolveWorkspaceRelativeReference(root, report))
      .toBe(".spec-finder/tasks/demo/reports/task_01.md")
  })

  test("omits empty, traversal, absolute, control-containing, and external-symlink references", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-paths-"))
    const external = await mkdtemp(join(tmpdir(), "spec-finder-paths-external-"))
    roots.push(root, external)
    const outside = join(external, "report.md")
    await writeFile(outside, "report\n")
    const insideLink = join(root, "report-link.md")
    await symlink(outside, insideLink)
    const control = join(root, "report\n.md")
    await writeFile(control, "report\n")

    expect(await resolveWorkspaceRelativeReference(root, "")).toBeUndefined()
    expect(await resolveWorkspaceRelativeReference(root, relative(root, outside))).toBeUndefined()
    expect(await resolveWorkspaceRelativeReference(root, outside)).toBeUndefined()
    expect(await resolveWorkspaceRelativeReference(root, "C:\\outside\\report.md")).toBeUndefined()
    expect(await resolveWorkspaceRelativeReference(root, "\\\\server\\share\\report.md")).toBeUndefined()
    expect(await resolveWorkspaceRelativeReference(root, control)).toBeUndefined()
    expect(await resolveWorkspaceRelativeReference(root, insideLink)).toBeUndefined()
  })
})
