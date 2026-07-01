import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const checklistPath = join(repoRoot, 'docs', 'ax-rule-compliance-checklist.md')
const commerceScenarioRoot = join(repoRoot, 'examples', 'enterprise-scenarios', 'commerce-voc-agent')
const fixturePaths = [
  join(commerceScenarioRoot, 'risky-pr.diff'),
  join(commerceScenarioRoot, 'risky-mcp.json'),
  join(commerceScenarioRoot, 'agent-transcript.log'),
  join(repoRoot, 'examples', 'agent-policy.yaml'),
] as const
const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i,
  /(?:OWASP|MCP)[^\n|.]{0,60}(?:공식\s*인증|인증\s*완료|인증을\s*받은|검증\s*완료)/i,
  /(?:최종\s*)?회사\s*문제[^\n|.]{0,50}(?:확정\s*(?:됨|완료|상태|입니다|했다|했습니다)|검증\s*완료|알고\s*있음|verified)/i,
  /(?:real\s+customer\s+data|실제\s+(?:고객|회사)\s*데이터)[^\n|.]{0,50}(?:사용|포함|기반|학습|검증|included|used|trained|verified)/i,
  /AgentGuard[^\n|.]{0,90}(?:전체\s*AI\s*(?:인프라\s*)?보안\s*플랫폼|종합\s*AI\s*보안\s*플랫폼)/i,
  /full-stack\s+AI\s+red[-\s]?team\s+platform|전체\s+AI\s+인프라\s+보안\s+플랫폼/i,
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    const hasPackage = existsSync(join(currentDir, 'package.json'))
    const hasDocs = existsSync(join(currentDir, 'docs'))
    const hasTests = existsSync(join(currentDir, 'test'))
    if (hasPackage && hasDocs && hasTests) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find repository root in the directory tree')
    currentDir = parentDir
  }
}

function readChecklist(): string {
  return readFileSync(checklistPath, 'utf8')
}

test('AX rule compliance checklist exists and is linked from reviewer-facing indexes', () => {
  assert.ok(existsSync(checklistPath), 'docs/ax-rule-compliance-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
  const submissionPack = readFileSync(join(repoRoot, 'docs', 'ax-prelim-submission-pack.md'), 'utf8')

  assert.match(rootReadme, /\[AX rule compliance checklist\]\(docs\/ax-rule-compliance-checklist\.md\)/)
  assert.ok(
    /\[AX rule compliance checklist\]\(ax-rule-compliance-checklist\.md\)/.test(examplesDoc) ||
      /\[AX rule compliance checklist\]\(ax-rule-compliance-checklist\.md\)/.test(submissionPack),
    'docs/examples.md or docs/ax-prelim-submission-pack.md should link the checklist',
  )
})

test('AX rule compliance checklist covers required Korean-first sections', () => {
  const checklist = readChecklist()
  const requiredHeadings = [
    '## 판정',
    '## 공개 확인 사실',
    '## 게이트/미확인 체크',
    '## 현재 AgentGuard 증거',
    '## Fit/risk table',
    '## Exact smoke commands',
    '## Fixture-backed evidence',
    '## 제출 전 수정',
    '## 심사 방어 문구',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(checklist, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }
})

test('AX rule compliance checklist uses required public signals with borrow and avoid language', () => {
  const checklist = readChecklist()
  const requiredTerms = [
    'OWASP Agentic AI Threats and Mitigations',
    'Snyk agent-scan',
    'Tencent AI-Infra-Guard',
    'splx-ai agentic-radar',
    'borrow',
    'avoid',
    'excessive agency',
    'tool misuse',
    'GitHub activity',
    'full AI infra/red-team platform',
  ] as const

  for (const term of requiredTerms) {
    assert.match(checklist, new RegExp(escapeRegExp(term), 'i'))
  }
})

test('AX rule compliance checklist names exact commands and existing fixtures', () => {
  const checklist = readChecklist()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(fixturePath), `${fixturePath} should exist for checklist evidence`)
  }

  const requiredTerms = [
    'npm run build',
    'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    'examples/agent-policy.yaml',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'BLOCK',
    'PASS',
  ] as const

  for (const term of requiredTerms) {
    assert.match(checklist, new RegExp(escapeRegExp(term)))
  }
})

test('AX rule compliance checklist forbids unsupported submission claims', () => {
  const checklist = readChecklist()

  assert.match(checklist, /fake adoption/i)
  assert.match(checklist, /certification/i)
  assert.match(checklist, /final company problem certainty/i)
  assert.match(checklist, /real customer data/i)
  assert.match(checklist, /broad platform claims/i)

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(checklist, forbiddenClaimPattern)
  }
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
