import assert from 'node:assert/strict'
import { test } from 'node:test'
import { looksLikeRawSecret, payloadRedactionCheck } from '../src/redaction.js'
import { payload, finding } from './helpers.js'

test('looksLikeRawSecret detects secret-shaped values', () => {
  assert.equal(looksLikeRawSecret('sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX0123'), true)
  assert.equal(looksLikeRawSecret('sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'), true)
  assert.equal(looksLikeRawSecret('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'), true)
  assert.equal(looksLikeRawSecret('AKIAABCDEFGHIJKLMNOP'), true)
  assert.equal(looksLikeRawSecret(`AIzaSy${'A'.repeat(29)}wxyz`), true)
  assert.equal(looksLikeRawSecret('-----BEGIN RSA PRIVATE KEY-----'), true)
})

test('ADVERSARIAL: a high-entropy token the client sweep would miss is caught', () => {
  // 40 mixed-case + digit chars, matches NO SECRET_PATTERN prefix, but is high entropy.
  const token = 'Zx9Kq2Lm7Pv4Rt8Nw1Yb6Hd3Fg5Jc0Aq2Ws4Ex7'
  assert.equal(looksLikeRawSecret(token), true)
})

test('looksLikeRawSecret does NOT flag redacted evidence or normal paths', () => {
  assert.equal(looksLikeRawSecret('sk-p…0000'), false)
  assert.equal(looksLikeRawSecret('ghp_…abcd'), false)
  assert.equal(looksLikeRawSecret('~/.zshrc:42'), false)
  assert.equal(looksLikeRawSecret('src/config/database/connection.ts:120'), false)
  assert.equal(looksLikeRawSecret('mcp.broad_filesystem_access'), false)
})

test('payloadRedactionCheck passes a clean redacted payload', () => {
  const clean = payload('o', 'a', [finding(), finding({ ruleId: 'github-token', evidenceRedacted: 'ghp_…abcd' })])
  assert.deepEqual(payloadRedactionCheck(clean), { leak: false })
})

test('payloadRedactionCheck flags a poisoned evidence field', () => {
  const poisoned = payload('o', 'a', [finding({ evidenceRedacted: 'Zx9Kq2Lm7Pv4Rt8Nw1Yb6Hd3Fg5Jc0Aq2Ws4Ex7' })])
  const result = payloadRedactionCheck(poisoned)
  assert.equal(result.leak, true)
  assert.match(result.field ?? '', /evidenceRedacted/)
})

// Regression (red-team G003): server-minted orgId/assetId are opaque high-entropy
// tokens by design; the entropy heuristic must NOT flag them, or every real org's
// first report 422s. Existing fixtures used short ids ('orgA') and hid this.
test('payloadRedactionCheck accepts a real minted-shaped orgId (entropy heuristic off for structural ids)', () => {
  const realOrg = 'org_ff90c42435483214c82bdcea' // org_ + 24 hex, entropy ~4.0
  const assetId = 'pc-a1b2c3d4' // realistic server default (pc- + 8 hex) or a user label
  // sanity: the opaque orgId WOULD trip the generic entropy heuristic...
  assert.equal(looksLikeRawSecret(realOrg), true, 'precondition: opaque id trips the full heuristic')
  // ...but the shape-only variant (used for structural ids) lets it through.
  assert.equal(looksLikeRawSecret(realOrg, { entropy: false }), false, 'shape-only lets the opaque id through')
  // Production actor.subject is the (short) assetId, not `assetId@orgId` (that is
  // only the test helper's default), so override it to the realistic shape.
  const clean = payload(realOrg, assetId, [finding()], { actor: { type: 'device-token', subject: assetId } })
  assert.deepEqual(payloadRedactionCheck(clean), { leak: false }, 'a real registered org can push its first report')
})

test('payloadRedactionCheck still catches a shape-secret smuggled into orgId/assetId', () => {
  const shapeInOrg = payload('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345', 'pc1', [finding()], { actor: { type: 'device-token', subject: 'pc1' } })
  const r1 = payloadRedactionCheck(shapeInOrg)
  assert.equal(r1.leak, true)
  assert.equal(r1.field, 'orgId')
  const shapeInAsset = payload('orgA', 'sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345', [finding()], { actor: { type: 'device-token', subject: 'clean' } })
  const r2 = payloadRedactionCheck(shapeInAsset)
  assert.equal(r2.leak, true)
  assert.equal(r2.field, 'assetId')
})
