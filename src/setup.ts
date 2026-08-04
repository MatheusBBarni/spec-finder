import { cp, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { CONFIG_FILE, SPEC_DIR, TASKS_DIR, bundledSkillsPath } from "./paths.ts"
import { loadConfig, writeDefaultConfig } from "./config.ts"

export const SKILL_TARGETS = {
  claude: ".claude/skills",
  codex: ".agents/skills",
  cursor: ".cursor/skills",
} as const

export type SkillTarget = keyof typeof SKILL_TARGETS

export interface SetupResult {
  configPath: string
  configCreated: boolean
  installed: string[]
}

export async function setupWorkspace(root: string, targets: SkillTarget[]): Promise<SetupResult> {
  const specDirectory = join(root, SPEC_DIR)
  await mkdir(join(specDirectory, TASKS_DIR), { recursive: true })
  const configPath = join(specDirectory, CONFIG_FILE)
  let configCreated = false
  try {
    await loadConfig(root)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("cannot read")) {
      await writeDefaultConfig(root)
      configCreated = true
    } else {
      throw error
    }
  }

  const sourceRoot = bundledSkillsPath()
  const skills = ["sf-idea-factory", "sf-create-prd", "sf-create-techspec", "sf-create-tasks", "sf-execute-task", "sf-task-report"]
  const installed: string[] = []
  for (const target of [...new Set(targets)]) {
    const targetRoot = join(root, SKILL_TARGETS[target])
    await mkdir(targetRoot, { recursive: true })
    for (const skill of skills) {
      const destination = join(targetRoot, skill)
      await rm(destination, { recursive: true, force: true })
      await cp(join(sourceRoot, skill), destination, { recursive: true })
      installed.push(join(SKILL_TARGETS[target], skill))
    }
  }
  return { configPath, configCreated, installed }
}

