import { describe, expect, test } from "bun:test"
import { parseLoopArgs } from "../src/commands.ts"

describe("loop argument parser", () => {
  test("accepts a slug with dry-run and max-iterations", () => {
    expect(parseLoopArgs(["my-feature", "--dry-run", "--max-iterations", "4"])).toEqual({
      mode: "loop",
      slug: "my-feature",
      dryRun: true,
      resetState: false,
      maxIterations: 4,
    })
  })

  test("last repeated provider value wins", () => {
    const parsed = parseLoopArgs(["my-feature", "--provider", "claude", "--provider", "codex"])
    expect(parsed.mode).toBe("loop")
    expect(parseLoopArgs(["my-feature", "--max-iterations", "2", "--max-iterations", "9"])).toMatchObject({
      mode: "loop",
      maxIterations: 9,
    })
  })

  test.each([
    { args: ["my-feature", "--multiple"], code: "multiple_unsupported" },
    { args: ["my-feature", "extra"], code: "extra_positional" },
    { args: ["my-feature", "--unknown"], code: "unknown_option" },
    { args: ["my-feature", "--model"], code: "missing_value" },
    { args: ["my-feature", "--model", "--dry-run"], code: "option_like_value" },
    { args: ["my-feature", "--max-iterations", "0"], code: "invalid_integer" },
    { args: [], code: "missing_slug" },
  ])("rejects invalid invocation %#", ({ args, code }) => {
    const result = parseLoopArgs(args)
    expect(result.mode).toBe("error")
    if (result.mode === "error") expect(result.error.code).toBe(code)
  })
})
