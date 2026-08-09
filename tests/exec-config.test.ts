import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_CONFIG } from "../src/config.ts"
import {
  ExecConfigError,
  resolveExecLaunch,
  resolveExecConfig,
} from "../src/exec-config.ts"

async function makeConfig(root: string, config: Record<string, unknown>): Promise<void> {
  await mkdir(join(root, ".spec-finder"), { recursive: true })
  await writeFile(join(root, ".spec-finder", "config.json"), `${JSON.stringify(config)}\n`)
}

async function makeHomeConfig(home: string, config: Record<string, unknown>): Promise<void> {
  await mkdir(join(home, ".spec-finder"), { recursive: true })
  await writeFile(join(home, ".spec-finder", "config.json"), `${JSON.stringify(config)}\n`)
}

describe("exec runtime and permission resolution", () => {
  test("selects a complete repository profile and independently projects user permission", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-exec-config-"))
    const home = await mkdtemp(join(tmpdir(), "spec-finder-exec-home-"))
    try {
      await makeConfig(root, {
        ...DEFAULT_CONFIG,
        provider: "claude",
        model: "repository-model",
        reasoning: "medium",
        speed: "fast",
        permissions: "approve-all",
      })
      await mkdir(join(root, "nested", "deeper"), { recursive: true })
      await makeHomeConfig(home, {
        ...DEFAULT_CONFIG,
        provider: "cursor",
        model: "user-model",
        permissions: "deny",
      })

      const context = await resolveExecConfig({ cwd: join(root, "nested", "deeper"), home })
      expect(context).toEqual({
        workspace: await realpath(root),
        runtime: {
          provider: "claude",
          model: "repository-model",
          reasoning: "medium",
          speed: "fast",
        },
        runtimeSource: "repository",
        permission: "deny",
        permissionSource: "user",
        hostAccess: "read-only",
      })
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
    }
  })

  test("falls back to a complete user profile only when no repository profile exists", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "spec-finder-exec-cwd-"))
    const home = await mkdtemp(join(tmpdir(), "spec-finder-exec-home-"))
    try {
      await makeHomeConfig(home, {
        ...DEFAULT_CONFIG,
        provider: "cursor",
        model: "user-model",
        reasoning: "low",
        speed: "normal",
        permissions: "prompt",
      })
      const context = await resolveExecConfig({ cwd, home })
      expect(context.runtimeSource).toBe("user")
      expect(context.workspace).toBe(await realpath(cwd))
      expect(context.runtime).toEqual({
        provider: "cursor",
        model: "user-model",
        reasoning: "low",
        speed: "normal",
      })
    } finally {
      await rm(cwd, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
    }
  })

  test("blocks user fallback when an existing repository runtime profile is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-exec-invalid-repo-"))
    const home = await mkdtemp(join(tmpdir(), "spec-finder-exec-home-"))
    try {
      await makeConfig(root, { ...DEFAULT_CONFIG, provider: "not-a-provider" })
      await makeHomeConfig(home, { ...DEFAULT_CONFIG, provider: "codex" })
      await expect(resolveExecConfig({ cwd: root, home })).rejects.toMatchObject({
        name: "ExecConfigError",
        code: "runtime-profile",
        source: "repository",
      })
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
    }
  })

  test("retains user permission when unrelated user runtime fields are invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-exec-permission-"))
    const home = await mkdtemp(join(tmpdir(), "spec-finder-exec-home-"))
    try {
      await makeConfig(root, { ...DEFAULT_CONFIG, provider: "codex" })
      await makeHomeConfig(home, {
        ...DEFAULT_CONFIG,
        provider: "not-a-provider",
        reasoning: "not-a-reasoning-value",
        permissions: "approve-all",
      })
      const context = await resolveExecConfig({ cwd: root, home })
      expect(context.runtimeSource).toBe("repository")
      expect(context.permission).toBe("approve-all")
      expect(context.permissionSource).toBe("user")
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
    }
  })

  test("defaults unusable user permission to prompt without weakening runtime resolution", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-exec-default-permission-"))
    const home = await mkdtemp(join(tmpdir(), "spec-finder-exec-home-"))
    try {
      await makeConfig(root, { ...DEFAULT_CONFIG, permissions: "approve-all" })
      await makeHomeConfig(home, { ...DEFAULT_CONFIG, permissions: "unsafe" })
      const context = await resolveExecConfig({ cwd: root, home })
      expect(context.permission).toBe("prompt")
      expect(context.permissionSource).toBe("default")
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
    }
  })

  test("applies explicit overrides as a final complete-profile validation step", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-exec-overrides-"))
    const home = await mkdtemp(join(tmpdir(), "spec-finder-exec-home-"))
    try {
      await makeConfig(root, { ...DEFAULT_CONFIG, provider: "codex", model: "base" })
      const context = await resolveExecConfig({
        cwd: root,
        home,
        overrides: { provider: "cursor", model: "override", reasoning: "xhigh", speed: "fast" },
      })
      expect(context.runtime).toEqual({
        provider: "cursor",
        model: "override",
        reasoning: "xhigh",
        speed: "fast",
      })
      await expect(resolveExecConfig({ cwd: root, home, overrides: { provider: "invalid" } }))
        .rejects.toBeInstanceOf(ExecConfigError)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
    }
  })

  test("gates real exec launches while keeping fixture launches injectable", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-exec-certification-"))
    const home = await mkdtemp(join(tmpdir(), "spec-finder-exec-home-"))
    try {
      await makeConfig(root, { ...DEFAULT_CONFIG, provider: "codex", model: "base" })
      const context = await resolveExecConfig({ cwd: root, home })
      expect(() => resolveExecLaunch(context)).toThrow(/not certified for exec/)

      const fixture = {
        command: process.execPath,
        args: ["mock-agent.ts"],
        env: { SPEC_FINDER_TEST_FIXTURE: "1" },
        authMethod: null,
      }
      const launch = resolveExecLaunch(context, fixture)
      expect(launch).toMatchObject(fixture)
      expect(launch.mode).toBe("exec")
      expect(launch.args).not.toBe(fixture.args)
      expect(launch.env).not.toBe(fixture.env)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
    }
  })
})
