import assert from 'node:assert/strict'
import { test } from 'node:test'
import { looksLikeRawSecret, payloadRedactionCheck } from '../src/redaction.js'
import { payload, finding } from './helpers.js'

test('looksLikeRawSecret detects secret-shaped values', () => {
  assert.equal(looksLikeRawSecret('sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX0123'), true)
  assert.equal(looksLikeRawSecret('sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'), true)
  assert.equal(looksLikeRawSecret('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'), true)
  assert.equal(looksLikeRawSecret('AKIAABCDEFGHIJKLMNOP'), true)
  assert.equal(looksLikeRawSecret('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456'), true)
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
