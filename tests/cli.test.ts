import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { main } from "../src/cli.tsx"

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

async function captureMain(argv: string[]): Promise<{ exit: number; stdout: string; stderr: string }> {
  const originalStdout = process.stdout.write
  const originalStderr = process.stderr.write
  let stdout = ""
  let stderr = ""
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
    return true
  }) as typeof originalStdout
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
    return true
  }) as typeof originalStderr

  try {
    const exit = await main(argv)
    return { exit, stdout, stderr }
  } finally {
    process.stdout.write = originalStdout
    process.stderr.write = originalStderr
  }
}

describe("CLI help", () => {
  test("publishes the singular setup contract in help and README", async () => {
    const help = await captureHelp()
    const setupUsage = "spec-finder setup [--agent claude|codex|cursor|grok|pi] [--model auto|CURATED] [--speed auto|normal|fast] [--local|--global] [--copy]"

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
        "Grok Build",
        "Pi",
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
    expect(help).not.toContain("[--agent claude|codex|cursor|grok|pi]...")
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

  test("omits exec from Usage and does not document Exec mode", async () => {
    const help = await captureHelp()

    expect(help).not.toContain('spec-finder exec "<prompt>"')
    expect(help).not.toContain("Exec mode:")
    expect(help).toContain("spec-finder run")
    expect(help).toContain("spec-finder loop")
  })

  test("treats leftover exec as an unknown command", async () => {
    const result = await captureMain(["exec"])

    expect(result.exit).toBe(2)
    expect(result.stdout).toBe("")
    expect(result.stderr.startsWith("unknown command: exec")).toBe(true)
    expect(result.stderr).toContain("unknown command: exec")
    expect(result.stderr).not.toContain('spec-finder exec "<prompt>"')
    expect(result.stderr).not.toContain("Exec mode:")
  })

  test("treats leftover exec with a prompt as an unknown command", async () => {
    const result = await captureMain(["exec", "prompt"])

    expect(result.exit).toBe(2)
    expect(result.stdout).toBe("")
    expect(result.stderr.startsWith("unknown command: exec")).toBe(true)
    expect(result.stderr).toContain("unknown command: exec")
    expect(result.stderr).not.toContain('spec-finder exec "<prompt>"')
    expect(result.stderr).not.toContain("Exec mode:")
  })

  test("keeps README lists honest and stubs leftover exec as not shipped", async () => {
    const help = await captureHelp()

    expect(README).not.toContain('spec-finder exec "<prompt>"')
    expect(README).not.toContain("spec-finder exec --provider grok")
    expect(README).not.toContain("spec-finder exec --provider pi")
    expect(README).not.toContain("Packet-free `exec`")
    expect(README).not.toContain("| One-turn `exec` |")
    expect(README).toContain("not shipped")
    expect(README).toContain("unavailable")
    for (const metric of ["M-01", "M-02", "M-03", "M-04", "M-05", "M-06", "M-07"]) {
      expect(README).not.toContain(metric)
    }
    for (const text of [help, README]) {
      expect(text).not.toContain('spec-finder exec "<prompt>"')
      expect(text).toContain("spec-finder run")
      expect(text).toContain("spec-finder loop")
    }
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

  test("documents spec-finder loop grammar, terminals, and flags", async () => {
    const help = await captureHelp()
    expect(help).toContain("spec-finder loop <task_slug>")
    for (const flag of ["--dry-run", "--reset-state", "--max-iterations", "--no-progress-window"]) {
      expect(help).toContain(flag)
    }
    for (const terminal of ["done", "no_op", "blocked", "failed", "exhausted", "stalled", "cancelled"]) {
      expect(help).toContain(terminal)
    }
  })

  test("keeps help and README aligned on loop vs run, exits, and dry-run", async () => {
    const help = await captureHelp()
    for (const text of [help, README]) {
      expect(text).toContain("spec-finder loop <task_slug>")
      expect(text).toContain("spec-finder run")
      expect(text).toContain("writes nothing")
      expect(text).toContain("0")
      expect(text).toContain("1")
      expect(text).toContain("2")
      expect(text).toContain("130")
    }
    expect(help).not.toContain("loop --multiple")
    expect(README).not.toContain("loop --multiple")
    expect(help).toContain("no required loop config key")
    expect(README).toContain("no required `loop` key")
  })

  test("documents ls and inspect grammar, empty success, and 0/2 exits", async () => {
    const help = await captureHelp()
    for (const text of [help, README]) {
      expect(text).toContain("spec-finder ls")
      expect(text).toContain("spec-finder inspect <task_slug>")
      expect(text).toContain("no active packets")
      expect(text).toContain("Missing or invalid packets exit 2")
      expect(text).toContain("exits 0 or 2 only")
      expect(text).toContain("starts no provider")
      expect(text).toContain("takes no run-lock")
      expect(text).toContain("writes nothing")
      expect(text).toContain("not archive-ready")
      expect(text).toContain("early-stage")
      expect(text).not.toContain("--json")
      expect(text).not.toContain("archive moves")
      expect(text).not.toContain("DONE/REMAINING")
    }
    expect(help).not.toContain("daemon")
    expect(help).not.toContain("tasks_done")
  })


})
