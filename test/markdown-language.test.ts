import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { toMarkdown } from '../src/report.js'
import type { Finding } from '../src/rules.js'

const findings: Finding[] = [
  {
    id: 'github-token',
    title: 'GitHub token',
    severity: 'critical',
    category: 'secret',
    file: 'agent.log',
    line: 3,
    evidence: '[REDACTED]',
    recommendation: 'Remove the secret, rotate it, and load it from a secret manager or environment variable.',
  },
  {
    id: 'mcp-filesystem-wide-root',
    title: 'MCP filesystem server exposes a broad root path',
    severity: 'critical',
    category: 'mcp-risk',
    file: 'mcp-config',
    evidence: 'filesystem root',
    recommendation: 'Restrict filesystem MCP roots to the repository or a dedicated read-only working directory.',
  },
]

test('default Markdown report is Korean-first for human terminal output', () => {
  const markdown = toMarkdown(findings)

  assert.match(markdown, /^# AgentGuard 위험 리포트/)
  assert.match(markdown, /\*\*판정:\*\* BLOCK/)
  assert.match(markdown, /\*\*위험 점수:\*\* 8/)
  assert.match(markdown, /\*\*탐지 건수:\*\* 2/)
  assert.match(markdown, /\| 심각도 \| 분류 \| 파일 \| 탐지 내용 \| 증거 \|/)
  assert.match(markdown, /GitHub 토큰/)
  assert.match(markdown, /MCP filesystem 서버가 넓은 root path를 노출함/)
  assert.match(markdown, /## 권장 조치/)
  assert.match(markdown, /비밀 값을 제거하고 회전/)
  assert.doesNotMatch(markdown, /^# AgentGuard Risk Report/)
  assert.doesNotMatch(markdown, /\*\*Verdict:\*\*/)
})

test('English Markdown report remains available with explicit lang option', () => {
  const markdown = toMarkdown(findings, { lang: 'en' })

  assert.match(markdown, /^# AgentGuard Risk Report/)
  assert.match(markdown, /\*\*Verdict:\*\* BLOCK/)
  assert.match(markdown, /\| Severity \| Category \| File \| Finding \| Evidence \|/)
  assert.match(markdown, /GitHub token/)
  assert.doesNotMatch(markdown, /\*\*판정:\*\*/)
})

test('JSON output stays machine-facing English even when Markdown defaults to Korean', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'scan-log', '--json'], {
    cwd: process.cwd(),
    input: 'github_pat_' + 'A'.repeat(22) + '_' + 'B'.repeat(59),
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  const parsed = JSON.parse(result.stdout) as Array<{ title: string, category: string, severity: string }>
  assert.equal(parsed[0]?.title, 'GitHub token')
  assert.equal(parsed[0]?.category, 'secret')
  assert.equal(parsed[0]?.severity, 'critical')
})

test('CLI --lang en keeps English human-readable Markdown output', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'scan-log', '--lang', 'en'], {
    cwd: process.cwd(),
    input: 'github_pat_' + 'A'.repeat(22) + '_' + 'B'.repeat(59),
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /^# AgentGuard Risk Report/)
  assert.match(result.stdout, /\*\*Verdict:\*\* REVIEW/)
  assert.doesNotMatch(result.stdout, /\*\*판정:\*\*/)
}
)
