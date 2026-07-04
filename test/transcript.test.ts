import assert from 'node:assert/strict'
import { test } from 'node:test'
// note: kept separate from scanner.test.ts (already ~1090 lines) rather than growing it further.
import { scanText, scanTranscript } from '../src/scanner.js'

// 실증적으로 검증된 회피 사례: JSON \uXXXX 유니코드 이스케이프가 원문(raw) 바이트에서는
// 토큰의 문자 클래스를 끊어 openai-key 정규식을 무력화하지만, JSON.parse로 디코딩하면
// 이스케이프가 원래 문자로 복원되어 하나로 이어진 키가 드러난다.
// (반대로 \n 이스케이프는 디코딩 후에도 실제 개행 문자가 여전히 토큰을 끊어놓아
// 복구되지 않는다 — 이 케이스는 채택하지 않았다.)
const suffix = 'A'.repeat(80) + 'wxyz'
const escapedKeyJsonlLine = `{"content":"api key: sk-proj-AAAAAAAAAA\\u0041${suffix}"}`

test('plain-text scan misses an OpenAI-style key split by a JSON unicode escape (documents the gap)', () => {
  const findings = scanText(escapedKeyJsonlLine, 'agent-log')
  assert.ok(!findings.some((f) => f.id === 'openai-key'), 'raw scan should not see the escape-split key')
})

test('scanTranscript decodes JSONL string values and catches the escape-split key', () => {
  const findings = scanTranscript(escapedKeyJsonlLine, 'agent-log')
  const finding = findings.find((f) => f.id === 'openai-key')
  assert.ok(finding, 'expected scanTranscript to find the key hidden by a JSON unicode escape')
  assert.equal(finding.severity, 'critical')
  assert.match(finding.evidence, /^sk-p…wxyz$/)
})

test('scanTranscript walks nested Codex-style content arrays', () => {
  const codexLine = JSON.stringify({
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: `run this: OPENAI_API_KEY=sk-${'B'.repeat(44)}wxyz` }],
  })

  const findings = scanTranscript(codexLine, 'agent-log')
  assert.ok(findings.some((f) => f.id === 'openai-key'))
})

test('scanTranscript dedupes a finding already caught by the raw-line scan', () => {
  const hermesLine = JSON.stringify({ role: 'assistant', content: `token: sk-${'C'.repeat(44)}wxyz` })

  const rawCount = scanText(hermesLine, 'agent-log').filter((f) => f.id === 'openai-key').length
  const transcriptCount = scanTranscript(hermesLine, 'agent-log').filter((f) => f.id === 'openai-key').length

  assert.equal(rawCount, 1)
  assert.equal(transcriptCount, 1, 'should not double-report the same id+evidence finding')
})

test('scanTranscript behaves byte-identically to scanText for plain (non-JSONL) text', () => {
  const plain = 'OPENAI_API_KEY="sk-abcdefghijklmnopqrstuvwxyz"\nrm -rf /\n'

  assert.deepEqual(scanTranscript(plain, 'agent-log'), scanText(plain, 'agent-log'))
})
