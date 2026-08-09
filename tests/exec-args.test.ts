import { describe, expect, test } from "bun:test"
import {
  parseExecArguments,
  parseExecArgumentsOrThrow,
} from "../src/commands.ts"

describe("exec argument parser", () => {
  test("accepts one prompt and keeps the last repeated override", () => {
    expect(parseExecArguments([
      "inspect the workspace",
      "--provider", "claude",
      "--provider", "codex",
      "--model", "first-model",
      "--model", "last-model",
      "--reasoning", "medium",
      "--speed", "fast",
    ])).toEqual({
      mode: "exec",
      prompt: "inspect the workspace",
      overrides: {
        provider: "codex",
        model: "last-model",
        reasoning: "medium",
        speed: "fast",
      },
    })
  })

  test("preserves prompt text while validating non-empty content", () => {
    expect(parseExecArguments(["  keep surrounding whitespace  "])).toEqual({
      mode: "exec",
      prompt: "  keep surrounding whitespace  ",
      overrides: {},
    })
    expect(parseExecArguments(["   "])).toMatchObject({ mode: "error", error: { code: "blank_prompt" } })
  })

  test.each([
    { args: [], code: "missing_prompt" },
    { args: ["--model", "model"], code: "missing_prompt" },
    { args: ["   "], code: "blank_prompt" },
    { args: ["prompt", "another"], code: "extra_positional" },
    { args: ["prompt", "--unknown", "value"], code: "unknown_option" },
    { args: ["prompt", "--model"], code: "missing_value" },
    { args: ["prompt", "--model", "--speed"], code: "option_like_value" },
    { args: ["prompt", "--provider=codex"], code: "unknown_option" },
  ])("rejects invalid invocation %#", ({ args, code }) => {
    const result = parseExecArguments(args)
    expect(result.mode).toBe("error")
    if (result.mode === "error") expect(result.error.code).toBe(code)
    expect(result).not.toHaveProperty("prompt")
    expect(result).not.toHaveProperty("overrides")
  })

  test("offers an exception adapter without routing or starting execution", () => {
    expect(parseExecArgumentsOrThrow(["prompt", "--speed", "normal"])).toEqual({
      mode: "exec",
      prompt: "prompt",
      overrides: { speed: "normal" },
    })
    expect(() => parseExecArgumentsOrThrow(["prompt", "--bogus"])).toThrow("unsupported exec option")
  })
})
