import { describe, expect, test } from "bun:test"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  TddOptInError,
  loadTddOptIn,
  parseTddOptIn,
  resolveTddPath,
} from "../src/tdd-opt-in.ts"

const PACKET_IDS = ["task_01", "task_02"] as const

describe("tdd.json opt-in", () => {
  test("missing file loads as undefined and resolves core", async () => {
    const packet = await mkdtemp(join(tmpdir(), "spec-finder-tdd-missing-"))
    const document = await loadTddOptIn(packet, PACKET_IDS)
    expect(document).toBeUndefined()
    expect(resolveTddPath(document, "task_01")).toBe("core")
    expect(resolveTddPath(document, "task_02")).toBe("core")
  })

  test("version-only document keeps every task on core", () => {
    const document = parseTddOptIn({ version: 1 })
    expect(resolveTddPath(document, "task_01")).toBe("core")
    expect(resolveTddPath(document, "task_02")).toBe("core")
  })

  test("packet tdd mark resolves every packet task id as tdd", () => {
    const document = parseTddOptIn({ version: 1, packet: "tdd" })
    expect(resolveTddPath(document, "task_01")).toBe("tdd")
    expect(resolveTddPath(document, "task_02")).toBe("tdd")
  })

  test("task list without packet mark opts only listed ids", () => {
    const document = parseTddOptIn({ version: 1, tasks: ["task_02"] })
    expect(resolveTddPath(document, "task_01")).toBe("core")
    expect(resolveTddPath(document, "task_02")).toBe("tdd")
  })

  test("packet mark still opts every task when a tasks list is also present", () => {
    const document = parseTddOptIn({ version: 1, packet: "tdd", tasks: ["task_02"] })
    expect(resolveTddPath(document, "task_01")).toBe("tdd")
    expect(resolveTddPath(document, "task_02")).toBe("tdd")
  })

  test("extra keys fail closed with path and issues", () => {
    expectTddOptInError(
      () => parseTddOptIn({ version: 1, extra: true }),
      "tdd.json",
    )
  })

  test("packet core is invalid", () => {
    expectTddOptInError(
      () => parseTddOptIn({ version: 1, packet: "core" }),
      "tdd.json",
    )
  })

  test("duplicate task ids fail closed", () => {
    expectTddOptInError(
      () => parseTddOptIn({ version: 1, tasks: ["task_02", "task_02"] }),
      "tdd.json",
    )
  })

  test("unknown task ids fail load with sidecar path and issues", async () => {
    const packet = await mkdtemp(join(tmpdir(), "spec-finder-tdd-unknown-"))
    const path = join(packet, "tdd.json")
    await writeFile(path, `${JSON.stringify({ version: 1, tasks: ["task_99"] })}\n`)
    try {
      await loadTddOptIn(packet, PACKET_IDS)
      throw new Error("expected loadTddOptIn to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(TddOptInError)
      const failure = error as TddOptInError
      expect(failure.path).toBe(path)
      expect(failure.message).toContain("tdd.json")
      expect(failure.issues.some((issue) => issue.includes("task_99"))).toBeTrue()
    }
  })

  test("invalid JSON fails load without falling back to core", async () => {
    const packet = await mkdtemp(join(tmpdir(), "spec-finder-tdd-json-"))
    const path = join(packet, "tdd.json")
    await writeFile(path, "{")
    await expect(loadTddOptIn(packet, PACKET_IDS)).rejects.toBeInstanceOf(TddOptInError)
    try {
      await loadTddOptIn(packet, PACKET_IDS)
    } catch (error) {
      expect((error as TddOptInError).path).toBe(path)
    }
  })
})

function expectTddOptInError(run: () => unknown, path: string): void {
  try {
    run()
    throw new Error("expected TddOptInError")
  } catch (error) {
    expect(error).toBeInstanceOf(TddOptInError)
    const failure = error as TddOptInError
    expect(failure.path).toBe(path)
    expect(failure.message).toContain("tdd.json")
    expect(failure.issues.length).toBeGreaterThan(0)
  }
}
