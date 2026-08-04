import { describe, expect, test } from "bun:test"
import { PassThrough } from "node:stream"
import { resolveSetupOptions } from "../src/commands.ts"
import type { SetupPickerInput } from "../src/ui/setup-picker.ts"

class FakeTtyInput extends PassThrough implements SetupPickerInput {
  isTTY = true
  isRaw = false
  readonly rawModes: boolean[] = []

  setRawMode(mode: boolean): void {
    this.isRaw = mode
    this.rawModes.push(mode)
  }
}

function terminalHarness(): {
  input: FakeTtyInput
  output: PassThrough
  text: () => string
} {
  const input = new FakeTtyInput()
  const output = new PassThrough()
  let rendered = ""
  output.on("data", (chunk) => { rendered += chunk.toString() })
  return { input, output, text: () => rendered }
}

async function waitForText(text: () => string, expected: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (text().includes(expected)) return
    await Bun.sleep(5)
  }
  throw new Error(`setup picker did not render ${JSON.stringify(expected)}`)
}

describe("setup command options", () => {
  test("keeps every repeated --agent selection and accepts explicit non-interactive choices", async () => {
    await expect(resolveSetupOptions([
      "--agent", "claude",
      "--agent", "cursor",
      "--agent", "claude",
      "--global",
      "--symlink",
    ], { interactive: false })).resolves.toEqual({
      targets: ["claude", "cursor", "claude"],
      scope: "global",
      mode: "symlink",
    })
  })

  test("uses all, local, and copy defaults without a terminal", async () => {
    await expect(resolveSetupOptions([], { interactive: false })).resolves.toEqual({
      targets: ["claude", "codex", "cursor"],
      scope: "local",
      mode: "copy",
    })
  })

  test("prompts only for setup choices omitted from flags", async () => {
    const terminal = terminalHarness()
    const resolution = resolveSetupOptions(["--agent", "codex", "--local"], {
      interactive: true,
      input: terminal.input,
      output: terminal.output,
    })
    await waitForText(terminal.text, "Choose skill installation mode")
    terminal.input.write("\u001B[B")
    terminal.input.write("\r")
    const options = await resolution

    expect(options).toEqual({ targets: ["codex"], scope: "local", mode: "symlink" })
    expect(terminal.text()).not.toContain("Select providers")
    expect(terminal.text()).not.toContain("Choose installation scope")
  })

  test("uses arrows, Space, and Enter across all interactive setup choices", async () => {
    const terminal = terminalHarness()
    const resolution = resolveSetupOptions([], {
      interactive: true,
      input: terminal.input,
      output: terminal.output,
    })

    await waitForText(terminal.text, "Select providers")
    terminal.input.write("\u001B[B\u001B[B")
    terminal.input.write(" ")
    terminal.input.write("\r")

    await waitForText(terminal.text, "Choose installation scope")
    terminal.input.write("\u001B[B")
    terminal.input.write("\r")

    await waitForText(terminal.text, "Choose skill installation mode")
    terminal.input.write("\u001B[B")
    terminal.input.write("\r")

    await expect(resolution).resolves.toEqual({
      targets: ["claude", "codex"],
      scope: "global",
      mode: "symlink",
    })
    expect(terminal.input.rawModes).toEqual([true, false, true, false, true, false])
    expect(terminal.input.isPaused()).toBe(true)
    expect(terminal.text()).toContain("↑/↓ move · Space toggle · Enter confirm · Esc cancel")
  })

  test("requires one provider and restores raw mode after cancellation", async () => {
    const terminal = terminalHarness()
    const resolution = resolveSetupOptions(["--local", "--copy"], {
      interactive: true,
      input: terminal.input,
      output: terminal.output,
    })

    await waitForText(terminal.text, "Select providers")
    terminal.input.write(" ")
    terminal.input.write("\u001B[B ")
    terminal.input.write("\u001B[B ")
    terminal.input.write("\r")
    await waitForText(terminal.text, "Select at least one provider before continuing")
    terminal.input.write("\u001B")

    await expect(resolution).rejects.toThrow("setup cancelled")
    expect(terminal.input.rawModes).toEqual([true, false])
    expect(terminal.input.isPaused()).toBe(true)
  })

  test("rejects conflicting flags and missing providers", async () => {
    await expect(resolveSetupOptions(["--global", "--local"], { interactive: false }))
      .rejects.toThrow("setup accepts either --global or --local, not both")
    await expect(resolveSetupOptions(["--symlink", "--copy"], { interactive: false }))
      .rejects.toThrow("setup accepts either --symlink or --copy, not both")
    await expect(resolveSetupOptions(["--agent"], { interactive: false }))
      .rejects.toThrow("setup requires a provider after --agent")
  })
})
