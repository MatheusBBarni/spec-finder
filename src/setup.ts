import { cp, lstat, mkdir, realpath, rm, symlink } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { CONFIG_FILE, SPEC_DIR, TASKS_DIR, bundledSkillsPath } from "./paths.ts"
import { loadConfig, writeConfig, writeDefaultConfig } from "./config.ts"

export const SKILL_TARGETS = {
  claude: ".claude/skills",
  codex: ".agents/skills",
  cursor: ".cursor/skills",
} as const

export type SkillTarget = keyof typeof SKILL_TARGETS

export const SETUP_SCOPES = ["local", "global"] as const
export type SetupScope = (typeof SETUP_SCOPES)[number]

export const SKILL_INSTALL_MODES = ["copy", "symlink"] as const
export type SkillInstallMode = (typeof SKILL_INSTALL_MODES)[number]

export const SPEC_FINDER_SKILLS = [
  "sf-idea-factory",
  "sf-create-prd",
  "sf-create-techspec",
  "sf-create-tasks",
  "sf-memory",
  "sf-execute-task",
  "sf-task-report",
] as const

export interface SetupWorkspaceOptions {
  scope?: SetupScope
  mode?: SkillInstallMode
  homeDirectory?: string
}

export interface SetupResult {
  configPath: string
  configCreated: boolean
  installed: string[]
  copied: string[]
  linked: string[]
  scope: SetupScope
  mode: SkillInstallMode
  canonical: SkillTarget | null
}

export function isSkillTarget(value: string): value is SkillTarget {
  return Object.hasOwn(SKILL_TARGETS, value)
}

export function skillTargetPath(
  root: string,
  target: SkillTarget,
  scope: SetupScope = "local",
  homeDirectory = homedir(),
): string {
  return join(scope === "global" ? homeDirectory : root, SKILL_TARGETS[target])
}

export async function setupWorkspace(
  root: string,
  targets: SkillTarget[],
  options: SetupWorkspaceOptions = {},
): Promise<SetupResult> {
  const selectedTargets = uniqueTargets(targets)
  validateTargets(selectedTargets)
  if (selectedTargets.length === 0) throw new Error("select at least one setup provider")

  const scope = options.scope ?? "local"
  const mode = options.mode ?? "copy"
  validateScope(scope)
  validateInstallMode(mode)
  const homeDirectory = options.homeDirectory ?? homedir()

  const specDirectory = join(root, SPEC_DIR)
  await mkdir(join(specDirectory, TASKS_DIR), { recursive: true })
  const configPath = join(specDirectory, CONFIG_FILE)
  let configCreated = false
  try {
    const config = await loadConfig(root)
    await writeConfig(root, config)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("cannot read")) {
      await writeDefaultConfig(root)
      configCreated = true
    } else {
      throw error
    }
  }

  const sourceRoot = bundledSkillsPath()
  const installed: string[] = []
  const copied: string[] = []
  const linked: string[] = []
  const canonical = mode === "symlink" ? selectCanonicalTarget(selectedTargets) : null
  const installationOrder = canonical
    ? [canonical, ...selectedTargets.filter((target) => target !== canonical)]
    : selectedTargets

  for (const target of installationOrder) {
    const targetRoot = skillTargetPath(root, target, scope, homeDirectory)
    if (scope === "local") await assertSafeLocalSkillRoot(root, targetRoot)
    await mkdir(targetRoot, { recursive: true })
    for (const skill of SPEC_FINDER_SKILLS) {
      if (scope === "local") await assertSafeLocalSkillRoot(root, targetRoot)
      const destination = join(targetRoot, skill)
      const displayPath = installedSkillPath(target, skill, scope, homeDirectory)
      if (canonical && target !== canonical) {
        await replaceWithSymlink(join(skillTargetPath(root, canonical, scope, homeDirectory), skill), destination)
        linked.push(displayPath)
      } else {
        await replaceWithCopy(join(sourceRoot, skill), destination)
        copied.push(displayPath)
      }
      installed.push(displayPath)
    }
  }
  return { configPath, configCreated, installed, copied, linked, scope, mode, canonical }
}

function uniqueTargets(targets: SkillTarget[]): SkillTarget[] {
  return [...new Set(targets)]
}

function validateTargets(targets: SkillTarget[]): void {
  for (const target of targets) {
    if (!isSkillTarget(target)) throw new Error(`unsupported setup agent: ${target}`)
  }
}

function validateScope(scope: SetupScope): void {
  if (!SETUP_SCOPES.includes(scope)) throw new Error(`unsupported setup scope: ${scope}`)
}

function validateInstallMode(mode: SkillInstallMode): void {
  if (!SKILL_INSTALL_MODES.includes(mode)) throw new Error(`unsupported skill install mode: ${mode}`)
}

function selectCanonicalTarget(targets: SkillTarget[]): SkillTarget {
  return targets.includes("codex") ? "codex" : targets[0]!
}

function installedSkillPath(target: SkillTarget, skill: string, scope: SetupScope, homeDirectory: string): string {
  return scope === "local"
    ? join(SKILL_TARGETS[target], skill)
    : join(homeDirectory, SKILL_TARGETS[target], skill)
}

async function replaceWithCopy(source: string, destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true })
  await cp(source, destination, { recursive: true })
}

async function replaceWithSymlink(source: string, destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true })
  const target = process.platform === "win32" ? source : relative(dirname(destination), source)
  await symlink(target, destination, process.platform === "win32" ? "junction" : "dir")
}

async function assertSafeLocalSkillRoot(root: string, targetRoot: string): Promise<void> {
  const workspacePath = resolve(root)
  const targetPath = resolve(targetRoot)
  const offset = relative(workspacePath, targetPath)
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new Error(`local skill path escapes workspace: ${targetRoot}`)
  }

  const resolvedWorkspace = await realpath(workspacePath)
  let cursor = workspacePath
  for (const component of offset.split(sep).filter(Boolean)) {
    cursor = join(cursor, component)
    try {
      const status = await lstat(cursor)
      if (status.isSymbolicLink()) throw new Error(`local skill path contains a symlink: ${cursor}`)
      if (status.isDirectory()) {
        const resolvedCursor = await realpath(cursor)
        const resolvedOffset = relative(resolvedWorkspace, resolvedCursor)
        if (resolvedOffset === ".." || resolvedOffset.startsWith(`..${sep}`) || isAbsolute(resolvedOffset)) {
          throw new Error(`local skill path escapes workspace: ${cursor}`)
        }
      }
    } catch (error) {
      if (isMissingPath(error)) break
      throw error
    }
  }
}

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}
