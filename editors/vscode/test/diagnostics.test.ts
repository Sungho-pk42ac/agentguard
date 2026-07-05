import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findingToDiagnostic, parseScanJson, type ScanFinding } from '../src/diagnostics.js'

function baseFinding(overrides: Partial<ScanFinding> = {}): ScanFinding {
  return {
    severity: 'high',
    file: 'src/foo.ts',
    line: 3,
    ruleId: 'secret.aws-key',
    evidenceRedacted: 'AKIA****',
    recommendation: 'Rotate the key and remove it from source control.',
    ...overrides,
  }
}

test('severity mapping: critical and high map to Error', () => {
  assert.equal(findingToDiagnostic(baseFinding({ severity: 'critical' })).severity, 'Error')
  assert.equal(findingToDiagnostic(baseFinding({ severity: 'high' })).severity, 'Error')
})

test('severity mapping: medium maps to Warning', () => {
  assert.equal(findingToDiagnostic(baseFinding({ severity: 'medium' })).severity, 'Warning')
})

test('severity mapping: low maps to Information', () => {
  assert.equal(findingToDiagnostic(baseFinding({ severity: 'low' })).severity, 'Information')
})

test('1-based finding line converts to 0-based VS Code line', () => {
  const diagnostic = findingToDiagnostic(baseFinding({ line: 1 }))
  assert.equal(diagnostic.range.startLine, 0)
  assert.equal(diagnostic.range.endLine, 0)

  const diagnostic10 = findingToDiagnostic(baseFinding({ line: 10 }))
  assert.equal(diagnostic10.range.startLine, 9)
  assert.equal(diagnostic10.range.endLine, 9)
})

test('line is clamped to >= 0 and never negative', () => {
  const diagnostic = findingToDiagnostic(baseFinding({ line: 0 }))
  assert.equal(diagnostic.range.startLine, 0)

  const diagnosticNegative = findingToDiagnostic(baseFinding({ line: -5 }))
  assert.equal(diagnosticNegative.range.startLine, 0)
})

test('missing line defaults to 0', () => {
  const diagnostic = findingToDiagnostic(baseFinding({ line: undefined }))
  assert.equal(diagnostic.range.startLine, 0)
  assert.equal(diagnostic.range.endLine, 0)
})

test('message composes ruleId + evidence + recommendation', () => {
  const diagnostic = findingToDiagnostic(
    baseFinding({ ruleId: 'secret.aws-key', evidenceRedacted: 'AKIA****', recommendation: 'Rotate the key.' }),
  )
  assert.equal(diagnostic.message, 'secret.aws-key: AKIA**** — Rotate the key.')
  assert.equal(diagnostic.source, 'AgentGuard')
  assert.equal(diagnostic.code, 'secret.aws-key')
})

test('message falls back to message field when evidenceRedacted is absent', () => {
  const diagnostic = findingToDiagnostic(
    baseFinding({ evidenceRedacted: undefined, message: 'raw evidence text', recommendation: 'Fix it.' }),
  )
  assert.equal(diagnostic.message, 'secret.aws-key: raw evidence text — Fix it.')
})

test('parseScanJson maps the real CLI findings JSON (main package Finding shape)', () => {
  const cliOutput = JSON.stringify([
    {
      id: 'secret.aws-key',
      title: 'AWS access key',
      severity: 'critical',
      category: 'secret',
      file: 'src/config.ts',
      line: 12,
      evidence: 'AKIA****',
      recommendation: 'Rotate the key and remove it from source control.',
    },
    {
      id: 'pii.email',
      title: 'Email address',
      severity: 'low',
      category: 'pii',
      evidence: 'j***@example.com',
      recommendation: 'Remove or redact the email address.',
    },
  ])

  const findings = parseScanJson(cliOutput)
  assert.equal(findings.length, 2)
  assert.deepEqual(findings[0], {
    severity: 'critical',
    file: 'src/config.ts',
    line: 12,
    ruleId: 'secret.aws-key',
    evidenceRedacted: 'AKIA****',
    recommendation: 'Rotate the key and remove it from source control.',
    message: undefined,
  })
  assert.equal(findings[1].file, undefined)
  assert.equal(findings[1].line, undefined)
})

test('parseScanJson tolerates empty input', () => {
  assert.deepEqual(parseScanJson(''), [])
  assert.deepEqual(parseScanJson('   '), [])
})

test('parseScanJson tolerates malformed JSON', () => {
  assert.deepEqual(parseScanJson('not json'), [])
  assert.deepEqual(parseScanJson('{"not":"an array"}'), [])
})

test('parseScanJson skips entries with unknown severity or missing ruleId', () => {
  const cliOutput = JSON.stringify([
    { id: 'x.rule', severity: 'nonsense', evidence: 'e', recommendation: 'r' },
    { severity: 'high', evidence: 'e', recommendation: 'r' },
    { id: 'ok.rule', severity: 'medium', evidence: 'e', recommendation: 'r' },
  ])
  const findings = parseScanJson(cliOutput)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].ruleId, 'ok.rule')
})
