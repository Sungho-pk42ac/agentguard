import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReportPayload, pushReport, type FetchLike, type PushIdentity } from '../src/report-push.js'
import type { Finding } from '../src/rules.js'

// [R3/NEW-CR-1] Client-side half of the wire cross-version compatibility
// contract: the agent negotiates via GET /v1/meta before deciding whether to
// send advisory findings at schemaVersion 2, or fall back to omitting them at
// schemaVersion 1. §6.1 pins these as the "new agent" skew scenarios (c)/(d);
// the server-side (a)/(b) scenarios live in control-plane/test/wire-skew.test.ts.

const HOME = '/home/dana'
const USER = 'dana'

const deviceIdentity: PushIdentity = {
  orgId: 'org_acme',
  assetId: 'asset_pc1',
  actor: { type: 'device-token', subject: 'dana@acme' },
  credential: { kind: 'device-token', secret: 'dev-secret-123' },
}

function findings(): Finding[] {
  return [
    {
      id: 'mcp-unapproved',
      title: 'Unapproved MCP server present locally: filesystem',
      severity: 'low',
      category: 'mcp-risk',
      evidence: 'filesystem',
      recommendation: 'Get this MCP server approved in the org MCP catalog.',
      advisory: true,
    },
    {
      id: 'openai-key',
      title: 'OpenAI-style API key',
      severity: 'critical',
      category: 'secret',
      file: 'src/config.ts',
      line: 12,
      evidence: 'sk-p…0000',
      recommendation: 'rotate',
    },
  ]
}

function buildAdvisoryPayload() {
  return buildReportPayload(findings(), {
    orgId: 'org_acme',
    assetId: 'asset_pc1',
    actor: { type: 'device-token', subject: 'dana' },
    home: HOME,
    username: USER,
    scannedAt: '2026-07-04T00:00:00.000Z',
  })
}

test('WIRE SKEW (b): server advertising schemaVersions [1,2] receives schemaVersion 2 with the advisory finding intact', async () => {
  const payload = buildAdvisoryPayload()
  assert.equal(payload.schemaVersion, 1, 'buildReportPayload always emits 1; negotiation happens in pushReport')
  assert.equal(payload.findings.some((f) => f.ruleId === 'mcp-unapproved'), true)

  let sentBody: string | undefined
  let metaCalls = 0
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith('/v1/meta')) {
      metaCalls += 1
      return { status: 200, text: async () => JSON.stringify({ schemaVersions: [1, 2], version: '0.2.0' }) }
    }
    sentBody = init.body
    return { status: 202, text: async () => '{"accepted":true}' }
  }

  const result = await pushReport('https://cp.example', payload, deviceIdentity, { fetchImpl })
  assert.equal(result.status, 202)
  assert.equal(metaCalls, 1, 'the meta probe is cached for this single push call')
  const sent = JSON.parse(sentBody!)
  assert.equal(sent.schemaVersion, 2)
  assert.equal(sent.findings.some((f: { ruleId: string }) => f.ruleId === 'mcp-unapproved'), true, 'advisory finding rides at v2')
})

test('WIRE SKEW (c): server advertising schemaVersions [1] only makes the agent omit advisory findings and send schemaVersion 1', async () => {
  const payload = buildAdvisoryPayload()
  let sentBody: string | undefined
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith('/v1/meta')) {
      return { status: 200, text: async () => JSON.stringify({ schemaVersions: [1], version: '0.1.0' }) }
    }
    sentBody = init.body
    return { status: 202, text: async () => '{"accepted":true}' }
  }

  await pushReport('https://cp.example', payload, deviceIdentity, { fetchImpl })
  const sent = JSON.parse(sentBody!)
  assert.equal(sent.schemaVersion, 1)
  assert.equal(sent.findings.some((f: { ruleId: string }) => f.ruleId === 'mcp-unapproved'), false, 'advisory finding is omitted, not merely downgraded')
  assert.equal(sent.findings.length, 1, 'the non-advisory finding still ships')
})

test('WIRE SKEW (d): a missing/erroring /v1/meta falls back to schemaVersion 1 and omits advisory findings', async () => {
  const payload = buildAdvisoryPayload()
  let sentBody: string | undefined
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith('/v1/meta')) {
      throw new Error('ECONNREFUSED')
    }
    sentBody = init.body
    return { status: 202, text: async () => '{"accepted":true}' }
  }

  await pushReport('https://cp.example', payload, deviceIdentity, { fetchImpl })
  const sent = JSON.parse(sentBody!)
  assert.equal(sent.schemaVersion, 1)
  assert.equal(sent.findings.some((f: { ruleId: string }) => f.ruleId === 'mcp-unapproved'), false)
})

test('a payload with no advisory findings always sends schemaVersion 1 without probing /v1/meta', async () => {
  const payload = buildReportPayload([findings()[1]!], {
    orgId: 'org_acme',
    assetId: 'asset_pc1',
    actor: { type: 'device-token', subject: 'dana' },
    home: HOME,
    username: USER,
  })
  let metaCalls = 0
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith('/v1/meta')) {
      metaCalls += 1
      return { status: 200, text: async () => JSON.stringify({ schemaVersions: [1, 2] }) }
    }
    return { status: 202, text: async () => JSON.parse(init.body ?? '{}') && '{"accepted":true}' }
  }
  await pushReport('https://cp.example', payload, deviceIdentity, { fetchImpl })
  assert.equal(metaCalls, 0, 'no advisory findings means no negotiation probe at all')
})
