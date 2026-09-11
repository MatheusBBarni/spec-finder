import { describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile, access } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import type { SessionUpdate } from "@agentclientprotocol/sdk"
import { DEFAULT_CONFIG, parseConfig, type SpecFinderConfig } from "../src/config.ts"
import type { CheckpointServiceContract } from "../src/checkpoints.ts"
import { checkpointCommand, inspectCommand, INSPECT_USAGE, loopCommand, lsCommand, LS_USAGE, npmCliCommand, refreshCommand, REFRESH_USAGE, runCommand, resolveSetupOptions, setupCommand } from "../src/commands.ts"
import { describeLoopPaths } from "../src/loop-state.ts"
import { SPEC_FINDER_SKILLS, setupLockPath } from "../src/setup.ts"
import { acquireRunLock } from "../src/run-lock.ts"
import { CockpitStore } from "../src/ui/store.ts"
import type { BatchResult } from "../src/batch.ts"
import { parseTask, type TaskFile } from "../src/tasks.ts"
import type { SetupPickerInput } from "../src/ui/setup-picker.ts"
import { VERSION } from "../src/version.ts"

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

function commandOutput(isTTY = false): {
  output: PassThrough & { isTTY: boolean }
  text: () => string
} {
  const output = Object.assign(new PassThrough(), { isTTY })
  let rendered = ""
  output.on("data", (chunk) => { rendered += chunk.toString() })
  return { output, text: () => rendered }
}

async function waitForText(text: () => string, expected: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (text().includes(expected)) return
    await Bun.sleep(5)
  }
  throw new Error(`setup picker did not render ${JSON.stringify(expected)}`)
}

describe("setup command options", () => {
  test("rejects repeated providers, duplicate values, conflicting scope, symlink, and invalid curated models", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-opts-"))
    try {
      await expect(resolveSetupOptions(["--agent", "claude", "--agent", "claude"], { interactive: false, root }))
        .rejects.toThrow("repeated --agent")
      await expect(resolveSetupOptions(["--model", "auto", "--model", "fable"], { interactive: false, root }))
        .rejects.toThrow("duplicate setup option: --model")
      await expect(resolveSetupOptions(["--speed", "normal", "--speed", "fast"], { interactive: false, root }))
        .rejects.toThrow("duplicate setup option: --speed")
      await expect(resolveSetupOptions(["--global", "--local"], { interactive: false, root }))
        .rejects.toThrow("either --global or --local")
      await expect(resolveSetupOptions(["--symlink"], { interactive: false, root }))
        .rejects.toThrow("no longer supports --symlink")
      await expect(resolveSetupOptions(["--agent", "claude", "--model", "gpt-5.6-luna", "--local"], { interactive: false, root }))
        .rejects.toThrow("unsupported setup model")
      await expect(resolveSetupOptions(["--copy", "--local"], { interactive: false, root })).resolves.toMatchObject({
        provider: "codex",
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("uses Codex, its catalogue default, normal speed, and local scope for a fresh non-interactive workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-fresh-"))
    try {
      await expect(resolveSetupOptions([], { interactive: false, root })).resolves.toEqual({
        provider: "codex",
        model: "gpt-5.6-luna",
        speed: "normal",
        scope: "local",
        skills: [...SPEC_FINDER_SKILLS],
        origin: { provider: "default", model: "default", speed: "default" },
      })

    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("accepts Grok Build setup with its provider-directed model default", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-grok-setup-"))
    try {
      await expect(resolveSetupOptions(["--agent", "grok"], { interactive: false, root })).resolves.toEqual({
        provider: "grok",
        model: "auto",
        speed: "normal",
        scope: "local",
        skills: [...SPEC_FINDER_SKILLS],
        origin: { provider: "flag", model: "default", speed: "default" },
      })

      await expect(resolveSetupOptions(["--agent", "grok", "--model", "volatile-model"], { interactive: false, root }))
        .rejects.toThrow("unsupported setup model for grok")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("accepts Pi setup with auto model and rejects curated-looking ids", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-pi-setup-"))
    try {
      await expect(resolveSetupOptions(["--agent", "pi"], { interactive: false, root })).resolves.toEqual({
        provider: "pi",
        model: "auto",
        speed: "normal",
        scope: "local",
        skills: [...SPEC_FINDER_SKILLS],
        origin: { provider: "flag", model: "default", speed: "default" },
      })

      await expect(resolveSetupOptions(["--agent", "pi", "--model", "volatile-model"], { interactive: false, root }))
        .rejects.toThrow("unsupported setup model for pi")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("reuses configured provider/model/speed/scope and preserves a same-provider custom model", async () => {
    const configured = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "claude",
      model: "team-custom-model",
      speed: "fast",
      setup: { status: "configured", scope: "global", destination: ".claude/skills" },
    })
    await expect(resolveSetupOptions([], {
      interactive: false,
      root: "/tmp/spec-finder-saved-setup",
      loadConfig: async () => configured,
    })).resolves.toEqual({
      provider: "claude",
      model: "team-custom-model",
      speed: "fast",
      scope: "global",
      skills: [...SPEC_FINDER_SKILLS],
      origin: { provider: "saved", model: "saved", speed: "saved" },
    })

  })

  test("reuses a saved Grok provider and its provider-directed model", async () => {
    const configured = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "grok",
      model: "auto",
      speed: "fast",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })

    await expect(resolveSetupOptions([], {
      interactive: false,
      root: "/tmp/spec-finder-saved-grok-setup",
      loadConfig: async () => configured,
    })).resolves.toEqual({
      provider: "grok",
      model: "auto",
      speed: "fast",
      scope: "local",
      skills: [...SPEC_FINDER_SKILLS],
      origin: { provider: "saved", model: "saved", speed: "saved" },
    })

  })

  test("reuses a saved Pi provider and its provider-directed model", async () => {
    const configured = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "pi",
      model: "auto",
      speed: "fast",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })

    await expect(resolveSetupOptions([], {
      interactive: false,
      root: "/tmp/spec-finder-saved-pi-setup",
      loadConfig: async () => configured,
    })).resolves.toEqual({
      provider: "pi",
      model: "auto",
      speed: "fast",
      scope: "local",
      skills: [...SPEC_FINDER_SKILLS],
      origin: { provider: "saved", model: "saved", speed: "saved" },
    })

  })

  test("defaults a changed provider to its newest model while retaining saved speed", async () => {
    const configured = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "codex",
      model: "gpt-5.6-sol",
      speed: "fast",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })
    await expect(resolveSetupOptions(["--agent", "claude"], {
      interactive: false,
      loadConfig: async () => configured,
    })).resolves.toEqual({
      provider: "claude",
      model: "fable",
      speed: "fast",
      scope: "local",
      skills: [...SPEC_FINDER_SKILLS],
      origin: { provider: "flag", model: "default", speed: "saved" },
    })

  })

  test("reuses a saved skill subset on a non-interactive rerun", async () => {
    const configured = parseConfig({
      ...DEFAULT_CONFIG,
      setup: {
        status: "configured",
        scope: "local",
        destination: ".agents/skills",
        skills: ["sf-write-spec", "sf-memory"],
      },
    })
    await expect(resolveSetupOptions([], {
      interactive: false,
      loadConfig: async () => configured,
    })).resolves.toMatchObject({
      skills: ["sf-write-spec", "sf-memory"],
    })
  })


  test("requires an explicit scope after v2 migration and then preserves its runtime intent", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-v2-"))
    try {
      await mkdir(join(root, ".spec-finder"), { recursive: true })
      await writeFile(join(root, ".spec-finder", "config.json"), JSON.stringify({
        version: 2,
        provider: "codex",
        model: "old-custom",
        reasoning: "high",
        speed: "fast",
        permissions: "prompt",
        auto_commit: false,
      }))
      await expect(resolveSetupOptions([], { interactive: false, root })).rejects.toThrow("has no saved scope")
      await expect(resolveSetupOptions(["--global"], { interactive: false, root })).resolves.toMatchObject({
        provider: "codex",
        model: "old-custom",
        speed: "fast",
        scope: "global",
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("uses one keyboard-selectable value per interactive step and ignores Space in single-select mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-picker-"))
    const terminal = terminalHarness()
    try {
      const resolution = resolveSetupOptions([], {
        interactive: true,
        root,
        input: terminal.input,
        output: terminal.output,
      })

      await waitForText(terminal.text, "Choose provider")
      terminal.input.write(" ")
      terminal.input.write("\r")
      await waitForText(terminal.text, "Choose installation scope")
      terminal.input.write("\u001B[B\r")
      await waitForText(terminal.text, "Choose model")
      terminal.input.write("\r")
      await waitForText(terminal.text, "Choose speed")
      terminal.input.write("\r")
      await waitForText(terminal.text, "Choose skills to install")
      expect(terminal.text()).toContain("Space toggle")
      terminal.input.write("\r")

      await expect(resolution).resolves.toMatchObject({
        provider: "codex",
        scope: "global",
        model: "gpt-5.6-luna",
        speed: "normal",
        skills: [...SPEC_FINDER_SKILLS],
      })
      expect(terminal.input.rawModes).toEqual([true, false, true, false, true, false, true, false, true, false])
      expect(terminal.input.isPaused()).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("starts with every skill selected and Space toggles a skill off", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-skill-picker-"))
    const terminal = terminalHarness()
    try {
      const resolution = resolveSetupOptions([], {
        interactive: true,
        root,
        input: terminal.input,
        output: terminal.output,
      })

      await waitForText(terminal.text, "Choose provider")
      terminal.input.write("\r")
      await waitForText(terminal.text, "Choose installation scope")
      terminal.input.write("\r")
      await waitForText(terminal.text, "Choose model")
      terminal.input.write("\r")
      await waitForText(terminal.text, "Choose speed")
      terminal.input.write("\r")
      await waitForText(terminal.text, "Choose skills to install")
      terminal.input.write(" ")
      terminal.input.write("\r")

      await expect(resolution).resolves.toMatchObject({
        skills: SPEC_FINDER_SKILLS.filter((skill) => skill !== "sf-idea-factory"),
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })


  test("requires an explicit migrated scope selection and reports cancellation without success", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-v2-picker-"))
    try {
      await mkdir(join(root, ".spec-finder"), { recursive: true })
      await writeFile(join(root, ".spec-finder", "config.json"), JSON.stringify({
        version: 2,
        provider: "codex",
        model: "auto",
        reasoning: "high",
        speed: "normal",
        permissions: "prompt",
        auto_commit: false,
      }))
      const terminal = terminalHarness()
      const resolution = resolveSetupOptions([], {
        root,
        interactive: true,
        input: terminal.input,
        output: terminal.output,
      })
      await waitForText(terminal.text, "Choose provider")
      terminal.input.write("\r")
      await waitForText(terminal.text, "Choose installation scope")
      terminal.input.write("\r")
      await waitForText(terminal.text, "Choose a scope before continuing")
      terminal.input.write("\u001B[B\r")
      await waitForText(terminal.text, "Choose model")
      terminal.input.write("\u001B")
      await expect(resolution).rejects.toThrow("setup cancelled")
      expect(terminal.input.rawModes.at(-1)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("summarizes requested setup values and explicit legacy preservation", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-summary-"))
    const terminal = commandOutput()
    try {
      const code = await setupCommand(["--agent", "cursor", "--model", "auto", "--speed", "fast", "--global"], {
        root,
        output: terminal.output,
        loadConfig: async () => DEFAULT_CONFIG,
        setupWorkspace: async (_root, request) => ({
          configPath: join(root, ".spec-finder", "config.json"),
          provider: request.provider,
          model: request.model,
          speed: request.speed,
          destination: ".agents/skills",
          skillRoot: join(root, ".agents/skills"),
          scope: request.scope,
          installed: [".agents/skills/sf-task-report"],
          legacyCursor: "preserved",
          gitignorePath: join(root, ".spec-finder", ".gitignore"),
          gitignoreStatus: "created",
        }),
      })
      expect(code).toBe(0)
      expect(terminal.text()).toContain("requested model: auto")
      expect(terminal.text()).toContain("requested speed: fast")
      expect(terminal.text()).toContain("destination: .agents/skills")
      expect(terminal.text()).toContain(`skill root: ${join(root, ".agents/skills")}`)
      expect(terminal.text()).toContain("legacy Cursor skills: preserved (not migrated)")
      expect(terminal.text()).toContain("packet gitignore: created")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe("run command batch integration", () => {
  test("accepts a Grok runtime override without changing saved setup metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-grok-runtime-override-"))
    const stored = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "codex",
      model: "gpt-5.6-luna",
      reasoning: "high",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })
    let received: SpecFinderConfig | undefined

    try {
      const exitCode = await runCommand(["demo", "--no-ui", "--provider", "grok"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => stored,
        runTaskPacket: async (options) => {
          received = options.config
          return { ok: true, completed: 1, failed: 0, blocked: 0 }
        },
      })

      expect(exitCode).toBe(0)
      expect(received?.provider).toBe("grok")
      expect(received?.model).toBe("auto")
      expect(received?.reasoning).toBe("auto")
      expect(received?.setup).toBe(stored.setup)

      let explicitReceived: SpecFinderConfig | undefined
      const explicitExitCode = await runCommand([
        "demo",
        "--no-ui",
        "--provider",
        "grok",
        "--model",
        "grok-4.5",
        "--reasoning",
        "low",
      ], {
        root,
        output: commandOutput().output,
        loadConfig: async () => stored,
        runTaskPacket: async (options) => {
          explicitReceived = options.config
          return { ok: true, completed: 1, failed: 0, blocked: 0 }
        },
      })

      expect(explicitExitCode).toBe(0)
      expect(explicitReceived?.model).toBe("grok-4.5")
      expect(explicitReceived?.reasoning).toBe("low")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("accepts a Pi runtime override without changing saved setup metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-pi-runtime-override-"))
    const stored = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "codex",
      model: "gpt-5.6-luna",
      reasoning: "high",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })
    let received: SpecFinderConfig | undefined

    try {
      const exitCode = await runCommand(["demo", "--no-ui", "--provider", "pi"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => stored,
        runTaskPacket: async (options) => {
          received = options.config
          return { ok: true, completed: 1, failed: 0, blocked: 0 }
        },
      })

      expect(exitCode).toBe(0)
      expect(received?.provider).toBe("pi")
      expect(received?.model).toBe("auto")
      expect(received?.reasoning).toBe("auto")
      expect(received?.setup).toBe(stored.setup)

      let explicitReceived: SpecFinderConfig | undefined
      const explicitExitCode = await runCommand([
        "demo",
        "--no-ui",
        "--provider",
        "pi",
        "--model",
        "anthropic/claude-sonnet-4",
        "--reasoning",
        "low",
      ], {
        root,
        output: commandOutput().output,
        loadConfig: async () => stored,
        runTaskPacket: async (options) => {
          explicitReceived = options.config
          return { ok: true, completed: 1, failed: 0, blocked: 0 }
        },
      })

      expect(explicitExitCode).toBe(0)
      expect(explicitReceived?.model).toBe("anthropic/claude-sonnet-4")
      expect(explicitReceived?.reasoning).toBe("low")
      expect(explicitReceived?.setup).toBe(stored.setup)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("layers a provider override over configured v3 metadata without changing its destination", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-configured-override-"))
    const stored = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "codex",
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })
    let received: SpecFinderConfig | undefined

    try {
      const result = await runCommand(["demo", "--no-ui", "--provider", "claude"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => stored,
        runTaskPacket: async (options) => {
          received = options.config
          return { ok: true, completed: 1, failed: 0, blocked: 0 }
        },
      })

      expect(result).toBe(0)
      expect(received?.provider).toBe("claude")
      expect(received?.setup).toBe(stored.setup)
      expect(received?.setup).toEqual({
        status: "configured",
        scope: "local",
        destination: ".agents/skills",
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("explains a typed no-work result in singular no-ui output and succeeds", async () => {
    const output = commandOutput()
    const result = await runCommand(["complete", "--no-ui"], {
      root: "/tmp/spec-finder-command-no-work-output",
      output: output.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runTaskPacket: async (options) => {
        options.emit({
          type: "run_finished",
          ok: true,
          message: "0 tasks completed",
          outcome: "no_work",
          reason: "all_tasks_complete",
        })
        return {
          ok: true,
          completed: 0,
          failed: 0,
          blocked: 0,
          outcome: "no_work",
          reason: "all_tasks_complete",
        }
      },
    })

    expect(result).toBe(0)
    expect(output.text()).toBe("ok: no executable tasks; all tasks are already complete\n")
  })

  test("waits for an interactive typed no-work exit before closing the cockpit", async () => {
    const output = commandOutput(true)
    let releaseExit: (() => void) | undefined
    let waitForExitCalls = 0
    let waitForDismissalCalls = 0
    let closeCalls = 0
    let settled = false
    const exit = new Promise<void>((resolve) => { releaseExit = resolve })
    const command = runCommand(["complete"], {
      root: "/tmp/spec-finder-command-no-work-interactive",
      input: { isTTY: true },
      output: output.output,
      loadConfig: async () => DEFAULT_CONFIG,
      startCockpit: async () => ({
        waitForExit: () => {
          waitForExitCalls += 1
          return exit
        },
        waitForDismissal: async () => { waitForDismissalCalls += 1 },
        close: () => { closeCalls += 1 },
      }),
      runTaskPacket: async (options) => {
        options.emit({
          type: "run_finished",
          ok: true,
          message: "No executable tasks: all tasks are already complete",
          outcome: "no_work",
          reason: "all_tasks_complete",
        })
        return {
          ok: true,
          completed: 0,
          failed: 0,
          blocked: 0,
          outcome: "no_work",
          reason: "all_tasks_complete",
        }
      },
    })
    void command.then(() => { settled = true })

    for (let attempt = 0; attempt < 100 && waitForExitCalls === 0; attempt += 1) await Bun.sleep(1)
    expect(waitForExitCalls).toBe(1)
    expect(settled).toBeFalse()
    expect(closeCalls).toBe(0)
    expect(waitForDismissalCalls).toBe(0)

    releaseExit?.()
    expect(await command).toBe(0)
    expect(closeCalls).toBe(1)
  })

  test("automatically closes normal interactive success without waiting for no-work exit", async () => {
    const output = commandOutput(true)
    let waitForExitCalls = 0
    let closeCalls = 0
    const result = await runCommand(["alpha"], {
      root: "/tmp/spec-finder-command-normal-interactive",
      input: { isTTY: true },
      output: output.output,
      loadConfig: async () => DEFAULT_CONFIG,
      startCockpit: async () => ({
        waitForExit: async () => { waitForExitCalls += 1 },
        waitForDismissal: async () => undefined,
        close: () => { closeCalls += 1 },
      }),
      runTaskPacket: async () => ({ ok: true, completed: 1, failed: 0, blocked: 0 }),
    })

    expect(result).toBe(0)
    expect(waitForExitCalls).toBe(0)
    expect(closeCalls).toBe(1)
  })

  test("retains interactive single and batch failures until dismissal", async () => {
    for (const mode of ["single", "batch"] as const) {
      const root = await mkdtemp(join(tmpdir(), `spec-finder-${mode}-failure-review-`))
      const terminal = commandOutput(true)
      let dismiss: (() => void) | undefined
      let waitCalls = 0
      let waitForExitCalls = 0
      let closeCalls = 0
      const dismissal = new Promise<void>((resolve) => { dismiss = resolve })
      const session = {
        waitForDismissal: () => {
          waitCalls += 1
          return dismissal
        },
        waitForExit: async () => { waitForExitCalls += 1 },
        close: () => { closeCalls += 1 },
      }

      try {
        const result = mode === "single"
          ? runCommand(["alpha"], {
              root,
              input: { isTTY: true },
              output: terminal.output,
              loadConfig: async () => DEFAULT_CONFIG,
              startCockpit: async () => session,
              runTaskPacket: async () => ({ ok: false, completed: 0, failed: 1, blocked: 0 }),
            })
          : runCommand(["--multiple", "alpha,beta"], {
              root,
              input: { isTTY: true },
              output: terminal.output,
              loadConfig: async () => DEFAULT_CONFIG,
              startCockpit: async () => session,
              runBatch: async () => ({
                ok: false,
                status: "failed",
                stoppingSlug: "alpha",
                packets: [
                  { slug: "alpha", outcome: "failed", detail: "stopped" },
                  { slug: "beta", outcome: "not_started" },
                ],
              }),
            })
        let settled = false
        void result.then(() => { settled = true })
        for (let attempt = 0; attempt < 20 && waitCalls === 0; attempt += 1) await Bun.sleep(1)

        expect(waitCalls).toBe(1)
        expect(settled).toBeFalse()
        dismiss?.()
        expect(await result).toBe(1)
        expect(closeCalls).toBe(1)
        expect(waitForExitCalls).toBe(0)
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  })

  test("requires both terminal streams and preserves console failure behavior before starting the cockpit", async () => {
    const scenarios = [
      { name: "stdin", args: ["alpha"], inputTTY: false, outputTTY: true },
      { name: "stdout", args: ["alpha"], inputTTY: true, outputTTY: false },
      { name: "flag", args: ["alpha", "--no-ui"], inputTTY: true, outputTTY: true },
    ] as const

    for (const scenario of scenarios) {
      const root = await mkdtemp(join(tmpdir(), `spec-finder-non-tty-review-${scenario.name}-`))
      const terminal = commandOutput(scenario.outputTTY)
      let starts = 0
      try {
        const result = await runCommand([...scenario.args], {
          root,
          input: { isTTY: scenario.inputTTY },
          output: terminal.output,
          loadConfig: async () => DEFAULT_CONFIG,
          startCockpit: async () => {
            starts += 1
            return { close: () => undefined, waitForDismissal: async () => undefined }
          },
          runTaskPacket: async (options) => {
            options.emit({ type: "task_status", taskId: "task_01", status: "failed" })
            options.emit({ type: "activity", taskId: "task_01", message: "console failure detail" })
            options.emit({ type: "run_finished", ok: false, message: "console failure" })
            return { ok: false, completed: 0, failed: 1, blocked: 0 }
          },
        })
        expect(result).toBe(1)
        expect(starts).toBe(0)
        expect(terminal.text()).toContain("task_01: failed")
        expect(terminal.text()).toContain("task_01: console failure detail")
        expect(terminal.text()).toContain("failed: console failure")
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  })

  test("does not wait for successful, cancelled, or preflight-failed interactive outcomes", async () => {
    const scenarios = ["success", "cancelled", "preflight"] as const
    for (const scenario of scenarios) {
      const root = await mkdtemp(join(tmpdir(), `spec-finder-${scenario}-review-`))
      let waitCalls = 0
      let closeCalls = 0
      try {
        const common = {
          root,
          input: { isTTY: true },
          output: commandOutput(true).output,
          loadConfig: async () => DEFAULT_CONFIG,
          startCockpit: async () => ({
            waitForDismissal: async () => { waitCalls += 1 },
            close: () => { closeCalls += 1 },
          }),
        }
        const result = scenario === "success"
          ? await runCommand(["alpha"], {
              ...common,
              runTaskPacket: async () => ({ ok: true, completed: 1, failed: 0, blocked: 0 }),
            })
          : await runCommand(["--multiple", "alpha"], {
              ...common,
              runBatch: async () => ({
                ok: false,
                status: scenario === "cancelled" ? "cancelled" : "preflight_failed",
                packets: [{ slug: "alpha", outcome: scenario === "cancelled" ? "cancelled" : "not_started" }],
              }),
            })

        expect(result).toBe(scenario === "success" ? 0 : 1)
        expect(waitCalls).toBe(0)
        expect(closeCalls).toBe(1)
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  })

  test("closes immediately on active cancellation and never re-enters failure review", async () => {
    for (const mode of ["single", "batch"] as const) {
      const root = await mkdtemp(join(tmpdir(), `spec-finder-${mode}-cancel-review-`))
      const terminal = commandOutput(true)
      let cancel: (() => void) | undefined
      let releaseRunner: (() => void) | undefined
      let markStarted: (() => void) | undefined
      let waitCalls = 0
      let closeCalls = 0
      const started = new Promise<void>((resolve) => { markStarted = resolve })
      const runnerRelease = new Promise<void>((resolve) => { releaseRunner = resolve })
      const session = {
        waitForDismissal: async () => { waitCalls += 1 },
        close: () => { closeCalls += 1 },
      }

      try {
        const command = mode === "single"
          ? runCommand(["alpha"], {
              root,
              input: { isTTY: true },
              output: terminal.output,
              loadConfig: async () => DEFAULT_CONFIG,
              startCockpit: async (_store, onCancel) => {
                cancel = onCancel
                return session
              },
              runTaskPacket: async () => {
                markStarted?.()
                await runnerRelease
                return { ok: false, completed: 0, failed: 1, blocked: 0 }
              },
            })
          : runCommand(["--multiple", "alpha"], {
              root,
              input: { isTTY: true },
              output: terminal.output,
              loadConfig: async () => DEFAULT_CONFIG,
              startCockpit: async (_store, onCancel) => {
                cancel = onCancel
                return session
              },
              runBatch: async () => {
                markStarted?.()
                await runnerRelease
                return {
                  ok: false,
                  status: "failed",
                  stoppingSlug: "alpha",
                  packets: [{ slug: "alpha", outcome: "failed", detail: "stopped" }],
                }
              },
            })

        await started
        cancel?.()
        expect(closeCalls).toBe(1)
        releaseRunner?.()
        expect(await command).toBe(1)
        expect(waitCalls).toBe(0)
        expect(closeCalls).toBe(1)
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  })

  test("routes validated batch arguments once with shared signal/config and deterministic success output", async () => {
    const terminal = commandOutput()
    const signals: AbortSignal[] = []
    const configs: typeof DEFAULT_CONFIG[] = []
    let calls = 0
    const result = await runCommand(["--multiple", "alpha,beta", "--no-ui", "--model", "batch-model"], {
      root: "/tmp/spec-finder-command-test",
      output: terminal.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runBatch: async (options) => {
        calls += 1
        signals.push(options.signal)
        configs.push(options.config)
        options.onEvent?.({ type: "batch_started", slugs: options.slugs, total: options.slugs.length, config: options.config })
        options.onEvent?.({ type: "batch_packet_started", slug: "alpha", index: 0, total: 2, tasks: [] })
        options.onEvent?.({ type: "run_finished", ok: true, message: "nested packet result" })
        options.onEvent?.({ type: "batch_packet_finished", slug: "alpha", index: 0, outcome: "succeeded", detail: "completed" })
        options.onEvent?.({ type: "batch_packet_started", slug: "beta", index: 1, total: 2, tasks: [] })
        options.onEvent?.({ type: "batch_packet_finished", slug: "beta", index: 1, outcome: "succeeded", detail: "already_complete" })
        const batchResult: BatchResult = {
          ok: true,
          status: "completed",
          packets: [
            { slug: "alpha", outcome: "succeeded", detail: "completed" },
            { slug: "beta", outcome: "succeeded", detail: "already_complete" },
          ],
        }
        options.onEvent?.({ type: "batch_finished", ...batchResult })
        return batchResult
      },
    })

    expect(result).toBe(0)
    expect(calls).toBe(1)
    expect(signals).toHaveLength(1)
    expect(configs).toEqual([{ ...DEFAULT_CONFIG, model: "batch-model" }])
    expect(terminal.text()).toContain("batch: packet 1/2 started: alpha")
    expect(terminal.text()).toContain("batch: packet outcome: beta succeeded (already complete)")
    expect(terminal.text()).toContain("batch: aggregate succeeded (exit 0)")
    expect(terminal.text()).not.toContain("nested packet result")
    expect(terminal.text()).not.toContain("run_finished")
  })

  test("prints the stopping packet, exhausted task retry, and no packet-retry guidance", async () => {
    const terminal = commandOutput()
    const batchResult: BatchResult = {
      ok: false,
      status: "failed",
      stoppingSlug: "beta",
      packets: [
        { slug: "alpha", outcome: "succeeded", detail: "completed" },
        { slug: "beta", outcome: "failed", detail: "stopped" },
        { slug: "gamma", outcome: "not_started" },
      ],
    }
    const result = await runCommand(["--multiple", "alpha,beta,gamma", "--no-ui"], {
      root: "/tmp/spec-finder-command-test",
      output: terminal.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runBatch: async (options) => {
        options.onEvent?.({ type: "batch_started", slugs: options.slugs, total: 3 })
        options.onEvent?.({ type: "batch_packet_started", slug: "alpha", index: 0, total: 3, tasks: [] })
        options.onEvent?.({ type: "batch_packet_finished", slug: "alpha", index: 0, outcome: "succeeded", detail: "completed" })
        options.onEvent?.({ type: "batch_packet_started", slug: "beta", index: 1, total: 3, tasks: [] })
        options.onEvent?.({ type: "batch_packet_finished", slug: "beta", index: 1, outcome: "failed", detail: "stopped" })
        options.onEvent?.({ type: "batch_finished", ...batchResult })
        return batchResult
      },
    })

    expect(result).toBe(1)
    expect(terminal.text()).toContain("batch: packet outcome: gamma not_started")
    expect(terminal.text()).toContain("batch: stopping packet: beta (failed)")
    expect(terminal.text()).toContain("batch: task retry exhausted; no automatic packet retry; resolve the issue and rerun manually")
    expect(terminal.text()).toContain("batch: aggregate failed (exit 1)")
  })

  test("maps cancellation and preflight aggregate results to exit 1", async () => {
    const terminal = commandOutput()
    const cancelled: BatchResult = {
      ok: false,
      status: "cancelled",
      stoppingSlug: "beta",
      packets: [
        { slug: "alpha", outcome: "succeeded", detail: "completed" },
        { slug: "beta", outcome: "cancelled", detail: "stopped" },
        { slug: "gamma", outcome: "not_started" },
      ],
    }
    const cancellationExit = await runCommand(["--multiple", "alpha,beta,gamma", "--no-ui"], {
      root: "/tmp/spec-finder-command-test",
      output: terminal.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runBatch: async (options) => {
        options.onEvent?.({ type: "batch_finished", ...cancelled })
        return cancelled
      },
    })
    expect(cancellationExit).toBe(1)
    expect(terminal.text()).toContain("batch: stopping packet: beta (cancelled)")

    const preflightTerminal = commandOutput()
    const preflight: BatchResult = {
      ok: false,
      status: "preflight_failed",
      packets: [
        { slug: "alpha", outcome: "not_started" },
        { slug: "missing", outcome: "not_started" },
      ],
    }
    const preflightExit = await runCommand(["--multiple", "alpha,missing", "--no-ui"], {
      root: "/tmp/spec-finder-command-test",
      output: preflightTerminal.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runBatch: async (options) => {
        options.onEvent?.({
          type: "batch_finished",
          ...preflight,
          message: "batch preflight failed:\n- packet missing: task packet not found",
        })
        return preflight
      },
    })
    expect(preflightExit).toBe(1)
    expect(preflightTerminal.text()).toContain("batch: preflight failed; no packets started")
    expect(preflightTerminal.text()).toContain("packet missing: task packet not found")
    expect(preflightTerminal.text()).not.toContain("batch: starting")
    expect(preflightTerminal.text()).toContain("batch: packet outcome: missing not_started")
  })

  test("rejects invalid batch grammar before config, renderer, or coordinator start", async () => {
    let configCalls = 0
    let rendererCalls = 0
    let coordinatorCalls = 0
    await expect(runCommand(["--multiple", "alpha", "--multiple", "beta"], {
      output: commandOutput().output,
      loadConfig: async () => {
        configCalls += 1
        return DEFAULT_CONFIG
      },
      startCockpit: async () => {
        rendererCalls += 1
        return { close: () => undefined, waitForDismissal: async () => undefined }
      },
      runBatch: async () => {
        coordinatorCalls += 1
        return { ok: true, status: "completed", packets: [] }
      },
    })).rejects.toThrow("--multiple may be provided only once")
    expect(configCalls).toBe(0)
    expect(rendererCalls).toBe(0)
    expect(coordinatorCalls).toBe(0)
  })

  test("closes one renderer after a thrown coordinator error and keeps the single-run branch intact", async () => {
    const output = commandOutput(true)
    let closeCalls = 0
    await expect(runCommand(["--multiple", "alpha,beta"], {
      root: "/tmp/spec-finder-command-test",
      output: output.output,
      input: { isTTY: true },
      noUi: false,
      loadConfig: async () => DEFAULT_CONFIG,
      startCockpit: async () => ({
        close: () => { closeCalls += 1 },
        waitForDismissal: async () => undefined,
      }),
      runBatch: async () => { throw new Error("preflight exploded") },
    })).rejects.toThrow("preflight exploded")
    expect(closeCalls).toBe(1)

    const singleOutput = commandOutput()
    const singleCalls: string[] = []
    const singleExit = await runCommand(["single-packet", "--no-ui"], {
      root: "/tmp/spec-finder-command-test",
      output: singleOutput.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runTaskPacket: async (options) => {
        singleCalls.push(options.slug)
        options.emit({ type: "activity", taskId: "task_01", message: "single packet activity" })
        options.emit({ type: "run_finished", ok: true, message: "single packet complete" })
        return { ok: true, completed: 1, failed: 0, blocked: 0 }
      },
    })
    expect(singleExit).toBe(0)
    expect(singleCalls).toEqual(["single-packet"])
    expect(singleOutput.text()).toContain("task_01: single packet activity")
    expect(singleOutput.text()).toContain("ok: single packet complete")
  })

  test("closes one renderer after a thrown single-runner error and propagates it", async () => {
    const output = commandOutput(true)
    let closeCalls = 0

    await expect(runCommand(["alpha"], {
      root: "/tmp/spec-finder-command-test",
      output: output.output,
      input: { isTTY: true },
      loadConfig: async () => DEFAULT_CONFIG,
      startCockpit: async () => ({
        close: () => { closeCalls += 1 },
        waitForExit: async () => { throw new Error("no-work exit should not be awaited") },
        waitForDismissal: async () => undefined,
      }),
      runTaskPacket: async () => { throw new Error("runner exploded") },
    })).rejects.toThrow("runner exploded")

    expect(closeCalls).toBe(1)
  })

  test("keeps no-ui output free of session updates and report references", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-command-report-output-"))
    const output = commandOutput()
    try {
      const result = await runCommand(["demo", "--no-ui"], {
        root,
        output: output.output,
        loadConfig: async () => DEFAULT_CONFIG,
        runTaskPacket: async (options) => {
          const reportMetadata = {
            sessionUpdate: "session_info_update",
            title: "Final report prompt /Users/alice/spec-finder/reports/task_01.md",
          } satisfies SessionUpdate
          options.emit({
            type: "session_update",
            taskId: "task_01",
            sessionId: "reused-session",
            phase: "report",
            update: reportMetadata,
          })
          options.emit({
            type: "task_status",
            taskId: "task_01",
            status: "completed",
            reportReference: ".spec-finder/tasks/demo/reports/task_01.md",
          })
          options.emit({ type: "run_finished", ok: true, message: "single packet complete" })
          return { ok: true, completed: 1, failed: 0, blocked: 0 }
        },
      })

      expect(result).toBe(0)
      expect(output.text()).toBe("task_01: completed\nok: single packet complete\n")
      expect(output.text()).not.toContain("Report:")
      expect(output.text()).not.toContain("session_info_update")
      expect(output.text()).not.toContain("/Users/alice/spec-finder")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("refuses a second run in the same workspace until the active run releases its lease", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-command-lock-"))
    let finish: ((result: { ok: boolean; completed: number; failed: number; blocked: number }) => void) | undefined
    const activeResult = new Promise<{ ok: boolean; completed: number; failed: number; blocked: number }>((resolve) => {
      finish = resolve
    })
    let markStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })

    try {
      const first = runCommand(["alpha", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runTaskPacket: async () => {
          markStarted?.()
          return activeResult
        },
      })
      await started

      await expect(runCommand(["beta", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runTaskPacket: async () => ({ ok: true, completed: 1, failed: 0, blocked: 0 }),
      })).rejects.toThrow("another Spec Finder run is active")

      if (finish === undefined) throw new Error("active run did not initialize")
      finish({ ok: true, completed: 1, failed: 0, blocked: 0 })
      expect(await first).toBe(0)

      await expect(runCommand(["beta", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runTaskPacket: async () => ({ ok: true, completed: 1, failed: 0, blocked: 0 }),
      })).resolves.toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe("checkpoint command bridge", () => {
  test("routes begin and complete through the shared service with config-owned enablement", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-checkpoint-command-"))
    const slug = "demo"
    const directory = join(root, ".spec-finder", "tasks", slug)
    const taskPath = join(directory, "task_01.md")
    await mkdir(directory, { recursive: true })
    await writeFile(taskPath, `---
status: pending
title: Bridge task
type: backend
complexity: low
dependencies: []
---

# Bridge task

Checkpoint bridge fixture.
`)
    const task = parseTask(taskPath, await Bun.file(taskPath).text())
    const calls: Array<{ phase: string; root: string; slug: string; task: TaskFile; autoCommit: boolean }> = []
    const service: CheckpointServiceContract = {
      begin: async (input) => {
        calls.push({ phase: "begin", root: input.root, slug: input.slug, task: input.task, autoCommit: input.config?.auto_commit ?? false })
        return { state: "created", message: "baseline captured" }
      },
      complete: async (input) => {
        calls.push({ phase: "complete", root: input.root, slug: input.slug, task: input.task, autoCommit: input.config?.auto_commit ?? false })
        return { state: "created", commit: "a".repeat(40) }
      },
      retry: async () => ({ state: "blocked", message: "unused" }),
      preserve: async () => ({ state: "created", message: "unused" }),
    }

    try {
      const beginOutput = commandOutput()
      await expect(checkpointCommand(["begin", slug, "task_01"], {
        root,
        output: beginOutput.output,
        loadConfig: async () => ({ ...DEFAULT_CONFIG, auto_commit: true }),
        loadTaskPacket: async () => ({ directory, tasks: [task] }),
        checkpointService: service,
      })).resolves.toBe(0)
      expect(beginOutput.text()).toContain("checkpoint begin: demo/task_01: baseline captured")

      const completeOutput = commandOutput()
      await expect(checkpointCommand(["complete", slug, "task_01"], {
        root,
        output: completeOutput.output,
        loadConfig: async () => ({ ...DEFAULT_CONFIG, auto_commit: true }),
        loadTaskPacket: async () => ({ directory, tasks: [task] }),
        checkpointService: service,
      })).resolves.toBe(0)
      expect(completeOutput.text()).toContain(`checkpoint complete: demo/task_01: local checkpoint created (${"a".repeat(40)})`)
      expect(calls.map((call) => call.phase)).toEqual(["begin", "complete"])
      expect(calls.every((call) => call.root === root && call.slug === slug && call.task.id === "task_01" && call.autoCommit)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("reports disabled config without loading tasks or invoking Git", async () => {
    let packetLoads = 0
    let serviceCalls = 0
    const output = commandOutput()
    const service: CheckpointServiceContract = {
      begin: async () => { serviceCalls += 1; return { state: "created" } },
      complete: async () => { serviceCalls += 1; return { state: "created" } },
      retry: async () => { serviceCalls += 1; return { state: "created" } },
      preserve: async () => { serviceCalls += 1; return { state: "created" } },
    }

    await expect(checkpointCommand(["begin", "demo", "task_01"], {
      root: "/tmp/spec-finder-checkpoint-disabled",
      output: output.output,
      loadConfig: async () => DEFAULT_CONFIG,
      loadTaskPacket: async () => {
        packetLoads += 1
        throw new Error("packet loading should not occur when disabled")
      },
      checkpointService: service,
    })).resolves.toBe(1)
    expect(output.text()).toContain("requires auto_commit: true")
    expect(packetLoads).toBe(0)
    expect(serviceCalls).toBe(0)
  })

  test("rejects malformed phases, packet/task IDs, missing tasks, and legacy auto-commit tokens", async () => {
    const options = {
      root: "/tmp/spec-finder-checkpoint-validation",
      loadConfig: async () => ({ ...DEFAULT_CONFIG, auto_commit: true }),
      loadTaskPacket: async () => ({ directory: "/tmp", tasks: [] }),
    }

    await expect(checkpointCommand(["publish", "demo", "task_01"], options)).rejects.toThrow("invalid checkpoint phase")
    await expect(checkpointCommand(["begin", "../demo", "task_01"], options)).rejects.toThrow("invalid task slug")
    await expect(checkpointCommand(["begin", "demo", "task-one"], options)).rejects.toThrow("invalid task ID")
    await expect(checkpointCommand(["begin", "demo", "task_01", "auto-commit=true"], options)).rejects.toThrow("legacy auto-commit=true")
    await expect(runCommand(["demo", "auto-commit=false"], { ...options, output: commandOutput().output })).rejects.toThrow("legacy auto-commit=false")
    await expect(checkpointCommand(["complete", "demo", "task_01"], options)).rejects.toThrow("task not found")
  })

  test("returns a nonzero blocked result and preserves the service reason", async () => {
    const output = commandOutput()
    const service: CheckpointServiceContract = {
      begin: async () => ({ state: "created" }),
      complete: async () => ({ state: "blocked", message: "hook refused local commit" }),
      retry: async () => ({ state: "blocked", message: "unused" }),
      preserve: async () => ({ state: "created", message: "unused" }),
    }
    const task: TaskFile = {
      id: "task_01",
      number: 1,
      path: "/tmp/task_01.md",
      body: "\n# Bridge task\n",
      source: "---\nstatus: completed\ntitle: Bridge task\ntype: backend\ncomplexity: low\ndependencies: []\n---\n\n# Bridge task\n",
      frontmatter: {
        status: "completed",
        title: "Bridge task",
        type: "backend",
        complexity: "low",
        dependencies: [],
      },
    }
    const result = await checkpointCommand(["complete", "demo", "task_01"], {
      root: "/tmp/spec-finder-checkpoint-blocked",
      output: output.output,
      loadConfig: async () => ({ ...DEFAULT_CONFIG, auto_commit: true }),
      loadTaskPacket: async () => ({ directory: "/tmp", tasks: [task] }),
      checkpointService: service,
    })

    expect(result).toBe(1)
    expect(output.text()).toContain("checkpoint complete blocked for demo/task_01: hook refused local commit")
  })

  test("returns zero when checkpoints are skipped because Git HEAD is missing", async () => {
    const output = commandOutput()
    const service: CheckpointServiceContract = {
      begin: async () => ({ state: "skipped", message: "Git HEAD is missing; continuing without checkpoints" }),
      complete: async () => ({ state: "skipped", message: "Git HEAD is missing; continuing without checkpoints" }),
      retry: async () => ({ state: "blocked", message: "unused" }),
      preserve: async () => ({ state: "created", message: "unused" }),
    }
    const task: TaskFile = {
      id: "task_01",
      number: 1,
      path: "/tmp/task_01.md",
      body: "\n# Bridge task\n",
      source: "---\nstatus: pending\ntitle: Bridge task\ntype: backend\ncomplexity: low\ndependencies: []\n---\n\n# Bridge task\n",
      frontmatter: {
        status: "pending",
        title: "Bridge task",
        type: "backend",
        complexity: "low",
        dependencies: [],
      },
    }

    const result = await checkpointCommand(["begin", "demo", "task_01"], {
      root: "/tmp/spec-finder-checkpoint-skipped",
      output: output.output,
      loadConfig: async () => ({ ...DEFAULT_CONFIG, auto_commit: true }),
      loadTaskPacket: async () => ({ directory: "/tmp", tasks: [task] }),
      checkpointService: service,
    })

    expect(result).toBe(0)
    expect(output.text()).toContain("checkpoint begin skipped for demo/task_01: Git HEAD is missing; continuing without checkpoints")
  })
})

function loopTask(id: string, title: string): TaskFile {
  return parseTask(`${id}.md`, `---
status: pending
title: ${title}
type: chore
complexity: low
dependencies: []
---

# Task ${id.replace("task_", "")}: ${title}
`)
}

describe("loop command", () => {
  test("injected done and no_op exit 0 and print loop: terminal", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-cmd-"))
    try {
      for (const terminal of ["done", "no_op"] as const) {
        const output = commandOutput()
        const code = await loopCommand(["demo", "--no-ui"], {
          root,
          output: output.output,
          loadConfig: async () => DEFAULT_CONFIG,
          runLoop: async ({ emit }) => {
            emit({ type: "activity", message: `loop: terminal ${terminal}: ok` })
            return { terminal, reason: "ok", iteration: 0, slug: "demo" }
          },
        })
        expect(code).toBe(0)
        expect(output.text()).toContain("loop: terminal")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("no-ui still prints loop activity and does not print loop_started", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-nui-"))
    try {
      const output = commandOutput()
      const code = await loopCommand(["demo", "--no-ui"], {
        root,
        output: output.output,
        loadConfig: async () => DEFAULT_CONFIG,
        runLoop: async ({ emit }) => {
          emit({ type: "loop_started", slug: "demo", iteration: 0, maxIterations: 50, noProgressWindow: 3 })
          emit({ type: "activity", message: "loop: iteration 1/50 execute" })
          emit({
            type: "loop_progress",
            slug: "demo",
            iteration: 1,
            maxIterations: 50,
            noProgressWindow: 3,
            phase: "execute",
          })
          emit({ type: "activity", message: "loop: terminal done: ok" })
          emit({
            type: "loop_finished",
            slug: "demo",
            terminal: "done",
            reason: "ok",
            iteration: 1,
            maxIterations: 50,
            noProgressWindow: 3,
          })
          return { terminal: "done", reason: "ok", iteration: 1, slug: "demo" }
        },
      })
      expect(code).toBe(0)
      expect(output.text()).toContain("loop: iteration")
      expect(output.text()).toContain("loop: terminal")
      expect(output.text()).not.toContain("loop_started")
      expect(output.text()).not.toContain("loop_progress")
      expect(output.text()).not.toContain("loop_finished")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })


  test("dry-run exits 0 even when the plan names a non-success terminal", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-dry-"))
    try {
      const code = await loopCommand(["demo", "--dry-run", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runLoop: async () => ({ terminal: "failed", reason: "dry-run: would execute", iteration: 0, slug: "demo" }),
      })
      expect(code).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("invalid runtime overrides exit 2 before the coordinator", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-override-"))
    try {
      let called = false
      const code = await loopCommand(["demo", "--no-ui", "--provider", "nope"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runLoop: async () => {
          called = true
          return { terminal: "done", reason: "ok", iteration: 0, slug: "demo" }
        },
      })
      expect(called).toBe(false)
      expect(code).toBe(2)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("injected named stops exit 1 and cancelled exits 130", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-exit-"))
    try {
      for (const terminal of ["blocked", "failed", "exhausted", "stalled"] as const) {
        const code = await loopCommand(["demo", "--no-ui"], {
          root,
          output: commandOutput().output,
          loadConfig: async () => DEFAULT_CONFIG,
          runLoop: async () => ({ terminal, reason: terminal, iteration: 1, slug: "demo" }),
        })
        expect(code).toBe(1)
      }
      const cancelled = await loopCommand(["demo", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runLoop: async () => ({ terminal: "cancelled", reason: "abort", iteration: 0, slug: "demo" }),
      })
      expect(cancelled).toBe(130)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("invalid flags exit 2 before writing a ledger", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-parse-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(packet, { recursive: true })
    await writeFile(join(packet, "task_01.md"), `---
status: pending
title: Demo
type: chore
complexity: low
dependencies: []
---

# Task 01: Demo
`)
    try {
      const code = await loopCommand(["demo", "--multiple"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
      })
      expect(code).toBe(2)
      expect(await Bun.file(describeLoopPaths(packet).directory).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("invalid ledger without reset-state exits 2", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-ledger-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(join(packet, "loop"), { recursive: true })
    await writeFile(join(packet, "task_01.md"), `---
status: pending
title: Demo
type: chore
complexity: low
dependencies: []
---

# Task 01: Demo
`)
    await writeFile(join(packet, "loop", "state.json"), `${JSON.stringify({ surprise: true })}\n`)
    try {
      const code = await loopCommand(["demo", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
      })
      expect(code).toBe(2)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("loop and run refuse each other while a lock is held", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-lock-"))
    let finishRun: ((result: { ok: boolean; completed: number; failed: number; blocked: number }) => void) | undefined
    const runResult = new Promise<{ ok: boolean; completed: number; failed: number; blocked: number }>((resolve) => {
      finishRun = resolve
    })
    let runStarted: (() => void) | undefined
    const startedRun = new Promise<void>((resolve) => {
      runStarted = resolve
    })
    try {
      const firstRun = runCommand(["alpha", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runTaskPacket: async () => {
          runStarted?.()
          return runResult
        },
      })
      await startedRun
      await expect(loopCommand(["beta", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runLoop: async () => ({ terminal: "done", reason: "ok", iteration: 0, slug: "beta" }),
      })).rejects.toThrow("another Spec Finder run is active")
      finishRun?.({ ok: true, completed: 1, failed: 0, blocked: 0 })
      expect(await firstRun).toBe(0)

      let finishLoop: ((result: { terminal: "done"; reason: string; iteration: number; slug: string }) => void) | undefined
      const loopResult = new Promise<{ terminal: "done"; reason: string; iteration: number; slug: string }>((resolve) => {
        finishLoop = resolve
      })
      let loopStarted: (() => void) | undefined
      const startedLoop = new Promise<void>((resolve) => {
        loopStarted = resolve
      })
      const firstLoop = loopCommand(["alpha", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runLoop: async () => {
          loopStarted?.()
          return loopResult
        },
      })
      await startedLoop
      await expect(runCommand(["beta", "--no-ui"], {
        root,
        output: commandOutput().output,
        loadConfig: async () => DEFAULT_CONFIG,
        runTaskPacket: async () => ({ ok: true, completed: 1, failed: 0, blocked: 0 }),
      })).rejects.toThrow("another Spec Finder run is active")
      finishLoop?.({ terminal: "done", reason: "ok", iteration: 0, slug: "alpha" })
      expect(await firstLoop).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("emit wrapper keeps only the first run_started on the cockpit store", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-emit-"))
    const output = commandOutput(true)
    let store: CockpitStore | undefined
    try {
      const code = await loopCommand(["demo"], {
        root,
        input: { isTTY: true },
        output: output.output,
        loadConfig: async () => DEFAULT_CONFIG,
        startCockpit: async (next) => {
          store = next
          return {
            close() {},
            waitForDismissal: async () => undefined,
            waitForExit: async () => undefined,
          }
        },
        runLoop: async ({ emit }) => {
          emit({ type: "run_started", slug: "first", config: DEFAULT_CONFIG, tasks: [loopTask("task_01", "First")] })
          emit({ type: "run_started", slug: "second", config: DEFAULT_CONFIG, tasks: [loopTask("task_02", "Second")] })
          return { terminal: "done", reason: "ok", iteration: 1, slug: "demo" }
        },
      })
      expect(code).toBe(0)
      expect(store?.getSnapshot().slug).toBe("first")
      expect(store?.getSnapshot().tasks.map((task) => task.id)).toEqual(["task_01"])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("keeps no_op wait-for-exit and dismisses non-success except cancelled", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-waits-"))
    try {
      async function waitsFor(terminal: "done" | "no_op" | "blocked" | "failed" | "exhausted" | "stalled" | "cancelled") {
        let exits = 0
        let dismissals = 0
        await loopCommand(["demo"], {
          root,
          input: { isTTY: true },
          output: commandOutput(true).output,
          loadConfig: async () => DEFAULT_CONFIG,
          startCockpit: async () => ({
            close() {},
            waitForDismissal: async () => { dismissals += 1 },
            waitForExit: async () => { exits += 1 },
          }),
          runLoop: async () => ({ terminal, reason: terminal, iteration: 0, slug: "demo" }),
        })
        return { exits, dismissals }
      }

      expect(await waitsFor("no_op")).toEqual({ exits: 1, dismissals: 0 })
      expect(await waitsFor("blocked")).toEqual({ exits: 0, dismissals: 1 })
      expect(await waitsFor("failed")).toEqual({ exits: 0, dismissals: 1 })
      expect(await waitsFor("exhausted")).toEqual({ exits: 0, dismissals: 1 })
      expect(await waitsFor("stalled")).toEqual({ exits: 0, dismissals: 1 })
      expect(await waitsFor("done")).toEqual({ exits: 0, dismissals: 0 })
      expect(await waitsFor("cancelled")).toEqual({ exits: 0, dismissals: 0 })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

})

describe("refresh command", () => {
  test("rejects extra args at exit 2 without touching the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-refresh-extra-"))
    try {
      const stdout = commandOutput()
      const stderr = commandOutput()
      const code = await refreshCommand(["--copy"], {
        root,
        output: stdout.output,
        error: stderr.output,
        viewLatest: async () => {
          throw new Error("viewLatest must not run")
        },
      })
      expect(code).toBe(2)
      expect(stdout.text()).toBe("")
      expect(stderr.text()).toContain("unsupported refresh option: --copy")
      expect(stderr.text()).toContain(REFRESH_USAGE)
      await expect(access(join(root, ".agents"))).rejects.toThrow()
      await expect(access(setupLockPath(root))).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("refuses missing or unconfigured cwd without writing skills", async () => {
    const missing = await mkdtemp(join(tmpdir(), "spec-finder-refresh-missing-"))
    const unconfigured = await mkdtemp(join(tmpdir(), "spec-finder-refresh-unconfigured-"))
    try {
      await mkdir(join(unconfigured, ".spec-finder"), { recursive: true })
      await writeFile(join(unconfigured, ".spec-finder", "config.json"), `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`)

      for (const root of [missing, unconfigured]) {
        const stdout = commandOutput()
        const stderr = commandOutput()
        const code = await refreshCommand([], {
          root,
          output: stdout.output,
          error: stderr.output,
          viewLatest: async () => {
            throw new Error("viewLatest must not run")
          },
        })
        expect(code).toBe(1)
        expect(stdout.text()).toBe("")
        expect(stderr.text()).toContain("spec-finder setup")
        await expect(access(join(root, ".agents", "skills", "sf-task-report"))).rejects.toThrow()
        await expect(access(setupLockPath(root))).rejects.toThrow()
      }
    } finally {
      await rm(missing, { recursive: true, force: true })
      await rm(unconfigured, { recursive: true, force: true })
    }
  })

  test("refuses a package that is not latest or whose latest view fails without writes or a lock", async () => {
    for (const viewLatest of [
      async () => "0.0.0-not-latest",
      async () => {
        throw new Error("registry unavailable")
      },
    ]) {
      const root = await mkdtemp(join(tmpdir(), "spec-finder-refresh-stale-"))
      try {
        await writeConfiguredRefresh(root)
        const beforeConfig = await readFile(join(root, ".spec-finder", "config.json"), "utf8")
        const stdout = commandOutput()
        const stderr = commandOutput()
        const code = await refreshCommand([], { root, output: stdout.output, error: stderr.output, viewLatest })
        expect(code).toBe(1)
        expect(stdout.text()).toBe("")
        expect(stderr.text()).toContain("spec-finder upgrade")
        expect(await readFile(join(root, ".spec-finder", "config.json"), "utf8")).toBe(beforeConfig)
        await expect(access(join(root, ".agents", "skills", "sf-task-report"))).rejects.toThrow()
        await expect(access(setupLockPath(root))).rejects.toThrow()
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  })

  test("recopies managed skills when configured and latest without rewriting config", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-refresh-ok-"))
    try {
      await writeConfiguredRefresh(root)
      const beforeConfig = await readFile(join(root, ".spec-finder", "config.json"), "utf8")
      const stdout = commandOutput()
      const stderr = commandOutput()
      const code = await refreshCommand([], {
        root,
        output: stdout.output,
        error: stderr.output,
        viewLatest: async () => VERSION,
      })
      expect(code).toBe(0)
      const text = stdout.text()
      expect(text).toContain("destination: .agents/skills")
      expect(text).toContain(`skill root: ${await realpath(join(root, ".agents", "skills"))}`)
      expect(text).toContain("scope: local")
      expect(text).toContain(`refreshed managed skills: ${SPEC_FINDER_SKILLS.length}`)
      expect(text).toContain("legacy Cursor skills: absent (not migrated)")
      expect(text).not.toContain("requested model")
      expect(text).not.toContain("requested speed")
      expect(stderr.text()).toBe("")
      expect(await readFile(join(root, ".spec-finder", "config.json"), "utf8")).toBe(beforeConfig)
      for (const skill of SPEC_FINDER_SKILLS) {
        await access(join(root, ".agents", "skills", skill, "SKILL.md"))
      }
      await expect(access(setupLockPath(root))).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("maps invalid config JSON or schema to exit 2", async () => {
    const invalidJson = await mkdtemp(join(tmpdir(), "spec-finder-refresh-json-"))
    const invalidSchema = await mkdtemp(join(tmpdir(), "spec-finder-refresh-schema-"))
    try {
      await mkdir(join(invalidJson, ".spec-finder"), { recursive: true })
      await writeFile(join(invalidJson, ".spec-finder", "config.json"), "{")
      await mkdir(join(invalidSchema, ".spec-finder"), { recursive: true })
      await writeFile(join(invalidSchema, ".spec-finder", "config.json"), JSON.stringify({
        ...DEFAULT_CONFIG,
        unknown: true,
      }))

      for (const root of [invalidJson, invalidSchema]) {
        const stdout = commandOutput()
        const stderr = commandOutput()
        const code = await refreshCommand([], {
          root,
          output: stdout.output,
          error: stderr.output,
          viewLatest: async () => VERSION,
        })
        expect(code).toBe(2)
        expect(stdout.text()).toBe("")
        expect(stderr.text().length).toBeGreaterThan(0)
        await expect(access(join(root, ".agents", "skills", "sf-task-report"))).rejects.toThrow()
      }
    } finally {
      await rm(invalidJson, { recursive: true, force: true })
      await rm(invalidSchema, { recursive: true, force: true })
    }
  })

  test("uses npm.cmd on Windows for the default latest view", () => {
    expect(npmCliCommand("win32")).toBe("npm.cmd")
    expect(npmCliCommand("darwin")).toBe("npm")
  })
})

async function writeConfiguredRefresh(root: string): Promise<void> {
  await mkdir(join(root, ".spec-finder"), { recursive: true })
  await writeFile(join(root, ".spec-finder", "config.json"), `${JSON.stringify({
    ...DEFAULT_CONFIG,
    model: "saved-refresh-model",
    setup: { status: "configured", scope: "local", destination: ".agents/skills" },
  }, null, 2)}\n`)
}

describe("packet inspection commands", () => {
  const task = (number: number, title: string, status = "pending", extra = "", body = "Test task."): string => `---
status: ${status}
title: ${title}
type: backend
complexity: low
dependencies: []
${extra}---

# Task ${number}: ${title}

## Overview
${body}
`

  test("prints an empty active packet glance", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-ls-empty-"))
    try {
      await mkdir(join(root, ".spec-finder", "tasks"), { recursive: true })
      const stdout = commandOutput()
      const stderr = commandOutput()
      expect(await lsCommand([], { root, output: stdout.output, error: stderr.output })).toBe(0)
      expect(stdout.text()).toBe("no active packets\n")
      expect(stderr.text()).toBe("")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("lists packets and does not take the run lock or leak packet prose", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-ls-mixed-"))
    try {
      const tasks = join(root, ".spec-finder", "tasks")
      const remaining = join(tasks, "remaining-work")
      const blocked = join(tasks, "blocked-checkpoint")
      const invalid = join(tasks, "invalid-parse")
      await mkdir(remaining, { recursive: true })
      await mkdir(blocked, { recursive: true })
      await mkdir(invalid, { recursive: true })
      await mkdir(join(root, ".spec-finder", "tasks_done", "archived"), { recursive: true })
      await writeFile(join(remaining, "task_01.md"), task(1, "Open work", "pending", "", "SECRET_BODY_PROSE"))
      await writeFile(join(blocked, "task_01.md"), task(
        1,
        "Blocked delivery",
        "completed",
        `checkpoint:
  state: blocked
  base_head: ${"a".repeat(40)}
  baseline_digest: ${"b".repeat(64)}
  paths:
    - src/example.ts
  error: blocked delivery
`,
      ))
      await writeFile(join(invalid, "task_01.md"), "not yaml\n")
      await writeFile(join(root, ".spec-finder", "TASKS_REPORT.md"), "SECRET_REPORT_PROSE\n")
      await writeFile(join(root, ".spec-finder", "tasks_done", "archived", "task_01.md"), task(1, "Archived"))
      const lease = await acquireRunLock(root)
      const stdout = commandOutput()
      const stderr = commandOutput()
      try {
        expect(await lsCommand([], { root, output: stdout.output, error: stderr.output })).toBe(0)
      } finally {
        await lease.release()
      }
      expect(stdout.text()).toContain("remaining-work remaining 0/1")
      expect(stdout.text()).toContain("blocked-checkpoint blocked 0/1")
      expect(stdout.text()).toContain("invalid-parse invalid 0/0")
      expect(stdout.text()).toContain("missing YAML frontmatter")
      expect(stdout.text()).not.toContain("archived")
      expect(stdout.text()).not.toContain("SECRET_BODY_PROSE")
      expect(stdout.text()).not.toContain("SECRET_REPORT_PROSE")
      expect(stderr.text()).toBe("")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  test("escapes control characters in human-readable inspection output", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-inspection-controls-"))
    try {
      const tasks = join(root, ".spec-finder", "tasks")
      const invalidSlug = "bad\nslug"
      const blocked = join(tasks, "blocked")
      await mkdir(join(tasks, invalidSlug), { recursive: true })
      await mkdir(blocked, { recursive: true })
      await writeFile(join(blocked, "task_01.md"), task(
        1,
        "Blocked delivery",
        "completed",
        `handoff:
  phase: report
  error: "blocked-\\u001b[31m"
`,
      ))

      const listOutput = commandOutput()
      const listError = commandOutput()
      expect(await lsCommand([], { root, output: listOutput.output, error: listError.output })).toBe(0)
      expect(listOutput.text()).toContain("bad\\u000aslug invalid")
      expect(listOutput.text()).not.toContain(invalidSlug)

      const inspectOutput = commandOutput()
      const inspectError = commandOutput()
      expect(await inspectCommand(["blocked"], { root, output: inspectOutput.output, error: inspectError.output })).toBe(0)
      expect(inspectOutput.text()).toContain("blocked-\\u001b[31m")
      expect(inspectOutput.text()).not.toContain(`${String.fromCharCode(27)}[31m`)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("rejects ls arguments and missing tasks directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-ls-errors-"))
    try {
      const stdout = commandOutput()
      const stderr = commandOutput()
      expect(await lsCommand(["--yaml"], { root, output: stdout.output, error: stderr.output })).toBe(2)
      expect(stderr.text()).toContain(LS_USAGE)
      const missingStdout = commandOutput()
      const missingStderr = commandOutput()
      expect(await lsCommand([], { root, output: missingStdout.output, error: missingStderr.output })).toBe(2)
      expect(missingStderr.text()).toContain("cannot read .spec-finder/tasks")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("prints inspect work, blockers, and absent loop without writing or locking", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-inspect-"))
    try {
      const packet = join(root, ".spec-finder", "tasks", "blocked-work")
      await mkdir(packet, { recursive: true })
      const path = join(packet, "task_01.md")
      await writeFile(path, task(1, "Blocked delivery", "completed", `checkpoint:
  state: blocked
  base_head: ${"a".repeat(40)}
  baseline_digest: ${"b".repeat(64)}
  paths:
    - src/example.ts
  error: blocked delivery
`, "SECRET_BODY_PROSE"))
      const before = await readFile(path, "utf8")
      const lease = await acquireRunLock(root)
      const stdout = commandOutput()
      const stderr = commandOutput()
      try {
        expect(await inspectCommand(["blocked-work"], { root, output: stdout.output, error: stderr.output })).toBe(0)
      } finally {
        await lease.release()
      }
      expect(stdout.text()).toContain("blocked-work blocked 0/1")
      expect(stdout.text()).toContain("remaining: task_01")
      expect(stdout.text()).toContain("task_01 checkpoint: blocked delivery")
      expect(stdout.text()).toContain("loop: absent")
      expect(stdout.text()).not.toContain("SECRET_BODY_PROSE")
      expect(stderr.text()).toBe("")
      expect(await readFile(path, "utf8")).toBe(before)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("returns exit 2 for missing, malformed, and invalid inspect invocations", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-inspect-errors-"))
    try {
      await mkdir(join(root, ".spec-finder", "tasks"), { recursive: true })
      const missingOut = commandOutput()
      const missingErr = commandOutput()
      expect(await inspectCommand(["missing"], { root, output: missingOut.output, error: missingErr.output })).toBe(2)
      expect(missingErr.text()).toContain("packet is missing: missing")
      const extraOut = commandOutput()
      const extraErr = commandOutput()
      expect(await inspectCommand(["one", "two"], { root, output: extraOut.output, error: extraErr.output })).toBe(2)
      expect(extraErr.text()).toContain(INSPECT_USAGE)
      const invalidOut = commandOutput()
      const invalidErr = commandOutput()
      expect(await inspectCommand(["Bad_Slug"], { root, output: invalidOut.output, error: invalidErr.output })).toBe(2)
      expect(invalidErr.text()).toContain("invalid task slug")
      expect(invalidErr.text()).toContain(INSPECT_USAGE)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("emits typed JSON envelopes for list and inspect", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-json-"))
    try {
      const packet = join(root, ".spec-finder", "tasks", "json-work")
      await mkdir(packet, { recursive: true })
      await writeFile(join(packet, "task_01.md"), task(1, "JSON work"))

      const listOutput = commandOutput()
      const listError = commandOutput()
      expect(await lsCommand(["--json"], { root, output: listOutput.output, error: listError.output })).toBe(0)
      expect(JSON.parse(listOutput.text())).toEqual({
        ok: true,
        rows: [{ slug: "json-work", kind: "remaining", completed: 0, total: 1 }],
      })
      expect(listError.text()).toBe("")

      const inspectOutput = commandOutput()
      const inspectError = commandOutput()
      expect(await inspectCommand(["--json", "json-work"], { root, output: inspectOutput.output, error: inspectError.output })).toBe(0)
      expect(JSON.parse(inspectOutput.text())).toMatchObject({
        ok: true,
        slug: "json-work",
        kind: "remaining",
        completed: 0,
        total: 1,
        remaining: [{ id: "task_01", status: "pending" }],
        blockers: [],
        loop: { state: "absent" },
      })
      expect(inspectError.text()).toBe("")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("emits typed JSON errors on stderr without usage prose", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-json-errors-"))
    try {
      const listOutput = commandOutput()
      const listError = commandOutput()
      expect(await lsCommand(["--json"], { root, output: listOutput.output, error: listError.output })).toBe(2)
      expect(listOutput.text()).toBe("")
      expect(JSON.parse(listError.text())).toEqual({
        ok: false,
        code: "tasks_unreadable",
        message: expect.stringContaining("cannot read .spec-finder/tasks"),
      })

      await mkdir(join(root, ".spec-finder", "tasks"), { recursive: true })
      const inspectOutput = commandOutput()
      const inspectError = commandOutput()
      expect(await inspectCommand(["missing", "--json"], { root, output: inspectOutput.output, error: inspectError.output })).toBe(2)
      expect(inspectOutput.text()).toBe("")
      expect(JSON.parse(inspectError.text())).toEqual({
        ok: false,
        code: "missing",
        message: "packet is missing: missing",
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
