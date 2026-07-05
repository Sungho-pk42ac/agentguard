// Org policy sync (story G003, plan §6.3 [CR-A]): pull the org's authoritative
// policy from the control plane (GET /v1/policy, ETag-cached) and merge it
// with the local `.agentguard.yml`-derived policy. Pure functions + an
// injectable fetch — no CLI wiring here (that lands in a later story); a
// future CLI verb calls fetchOrgPolicy() then mergeOrgPolicy() and feeds the
// result into the scanner's Policy.
//
// Fail-closed contract: the org policy is ALWAYS authoritative. The local
// policy may only ADD stricter denials (extra denied paths/mcp servers/mcp
// tools) or reference an APPROVED org exception to justify omitting one of
// the org's denials. Any other omission — an org denial the local policy
// dropped without a matching approved exception reference — is a WEAKENING
// ATTEMPT: it is ignored (the org denial is reinstated) and surfaced as a
// low-severity advisory finding. A fetch failure never removes protection:
// it falls back to the last-known org policy, or to local-only enforcement
// if there is no last-known policy, always with an advisory finding so the
// operator knows sync is degraded.

import { parse as parseYaml } from 'yaml'
import { DEFAULT_POLICY, type Policy } from './rules.js'

export interface FetchResponse {
  readonly status: number
  readonly headers: { get(name: string): string | null }
  text(): Promise<string>
}
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string> }) => Promise<FetchResponse>

export interface OrgPolicyException {
  readonly id: string
  readonly ruleId: string
  readonly reason: string
  readonly status: string
  readonly createdAt: number
  readonly resolvedAt?: number | null
}

export interface OrgPolicy {
  readonly rulesVersion: number
  readonly exceptionsVersion: number
  /** Opaque yaml/json rules text, same shape as a local .agentguard.yml policy file. */
  readonly rules: string
  readonly exceptions: readonly OrgPolicyException[]
  /** Unquoted ETag value (sha256 hex), if the response carried one. */
  readonly etag: string | null
}

export type AdvisorySeverity = 'low'

export interface AdvisoryFinding {
  readonly ruleId: string
  readonly severity: AdvisorySeverity
  readonly advisory: true
  /** Redacted context — a field/key name, never raw path/server/tool values. */
  readonly evidence: string
}

export type FetchOrgPolicyStatus = 'fresh' | 'updated' | 'unavailable'

export interface FetchOrgPolicyResult {
  readonly status: FetchOrgPolicyStatus
  /** Present on 'fresh' (last-known, unchanged) and 'updated' (freshly fetched); may be present on 'unavailable' (last-known fallback). */
  readonly policy?: OrgPolicy
  readonly advisoryFindings: readonly AdvisoryFinding[]
}

export interface FetchOrgPolicyOptions {
  readonly etag?: string
  /** The caller's last-known org policy, used as the fail-closed fallback on 304/failure. */
  readonly lastKnown?: OrgPolicy
  readonly fetchImpl?: FetchLike
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unavailable(lastKnown: OrgPolicy | undefined, evidence: string): FetchOrgPolicyResult {
  return {
    status: 'unavailable',
    policy: lastKnown,
    advisoryFindings: [{ ruleId: 'policy-sync-unavailable', severity: 'low', advisory: true, evidence }],
  }
}

/**
 * GET {endpoint}/v1/policy with an authenticated credential and (optionally)
 * an If-None-Match ETag. Never throws: any transport failure, non-200/304
 * response, or malformed body degrades to `status: 'unavailable'` with the
 * last-known policy (if given) and a `policy-sync-unavailable` advisory —
 * sync failure never widens what is enforced.
 */
export async function fetchOrgPolicy(endpoint: string, credential: string, options: FetchOrgPolicyOptions = {}): Promise<FetchOrgPolicyResult> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
  if (typeof fetchImpl !== 'function') {
    return unavailable(options.lastKnown, 'no fetch implementation available (Node >=20 required)')
  }
  const url = `${endpoint.replace(/\/+$/, '')}/v1/policy`
  const headers: Record<string, string> = { authorization: `Bearer ${credential}` }
  if (options.etag) headers['if-none-match'] = `"${options.etag}"`

  let response: FetchResponse
  try {
    response = await fetchImpl(url, { method: 'GET', headers })
  } catch (error) {
    return unavailable(options.lastKnown, `could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (response.status === 304) {
    return { status: 'fresh', policy: options.lastKnown, advisoryFindings: [] }
  }
  if (response.status !== 200) {
    return unavailable(options.lastKnown, `policy fetch rejected (HTTP ${response.status})`)
  }

  const text = await response.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return unavailable(options.lastKnown, 'policy response was not valid JSON')
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.rulesVersion !== 'number' ||
    typeof parsed.exceptionsVersion !== 'number' ||
    typeof parsed.rules !== 'string'
  ) {
    return unavailable(options.lastKnown, 'policy response missing rulesVersion/exceptionsVersion/rules')
  }
  const exceptions = Array.isArray(parsed.exceptions) ? (parsed.exceptions as OrgPolicyException[]) : []
  const etagHeader = response.headers.get('etag')
  const etag = etagHeader ? etagHeader.replace(/^W\//, '').replace(/^"|"$/g, '') : null

  return {
    status: 'updated',
    policy: { rulesVersion: parsed.rulesVersion, exceptionsVersion: parsed.exceptionsVersion, rules: parsed.rules, exceptions, etag },
    advisoryFindings: [],
  }
}

/** Parse an org/local rules text blob into a Policy. Malformed or empty text yields empty (no-op) lists — never throws. */
function parseRulesText(rulesText: string): Policy {
  if (!rulesText || rulesText.trim().length === 0) {
    return { denyRead: [], denyCommands: [], requireApproval: [], mcp: { denyServers: [], denyTools: [], requireApprovalTools: [] } }
  }
  let parsed: unknown
  try {
    parsed = parseYaml(rulesText)
  } catch {
    return { denyRead: [], denyCommands: [], requireApproval: [], mcp: { denyServers: [], denyTools: [], requireApprovalTools: [] } }
  }
  const root = isRecord(parsed) ? parsed : {}
  const mcpRoot = isRecord(root.mcp) ? root.mcp : {}
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return {
    denyRead: arr(root.denyRead),
    denyCommands: arr(root.denyCommands),
    requireApproval: arr(root.requireApproval),
    mcp: {
      denyServers: arr(mcpRoot.denyServers),
      denyTools: arr(mcpRoot.denyTools),
      requireApprovalTools: arr(mcpRoot.requireApprovalTools),
    },
  }
}

export interface LocalPolicyInput extends Policy {
  /** Org exception ids this machine's local policy invokes to justify an omitted org denial. */
  readonly exceptionIds?: readonly string[]
}

export interface MergeOrgPolicyResult {
  readonly policy: Policy
  readonly advisoryFindings: readonly AdvisoryFinding[]
}

/**
 * Merge the org's authoritative rules with a local candidate policy.
 *
 * For each org-denied entry (denyRead / mcp.denyServers / mcp.denyTools):
 *  - present in the local candidate too -> kept (no-op).
 *  - absent from the local candidate AND the local policy references an
 *    APPROVED org exception whose ruleId equals the entry -> legitimately
 *    omitted (the exception grants it).
 *  - absent otherwise -> WEAKENING ATTEMPT: ignored (the org denial is
 *    reinstated) and reported as a `policy-weakening-ignored` advisory whose
 *    evidence is the REDACTED field name, never the raw denied value.
 * Local-only additions (entries the org policy never mentioned) always merge
 * in — the local policy may only get stricter.
 */
export function mergeOrgPolicy(orgPolicy: OrgPolicy | undefined, localPolicy: LocalPolicyInput): MergeOrgPolicyResult {
  const advisoryFindings: AdvisoryFinding[] = []
  if (!orgPolicy) {
    // No org policy at all (never synced, or fail-closed with no last-known):
    // nothing to weaken against yet — enforce local-only.
    return {
      policy: {
        denyRead: [...localPolicy.denyRead],
        denyCommands: [...localPolicy.denyCommands],
        requireApproval: [...localPolicy.requireApproval],
        mcp: { ...localPolicy.mcp, denyServers: [...localPolicy.mcp.denyServers], denyTools: [...localPolicy.mcp.denyTools] },
      },
      advisoryFindings,
    }
  }

  const org = parseRulesText(orgPolicy.rules)
  const approvedRuleIds = new Set(
    orgPolicy.exceptions
      .filter((e) => e.status === 'approved' && (localPolicy.exceptionIds ?? []).includes(e.id))
      .map((e) => e.ruleId),
  )

  const mergeDenyList = (fieldName: string, orgList: readonly string[], localList: readonly string[]): string[] => {
    const result = new Set(localList)
    for (const item of orgList) {
      if (result.has(item)) continue
      if (approvedRuleIds.has(item)) continue // legitimately excepted; stays omitted
      advisoryFindings.push({ ruleId: 'policy-weakening-ignored', severity: 'low', advisory: true, evidence: fieldName })
      result.add(item) // fail-closed: reinstate the org denial
    }
    return [...result]
  }

  return {
    policy: {
      denyRead: mergeDenyList('denyRead', org.denyRead, localPolicy.denyRead),
      denyCommands: [...new Set([...org.denyCommands, ...localPolicy.denyCommands])],
      requireApproval: [...new Set([...org.requireApproval, ...localPolicy.requireApproval])],
      mcp: {
        denyServers: mergeDenyList('mcp.denyServers', org.mcp.denyServers, localPolicy.mcp.denyServers),
        denyTools: mergeDenyList('mcp.denyTools', org.mcp.denyTools, localPolicy.mcp.denyTools),
        requireApprovalTools: [...new Set([...org.mcp.requireApprovalTools, ...localPolicy.mcp.requireApprovalTools])],
      },
    },
    advisoryFindings,
  }
}

/** Convenience: DEFAULT_POLICY re-exported so callers can build a LocalPolicyInput without a separate rules.js import. */
export { DEFAULT_POLICY }
