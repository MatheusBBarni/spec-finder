import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { main } from "../src/cli.tsx"
import { parseExecArguments } from "../src/commands.ts"

const README = readFileSync(new URL("../README.md", import.meta.url), "utf8")

async function captureHelp(): Promise<string> {
  const originalWrite = process.stdout.write
  let output = ""
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
    return true
  }) as typeof originalWrite

  try {
    await main(["help"])
    return output
  } finally {
    process.stdout.write = originalWrite
  }
}

describe("CLI help", () => {
  test("publishes the singular setup contract in help and README", async () => {
    const help = await captureHelp()
    const setupUsage = "spec-finder setup [--agent claude|codex|cursor] [--model auto|CURATED] [--speed auto|normal|fast] [--local|--global] [--copy]"

    for (const text of [help, README]) {
      expect(text).toContain(setupUsage)
      for (const phrase of [
        "exactly one provider",
        "--model",
        "auto, normal, or fast",
        "--local",
        "--global",
        "--copy",
        "--symlink",
        "gpt-5.6-luna",
        "v3",
        "requested model",
        "requested speed",
        ".agents/skills",
        ".claude/skills",
        "not migrated",
      ]) {
        expect(text).toContain(phrase)
      }
    }

    expect(help).toContain("--symlink are rejected before any writes")
    expect(README).toContain("--symlink` are rejected before any writes")
    expect(README).toContain("historic installation scope is unknown")
    expect(README).toContain("Runtime ACP feedback is authoritative")
    expect(README).not.toContain("Space` to toggle providers")
    expect(README).not.toContain("repeat `--agent`")
    expect(README).not.toContain("--agent codex --agent cursor")
    expect(README).not.toContain("canonical provider")
    expect(README).not.toContain("seven bundled")
    expect(README).not.toContain("those seven")
    expect(README).not.toContain("[--copy|--symlink]")
    expect(README).not.toContain("| Cursor | `.cursor/skills` | `~/.cursor/skills` |")
    expect(help).not.toContain("[--agent claude|codex|cursor]...")
  })

  test("keeps the single-slug usage and exposes the opt-in batch grammar", async () => {
    const help = await captureHelp()

    expect(help).toContain("spec-finder run <task_slug>")
    expect(help).toContain("spec-finder run --multiple <slug1,slug2,...>")
    expect(help).toContain("exactly one ordered comma-separated slug list")
    expect(help).toContain("serial")
    expect(help).toContain("fail-fast")
  })

  test("names supported batch flags, rejection rules, and terminal outcomes", async () => {
    const help = await captureHelp()

    for (const flag of ["--no-ui", "--provider NAME", "--model ID", "--reasoning LEVEL", "--speed MODE"]) {
      expect(help).toContain(flag)
    }
    for (const term of ["positional slugs", "repeated --multiple", "empty or duplicate entries", "malformed or unknown packets", "option-like entries", "unknown options", "missing flag values"]) {
      expect(help).toContain(term)
    }
    for (const outcome of ["succeeded", "already complete", "failed", "cancelled", "not_started", "task phase retries once", "no automatic packet retry", "rerun manually"]) {
      expect(help).toContain(outcome)
    }
    expect(help).not.toContain("--retry")
    expect(help).not.toContain("--parallel")
  })

  test("documents the packet-free exec contract and its release gates", async () => {
    const help = await captureHelp()

    expect(help).toContain('spec-finder exec "<prompt>"')
    expect(help).toContain("exactly one non-empty positional prompt")
    expect(help).toContain("--provider is one of claude, codex, or cursor")
    expect(help).toContain("--model is non-empty")
    expect(help).toContain("--reasoning is auto|low|medium|high|xhigh|max|ultra")
    expect(help).toContain("--speed is auto|normal|fast")
    expect(help).toContain("CLI flags > nearest repository .spec-finder/config.json > ~/.spec-finder/config.json")
    expect(help).toContain("exactly one fresh ACP turn")
    expect(help).toContain("nearest complete repository profile")
    expect(help).toContain("approval policy, not an OS sandbox")
    expect(help).toContain("only a successful final answer goes to stdout")
    expect(help).toContain("Exits: 0 completed; 1 permission/refusal/limit/provider/cleanup failure; 2 invalid invocation/configuration/certification;")
    expect(help).toContain("exit 130")
    expect(help).toContain("task 09 certification")
    expect(help).toContain("all real providers")
    expect(help).toContain("write-capable access remain unavailable")
    expect(help).not.toContain("write-capable host access is enabled")
  })

  test("keeps README exec examples aligned with the parser and certified boundary", () => {
    const parsed = parseExecArguments([
      "summarize the current changes",
      "--provider", "codex",
      "--model", "auto",
      "--reasoning", "high",
      "--speed", "normal",
    ])
    expect(parsed).toMatchObject({
      mode: "exec",
      prompt: "summarize the current changes",
      overrides: { provider: "codex", model: "auto", reasoning: "high", speed: "normal" },
    })

    for (const text of [
      "spec-finder exec \"<prompt>\"",
      "CLI flags > nearest repository .spec-finder/config.json > ~/.spec-finder/config.json",
      "read-only",
      "direct canonical host access",
      "not a sandbox",
      "stderr",
      "stdout",
      "`0`",
      "`1`",
      "`2`",
      "`130`",
      "M-01",
      "M-02",
      "M-03",
      "M-04",
      "M-05",
      "M-06",
      "M-07",
      "telemetry",
      "task packet",
    ]) {
      expect(README).toContain(text)
    }
    expect(README).toContain("Task 09's certification is currently blocked")
    expect(README).toContain("Optional `session/close` is called only when the provider advertises that capability")
    expect(README).toContain("The reviewed task 09 certification record")
  })

  test("documents config-only local checkpoint phases and legacy-token rejection", async () => {
    const help = await captureHelp()

    expect(help).toContain("spec-finder checkpoint begin <task_slug> <task_id>")
    expect(help).toContain("spec-finder checkpoint complete <task_slug> <task_id>")
    expect(help).toContain(".spec-finder/config.json auto_commit: true")
    expect(help).toContain("local recovery checkpoints only")
    expect(help).toContain("never pushes")
    expect(help).toContain("Legacy auto-commit=true|false invocation tokens are rejected")
  })
})
