import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { PassThrough } from "node:stream"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { DEFAULT_CONFIG } from "../src/config.ts"
import { execCommand } from "../src/commands.ts"
import { AcpTurnError, type PermissionBroker } from "../src/acp-turn.ts"
import { createProcessSupervisor } from "../src/process-supervisor.ts"
import type { ProcessSupervisor } from "../src/acp-turn.ts"
import type { ExecFixtureLaunch } from "../src/exec.ts"

const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("packet-free exec command", () => {
  test("runs exactly one fresh fixture turn, separates streams, and leaves packet artifacts unchanged", async () => {
    const { root, home } = await fixtureWorkspace()
    const lifecycle = join(home, "lifecycle.log")
    const before = await packetTree(root)
    const output = captureStreams()

    const result = await execCommand(["summarize the workspace"], {
      cwd: root,
      home,
      providerLaunch: fixtureLaunch({ SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycle }),
      stdout: output.stdout,
      stderr: output.stderr,
      input: new PassThrough(),
    })

    expect(result).toBe(0)
    expect(output.stdout.text).toBe("mock turn started\n")
    expect(output.stderr.text).toContain("[exec] workspace: ")
    expect(output.stderr.text).toContain("[exec] host-access: read-only")
    expect(output.stderr.text).toContain("[exec] result: completed\n")
    expect(await lifecycleSteps(lifecycle)).toEqual([
      "initialize",
      "session/new",
      "session/prompt",
    ])
    expect(await packetTree(root)).toEqual(before)
  })

  test("advertises no ACP write capability while the exec release gate is disabled", async () => {
    const { root, home } = await fixtureWorkspace()
    const capabilityLog = join(home, "capabilities.log")
    const output = captureStreams()

    const result = await execCommand(["inspect capabilities"], {
      cwd: root,
      home,
      providerLaunch: fixtureLaunch({ SPEC_FINDER_TEST_CAPABILITY_LOG: capabilityLog }),
      stdout: output.stdout,
      stderr: output.stderr,
      input: new PassThrough(),
    })

    expect(result).toBe(0)
    expect(await readFile(capabilityLog, "utf8")).toBe("writeTextFile=false\n")
  })

  test("fails malformed invocation before configuration or provider spawn", async () => {
    const output = captureStreams()
    let spawned = false
    const result = await execCommand(["--model"], {
      stdout: output.stdout,
      stderr: output.stderr,
      providerLaunch: fixtureLaunch(),
      resolveConfig: async () => {
        throw new Error("configuration must not be read")
      },
      supervisor: {
        spawn: async () => {
          spawned = true
          throw new Error("provider must not start")
        },
      },
    })

    expect(result).toBe(2)
    expect(spawned).toBe(false)
    expect(output.stdout.text).toBe("")
    expect(output.stderr.text).toContain("[exec] result: invalid-invocation")
  })

  test.each([
    ["refusal", "refused"],
    ["max_tokens", "limited:max-tokens"],
    ["max_turn_requests", "limited:max-turn-requests"],
  ] as const)("keeps stdout empty for %s terminal outcomes", async (stopReason, expected) => {
    const { root, home } = await fixtureWorkspace()
    const output = captureStreams()
    const result = await execCommand(["perform one turn"], {
      cwd: root,
      home,
      providerLaunch: fixtureLaunch({ SPEC_FINDER_TEST_STOP_REASON: stopReason }),
      stdout: output.stdout,
      stderr: output.stderr,
      input: new PassThrough(),
    })

    expect(result).toBe(1)
    expect(output.stdout.text).toBe("")
    expect(output.stderr.text).toContain(`[exec] result: ${expected}\n`)
  })

  test("uses the user-owned deny policy without persisting permission or history", async () => {
    const { root, home } = await fixtureWorkspace({ permissions: "deny" })
    const lifecycle = join(home, "permission-lifecycle.log")
    const before = await packetTree(root)
    const output = captureStreams()

    const result = await execCommand(["request a mock edit"], {
      cwd: root,
      home,
      providerLaunch: fixtureLaunch({
        SPEC_FINDER_TEST_REQUEST_PERMISSION: "1",
        SPEC_FINDER_TEST_EXPECT_PERMISSION: "reject",
        SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycle,
      }),
      stdout: output.stdout,
      stderr: output.stderr,
      input: new PassThrough(),
    })

    expect(result).toBe(1)
    expect(output.stdout.text).toBe("")
    expect(output.stderr.text).toContain("[exec] permissions: deny (user)")
    expect(output.stderr.text).toContain("[exec] permission: denied")
    expect(output.stderr.text).toContain("[exec] result: permission-denied")
    expect(await packetTree(root)).toEqual(before)
  })

  test("cancels semantically, consumes trailing updates, and returns 130 once", async () => {
    const { root, home } = await fixtureWorkspace()
    const lifecycle = join(home, "cancel-lifecycle.log")
    const output = captureStreams()
    const controller = new AbortController()
    const running = execCommand(["wait for cancellation"], {
      cwd: root,
      home,
      controller,
      signal: controller.signal,
      providerLaunch: fixtureLaunch({
        SPEC_FINDER_TEST_WAIT_FOR_CANCEL: "1",
        SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycle,
      }),
      stdout: output.stdout,
      stderr: output.stderr,
      input: new PassThrough(),
    })

    await waitForLifecycle(lifecycle, "session/prompt")
    controller.abort()
    expect(await running).toBe(130)
    expect(output.stdout.text).toBe("")
    expect(output.stderr.text).toContain("[exec] result: cancelled\n")
    expect((await lifecycleSteps(lifecycle)).filter((step) => step === "session/cancel")).toHaveLength(1)
  }, 5_000)

  test("routes a repeated SIGINT to forced ACP cleanup", async () => {
    const { root, home } = await fixtureWorkspace()
    const output = captureStreams()
    let started!: () => void
    const turnStarted = new Promise<void>((resolve) => { started = resolve })
    let seenSignal: AbortSignal | undefined
    let seenForceSignal: AbortSignal | undefined
    const running = execCommand(["wait for repeated cancellation"], {
      cwd: root,
      home,
      providerLaunch: fixtureLaunch(),
      stdout: output.stdout,
      stderr: output.stderr,
      input: new PassThrough(),
      turn: async (request) => {
        seenSignal = request.signal
        seenForceSignal = request.forceSignal
        started()
        await new Promise<void>((resolve) => request.forceSignal?.addEventListener("abort", () => resolve(), { once: true }))
        return {
          stopReason: "cancelled",
          outcome: "cancelled",
          finalText: "",
          permissionDenied: false,
          cleanup: "confirmed",
        }
      },
    })

    await turnStarted
    process.emit("SIGINT", "SIGINT")
    expect(seenSignal?.aborted).toBeTrue()
    expect(seenForceSignal?.aborted).toBeFalse()
    process.emit("SIGINT", "SIGINT")

    expect(await running).toBe(130)
    expect(seenForceSignal?.aborted).toBeTrue()
  })

  test("rejects uncertified real providers before the supervisor is called", async () => {
    const { root, home } = await fixtureWorkspace()
    const output = captureStreams()
    let spawned = false
    const result = await execCommand(["real provider must stay gated"], {
      cwd: root,
      home,
      stdout: output.stdout,
      stderr: output.stderr,
      supervisor: {
        spawn: async () => {
          spawned = true
          throw new Error("spawned uncertified provider")
        },
      },
    })

    expect(result).toBe(2)
    expect(spawned).toBe(false)
    expect(output.stdout.text).toBe("")
    expect(output.stderr.text).toContain("[exec] result: config-error")
    expect(output.stderr.text).toContain("not certified")
  })

  test("passes the canonical workspace and direct launch to the lower-level contracts", async () => {
    const { root, home } = await fixtureWorkspace()
    const canonicalRoot = await realpath(root)
    const output = captureStreams()
    let seenRequest: { workspace: string; cwd: string } | undefined
    const supervisor: ProcessSupervisor = {
      spawn: async (launch) => {
        expect(launch.cwd).toBe(canonicalRoot)
        expect(launch.command).toBe(process.execPath)
        expect(launch.args).toEqual([fixture])
        return createProcessSupervisor().spawn(launch)
      },
    }
    const result = await execCommand(["inspect launch boundary"], {
      cwd: root,
      home,
      providerLaunch: fixtureLaunch(),
      supervisor,
      stdout: output.stdout,
      stderr: output.stderr,
      input: new PassThrough(),
      turn: async (request) => {
        seenRequest = { workspace: request.workspace, cwd: request.launch.cwd }
        return {
          stopReason: "end_turn",
          outcome: "completed",
          finalText: "injected result",
          permissionDenied: false,
          cleanup: "confirmed",
        }
      },
    })

    expect(result).toBe(0)
    expect(seenRequest).toEqual({ workspace: canonicalRoot, cwd: canonicalRoot })
    expect(output.stdout.text).toBe("injected result\n")
  })

  test("keeps preflight and lifecycle failures normalized and stdout-safe", async () => {
    const { root, home } = await fixtureWorkspace()
    const preflightOutput = captureStreams()
    const preflightResult = await execCommand(["invalid config fixture"], {
      cwd: root,
      home,
      stdout: preflightOutput.stdout,
      stderr: preflightOutput.stderr,
      resolveConfig: async () => { throw new Error("secret\nconfiguration failure") },
    })
    expect(preflightResult).toBe(2)
    expect(preflightOutput.stdout.text).toBe("")
    expect(preflightOutput.stderr.text).toContain("exec preflight failed: secret configuration failure")

    for (const [error, expected] of [
      [new AcpTurnError("protocol", "protocol payload"), "provider-error"],
      [new AcpTurnError("cleanup", "cleanup payload"), "cleanup-error"],
    ] as const) {
      const output = captureStreams()
      const result = await execCommand(["turn failure"], {
        cwd: root,
        home,
        providerLaunch: fixtureLaunch(),
        stdout: output.stdout,
        stderr: output.stderr,
        permission: { request: async () => ({ decision: "cancelled" }), cancelPending: async () => {} },
        turn: async () => { throw error },
      })
      expect(result).toBe(1)
      expect(output.stdout.text).toBe("")
      expect(output.stderr.text).toContain(`[exec] result: ${expected}`)
      expect(output.stderr.text).not.toContain("payload")
    }
  })

  test("keeps injected permission cleanup and the read-only host gate bounded", async () => {
    const { root, home } = await fixtureWorkspace()
    const output = captureStreams()
    let disposed = false
    const result = await execCommand(["read-only host"], {
      cwd: root,
      home,
      providerLaunch: fixtureLaunch(),
      stdout: output.stdout,
      stderr: output.stderr,
      permission: {
        request: async () => ({ decision: "allowed", optionId: "allow_once" }),
        cancelPending: async () => {},
        dispose: async () => {
          disposed = true
          throw new Error("ignored cleanup error")
        },
      } as PermissionBroker & { dispose: () => Promise<void> },
      turn: async (request) => {
        await expect(request.hostAccess.writeTextFile(join(root, "blocked.txt"), "nope", async () => {}))
          .rejects.toMatchObject({ code: "missing-authorizer" })
        return {
          stopReason: "end_turn",
          outcome: "completed",
          finalText: "read-only result",
          permissionDenied: false,
          cleanup: "confirmed",
        }
      },
    })

    expect(result).toBe(0)
    expect(disposed).toBe(true)
    expect(output.stdout.text).toBe("read-only result\n")
  })
})

async function fixtureWorkspace(overrides: Record<string, unknown> = {}): Promise<{ root: string; home: string }> {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-exec-root-"))
  const home = await mkdtemp(join(tmpdir(), "spec-finder-exec-home-"))
  roots.push(root, home)
  await mkdir(join(root, ".spec-finder"), { recursive: true })
  await writeFile(join(root, ".spec-finder", "config.json"), JSON.stringify({
    ...DEFAULT_CONFIG,
    provider: "codex",
    model: "fixture-model",
    reasoning: "auto",
    speed: "auto",
    ...overrides,
  }))
  await mkdir(join(home, ".spec-finder"), { recursive: true })
  await writeFile(join(home, ".spec-finder", "config.json"), JSON.stringify({
    ...DEFAULT_CONFIG,
    provider: "codex",
    model: "user-model",
    ...overrides,
  }))
  return { root, home }
}

function fixtureLaunch(env: Record<string, string> = {}): ExecFixtureLaunch {
  return {
    command: process.execPath,
    args: [fixture],
    env,
    authMethod: null,
  }
}

function captureStreams(): {
  stdout: PassThrough & { text: string }
  stderr: PassThrough & { text: string }
} {
  const stdout = Object.assign(new PassThrough(), { text: "" })
  const stderr = Object.assign(new PassThrough(), { text: "" })
  stdout.on("data", (chunk) => { stdout.text += chunk.toString() })
  stderr.on("data", (chunk) => { stderr.text += chunk.toString() })
  return { stdout, stderr }
}

async function packetTree(root: string): Promise<string[]> {
  const packetRoot = join(root, ".spec-finder")
  const entries = await readdir(packetRoot, { recursive: true, withFileTypes: true })
  return entries
    .map((entry) => `${entry.isDirectory() ? "d" : "f"}:${entry.name}`)
    .sort()
}

async function lifecycleSteps(path: string): Promise<string[]> {
  try {
    const content = await readFile(path, "utf8")
    return content.trim().length === 0 ? [] : content.trim().split("\n")
  } catch {
    return []
  }
}

async function waitForLifecycle(path: string, step: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if ((await lifecycleSteps(path)).includes(step)) return
    await Bun.sleep(10)
  }
  throw new Error(`timed out waiting for ${step}`)
}
