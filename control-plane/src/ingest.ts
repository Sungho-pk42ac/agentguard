import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { reportPayloadSchema } from './contract.js'
import { processAlerts } from './alerts.js'
import { payloadRedactionCheck } from './redaction.js'
import type { AssetRecord } from './model.js'
import type { NotifierPort } from './notify/port.js'
import type { OidcVerifier } from './verify/oidc.js'
import type { StoragePort } from './storage/port.js'

export interface IngestDeps {
  readonly storage: StoragePort
  readonly notifier: NotifierPort
  readonly oidcVerifier: OidcVerifier
  readonly now: () => number
  readonly freshnessWindowSec?: number
  readonly channel?: string
}

export interface HandlerResponse {
  readonly status: number
  readonly json: Record<string, unknown>
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Verify the request is from the bound asset (device-token HMAC or OIDC bearer). */
function authenticate(asset: AssetRecord, headers: Record<string, string>, rawBody: string, ts: number, oidc: OidcVerifier): boolean {
  const signature = headers['x-agentguard-signature']
  if (signature !== undefined) {
    if (asset.authKind !== 'device-token' || !asset.secret) return false
    const expected = `v1=${createHmac('sha256', asset.secret).update(`${ts}.${rawBody}`).digest('hex')}`
    return timingSafeStringEqual(signature, expected)
  }
  const authorization = headers['authorization']
  if (authorization !== undefined && authorization.startsWith('Bearer ')) {
    if (asset.authKind !== 'oidc') return false
    const claims = oidc.verify(authorization.slice('Bearer '.length))
    return claims !== null && claims.subject === asset.subject && claims.provider === asset.provider
  }
  return false
}

/**
 * POST /v1/reports. Order: parse -> tenant-bind -> freshness -> authenticate
 * (401) -> schema (422) -> independent redaction (422) -> persist + alert (202).
 * Nothing is persisted unless every gate passes.
 */
export async function handleReport(rawBody: string, headers: Record<string, string>, deps: IngestDeps): Promise<HandlerResponse> {
  const windowSec = deps.freshnessWindowSec ?? 300
  const now = deps.now()

  let raw: unknown
  try {
    raw = JSON.parse(rawBody)
  } catch {
    return { status: 422, json: { error: 'invalid JSON body' } }
  }
  const record = (raw ?? {}) as Record<string, unknown>
  const orgId = record.orgId
  const headerAsset = headers['x-agentguard-asset']
  if (typeof orgId !== 'string' || typeof headerAsset !== 'string') {
    return { status: 401, json: { error: 'missing org or asset identity' } }
  }
  if (record.assetId !== headerAsset) {
    return { status: 401, json: { error: 'asset header does not match payload' } }
  }

  const asset = deps.storage.getAsset(orgId, headerAsset)
  if (!asset) return { status: 401, json: { error: 'unknown or unenrolled asset' } }

  // Freshness bounds replay to a 300s window. A replay within that window has no
  // effect: finding upsert is idempotent (keyed on fingerprint) and alerts dedup
  // on (org, fingerprint), so no new data or duplicate alert can be injected. A
  // nonce/jti cache for strict once-only semantics is a follow-up.
  const ts = Number(headers['x-agentguard-timestamp'])
  if (!Number.isFinite(ts) || Math.abs(Math.floor(now / 1000) - ts) > windowSec) {
    return { status: 401, json: { error: 'missing or stale request timestamp' } }
  }

  if (!authenticate(asset, headers, rawBody, ts, deps.oidcVerifier)) {
    return { status: 401, json: { error: 'authentication failed' } }
  }

  const parsed = reportPayloadSchema.safeParse(raw)
  if (!parsed.success) {
    return { status: 422, json: { error: 'schema validation failed' } }
  }
  const payload = parsed.data

  const redaction = payloadRedactionCheck(payload)
  if (redaction.leak) {
    // Loud reject; nothing is stored.
    return { status: 422, json: { error: 'server redaction check failed', field: redaction.field } }
  }

  for (const finding of payload.findings) {
    deps.storage.upsertFinding(orgId, headerAsset, finding, now)
  }
  deps.storage.touchAsset(orgId, headerAsset, now)
  deps.storage.recordIngest({ orgId, assetId: headerAsset, receivedAt: now, findingCount: payload.findings.length })

  const newCriticalCount = await processAlerts(orgId, headerAsset, payload.findings, {
    storage: deps.storage,
    notifier: deps.notifier,
    now: deps.now,
    channel: deps.channel,
  })

  return { status: 202, json: { accepted: true, findingCount: payload.findings.length, newCriticalCount } }
}

export interface EnrollDeps {
  readonly storage: StoragePort
  readonly oidcVerifier: OidcVerifier
  readonly now: () => number
  readonly mintToken?: () => string
}

/** POST /v1/enroll. OIDC (CI) verifies the id-token; PC exchanges a one-time code. */
export function handleEnroll(rawBody: string, deps: EnrollDeps): HandlerResponse {
  let raw: unknown
  try {
    raw = JSON.parse(rawBody)
  } catch {
    return { status: 400, json: { error: 'invalid JSON body' } }
  }
  const body = (raw ?? {}) as Record<string, unknown>
  const orgId = body.orgId
  if (typeof orgId !== 'string' || orgId.length === 0) {
    return { status: 400, json: { error: 'orgId is required' } }
  }
  const label = typeof body.assetLabel === 'string' ? body.assetLabel : 'unlabeled'
  const now = deps.now()

  // OIDC (CI) path
  if (typeof body.oidcToken === 'string' && body.oidcToken.length > 0) {
    const claims = deps.oidcVerifier.verify(body.oidcToken)
    if (!claims) return { status: 401, json: { error: 'OIDC token verification failed' } }
    // Authorization: the verified subject/provider must be pre-granted for this
    // org. Without this, any holder of a verifiable token could self-enroll into
    // a victim org and inject reports.
    if (!deps.storage.isOidcGranted(orgId, claims.provider, claims.subject)) {
      return { status: 403, json: { error: 'OIDC identity is not authorized to enroll into this org' } }
    }
    const assetId = typeof body.assetId === 'string' && body.assetId.length > 0 ? body.assetId : `ci-${claims.provider}`
    if (deps.storage.getAsset(orgId, assetId)) {
      return { status: 409, json: { error: 'asset already enrolled' } }
    }
    deps.storage.createAsset({
      orgId,
      assetId,
      label,
      kind: 'ci',
      authKind: 'oidc',
      subject: claims.subject,
      provider: claims.provider,
      lastSeenAt: null,
      createdAt: now,
    })
    return { status: 200, json: { assetId } }
  }

  // PC device-token path (one-time enrollment code)
  if (typeof body.enrollmentCode === 'string' && body.enrollmentCode.length > 0) {
    const codeHash = createHash('sha256').update(body.enrollmentCode).digest('hex')
    if (!deps.storage.consumeEnrollmentCode(orgId, codeHash, now)) {
      return { status: 401, json: { error: 'invalid or expired enrollment code' } }
    }
    const assetId = typeof body.assetId === 'string' && body.assetId.length > 0 ? body.assetId : `pc-${randomBytes(4).toString('hex')}`
    if (deps.storage.getAsset(orgId, assetId)) {
      return { status: 409, json: { error: 'asset already enrolled' } }
    }
    const deviceToken = (deps.mintToken ?? (() => randomBytes(24).toString('hex')))()
    deps.storage.createAsset({
      orgId,
      assetId,
      label,
      kind: 'pc',
      authKind: 'device-token',
      secret: deviceToken,
      lastSeenAt: null,
      createdAt: now,
    })
    return { status: 200, json: { assetId, deviceToken } }
  }

  return { status: 400, json: { error: 'provide oidcToken (CI) or enrollmentCode (PC)' } }
}
