import { SPECS_DIR, TASKS_DIR } from "./paths.ts"

export const TASKS_DONE_DIR = "tasks_done"
export const GITIGNORE_FILE = ".gitignore"

export const PACKET_GITIGNORE_COMMENT =
  "# Spec Finder packets stay local; committing them can poison later agent context."

export const PACKET_GITIGNORE_PATHS = [
  `/${TASKS_DIR}/`,
  `/${TASKS_DONE_DIR}/`,
  `/${SPECS_DIR}/`,
] as const

export type GitignoreStatus = "created" | "updated" | "unchanged"

export function mergeWorkspaceGitignore(existing: string | undefined): {
  content: string
  changed: boolean
} {
  const newline = existing?.includes("\r\n") ? "\r\n" : "\n"
  const missing = PACKET_GITIGNORE_PATHS.filter((path) => !gitignoreCovers(existing ?? "", path))
  if (missing.length === 0) {
    return { content: existing ?? "", changed: false }
  }

  if (existing === undefined || existing.length === 0) {
    return {
      content: [PACKET_GITIGNORE_COMMENT, ...PACKET_GITIGNORE_PATHS].join(newline) + newline,
      changed: true,
    }
  }

  let prefix = existing
  if (!prefix.endsWith("\n")) prefix += newline
  const separator = /(?:\r?\n){2}$/.test(prefix) ? "" : newline
  const commentLine = gitignoreHasPacketComment(existing) ? [] : [PACKET_GITIGNORE_COMMENT]
  const block = [...commentLine, ...missing].join(newline) + newline
  return {
    content: `${prefix}${separator}${block}`,
    changed: true,
  }
}

export function gitignoreCovers(content: string, directoryPath: string): boolean {
  const target = directoryPath.replace(/\/+$/, "").replace(/^\//, "")
  for (const line of content.split(/\r?\n/)) {
    const pattern = normalizeGitignorePattern(line)
    if (pattern === target) return true
  }
  return false
}

function gitignoreHasPacketComment(content: string): boolean {
  return content.split(/\r?\n/).some((line) => line.trim() === PACKET_GITIGNORE_COMMENT)
}

function normalizeGitignorePattern(line: string): string | undefined {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.startsWith("#") || trimmed.startsWith("!")) return undefined
  return trimmed.replace(/^\//, "").replace(/\/\*\*$/, "").replace(/\/+$/, "")
}
