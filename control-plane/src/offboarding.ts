// Offboarding webhook contract (M2c / plan §6.4 CR-B): HR-driven asset-sweep
// workflow. Auth is EITHER a session admin OR a signed HR webhook (per-org
// Org.webhookSecret, never client-supplied). Pure handlers in the style of
// ingest.ts/auth/routes.ts — server.ts owns HTTP wiring (headers, cookies,
// CSRF, Set-Cookie).

import { createHmac, timingSafeEqual } from 'node:crypto'
import { isLegalOffboardingTransition, type OffboardingStatus, type OffboardingTask } from './model.js'
import type { Principal } from './verify/viewer.js'
import type { StoragePort } from './storage/port.js'
import type { HandlerResponse } from './ingest.js'
import { mintId } from './auth/records.js'

export interface OffboardingDeps {
  readonly storage: StoragePort
  readonly now: () => number
  readonly mintId?: (prefix: string) => string
  readonly webhookFreshnessWindowSec?: number
}

const DEFAULT_WEBHOOK_FRESHNESS_SEC = 300

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Verify x-agentguard-webhook-timestamp + x-agentguard-webhook-signature
 * against the org's webhookSecret. Signature = 'v1=' + hex hmac-sha256(secret,
 * `${timestamp}.${rawBody}`). Freshness is +/-300s (configurable); a stale or
 * mismatched signature is always rejected, never distinguished in the
 * response (no timestamp-oracle).
 */
export function verifyOffboardingWebhookSignature(
  headers: Record<string, string>,
  rawBody: string,
  secret: string,
  nowSec: number,
  freshnessWindowSec: number = DEFAULT_WEBHOOK_FRESHNESS_SEC,
): boolean {
  const tsHeader = headers['x-agentguard-webhook-timestamp']
  const signature = headers['x-agentguard-webhook-signature']
  if (!tsHeader || !signature) return false
  const ts = Number(tsHeader)
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > freshnessWindowSec) return false
  const expected = `v1=${createHmac('sha256', secret).update(`${tsHeader}.${rawBody}`).digest('hex')}`
  return timingSafeStringEqual(signature, expected)
}

function parseJson(rawBody: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(rawBody)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return undefined
  }
}

interface ParsedOffboardingBody {
  readonly employee: { id: string; email: string; name: string }
  readonly assetIds?: string[]
  readonly effectiveAt: string
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function parseOffboardingBody(body: Record<string, unknown>): ParsedOffboardingBody | undefined {
  const employee = body.employee
  if (typeof employee !== 'object' || employee === null) return undefined
  const e = employee as Record<string, unknown>
  if (!isNonEmptyString(e.id) || !isNonEmptyString(e.email) || !isNonEmptyString(e.name)) return undefined
  if (!isNonEmptyString(body.effectiveAt)) return undefined
  let assetIds: string[] | undefined
  if (body.assetIds !== undefined) {
    if (!Array.isArray(body.assetIds) || !body.assetIds.every((a) => typeof a === 'string')) return undefined
    assetIds = body.assetIds as string[]
  }
  return { employee: { id: e.id, email: e.email, name: e.name }, assetIds, effectiveAt: body.effectiveAt }
}

/** Match org assets whose label or subject equals the employee's id or email. */
function matchAssetsForEmployee(storage: StoragePort, orgId: string, employee: { id: string; email: string }): string[] {
  const needles = new Set([employee.id, employee.email])
  return storage
    .listAssets(orgId)
    .filter((a) => needles.has(a.label) || (a.subject !== undefined && needles.has(a.subject)))
    .map((a) => a.assetId)
}

function taskJson(task: OffboardingTask): Record<string, unknown> {
  return {
    id: task.id,
    orgId: task.orgId,
    employee: task.employee,
    assetIds: task.assetIds,
    unmatched: task.unmatched,
    status: task.status,
    effectiveAt: task.effectiveAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    audit: task.audit,
  }
}

/**
 * POST /v1/workflows/offboarding. Exactly one of `principal` (session,
 * admin-role-checked by the caller before invoking with a non-null value —
 * see server.ts) or webhook signature headers authorizes the request:
 *   - principal !== null: session-admin path, orgId = principal.orgId.
 *   - principal === null: signed-webhook path, orgId comes from the body
 *     (the signature proves possession of that org's webhookSecret).
 */
export function handleCreateOffboarding(
  principal: Principal | null,
  rawBody: string,
  headers: Record<string, string>,
  deps: OffboardingDeps,
): HandlerResponse {
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }

  let orgId: string
  if (principal) {
    if (principal.role !== 'admin') return { status: 403, json: { error: 'admin role required' } }
    orgId = principal.orgId
  } else {
    const bodyOrgId = body.orgId
    if (!isNonEmptyString(bodyOrgId)) {
      return { status: 401, json: { error: 'unauthorized: session or signed webhook required' } }
    }
    const org = deps.storage.getOrg(bodyOrgId)
    if (!org) return { status: 401, json: { error: 'unauthorized: unknown org' } }
    const now = deps.now()
    if (!verifyOffboardingWebhookSignature(headers, rawBody, org.webhookSecret, Math.floor(now / 1000), deps.webhookFreshnessWindowSec)) {
      return { status: 401, json: { error: 'unauthorized: invalid or stale webhook signature' } }
    }
    orgId = bodyOrgId
  }

  const parsed = parseOffboardingBody(body)
  if (!parsed) {
    return { status: 400, json: { error: 'employee {id,email,name}, and effectiveAt are required; assetIds must be a string array if present' } }
  }

  const now = deps.now()
  let assetIds: string[]
  let unmatched: boolean
  if (parsed.assetIds !== undefined) {
    assetIds = parsed.assetIds
    unmatched = false
  } else {
    assetIds = matchAssetsForEmployee(deps.storage, orgId, parsed.employee)
    unmatched = assetIds.length === 0
  }

  const actor = principal ? principal.userId : 'webhook'
  const candidate: OffboardingTask = {
    id: (deps.mintId ?? mintId)('offb'),
    orgId,
    employee: parsed.employee,
    assetIds,
    unmatched,
    status: 'open',
    effectiveAt: parsed.effectiveAt,
    createdAt: now,
    updatedAt: now,
    audit: [{ at: now, from: '', to: 'open', actor }],
  }
  const { task, created } = deps.storage.createOffboardingTask(candidate)
  return { status: created ? 201 : 200, json: taskJson(task) }
}

/** GET /v1/workflows/offboarding (session, any role). */
export function handleListOffboarding(orgId: string, deps: OffboardingDeps): HandlerResponse {
  const tasks = deps.storage.listOffboardingTasks(orgId).map(taskJson)
  return { status: 200, json: { tasks } }
}

/** GET /v1/workflows/offboarding/:id (session, any role). */
export function handleGetOffboarding(orgId: string, id: string, deps: OffboardingDeps): HandlerResponse {
  const task = deps.storage.getOffboardingTask(orgId, id)
  if (!task) return { status: 404, json: { error: 'offboarding task not found' } }
  return { status: 200, json: taskJson(task) }
}

/**
 * POST /v1/workflows/offboarding/:id/transition {to} (session admin only —
 * role checked by the caller). open -> sweeping -> done, no skips, no
 * backwards transitions; illegal transitions are 409.
 */
export function handleTransitionOffboarding(principal: Principal, id: string, rawBody: string, deps: OffboardingDeps): HandlerResponse {
  if (principal.role !== 'admin') return { status: 403, json: { error: 'admin role required' } }
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  const to = body.to
  if (to !== 'open' && to !== 'sweeping' && to !== 'done') {
    return { status: 400, json: { error: "to must be one of 'open', 'sweeping', 'done'" } }
  }
  const result = deps.storage.transitionOffboardingTask(principal.orgId, id, to as OffboardingStatus, principal.userId, deps.now())
  if (!result.ok) {
    if (result.reason === 'not_found') return { status: 404, json: { error: 'offboarding task not found' } }
    return { status: 409, json: { error: `illegal transition to '${to}'` } }
  }
  return { status: 200, json: taskJson(result.task) }
}

// Re-export for callers that only need the pure state-machine check without
// importing model.ts directly.
export { isLegalOffboardingTransition }
