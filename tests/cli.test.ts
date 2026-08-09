import { describe, expect, test } from "bun:test"
import { main } from "../src/cli.tsx"

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
    for (const outcome of ["succeeded", "already complete", "failed", "cancelled", "not_started", "no automatic retry", "rerun manually"]) {
      expect(help).toContain(outcome)
    }
    expect(help).not.toContain("--retry")
    expect(help).not.toContain("--parallel")
  })
})
