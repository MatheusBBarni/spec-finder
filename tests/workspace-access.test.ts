import { afterEach, describe, expect, test } from "bun:test"
import { access, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CanonicalWorkspaceAccess, WorkspaceAccessError } from "../src/workspace-access.ts"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

describe("canonical workspace access", () => {
  test("reads and writes safe nested text through the capability", async () => {
    const root = await createRoot()
    const accessCapability = new CanonicalWorkspaceAccess(root)
    const target = join(root, "nested", "answer.txt")
    const authorizations: string[] = []

    await accessCapability.writeTextFile(target, "safe", async (authorizedPath) => {
      authorizations.push(authorizedPath)
    })

    expect(authorizations).toEqual([target])
    expect(await accessCapability.readTextFile(target)).toBe("safe")
    expect(await accessCapability.workspaceRelativePath(join(root, "nested", "future.txt"))).toBe("nested/future.txt")
    expect(await readFile(target, "utf8")).toBe("safe")
  })

  test("rejects relative, traversal, sibling-prefix, and lexical alias paths before file access", async () => {
    const root = await createRoot()
    const accessCapability = new CanonicalWorkspaceAccess(root)
    const outside = join(root, "..", "outside.txt")

    for (const candidate of [
      "nested/file.txt",
      join(root, "nested", "..", "outside.txt"),
      `${root}-sibling/file.txt`,
      join(root, ".", "file.txt"),
      `${root}//file.txt`,
      `${root}/file.txt/`,
    ]) {
      await expect(accessCapability.readTextFile(candidate)).rejects.toBeInstanceOf(WorkspaceAccessError)
    }

    await expect(accessCapability.readTextFile(outside)).rejects.toMatchObject({ code: "path-escapes-workspace" })
  })

  test("rejects symlinked ancestors and final targets for reads and writes", async () => {
    const root = await createRoot()
    const outside = await mkdtemp(join(tmpdir(), "spec-finder-access-outside-"))
    roots.push(outside)
    const linkedDirectory = join(root, "linked")
    const linkedFile = join(root, "linked-file.txt")
    await writeFile(join(outside, "secret.txt"), "secret")
    await symlink(outside, linkedDirectory, "dir")
    await symlink(join(outside, "secret.txt"), linkedFile, "file")
    const accessCapability = new CanonicalWorkspaceAccess(root)

    await expect(accessCapability.readTextFile(join(linkedDirectory, "secret.txt"))).rejects.toMatchObject({
      code: "symlink-component",
    })
    await expect(accessCapability.readTextFile(linkedFile)).rejects.toMatchObject({ code: "symlink-component" })
    await expect(accessCapability.writeTextFile(join(linkedDirectory, "new.txt"), "nope", async () => {}))
      .rejects.toMatchObject({ code: "symlink-component" })
    await expect(accessCapability.writeTextFile(linkedFile, "nope", async () => {}))
      .rejects.toMatchObject({ code: "symlink-component" })
    expect(await readFile(join(outside, "secret.txt"), "utf8")).toBe("secret")
  })

  test("authorizes before creating missing directories and revalidates every created component", async () => {
    const root = await createRoot()
    const accessCapability = new CanonicalWorkspaceAccess(root)
    const target = join(root, "one", "two", "file.txt")
    let authorized = false

    await expect(accessCapability.writeTextFile(target, "blocked", async () => {
      expect(await exists(join(root, "one"))).toBe(false)
      throw new Error("denied")
    })).rejects.toThrow("denied")
    expect(await exists(join(root, "one"))).toBe(false)

    await accessCapability.writeTextFile(target, "created", async () => {
      authorized = true
    })
    expect(authorized).toBe(true)
    expect(await accessCapability.readTextFile(target)).toBe("created")
    expect((await lstat(join(root, "one", "two"))).isDirectory()).toBe(true)
  })

  test("fails closed when the workspace itself is a symlink", async () => {
    const realRoot = await createRoot()
    const linkParent = await mkdtemp(join(tmpdir(), "spec-finder-access-link-"))
    roots.push(linkParent)
    const linkedRoot = join(linkParent, "workspace")
    await symlink(realRoot, linkedRoot, "dir")

    await expect(new CanonicalWorkspaceAccess(linkedRoot).readTextFile(join(linkedRoot, "file.txt")))
      .rejects.toMatchObject({ code: "invalid-workspace" })
  })
})

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-access-"))
  roots.push(root)
  await mkdir(join(root, ".spec-finder"))
  return root
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
