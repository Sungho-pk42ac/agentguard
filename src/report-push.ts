import { createHmac } from 'node:crypto'
import { homedir, userInfo } from 'node:os'
import {
  buildFingerprint,
  reportPayloadSchema,
  SCHEMA_VERSION,
  stripUserPath,
  type ReportActor,
  type ReportFinding,
  type ReportPayload,
} from './contract/report-payload.js'
import { SECRET_PATTERNS, type Finding } from './rules.js'
import { readVersion } from './version.js'

// Report agent: turns local scan findings into a REDACTED, signed wire payload
// and pushes it to the control plane. The redaction guard runs before any
// network call so a raw secret can never leave the machine.

export class RedactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RedactionError'
  }
}

export class ReportPushError extends Error {
  readonly status?: number
  readonly body?: string
  constructor(message: string, status?: number, body?: string) {
    super(message)
    this.name = 'ReportPushError'
    this.status = status
    this.body = body
  }
}

export type CredentialKind = 'device-token' | 'oidc'

export interface PushIdentity {
  readonly orgId: string
  readonly assetId: string
  readonly actor: ReportActor
  readonly credential:
    | { readonly kind: 'device-token'; readonly secret: string }
    | { readonly kind: 'oidc'; readonly token: string }
}

function safeUsername(): string {
  try {
    return userInfo().username
  } catch {
    return ''
  }
}

function findingLocation(finding: Finding, home: string, username: string): string {
  const base = finding.file
    ? finding.line !== undefined
      ? `${finding.file}:${finding.line}`
      : finding.file
    : 'stdin'
  return stripUserPath(base, home, username)
}

/** Map an internal Finding onto the redacted wire finding. */
export function mapFinding(finding: Finding, opts: { home: string; username: string }): ReportFinding {
  const location = findingLocation(finding, opts.home, opts.username)
  const evidenceRedacted = finding.evidence
  return {
    ruleId: finding.id,
    surface: finding.category,
    severity: finding.severity,
    location,
    evidenceRedacted,
    fingerprint: buildFingerprint({ ruleId: finding.id, location, evidenceRedacted }),
    ...(finding.advisory ? { advisory: true as const } : {}),
  }
}

export interface BuildPayloadMeta {
  readonly orgId: string
  readonly assetId: string
  readonly actor: ReportActor
  readonly scannedAt?: string
  readonly home?: string
  readonly username?: string
  readonly baseline?: { readonly appeared: number; readonly disappeared: number; readonly rotated: number }
}

/**
 * Client-side redaction guard: fail CLOSED if any serialized payload field
 * matches a known secret pattern. Runs the SAME detector patterns the scanner
 * uses; the server runs a separate independent heuristic (defense in depth).
 */
export function assertRedacted(payload: ReportPayload): void {
  const serialized = JSON.stringify(payload)
  for (const pattern of SECRET_PATTERNS) {
    const re = new RegExp(pattern.re.source, pattern.re.flags.replace('g', ''))
    if (re.test(serialized)) {
      throw new RedactionError(
        `redaction guard tripped: payload contains a value matching rule "${pattern.id}"; refusing to transmit`,
      )
    }
  }
}

/** Build and validate a report payload. Throws RedactionError before any network use. */
export function buildReportPayload(findings: readonly Finding[], meta: BuildPayloadMeta): ReportPayload {
  const home = meta.home ?? homedir()
  const username = meta.username ?? safeUsername()
  const payload = reportPayloadSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    orgId: meta.orgId,
    assetId: meta.assetId,
    actor: meta.actor,
    scannedAt: meta.scannedAt ?? new Date().toISOString(),
    agentVersion: readVersion(),
    findings: findings.map((finding) => mapFinding(finding, { home, username })),
    ...(meta.baseline ? { baseline: meta.baseline } : {}),
  })
  assertRedacted(payload)
  return payload
}

/** Canonical device-token signature over the exact request-body bytes. */
export function signBody(body: string, timestamp: number, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export interface FetchResponse {
  readonly status: number
  text(): Promise<string>
}
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<FetchResponse>

export interface PushResult {
  readonly status: number
  readonly body: string
}

export interface PushOptions {
  readonly fetchImpl?: FetchLike
  readonly now?: number
}

/**
 * [R3/NEW-CR-1] Capability negotiation for the advisory-finding wire skew.
 * A payload with no advisory findings always sends schemaVersion 1 (no probe
 * needed). A payload carrying >=1 advisory finding probes GET /v1/meta
 * (cached for this single push call): if the server advertises schemaVersion
 * 2, the advisory findings ride at schemaVersion 2; otherwise (server only
 * advertises [1], or /v1/meta is missing/errors) the agent falls back to
 * omitting the advisory findings and sending schemaVersion 1.
 */
async function negotiateSchemaVersion(endpoint: string, payload: ReportPayload, fetchImpl: FetchLike): Promise<ReportPayload> {
  const hasAdvisory = payload.findings.some((f) => f.advisory === true)
  if (!hasAdvisory) return payload
  const serverVersions = await fetchSchemaVersions(endpoint, fetchImpl)
  if (serverVersions?.includes(2)) {
    return { ...payload, schemaVersion: 2 }
  }
  return { ...payload, schemaVersion: 1, findings: payload.findings.filter((f) => f.advisory !== true) }
}

async function fetchSchemaVersions(endpoint: string, fetchImpl: FetchLike): Promise<number[] | undefined> {
  try {
    const response = await fetchImpl(`${endpoint}/v1/meta`, { method: 'GET', headers: {} })
    if (response.status !== 200) return undefined
    const parsed: unknown = JSON.parse(await response.text())
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { schemaVersions?: unknown }).schemaVersions)) {
      return (parsed as { schemaVersions: unknown[] }).schemaVersions.filter((v): v is number => typeof v === 'number')
    }
    return undefined
  } catch {
    return undefined
  }
}

/** Sign and POST a report payload to `<endpoint>/v1/reports`. */
export async function pushReport(
  endpoint: string,
  payload: ReportPayload,
  identity: PushIdentity,
  options: PushOptions = {},
): Promise<PushResult> {
  // Guard again immediately before egress (belt and braces).
  assertRedacted(payload)
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
  if (typeof fetchImpl !== 'function') {
    throw new ReportPushError('no fetch implementation available (Node >=20 required)')
  }
  const normalizedEndpoint = endpoint.replace(/\/+$/, '')
  const negotiated = await negotiateSchemaVersion(normalizedEndpoint, payload, fetchImpl)
  const body = JSON.stringify(negotiated)
  const timestamp = Math.floor((options.now ?? Date.now()) / 1000)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-agentguard-timestamp': String(timestamp),
    'x-agentguard-asset': identity.assetId,
  }
  if (identity.credential.kind === 'device-token') {
    headers['x-agentguard-signature'] = `v1=${signBody(body, timestamp, identity.credential.secret)}`
  } else {
    headers['authorization'] = `Bearer ${identity.credential.token}`
  }
  const url = `${normalizedEndpoint}/v1/reports`
  let response: FetchResponse
  try {
    response = await fetchImpl(url, { method: 'POST', headers, body })
  } catch (error) {
    throw new ReportPushError(`could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const text = await response.text()
  if (response.status !== 202) {
    throw new ReportPushError(`ingest rejected the report (HTTP ${response.status})`, response.status, text)
  }
  return { status: response.status, body: text }
}
