import { describe, expect, test } from "bun:test"
import {
  PACKED_PATH_ALLOWLIST,
  RELEASE_PACKAGE_NAME,
  RELEASE_SOURCE_REF,
  classifyState,
  formatInstallerFooter,
  formatReleaseFooter,
  formatSummary,
  isStableVersion,
  parseStableVersion,
  validateCandidate,
  validatePackedPaths,
  type MetadataRemoteState,
  type ReleaseMode,
  type RemoteState,
} from "../scripts/release/contract.ts"

const version = "1.2.3"
const sourceSha = "a".repeat(40)
const allowedPaths = [
  "package/package.json",
  "dist/cli.js",
  "skills/sf-create-prd/SKILL.md",
  "README.md",
  "LICENSE",
]

describe("release contract helpers", () => {
  test("accepts a stable candidate and derives its exact tag", () => {
    const result = validateCandidate({
      name: RELEASE_PACKAGE_NAME,
      version,
      sourceSha,
      sourceRef: RELEASE_SOURCE_REF,
      packedPaths: allowedPaths,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.candidate).toMatchObject({
      name: RELEASE_PACKAGE_NAME,
      version,
      tag: `v${version}`,
      sourceSha,
      sourceRef: RELEASE_SOURCE_REF,
    })
    expect(result.packageUrl).toBe(`https://www.npmjs.com/package/spec-finder/v/${version}`)
  })

  test("rejects prerelease, malformed, and mismatched candidate identities", () => {
    for (const invalidVersion of ["1.2.3-beta.1", "1.2", "01.2.3", "v1.2.3", ""]) {
      const result = validateCandidate({
        name: RELEASE_PACKAGE_NAME,
        version: invalidVersion,
      })
      expect(result.ok).toBe(false)
      expect(result.reason).toContain("stable SemVer")
    }

    const mismatched = validateCandidate({
      name: "another-package",
      version,
      tag: "v9.9.9",
      sourceRef: "refs/heads/feature",
    })
    expect(mismatched.ok).toBe(false)
    expect(mismatched.reasons.join(" ")).toContain("package name")
    expect(mismatched.reasons.join(" ")).toContain("sourceRef")
    expect(mismatched.reasons.join(" ")).toContain("tag")
  })

  test("accepts npm's implicit package path and the repository package entries", () => {
    const result = validatePackedPaths(allowedPaths)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.normalizedPaths).toEqual(allowedPaths)
    expect(PACKED_PATH_ALLOWLIST).toEqual([
      "package/package.json",
      "dist/**",
      "skills/**",
      "README.md",
      "LICENSE",
    ])

    const npmPrefixed = validatePackedPaths([
      "package/package.json",
      "package/dist/cli.js",
      "package/skills/sf-create-prd/SKILL.md",
      "package/README.md",
      "package/LICENSE",
    ])
    expect(npmPrefixed.ok).toBe(true)
  })

  test("rejects traversal, unsafe separators, duplicates, and unexpected package files", () => {
    for (const unsafePath of [
      "../README.md",
      "dist/../README.md",
      "dist\\cli.js",
      "/tmp/secret",
      "package/package-lock.json",
      "src/cli.tsx",
    ]) {
      const result = validatePackedPaths([...allowedPaths, unsafePath])
      expect(result.ok).toBe(false)
      expect(result.unexpectedPaths).toContain(unsafePath)
    }

    const duplicate = validatePackedPaths([...allowedPaths, "package/README.md"])
    expect(duplicate.ok).toBe(false)
    expect(duplicate.reason).toContain("unexpected")

    const incomplete = validatePackedPaths(["dist/cli.js", "README.md", "LICENSE"])
    expect(incomplete.ok).toBe(false)
    expect(incomplete.missingPaths).toContain("package/package.json")
  })

  test("classifies every release and reconcile remote-state combination", () => {
    const npmStates = ["absent", "published", "mismatch"] as const
    const metadataStates = ["absent", "matching", "mismatch"] as const
    const modes = ["release", "reconcile"] as const

    for (const mode of modes) {
      for (const npm of npmStates) {
        for (const tag of metadataStates) {
          for (const release of metadataStates) {
            const state: RemoteState = { npm, tag, release }
            const result = classifyState(mode, state)

            if (mode === "release" && npm === "absent" && tag === "absent" && release === "absent") {
              expect(result).toMatchObject({ ok: true, status: "ready", action: "publish", canPublish: true })
            } else if (
              mode === "reconcile" &&
              npm === "published" &&
              tag === "matching" &&
              release === "matching"
            ) {
              expect(result).toMatchObject({ ok: true, status: "complete", action: "none", canPublish: false })
            } else if (
              mode === "reconcile" &&
              npm === "published" &&
              tag !== "mismatch" &&
              release !== "mismatch" &&
              (tag === "absent" || release === "absent")
            ) {
              expect(result).toMatchObject({ ok: true, status: "reconcile", action: "reconcile", canPublish: false })
            } else {
              expect(result).toMatchObject({ ok: false, status: "blocked", action: "none", canPublish: false })
            }
          }
        }
      }
    }
  })

  test("fails closed for unknown modes and remote state values", () => {
    const unknownMode = classifyState("publish" as ReleaseMode, {
      npm: "absent",
      tag: "absent",
      release: "absent",
    })
    expect(unknownMode.ok).toBe(false)
    expect(unknownMode.reason).toContain("unknown")

    const unknownState = classifyState("reconcile", {
      npm: "published",
      tag: "matching",
      release: "future-state" as MetadataRemoteState,
    })
    expect(unknownState.ok).toBe(false)
    expect(unknownState.valid).toBe(false)
    expect(unknownState.nextAction).toContain("manually")
  })

  test("formats installer guidance and rejects an unstable footer version", () => {
    const footer = formatReleaseFooter(version)
    expect(footer).toContain("https://www.npmjs.com/package/spec-finder/v/1.2.3")
    expect(footer).toContain("npm install --global spec-finder@1.2.3")
    expect(footer).toContain("spec-finder upgrade")
    expect(formatInstallerFooter(version)).toBe(footer)
    expect(() => formatReleaseFooter("1.2.3-rc.1")).toThrow("stable SemVer")
  })

  test("formats a complete text-first summary with all public evidence", () => {
    const summary = formatSummary({
      name: RELEASE_PACKAGE_NAME,
      version,
      mode: "release",
      result: "complete",
      sourceRef: RELEASE_SOURCE_REF,
      sourceSha,
      packageUrl: `https://www.npmjs.com/package/spec-finder/v/${version}`,
      tagUrl: `https://github.com/MatheusBBarni/spec-finder/releases/tag/v${version}`,
      releaseUrl: `https://github.com/MatheusBBarni/spec-finder/releases/tag/v${version}`,
      preflight: "passed",
      smoke: { ubuntu: "passed", windows: "passed" },
    })

    expect(summary).toContain("Result: complete")
    expect(summary).toContain("Package: https://www.npmjs.com/package/spec-finder/v/1.2.3")
    expect(summary).toContain("Tag: https://github.com/MatheusBBarni/spec-finder/releases/tag/v1.2.3")
    expect(summary).toContain("GitHub Release:")
    expect(summary).toContain("Smoke: Ubuntu passed; Windows passed")
    expect(summary).toContain("Next action:")
  })

  test("formats partial recovery without exposing an invalid URL or secret-like text", () => {
    const summary = formatSummary({
      version,
      mode: "reconcile",
      result: "partial",
      packageUrl: "https://www.npmjs.com/package/spec-finder/v/1.2.3?token=secret",
      tagState: "absent",
      releaseState: "absent",
      preflight: "passed",
      smoke: { ubuntu: "passed", windows: "failed" },
      nextAction: "reconcile with npm_token=secret",
    })

    expect(summary).toContain("Result: partial")
    expect(summary).toContain("Package: not available")
    expect(summary).toContain("Tag: not available")
    expect(summary).toContain("Smoke: Ubuntu passed; Windows failed")
    expect(summary).toContain("Run reconcile mode")
    expect(summary).not.toContain("secret")
  })

  test("rejects a falsely complete summary", () => {
    expect(() => formatSummary({
      version,
      mode: "release",
      result: "complete",
      preflight: "passed",
      smoke: { ubuntu: "passed", windows: "not_run" },
    })).toThrow("complete release summaries")
  })

  test("recognizes only stable versions", () => {
    expect(parseStableVersion("1.2.3")).toBe("1.2.3")
    expect(isStableVersion("1.2.3+build.7")).toBe(true)
    expect(isStableVersion("1.2.3-alpha")).toBe(false)
    expect(isStableVersion("1.2")).toBe(false)
  })
})
