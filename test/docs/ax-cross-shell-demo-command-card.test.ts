import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-cross-shell-demo-command-card.md')

const fixturePaths = [
  'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
] as const

const exactCommands = [
  'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'Get-Content -Raw examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json | node dist/index.js scan-mcp',
  'Get-Content -Raw examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff | node dist/index.js scan-diff',
  'Get-Content -Raw examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff | node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif',
] as const

const requiredReferences = [
  'https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/setting-a-default-shell-and-working-directory',
  'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_redirection',
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
  'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices',
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX cross-shell demo command card exists and is linked from README and examples docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-cross-shell-demo-command-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX cross-shell demo command card\]\(docs\/ax-cross-shell-demo-command-card\.md\)/)
  assert.match(examplesDoc, /\[AX cross-shell demo command card\]\(ax-cross-shell-demo-command-card\.md\)/)
})

test('AX cross-shell demo command card is Korean-first and has shell-specific sections', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 30초 운영 카드',
    '## POSIX shell',
    '## PowerShell',
    '## GitHub Actions artifact path',
    '## Expected verdict and exit behavior',
    '## Public reference borrow/avoid notes',
    '## Non-claim guardrails',
  ] as const

  assert.match(card, /^# AX cross-shell demo command card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }
})

test('AX cross-shell demo command card uses exact existing fixture-backed commands', () => {
  const card = readCard()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(card, fixturePath)
  }

  for (const command of exactCommands) {
    expectLiteral(card, command)
  }

  expectLiteral(card, 'shell: bash')
  expectLiteral(card, 'continue-on-error: true')
  expectLiteral(card, 'actions/upload-artifact@v4')
  expectLiteral(card, '.agentguard-demo/agentguard.sarif')
})

test('AX cross-shell demo command card states verdict exit and SARIF artifact behavior honestly', () => {
  const card = readCard()

  assert.match(card, /`BLOCK`[\s\S]{0,500}(?:nonzero|0이 아닌|실패)/i)
  assert.match(card, /`REVIEW`[\s\S]{0,500}(?:review|검토|승인자)/i)
  assert.match(card, /`PASS`[\s\S]{0,500}(?:no findings|finding 없음|위험 없음)/i)
  assert.match(card, /SARIF[\s\S]{0,700}(?:artifact|아티팩트)[\s\S]{0,700}(?:preserve|보존|업로드)/i)
  assert.match(card, /MCP[\s\S]{0,700}(?:business approval|업무 승인|승인 중단)/i)
})

test('AX cross-shell demo command card cites public references and bans fake claims', () => {
  const card = readCard()

  for (const reference of requiredReferences) {
    expectLiteral(card, reference)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(card, /(?:GitHub|PowerShell|MCP|SARIF)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(card, /(?:CLI|command|rule IDs?|JSON|SARIF)[^\n]*(?:rename|renamed|이름\s*변경|표시용\s*변경)/i)
  assert.doesNotMatch(card, /(?:dashboard|SaaS|Auth|customer data|고객\s*데이터)[^\n]*(?:available|지원|제공|운영|production)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
