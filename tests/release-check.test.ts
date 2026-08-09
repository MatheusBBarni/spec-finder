import { describe, expect, test } from "bun:test"
import {
  NPM_PACK_COMMAND,
  parsePackOutput,
  runReleaseCheck,
  type PackProcessResult,
  type PackProcessRunner,
} from "../scripts/release/check.ts"

const packedFiles = [
  { path: "LICENSE" },
  { path: "README.md" },
  { path: "dist/cli.js" },
  { path: "package.json" },
  { path: "skills/sf-memory/SKILL.md" },
]

function packOutput(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify([
    {
      name: "spec-finder",
      version: "0.1.0",
      files: packedFiles,
      ...overrides,
    },
  ])
}

function injectedPack(
  result: PackProcessResult,
  calls: string[][],
): PackProcessRunner {
  return async (command) => {
    calls.push([...command])
    return result
  }
}

describe("release check runner", () => {
  test("parses the local pack report and delegates accepted paths to task 01 helpers", async () => {
    const calls: string[][] = []
    const result = await runReleaseCheck({
      runPack: injectedPack(
        {
          exitCode: 0,
          stdout: `prepack progress\n${packOutput()}`,
          stderr: "",
        },
        calls,
      ),
    })

    expect(result.ok).toBe(true)
    expect(result.candidate).toMatchObject({
      name: "spec-finder",
      version: "0.1.0",
      tag: "v0.1.0",
    })
    expect(result.packedPaths).toContain("package/package.json")
    expect(calls).toEqual([[...NPM_PACK_COMMAND]])
  })

  test("fails with actionable text when npm pack output is malformed", async () => {
    await expect(
      runReleaseCheck({
        runPack: injectedPack(
          { exitCode: 0, stdout: "not-json", stderr: "" },
          [],
        ),
      }),
    ).rejects.toThrow("returned malformed JSON")
  })

  test("rejects empty, malformed, and structurally invalid pack reports", () => {
    expect(() => parsePackOutput("")).toThrow("returned no JSON")
    expect(() => parsePackOutput("progress [not-json")).toThrow("returned malformed JSON")
    expect(() => parsePackOutput("[{}]")).toThrow("not one package with a files list")
    expect(() => parsePackOutput(packOutput({ files: [{}] }))).toThrow("without a string path")
  })

  test("fails with the pack diagnostic when npm exits nonzero", async () => {
    await expect(
      runReleaseCheck({
        runPack: injectedPack(
          { exitCode: 17, stdout: "", stderr: "npm cache is unavailable" },
          [],
        ),
      }),
    ).rejects.toThrow("exited with code 17: npm cache is unavailable")
  })

  test("reports an injected process failure without falling through to parsing", async () => {
    await expect(
      runReleaseCheck({
        runPack: async () => {
          throw new Error("spawn exploded")
        },
      }),
    ).rejects.toThrow("unable to run npm pack --dry-run --json locally: spawn exploded")
  })

  test("fails closed when packed paths violate the allowlist", async () => {
    await expect(
      runReleaseCheck({
        runPack: injectedPack(
          {
            exitCode: 0,
            stdout: packOutput({ files: [...packedFiles, { path: "src/private.ts" }] }),
            stderr: "",
          },
          [],
        ),
      }),
    ).rejects.toThrow("packed-path allowlist")
  })

  test("fails closed when the pack identity violates the candidate contract", async () => {
    await expect(
      runReleaseCheck({
        runPack: injectedPack(
          { exitCode: 0, stdout: packOutput({ version: "1.2" }), stderr: "" },
          [],
        ),
      }),
    ).rejects.toThrow("candidate contract")
  })

  test("invokes exactly npm pack dry-run JSON and never a mutation command", async () => {
    const calls: string[][] = []
    await runReleaseCheck({
      runPack: injectedPack(
        { exitCode: 0, stdout: packOutput(), stderr: "" },
        calls,
      ),
    })

    expect(calls).toEqual([["npm", "pack", "--dry-run", "--json"]])
    expect(calls.flat()).not.toContain("publish")
    expect(calls.flat()).not.toContain("git")
    expect(calls.flat()).not.toContain("gh")
  })
})
