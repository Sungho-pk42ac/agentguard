import { createHash } from 'node:crypto'
import { z } from 'zod'

// Canonical wire contract shared by the report agent (client) and the control
// plane (server). This is the SINGLE source of truth for the report payload so
// the redaction/egress shape can never drift between the two sides
// (control-plane/src/contract.ts re-exports this exact module).
//
// PRIVACY INVARIANT: a payload only ever carries ALREADY-redacted evidence,
// rule IDs, surface, severity, a home/username-stripped location, and a
// fingerprint hash. Raw secret values and file bodies NEVER appear here.

export const SCHEMA_VERSION = 1 as const

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type Severity = (typeof SEVERITIES)[number]

export const findingSchema = z.strictObject({
  // Detector rule ID, e.g. 'openai-key', 'mcp.broad_filesystem_access'.
  ruleId: z.string().min(1).max(128),
  // Surface family, e.g. 'secret' | 'mcp-risk' | 'agent-config' | 'shell-rc'.
  surface: z.string().min(1).max(64),
  severity: z.enum(SEVERITIES),
  // Home/username-stripped location (see stripUserPath). e.g. '~/.zshrc:42'.
  location: z.string().min(1).max(1024),
  // Already-redacted evidence, e.g. 'sk-p...0000'. Never a raw secret.
  evidenceRedacted: z.string().max(512),
  // 128-bit hex fingerprint (see buildFingerprint). Always present.
  fingerprint: z.string().regex(/^[0-9a-f]{32}$/),
})
export type ReportFinding = z.infer<typeof findingSchema>

export const actorSchema = z.strictObject({
  type: z.enum(['device-token', 'oidc']),
  subject: z.string().min(1).max(256),
  provider: z.enum(['github', 'gitlab']).nullish(),
})
export type ReportActor = z.infer<typeof actorSchema>

export const baselineSummarySchema = z.strictObject({
  appeared: z.number().int().nonnegative(),
  disappeared: z.number().int().nonnegative(),
  rotated: z.number().int().nonnegative(),
})

export const reportPayloadSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  orgId: z.string().min(1).max(128),
  assetId: z.string().min(1).max(128),
  actor: actorSchema,
  // ISO-8601 scan timestamp (not the freshness/replay field; that is the
  // signing timestamp header on the ingest request).
  scannedAt: z.string().min(1).max(64),
  agentVersion: z.string().min(1).max(64),
  findings: z.array(findingSchema).max(10_000),
  baseline: baselineSummarySchema.optional(),
})
export type ReportPayload = z.infer<typeof reportPayloadSchema>

/**
 * Always-present, higher-entropy finding fingerprint.
 *
 * Derived from ruleId + location + ALREADY-redacted evidence — never from a raw
 * secret (the agent only ever holds redacted evidence). 128 bits of sha256 so
 * distinct findings do not collide in the (orgId, assetId, fingerprint) dedup
 * key or the (orgId, fingerprint) alert-dedup key.
 */
export function buildFingerprint(input: { ruleId: string; location: string; evidenceRedacted: string }): string {
  return createHash('sha256')
    .update(`${input.ruleId}\n${input.location}\n${input.evidenceRedacted}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Remove home-directory and username segments from a location before egress.
 *
 * `C:\\Users\\dana\\.zshrc` / `/home/dana/.zshrc` -> `~/.zshrc`. Relative paths
 * (already safe) pass through unchanged. Forward-slash normalized.
 */
export function stripUserPath(location: string, home?: string, username?: string): string {
  let out = location.replace(/\\/g, '/')

  const h = (home ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
  if (h.length > 0 && out.toLowerCase().startsWith(h.toLowerCase())) {
    out = `~${out.slice(h.length)}`
  }

  // Collapse an absolute users/home root anywhere it still appears, e.g.
  // 'C:/Users/dana/x' or '/home/dana/x' -> '~/x'. Handles other-user paths too.
  out = out.replace(/(?:[A-Za-z]:)?\/?(?:Users|home)\/[^/]+(\/|$)/i, '~$1')

  if (username && username.length > 0) {
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(^|/)${escaped}(/|$)`, 'gi'), '$1~$2')
  }

  return out
}
