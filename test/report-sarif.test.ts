import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toSarif } from '../src/report.js'
import type { Finding } from '../src/rules.js'

const baseFinding: Finding = {
  id: 'openai-key',
  title: 'OpenAI-style API key',
  severity: 'critical',
  category: 'secret',
  file: 'src/agent.ts',
  line: 42,
  evidence: 'OpenAI-style API key: sk-…redacted',
  recommendation: 'Remove the secret, rotate it, and load it from a secret manager or environment variable.',
}

function firstFingerprint(findings: Finding[]): string {
  const sarif = JSON.parse(toSarif(findings))
  const fingerprint = sarif.runs[0].results[0].partialFingerprints?.['agentguard.v1']
  assert.equal(typeof fingerprint, 'string')
  return fingerprint
}

test('SARIF results include stable partial fingerprints for identical findings', () => {
  const first = firstFingerprint([baseFinding])
  const second = firstFingerprint([{ ...baseFinding }])

  assert.equal(first, second)
  assert.match(first, /^[a-f0-9]{64}$/)
})

test('SARIF partial fingerprints stay stable when line numbers shift', () => {
  const first = firstFingerprint([baseFinding])
  const second = firstFingerprint([{ ...baseFinding, line: 100 }])

  assert.equal(first, second)
})

test('SARIF partial fingerprints change when finding evidence changes', () => {
  const first = firstFingerprint([baseFinding])
  const second = firstFingerprint([{ ...baseFinding, evidence: 'OpenAI-style API key: sk-…different' }])

  assert.notEqual(first, second)
})
