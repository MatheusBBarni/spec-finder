/**
 * Pure contracts used by the repository-owned release workflow.
 *
 * This module deliberately has no process, network, filesystem, Git, npm, or
 * GitHub dependencies.  It only turns explicit values into fail-closed
 * decisions and public, secret-free text.
 */

export const RELEASE_PACKAGE_NAME = "spec-finder" as const
export const RELEASE_SOURCE_REF = "refs/heads/main" as const

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
const SOURCE_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i

const CANDIDATE_KEYS = new Set([
  "name",
  "version",
  "sourceSha",
  "sourceRef",
  "tag",
  "packedPaths",
])

const REMOTE_STATE_KEYS = new Set(["npm", "tag", "release"])

const PACKED_PATH_REQUIRED = [
  "package/package.json",
  "dist/cli.js",
  "README.md",
  "LICENSE",
] as const

export const PACKED_PATH_ALLOWLIST = [
  "package/package.json",
  "dist/**",
  "skills/**",
  "README.md",
  "LICENSE",
] as const

export type ReleaseMode = "release" | "reconcile"

export type CandidateInput = {
  readonly name: unknown
  readonly version: unknown
  readonly sourceSha?: unknown
  readonly sourceRef?: unknown
  readonly tag?: unknown
  readonly packedPaths?: unknown
}

export type ReleaseCandidate = {
  readonly name: typeof RELEASE_PACKAGE_NAME
  readonly version: string
  readonly tag: string
  readonly sourceSha?: string
  readonly sourceRef?: typeof RELEASE_SOURCE_REF
  readonly packedPaths?: readonly string[]
}

export type CandidateResult = CandidateAccepted | CandidateBlocked

export type CandidateAccepted = {
  readonly ok: true
  readonly accepted: true
  readonly valid: true
  readonly status: "accepted"
  readonly reason: null
  readonly blockingReason: null
  readonly reasons: readonly []
  readonly candidate: ReleaseCandidate
  readonly name: typeof RELEASE_PACKAGE_NAME
  readonly version: string
  readonly tag: string
  readonly packageUrl: string
}

export type CandidateBlocked = {
  readonly ok: false
  readonly accepted: false
  readonly valid: false
  readonly status: "blocked"
  readonly reason: string
  readonly blockingReason: string
  readonly reasons: readonly string[]
  readonly candidate: null
  readonly name?: never
  readonly version?: never
  readonly tag?: never
  readonly packageUrl?: never
}

export type AllowlistResult = AllowlistAccepted | AllowlistBlocked

export type AllowlistAccepted = {
  readonly ok: true
  readonly accepted: true
  readonly valid: true
  readonly status: "accepted"
  readonly reason: null
  readonly blockingReason: null
  readonly paths: readonly string[]
  readonly normalizedPaths: readonly string[]
  readonly unexpectedPaths: readonly []
  readonly missingPaths: readonly []
}

export type AllowlistBlocked = {
  readonly ok: false
  readonly accepted: false
  readonly valid: false
  readonly status: "blocked"
  readonly reason: string
  readonly blockingReason: string
  readonly paths: readonly string[]
  readonly normalizedPaths: readonly string[]
  readonly unexpectedPaths: readonly string[]
  readonly missingPaths: readonly string[]
}

export type NpmRemoteState = "absent" | "published" | "mismatch"
export type MetadataRemoteState = "absent" | "matching" | "mismatch"

export type RemoteState = {
  readonly npm: NpmRemoteState
  readonly tag: MetadataRemoteState
  readonly release: MetadataRemoteState
}

export type NextActionStatus = "ready" | "reconcile" | "complete" | "blocked"
export type NextActionKind = "publish" | "reconcile" | "none"

export type NextAction = {
  readonly ok: boolean
  readonly accepted: boolean
  readonly valid: boolean
  readonly safe: boolean
  readonly stateValid: boolean
  readonly status: NextActionStatus
  readonly outcome: NextActionStatus
  readonly mode: ReleaseMode | null
  readonly action: NextActionKind
  readonly canPublish: boolean
  readonly publish: boolean
  readonly reason: string
  readonly nextAction: string
}

export type SummaryResult = "complete" | "blocked" | "partial"
export type GateStatus = "passed" | "blocked" | "failed" | "partial" | "pending" | "not_run"
export type SmokeStatus = GateStatus

export type SummaryInput = {
  readonly name?: unknown
  readonly packageName?: unknown
  readonly version: unknown
  readonly mode: unknown
  readonly result?: unknown
  readonly status?: unknown
  readonly sourceSha?: unknown
  readonly sourceRef?: unknown
  readonly packageUrl?: unknown
  readonly tagUrl?: unknown
  readonly releaseUrl?: unknown
  readonly packageState?: unknown
  readonly tagState?: unknown
  readonly releaseState?: unknown
  readonly artifactState?: unknown
  readonly package?: unknown
  readonly tag?: unknown
  readonly release?: unknown
  readonly preflight?: unknown
  readonly smoke?: unknown
  readonly nextAction?: unknown
  readonly recoveryAction?: unknown
}

type UnknownRecord = { readonly [key: string]: unknown }

const RELEASE_FOOTER_MARKER = "<!-- spec-finder-release-footer -->"

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

/** Returns the original string only when it is a stable, valid SemVer. */
export function parseStableVersion(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null
  }

  return VERSION_PATTERN.test(value) ? value : null
}

export function isStableVersion(value: unknown): value is string {
  return parseStableVersion(value) !== null
}

function packageUrl(version: string): string {
  return `https://www.npmjs.com/package/${RELEASE_PACKAGE_NAME}/v/${version}`
}

function invalidCandidate(reasons: readonly string[]): CandidateBlocked {
  const normalizedReasons = reasons.length > 0 ? [...reasons] : ["candidate input is invalid"]
  const reason = normalizedReasons.join(" ")
  return {
    ok: false,
    accepted: false,
    valid: false,
    status: "blocked",
    reason,
    blockingReason: reason,
    reasons: normalizedReasons,
    candidate: null,
  }
}

/**
 * Validates the reviewed package identity and optional workflow identity.
 * The function never reads package.json or talks to a remote service; callers
 * must provide every value they want checked.
 */
export function validateCandidate(input: CandidateInput): CandidateResult {
  if (!isRecord(input)) {
    return invalidCandidate(["candidate input must be an object"])
  }

  const reasons: string[] = []
  for (const key of Object.keys(input)) {
    if (!CANDIDATE_KEYS.has(key)) {
      reasons.push(`candidate contains unexpected field ${key}`)
    }
  }

  const name = input.name
  if (name !== RELEASE_PACKAGE_NAME) {
    reasons.push(`package name must be ${RELEASE_PACKAGE_NAME}`)
  }

  const version = parseStableVersion(input.version)
  if (version === null) {
    reasons.push("version must be a stable SemVer without a prerelease identifier")
  }

  const hasSourceSha = hasOwn(input, "sourceSha")
  const hasSourceRef = hasOwn(input, "sourceRef")
  if (hasSourceSha !== hasSourceRef) {
    reasons.push("sourceSha and sourceRef must be supplied together")
  }

  const sourceSha = hasSourceSha ? input.sourceSha : undefined
  if (hasSourceSha && (typeof sourceSha !== "string" || !SOURCE_SHA_PATTERN.test(sourceSha))) {
    reasons.push("sourceSha must be a full 40- or 64-character hexadecimal commit id")
  }

  const sourceRef = hasSourceRef ? input.sourceRef : undefined
  if (hasSourceRef && sourceRef !== RELEASE_SOURCE_REF) {
    reasons.push(`sourceRef must be ${RELEASE_SOURCE_REF}`)
  }

  if (hasOwn(input, "tag") && input.tag !== (version === null ? undefined : `v${version}`)) {
    reasons.push("tag must exactly match v<version>")
  }

  let packedPaths: readonly string[] | undefined
  if (hasOwn(input, "packedPaths")) {
    if (!Array.isArray(input.packedPaths)) {
      reasons.push("packedPaths must be an array")
    } else {
      const packedResult = validatePackedPaths(input.packedPaths)
      if (!packedResult.ok) {
        reasons.push(`packed paths are blocked: ${packedResult.reason}`)
      } else {
        packedPaths = packedResult.normalizedPaths
      }
    }
  }

  if (reasons.length > 0 || version === null) {
    return invalidCandidate(reasons)
  }

  const optionalFields: {
    sourceSha?: string
    sourceRef?: typeof RELEASE_SOURCE_REF
    packedPaths?: readonly string[]
  } = {}
  if (typeof sourceSha === "string") {
    optionalFields.sourceSha = sourceSha
  }
  if (sourceRef === RELEASE_SOURCE_REF) {
    optionalFields.sourceRef = sourceRef
  }
  if (packedPaths !== undefined) {
    optionalFields.packedPaths = packedPaths
  }

  const tag = `v${version}`
  const candidate: ReleaseCandidate = {
    name: RELEASE_PACKAGE_NAME,
    version,
    tag,
    ...optionalFields,
  }

  return {
    ok: true,
    accepted: true,
    valid: true,
    status: "accepted",
    reason: null,
    blockingReason: null,
    reasons: [],
    candidate,
    name: RELEASE_PACKAGE_NAME,
    version,
    tag,
    packageUrl: packageUrl(version),
  }
}

function canonicalPackedPath(path: string): string | null {
  if (
    path.length === 0 ||
    path.length > 512 ||
    path.includes("\\") ||
    path.includes("\u0000") ||
    path.startsWith("/")
  ) {
    return null
  }

  const segments = path.split("/")
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return null
  }

  if (path === "package.json" || path === "package/package.json") {
    return "package/package.json"
  }

  if (path.startsWith("package/")) {
    const withoutNpmPrefix = path.slice("package/".length)
    if (withoutNpmPrefix.length === 0 || withoutNpmPrefix.startsWith("package/")) {
      return null
    }
    return withoutNpmPrefix
  }

  return path
}

function isAllowedCanonicalPath(path: string): boolean {
  return (
    path === "package/package.json" ||
    path === "README.md" ||
    path === "LICENSE" ||
    path.startsWith("dist/") ||
    path.startsWith("skills/")
  )
}

function invalidAllowlist(
  reason: string,
  paths: readonly string[],
  normalizedPaths: readonly string[],
  unexpectedPaths: readonly string[],
  missingPaths: readonly string[],
): AllowlistBlocked {
  return {
    ok: false,
    accepted: false,
    valid: false,
    status: "blocked",
    reason,
    blockingReason: reason,
    paths: [...paths],
    normalizedPaths: [...normalizedPaths],
    unexpectedPaths: [...unexpectedPaths],
    missingPaths: [...missingPaths],
  }
}

/**
 * Checks the exact public package allowlist. npm may report paths with or
 * without its tarball `package/` prefix; both forms normalize to one contract.
 */
export function validatePackedPaths(paths: readonly string[]): AllowlistResult {
  if (!Array.isArray(paths)) {
    return invalidAllowlist("packed paths must be an array", [], [], [], [...PACKED_PATH_REQUIRED])
  }

  const normalizedPaths: string[] = []
  const unexpectedPaths: string[] = []
  const seen = new Set<string>()

  for (const value of paths) {
    if (typeof value !== "string") {
      unexpectedPaths.push("<non-string path>")
      continue
    }

    const normalized = canonicalPackedPath(value)
    if (normalized === null || !isAllowedCanonicalPath(normalized)) {
      unexpectedPaths.push(value)
      continue
    }

    if (seen.has(normalized)) {
      unexpectedPaths.push(value)
      continue
    }

    seen.add(normalized)
    normalizedPaths.push(normalized)
  }

  const missingPaths = PACKED_PATH_REQUIRED.filter((required) => !seen.has(required))
  if (paths.length === 0) {
    return invalidAllowlist(
      "packed paths must include the published package entries",
      paths,
      normalizedPaths,
      unexpectedPaths,
      missingPaths,
    )
  }

  if (unexpectedPaths.length > 0) {
    return invalidAllowlist(
      `packed paths contain unexpected or unsafe entries: ${unexpectedPaths.join(", ")}`,
      paths,
      normalizedPaths,
      unexpectedPaths,
      missingPaths,
    )
  }

  if (missingPaths.length > 0) {
    return invalidAllowlist(
      `packed paths are missing required entries: ${missingPaths.join(", ")}`,
      paths,
      normalizedPaths,
      unexpectedPaths,
      missingPaths,
    )
  }

  if (!normalizedPaths.some((path) => path.startsWith("skills/"))) {
    return invalidAllowlist(
      "packed paths must include at least one skills entry",
      paths,
      normalizedPaths,
      unexpectedPaths,
      missingPaths,
    )
  }

  return {
    ok: true,
    accepted: true,
    valid: true,
    status: "accepted",
    reason: null,
    blockingReason: null,
    paths: [...paths],
    normalizedPaths,
    unexpectedPaths: [],
    missingPaths: [],
  }
}

function stateResult(
  mode: ReleaseMode | null,
  stateValid: boolean,
  accepted: boolean,
  status: NextActionStatus,
  action: NextActionKind,
  canPublish: boolean,
  reason: string,
  nextAction: string,
): NextAction {
  return {
    ok: accepted,
    accepted,
    valid: accepted,
    safe: accepted,
    stateValid,
    status,
    outcome: status,
    mode,
    action,
    canPublish,
    publish: canPublish,
    reason,
    nextAction,
  }
}

function isReleaseMode(value: unknown): value is ReleaseMode {
  return value === "release" || value === "reconcile"
}

function isNpmState(value: unknown): value is NpmRemoteState {
  return value === "absent" || value === "published" || value === "mismatch"
}

function isMetadataState(value: unknown): value is MetadataRemoteState {
  return value === "absent" || value === "matching" || value === "mismatch"
}

function isRemoteState(value: unknown): value is RemoteState {
  if (!isRecord(value)) {
    return false
  }

  const keys = Object.keys(value)
  return (
    keys.length === REMOTE_STATE_KEYS.size &&
    keys.every((key) => REMOTE_STATE_KEYS.has(key)) &&
    isNpmState(value.npm) &&
    isMetadataState(value.tag) &&
    isMetadataState(value.release)
  )
}

/**
 * Classifies remote state without authorizing any mutation.  In particular,
 * `reconcile` can only repair metadata for an already-published npm version.
 */
export function classifyState(mode: ReleaseMode, state: RemoteState): NextAction {
  if (!isReleaseMode(mode)) {
    return stateResult(
      null,
      false,
      false,
      "blocked",
      "none",
      false,
      "release mode is unknown",
      "Use release or reconcile mode explicitly.",
    )
  }

  if (!isRemoteState(state)) {
    return stateResult(
      mode,
      false,
      false,
      "blocked",
      "none",
      false,
      "remote state is malformed or contains an unknown value",
      "Inspect the public identity manually before retrying the workflow.",
    )
  }

  const { npm, tag, release } = state
  const metadataMismatch = tag === "mismatch" || release === "mismatch"

  if (metadataMismatch || npm === "mismatch") {
    return stateResult(
      mode,
      true,
      false,
      "blocked",
      "none",
      false,
      "public release identity contains a mismatch",
      "Stop and correct the mismatched artifact manually; do not force-update or republish.",
    )
  }

  if (mode === "release") {
    if (npm !== "absent") {
      return stateResult(
        mode,
        true,
        false,
        "blocked",
        "none",
        false,
        "release mode requires the exact npm version to be absent",
        "Inspect the existing npm version, then use reconcile mode only for missing matching metadata.",
      )
    }

    if (tag !== "absent" || release !== "absent") {
      return stateResult(
        mode,
        true,
        false,
        "blocked",
        "none",
        false,
        "release metadata exists without a published npm version",
        "Stop and reconcile the public identity manually before attempting a new release.",
      )
    }

    return stateResult(
      mode,
      true,
      true,
      "ready",
      "publish",
      true,
      "no public artifacts exist for this stable version",
      "Publish the validated candidate in release mode.",
    )
  }

  if (npm !== "published") {
    return stateResult(
      mode,
      true,
      false,
      "blocked",
      "none",
      false,
      "reconcile mode requires the exact npm version to be published",
      "Use release mode for an entirely absent version; reconcile never publishes npm.",
    )
  }

  if (tag === "matching" && release === "matching") {
    return stateResult(
      mode,
      true,
      true,
      "complete",
      "none",
      false,
      "npm, tag, and GitHub Release already match",
      "No recovery action is required for the public identity.",
    )
  }

  return stateResult(
    mode,
    true,
    true,
    "reconcile",
    "reconcile",
    false,
    "the npm version is published and matching metadata is incomplete",
    "Run reconcile mode to create only the missing matching metadata.",
  )
}

/** Produces the fixed public installer guidance appended to release notes. */
export function formatReleaseFooter(version: string): string {
  const stableVersion = parseStableVersion(version)
  if (stableVersion === null) {
    throw new TypeError("release footer requires a stable SemVer version")
  }

  return [
    RELEASE_FOOTER_MARKER,
    "## Installer guidance",
    "",
    `Package: ${packageUrl(stableVersion)}`,
    `Install: \`npm install --global ${RELEASE_PACKAGE_NAME}@${stableVersion}\``,
    `Upgrade: \`spec-finder upgrade\``,
  ].join("\n")
}

export const formatInstallerFooter = formatReleaseFooter

type ArtifactDisplay = {
  readonly state: string
  readonly url: string | null
}

type SmokeDisplay = {
  readonly ubuntu: SmokeStatus | "unknown"
  readonly windows: SmokeStatus | "unknown"
}

function isGateStatus(value: unknown): value is GateStatus {
  return (
    value === "passed" ||
    value === "blocked" ||
    value === "failed" ||
    value === "partial" ||
    value === "pending" ||
    value === "not_run"
  )
}

function normalizeGateStatus(value: unknown, fallback: GateStatus): GateStatus {
  return isGateStatus(value) ? value : fallback
}

function isSafePublicUrl(value: unknown, kind: "package" | "github", version: string): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return false
  }

  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
      return false
    }

    if (kind === "package") {
      if (url.hostname !== "www.npmjs.com" && url.hostname !== "npmjs.com") {
        return false
      }
      const root = `/package/${RELEASE_PACKAGE_NAME}`
      return url.pathname === root || url.pathname === `${root}/v/${version}`
    }

    return (
      url.hostname === "github.com" &&
      url.pathname.startsWith("/MatheusBBarni/spec-finder/")
    )
  } catch {
    return false
  }
}

function artifactValue(value: unknown, fallbackState: string): { state: string; url: unknown } {
  if (isRecord(value)) {
    return {
      state: typeof value.state === "string" ? value.state : fallbackState,
      url: value.url,
    }
  }

  if (typeof value === "string") {
    return { state: "available", url: value }
  }

  return { state: fallbackState, url: undefined }
}

function displayArtifact(
  value: unknown,
  flatUrl: unknown,
  flatState: unknown,
  kind: "package" | "github",
  version: string,
  fallbackState: string,
): ArtifactDisplay {
  const nested = artifactValue(value, typeof flatState === "string" ? flatState : fallbackState)
  const state = nested.state
  const urlInput = flatUrl ?? nested.url
  const url = isSafePublicUrl(urlInput, kind, version) ? urlInput : null

  if (state === "mismatch") {
    return { state: "mismatch", url: null }
  }

  if (url !== null) {
    return { state: state || "available", url }
  }

  if (
    state === "absent" ||
    state === "missing" ||
    state === "not_published" ||
    state === "not_available"
  ) {
    return { state: "not available", url: null }
  }

  return { state: state || "unavailable", url: null }
}

function artifactLine(display: ArtifactDisplay): string {
  if (display.url !== null) {
    return display.url
  }
  return display.state
}

function smokeValue(value: unknown): SmokeDisplay {
  if (!isRecord(value)) {
    return { ubuntu: "unknown", windows: "unknown" }
  }

  return {
    ubuntu: isGateStatus(value.ubuntu) ? value.ubuntu : "unknown",
    windows: isGateStatus(value.windows) ? value.windows : "unknown",
  }
}

function recoveryAction(result: SummaryResult, mode: ReleaseMode, requested: unknown): string {
  if (result === "complete") {
    return "No recovery action is required; the public identity and smoke proof are complete."
  }

  if (typeof requested === "string") {
    const normalized = requested.toLowerCase()
    if (normalized.includes("reconcile")) {
      return "Run reconcile mode for the same main version; do not republish npm."
    }
    if (normalized.includes("deprecat")) {
      return "Deprecate the defective exact version, publish a corrective version, and update its GitHub Release."
    }
    if (normalized.includes("mismatch") || normalized.includes("manual")) {
      return "Stop for manual identity correction; do not force-update tags, Releases, or npm versions."
    }
  }

  if (result === "partial" || mode === "reconcile") {
    return "Run reconcile mode for the same main version; do not republish npm."
  }

  return "Fix the blocked candidate and dispatch release mode again after the local gates pass."
}

function summaryInputResult(input: UnknownRecord): SummaryResult | null {
  const value = input.result ?? input.status
  return value === "complete" || value === "blocked" || value === "partial" ? value : null
}

/**
 * Formats only public release metadata. Arbitrary URLs, source ids, and action
 * text are validated or replaced with fixed safe wording before interpolation.
 */
export function formatSummary(input: SummaryInput): string {
  if (!isRecord(input)) {
    throw new TypeError("release summary input must be an object")
  }

  const version = parseStableVersion(input.version)
  if (version === null) {
    throw new TypeError("release summary requires a stable SemVer version")
  }

  if (!isReleaseMode(input.mode)) {
    throw new TypeError("release summary mode must be release or reconcile")
  }

  const result = summaryInputResult(input)
  if (result === null) {
    throw new TypeError("release summary result must be complete, blocked, or partial")
  }

  const name = input.name ?? input.packageName
  if (name !== undefined && name !== RELEASE_PACKAGE_NAME) {
    throw new TypeError(`release summary package name must be ${RELEASE_PACKAGE_NAME}`)
  }

  const sourceRef = input.sourceRef === RELEASE_SOURCE_REF ? RELEASE_SOURCE_REF : "unavailable"
  const sourceSha = typeof input.sourceSha === "string" && SOURCE_SHA_PATTERN.test(input.sourceSha)
    ? input.sourceSha
    : "unavailable"

  const fallbackState = result === "complete" ? "matching" : "not available"
  const artifactState = isRecord(input.artifactState) ? input.artifactState : {}
  const packageArtifact = displayArtifact(
    input.package ?? artifactState.package,
    input.packageUrl,
    input.packageState ?? artifactState.npm,
    "package",
    version,
    fallbackState,
  )
  const tagArtifact = displayArtifact(
    input.tag ?? artifactState.tag,
    input.tagUrl,
    input.tagState ?? artifactState.tag,
    "github",
    version,
    fallbackState,
  )
  const releaseArtifact = displayArtifact(
    input.release ?? artifactState.release,
    input.releaseUrl,
    input.releaseState ?? artifactState.release,
    "github",
    version,
    fallbackState,
  )

  const preflight = normalizeGateStatus(input.preflight, result === "complete" ? "passed" : "not_run")
  const smoke = smokeValue(input.smoke)

  if (
    result === "complete" &&
    (sourceRef === "unavailable" ||
      sourceSha === "unavailable" ||
      packageArtifact.url === null ||
      tagArtifact.url === null ||
      releaseArtifact.url === null ||
      preflight !== "passed" ||
      smoke.ubuntu !== "passed" ||
      smoke.windows !== "passed")
  ) {
    throw new TypeError("complete release summaries require public links, source identity, preflight, and both smoke passes")
  }

  return [
    `Release summary: ${RELEASE_PACKAGE_NAME}@${version}`,
    `Result: ${result}`,
    `Mode: ${input.mode}`,
    `Source: ${sourceRef} (${sourceSha})`,
    `Package: ${artifactLine(packageArtifact)}`,
    `Tag: ${artifactLine(tagArtifact)}`,
    `GitHub Release: ${artifactLine(releaseArtifact)}`,
    `Preflight: ${preflight}`,
    `Smoke: Ubuntu ${smoke.ubuntu}; Windows ${smoke.windows}`,
    `Next action: ${recoveryAction(result, input.mode, input.nextAction ?? input.recoveryAction)}`,
  ].join("\n")
}
