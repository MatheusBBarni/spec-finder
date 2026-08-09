import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { acquireRunLock } from "../src/run-lock.ts"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

describe("workspace run lock", () => {
  test("rejects a concurrent owner and allows the workspace after release", async () => {
    const fixture = await createFixture()
    const first = await acquireRunLock(fixture.root, { directory: fixture.locks })

    await expect(acquireRunLock(fixture.root, { directory: fixture.locks })).rejects.toThrow(
      `another Spec Finder run is active`,
    )

    await first.release()
    const next = await acquireRunLock(fixture.root, { directory: fixture.locks })
    await next.release()
  })

  test("recovers a lock whose recorded process no longer exists", async () => {
    const fixture = await createFixture()
    const stale = await acquireRunLock(fixture.root, { directory: fixture.locks, pid: 2_147_483_647 })
    const recovered = await acquireRunLock(fixture.root, { directory: fixture.locks })

    await recovered.release()
    await stale.release()
  })
})

async function createFixture(): Promise<{ root: string; locks: string }> {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-run-lock-"))
  roots.push(root)
  return { root, locks: join(root, "locks") }
}
