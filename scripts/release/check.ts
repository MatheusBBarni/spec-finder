import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  validateCandidate,
  validatePackedPaths,
  type ReleaseCandidate,
} from "./contract.ts"

export const NPM_PACK_COMMAND = ["npm", "pack", "--dry-run", "--json"] as const

export type PackProcessResult = {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export type PackProcessRunner = (
  command: readonly string[],
) => Promise<PackProcessResult>

export type ReleaseCheckOptions = {
  readonly runPack?: PackProcessRunner
}

export type ParsedPackOutput = {
  readonly name: string
  readonly version: string
  readonly paths: readonly string[]
}

export type ReleaseCheckResult = {
  readonly ok: true
  readonly candidate: ReleaseCandidate
  readonly packedPaths: readonly string[]
  readonly command: typeof NPM_PACK_COMMAND
}

export class ReleaseCheckError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReleaseCheckError"
  }
}

type UnknownRecord = { readonly [key: string]: unknown }

type PackPayload = {
  readonly name: string
  readonly version: string
  readonly files: readonly unknown[]
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function oneLine(value: string, limit = 400): string {
  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}

function isPackPayload(value: unknown): value is readonly [PackPayload] {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    return false
  }

  return (
    typeof value[0].name === "string" &&
    typeof value[0].version === "string" &&
    Array.isArray(value[0].files)
  )
}

function parseCandidatePayload(output: string): PackPayload {
  if (typeof output !== "string") {
    throw new ReleaseCheckError(
      "npm pack --dry-run --json stdout must be text; rerun the local pack check",
    )
  }

  const trimmed = output.trim()
  if (trimmed.length === 0) {
    throw new ReleaseCheckError(
      "npm pack --dry-run --json returned no JSON; rerun the local pack check and inspect npm output",
    )
  }

  let parsedJson = false
  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] !== "[") continue

    try {
      const parsed: unknown = JSON.parse(trimmed.slice(index))
      parsedJson = true
      if (isPackPayload(parsed)) return parsed[0]
    } catch {
      // npm lifecycle output may precede the JSON document; keep looking for it.
    }
  }

  if (parsedJson) {
    throw new ReleaseCheckError(
      "npm pack --dry-run --json returned JSON, but not one package with a files list",
    )
  }

  throw new ReleaseCheckError(
    "npm pack --dry-run --json returned malformed JSON; rerun the local pack check and inspect npm output",
  )
}

/**
 * Parses npm's JSON pack report after any prepack/lifecycle progress text.
 * Only the package identity and file paths are retained for the pure contract.
 */
export function parsePackOutput(output: string): ParsedPackOutput {
  const pack = parseCandidatePayload(output)
  const files = pack.files

  const paths: string[] = []
  for (const file of files) {
    if (!isRecord(file) || typeof file.path !== "string") {
      throw new ReleaseCheckError(
        "npm pack --dry-run --json included a file without a string path",
      )
    }
    paths.push(file.path)
  }

  return {
    name: pack.name as string,
    version: pack.version as string,
    paths,
  }
}

function createPackEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) environment[key] = value
  }

  // npm's default cache can be unavailable on a managed workstation. Keep the
  // candidate check local and rerunnable without touching a user-owned cache.
  const cachePath = join(tmpdir(), "spec-finder-release-check-npm-cache")
  environment.npm_config_cache = cachePath
  environment.npm_config_offline = "true"
  return environment
}

async function spawnNpmPack(command: readonly string[]): Promise<PackProcessResult> {
  const child = Bun.spawn([...command], {
    stdout: "pipe",
    stderr: "pipe",
    env: createPackEnvironment(),
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { stdout, stderr, exitCode }
}

/**
 * Runs only the local npm pack dry-run and delegates its parsed identity and
 * paths to the task 01 pure release-contract helpers.
 */
export async function runReleaseCheck(
  options: ReleaseCheckOptions = {},
): Promise<ReleaseCheckResult> {
  const runPack = options.runPack ?? spawnNpmPack
  let processResult: PackProcessResult
  try {
    processResult = await runPack(NPM_PACK_COMMAND)
  } catch (error) {
    const detail = error instanceof Error ? oneLine(error.message) : "unknown process error"
    throw new ReleaseCheckError(
      `unable to run npm pack --dry-run --json locally: ${detail}`,
    )
  }

  if (processResult.exitCode !== 0) {
    const detail = oneLine(processResult.stderr)
    const suffix = detail.length > 0 ? `: ${detail}` : ""
    throw new ReleaseCheckError(
      `npm pack --dry-run --json exited with code ${processResult.exitCode}${suffix}`,
    )
  }

  const packed = parsePackOutput(processResult.stdout)
  const allowlist = validatePackedPaths(packed.paths)
  if (!allowlist.ok) {
    throw new ReleaseCheckError(
      `release check blocked by packed-path allowlist: ${oneLine(allowlist.reason)}`,
    )
  }

  const candidate = validateCandidate({
    name: packed.name,
    version: packed.version,
    packedPaths: packed.paths,
  })
  if (!candidate.ok) {
    throw new ReleaseCheckError(
      `release check blocked by candidate contract: ${oneLine(candidate.reason)}`,
    )
  }

  return {
    ok: true,
    candidate: candidate.candidate,
    packedPaths: allowlist.normalizedPaths,
    command: NPM_PACK_COMMAND,
  }
}

async function main(): Promise<void> {
  try {
    const result = await runReleaseCheck()
    console.log(
      `release:check passed: ${result.candidate.name}@${result.candidate.version} (${result.packedPaths.length} packed paths)`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown release-check failure"
    console.error(`release:check failed: ${message}`)
    process.exitCode = 1
  }
}

if (import.meta.main) {
  void main()
}
