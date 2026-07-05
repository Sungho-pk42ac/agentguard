// Policy sync (M2b, §6.3 [CR-A]): per-org rules doc + exceptions.
// Pure handlers in the style of auth/routes.ts / offboarding.ts — server.ts
// owns HTTP wiring (ETag/If-None-Match comparison, CSRF, status codes).

import { createHash, randomBytes } from 'node:crypto'
import type { PolicyExceptionRecord } from './model.js'
import type { Principal } from './verify/viewer.js'
import type { StoragePort } from './storage/port.js'

export interface PolicyDeps {
  readonly storage: StoragePort
  readonly now: () => number
  readonly mintId?: (prefix: string) => string
}

export interface PolicyHandlerResponse {
  readonly status: number
  readonly json: Record<string, unknown>
}

// Opaque rules text (yaml or json, agent-interpreted) — bounded to keep the
// storage row and the wire payload sane; not otherwise validated server-side.
const MAX_RULES_BYTES = 256 * 1024

function defaultMintId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function parseJson(rawBody: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(rawBody)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return undefined
  }
}

function exceptionBody(e: PolicyExceptionRecord): Record<string, unknown> {
  return { id: e.id, ruleId: e.ruleId, reason: e.reason, status: e.status, createdAt: e.createdAt, resolvedAt: e.resolvedAt ?? null }
}

export interface PolicyView {
  readonly rulesVersion: number
  readonly exceptionsVersion: number
  readonly rules: string
  readonly exceptions: PolicyExceptionRecord[]
  readonly etag: string
}

/**
 * Build the org's policy view: current rules + approved-only exceptions, plus
 * the stable ETag (sha256 over {rulesVersion, exceptionsVersion, sha256(rules)}).
 * Busts whenever rulesVersion OR exceptionsVersion changes — i.e. on rules PUT
 * or exception approve/reject (creating a PENDING exception does not bust it,
 * since pending exceptions never appear in the view).
 */
export function buildPolicyView(orgId: string, storage: StoragePort): PolicyView {
  const policy = storage.getPolicy(orgId)
  const rulesVersion = policy?.rulesVersion ?? 0
  const exceptionsVersion = policy?.exceptionsVersion ?? 0
  const rules = policy?.rules ?? ''
  const exceptions = storage.listExceptions(orgId).filter((e) => e.status === 'approved')
  const etag = sha256(JSON.stringify({ rulesVersion, exceptionsVersion, rulesSha: sha256(rules) }))
  return { rulesVersion, exceptionsVersion, rules, exceptions, etag }
}

export function policyViewBody(view: PolicyView): Record<string, unknown> {
  return {
    rulesVersion: view.rulesVersion,
    exceptionsVersion: view.exceptionsVersion,
    rules: view.rules,
    exceptions: view.exceptions.map(exceptionBody),
  }
}

/** PUT /v1/policy (admin only) {rules} -> 200 {rulesVersion,exceptionsVersion} | 400 | 403. */
export function handlePutPolicy(principal: Principal, rawBody: string, deps: PolicyDeps): PolicyHandlerResponse {
  if (principal.role !== 'admin') return { status: 403, json: { error: 'admin role required' } }
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  const rules = body.rules
  if (typeof rules !== 'string' || rules.length === 0 || Buffer.byteLength(rules, 'utf8') > MAX_RULES_BYTES) {
    return { status: 400, json: { error: `rules must be a non-empty string up to ${MAX_RULES_BYTES} bytes` } }
  }
  const record = deps.storage.putPolicyRules(principal.orgId, rules)
  return { status: 200, json: { rulesVersion: record.rulesVersion, exceptionsVersion: record.exceptionsVersion } }
}

/** POST /v1/policy/exceptions (any member) {ruleId,reason} -> 200 {id,ruleId,reason,status,createdAt} | 400. */
export function handleCreateException(principal: Principal, rawBody: string, deps: PolicyDeps): PolicyHandlerResponse {
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  const ruleId = body.ruleId
  const reason = body.reason
  if (typeof ruleId !== 'string' || ruleId.trim().length === 0 || typeof reason !== 'string' || reason.trim().length === 0) {
    return { status: 400, json: { error: 'ruleId and reason are required' } }
  }
  const record: PolicyExceptionRecord = {
    id: (deps.mintId ?? defaultMintId)('exc'),
    orgId: principal.orgId,
    ruleId,
    reason,
    status: 'pending',
    createdAt: deps.now(),
  }
  deps.storage.createException(record)
  return { status: 200, json: exceptionBody(record) }
}

/**
 * POST /v1/policy/exceptions/:id/approve|reject (admin only) -> 200 {id,status,resolvedAt} | 403 | 404.
 * Bumps the org's exceptionsVersion (busts the policy ETag) on success.
 */
export function handleResolveException(
  principal: Principal,
  id: string,
  action: 'approve' | 'reject',
  deps: PolicyDeps,
): PolicyHandlerResponse {
  if (principal.role !== 'admin') return { status: 403, json: { error: 'admin role required' } }
  const status = action === 'approve' ? ('approved' as const) : ('rejected' as const)
  const updated = deps.storage.resolveException(principal.orgId, id, status, deps.now())
  if (!updated) return { status: 404, json: { error: 'unknown or already-resolved exception id' } }
  return { status: 200, json: { id: updated.id, status: updated.status, resolvedAt: updated.resolvedAt } }
}
