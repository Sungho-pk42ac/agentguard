import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_POLICY, fetchOrgPolicy, mergeOrgPolicy, type FetchLike, type FetchResponse, type LocalPolicyInput, type OrgPolicy } from '../src/policy-sync.js'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): FetchResponse {
  return {
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => JSON.stringify(body),
  }
}

function emptyLocal(overrides: Partial<LocalPolicyInput> = {}): LocalPolicyInput {
  return { denyRead: [], denyCommands: [], requireApproval: [], mcp: { denyServers: [], denyTools: [], requireApprovalTools: [] }, ...overrides }
}

test('fetchOrgPolicy: 200 response parses into an OrgPolicy with a normalized ETag', async () => {
  const fetchImpl: FetchLike = async () =>
    jsonResponse(200, { rulesVersion: 3, exceptionsVersion: 1, rules: 'denyRead:\n  - "**/.env"\n', exceptions: [] }, { etag: '"abc123"' })
  const result = await fetchOrgPolicy('https://cp.example', 'tok', { fetchImpl })
  assert.equal(result.status, 'updated')
  assert.equal(result.policy?.rulesVersion, 3)
  assert.equal(result.policy?.etag, 'abc123')
  assert.deepEqual(result.advisoryFindings, [])
})

test('fetchOrgPolicy: 304 returns status "fresh" and passes through the last-known policy unchanged', async () => {
  const lastKnown: OrgPolicy = { rulesVersion: 2, exceptionsVersion: 0, rules: 'denyRead: []', exceptions: [], etag: 'stable' }
  const fetchImpl: FetchLike = async () => jsonResponse(304, {})
  const result = await fetchOrgPolicy('https://cp.example', 'tok', { etag: 'stable', lastKnown, fetchImpl })
  assert.equal(result.status, 'fresh')
  assert.deepEqual(result.policy, lastKnown)
  assert.deepEqual(result.advisoryFindings, [])
})

test('fetchOrgPolicy: sends If-None-Match when an etag is supplied', async () => {
  let seenHeader: string | undefined
  const fetchImpl: FetchLike = async (_url, init) => {
    seenHeader = init.headers['if-none-match']
    return jsonResponse(304, {})
  }
  await fetchOrgPolicy('https://cp.example', 'tok', { etag: 'deadbeef', fetchImpl })
  assert.equal(seenHeader, '"deadbeef"')
})

test('fetchOrgPolicy: fail-closed on network failure — falls back to last-known policy plus a policy-sync-unavailable advisory', async () => {
  const lastKnown: OrgPolicy = { rulesVersion: 5, exceptionsVersion: 2, rules: 'denyRead:\n  - "**/.env"\n', exceptions: [], etag: 'e5' }
  const fetchImpl: FetchLike = async () => {
    throw new Error('ECONNREFUSED')
  }
  const result = await fetchOrgPolicy('https://cp.example', 'tok', { lastKnown, fetchImpl })
  assert.equal(result.status, 'unavailable')
  assert.deepEqual(result.policy, lastKnown)
  assert.equal(result.advisoryFindings.length, 1)
  assert.equal(result.advisoryFindings[0]!.ruleId, 'policy-sync-unavailable')
  assert.equal(result.advisoryFindings[0]!.severity, 'low')
  assert.equal(result.advisoryFindings[0]!.advisory, true)
})

test('fetchOrgPolicy: fail-closed with no last-known policy — unavailable, no policy, still advisory', async () => {
  const fetchImpl: FetchLike = async () => {
    throw new Error('timeout')
  }
  const result = await fetchOrgPolicy('https://cp.example', 'tok', { fetchImpl })
  assert.equal(result.status, 'unavailable')
  assert.equal(result.policy, undefined)
  assert.equal(result.advisoryFindings[0]!.ruleId, 'policy-sync-unavailable')
})

test('fetchOrgPolicy: a non-200/304 status also degrades fail-closed', async () => {
  const lastKnown: OrgPolicy = { rulesVersion: 1, exceptionsVersion: 0, rules: '', exceptions: [], etag: 'x' }
  const fetchImpl: FetchLike = async () => jsonResponse(500, { error: 'boom' })
  const result = await fetchOrgPolicy('https://cp.example', 'tok', { lastKnown, fetchImpl })
  assert.equal(result.status, 'unavailable')
  assert.deepEqual(result.policy, lastKnown)
})

test('mergeOrgPolicy: with no org policy, the merge is local-only (no advisory)', () => {
  const local = emptyLocal({ denyRead: ['**/local-secret'] })
  const { policy, advisoryFindings } = mergeOrgPolicy(undefined, local)
  assert.deepEqual(policy.denyRead, ['**/local-secret'])
  assert.deepEqual(advisoryFindings, [])
})

test('mergeOrgPolicy: stricter local additions merge in alongside the org denials', () => {
  const org: OrgPolicy = {
    rulesVersion: 1,
    exceptionsVersion: 0,
    rules: 'denyRead:\n  - "**/.env"\nmcp:\n  denyServers:\n    - filesystem\n  denyTools:\n    - shell.exec\n',
    exceptions: [],
    etag: 'e1',
  }
  const local = emptyLocal({
    denyRead: ['**/.env', '**/extra-secret'],
    mcp: { denyServers: ['filesystem', 'extra-server'], denyTools: ['shell.exec', 'extra-tool'], requireApprovalTools: [] },
  })
  const { policy, advisoryFindings } = mergeOrgPolicy(org, local)
  assert.deepEqual(new Set(policy.denyRead), new Set(['**/.env', '**/extra-secret']))
  assert.deepEqual(new Set(policy.mcp.denyServers), new Set(['filesystem', 'extra-server']))
  assert.deepEqual(new Set(policy.mcp.denyTools), new Set(['shell.exec', 'extra-tool']))
  assert.deepEqual(advisoryFindings, [], 'pure additions never trigger a weakening advisory')
})

test('mergeOrgPolicy: a local policy that drops an org denial has it reinstated plus a policy-weakening-ignored advisory (redacted evidence)', () => {
  const org: OrgPolicy = {
    rulesVersion: 1,
    exceptionsVersion: 0,
    rules: 'denyRead:\n  - "**/.env"\n  - "**/id_rsa"\nmcp:\n  denyServers:\n    - filesystem\n',
    exceptions: [],
    etag: 'e1',
  }
  // Local policy silently omits "**/id_rsa" and "filesystem" — an attempted weakening.
  const local = emptyLocal({ denyRead: ['**/.env'], mcp: { denyServers: [], denyTools: [], requireApprovalTools: [] } })
  const { policy, advisoryFindings } = mergeOrgPolicy(org, local)

  assert.ok(policy.denyRead.includes('**/id_rsa'), 'the dropped org denial is reinstated (fail-closed)')
  assert.ok(policy.mcp.denyServers.includes('filesystem'), 'the dropped org mcp denial is reinstated')

  const ruleIds = advisoryFindings.map((f) => f.ruleId)
  assert.ok(ruleIds.includes('policy-weakening-ignored'))
  for (const finding of advisoryFindings) {
    assert.equal(finding.advisory, true)
    assert.equal(finding.severity, 'low')
    // evidence must be a redacted field name, never the raw denied path/server value.
    assert.notEqual(finding.evidence, '**/id_rsa')
    assert.notEqual(finding.evidence, 'filesystem')
    assert.ok(['denyRead', 'mcp.denyServers'].includes(finding.evidence))
  }
})

test('mergeOrgPolicy: an org denial legitimately omitted via an APPROVED referenced exception is not flagged and stays omitted', () => {
  const org: OrgPolicy = {
    rulesVersion: 1,
    exceptionsVersion: 1,
    rules: 'denyRead:\n  - "**/.env"\n  - "**/id_rsa"\n',
    exceptions: [{ id: 'exc_1', ruleId: '**/id_rsa', reason: 'rotated key, tracked elsewhere', status: 'approved', createdAt: 0 }],
    etag: 'e1',
  }
  const local = emptyLocal({ denyRead: ['**/.env'], exceptionIds: ['exc_1'] })
  const { policy, advisoryFindings } = mergeOrgPolicy(org, local)
  assert.ok(!policy.denyRead.includes('**/id_rsa'), 'an approved+referenced exception legitimately relaxes the org denial')
  assert.deepEqual(advisoryFindings, [])
})

test('mergeOrgPolicy: a PENDING (not approved) or unreferenced exception does not excuse an omission — still flagged and reinstated', () => {
  const org: OrgPolicy = {
    rulesVersion: 1,
    exceptionsVersion: 0,
    rules: 'denyRead:\n  - "**/.env"\n  - "**/id_rsa"\n',
    exceptions: [{ id: 'exc_1', ruleId: '**/id_rsa', reason: 'pending review', status: 'pending', createdAt: 0 }],
    etag: 'e1',
  }
  // References the pending exception id, but it is not approved — must not excuse the omission.
  const localPending = emptyLocal({ denyRead: ['**/.env'], exceptionIds: ['exc_1'] })
  const pendingResult = mergeOrgPolicy(org, localPending)
  assert.ok(pendingResult.policy.denyRead.includes('**/id_rsa'))
  assert.ok(pendingResult.advisoryFindings.some((f) => f.ruleId === 'policy-weakening-ignored'))

  // Approved, but not referenced by the local policy — must not excuse the omission either.
  const approvedOrg: OrgPolicy = { ...org, exceptions: [{ ...org.exceptions[0]!, status: 'approved' }] }
  const localUnreferenced = emptyLocal({ denyRead: ['**/.env'] })
  const unreferencedResult = mergeOrgPolicy(approvedOrg, localUnreferenced)
  assert.ok(unreferencedResult.policy.denyRead.includes('**/id_rsa'))
  assert.ok(unreferencedResult.advisoryFindings.some((f) => f.ruleId === 'policy-weakening-ignored'))
})

test('mergeOrgPolicy: DEFAULT_POLICY is re-exported for building a local candidate policy', () => {
  assert.ok(Array.isArray(DEFAULT_POLICY.denyRead))
})
