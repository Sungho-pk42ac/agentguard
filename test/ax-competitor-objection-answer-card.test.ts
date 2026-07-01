import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-competitor-objection-answer-card.md')

const referencedPaths = [
  'docs/ax-judge-evidence-index.md',
  'docs/ax-judge-evidence-ladder.md',
  'docs/ax-competitive-comparison.md',
  'docs/github-action.md',
  'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'examples/agent-policy.yaml',
] as const

const exactCommands = [
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
] as const

const requiredReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://genai.owasp.org/llm-top-10/',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i,
  /AgentGuard[^\n|.]{0,80}(?:실제\s*채택|채택\s*완료|운영\s*실적|레퍼런스\s*보유)/i,
  /(?:OWASP|MCP|Tencent|splx-ai|Agentshield)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved|endorsed)/i,
  /(?:SOC\s*2|ISO\s*27001)[^\n|.]{0,40}(?:인증(?:\s*완료)?|준수(?:\s*완료)?|certified|compliant|verified)/i,
  /AgentGuard[^\n|.]{0,100}(?:전체\s*AI\s*(?:인프라\s*)?보안\s*플랫폼|종합\s*AI\s*보안\s*플랫폼|full[-\s]?stack\s+AI\s+red[-\s]?team\s+platform)/i,
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

test('AX competitor objection answer card exists and is linked from reviewer-facing docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-competitor-objection-answer-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX competitor objection answer card\]\(docs\/ax-competitor-objection-answer-card\.md\)/)
  assert.match(examplesDoc, /\[AX competitor objection answer card\]\(ax-competitor-objection-answer-card\.md\)/)
})

test('AX competitor objection answer card has Korean-first hard objection scripts', () => {
  const card = readCard()
  const objectionHeadingCount = card.match(/^## Objection /gm)?.length ?? 0

  assert.ok(objectionHeadingCount >= 3, 'card should include at least three hard objections')
  assert.match(card, /^# AX competitor objection answer card/)
  assert.match(card, /한국어 우선/)
  assert.match(card, /30초 답변/)
  assert.match(card, /대상권/)
  assert.match(card, /빌릴 점|borrow/i)
  assert.match(card, /피할 점|avoid/i)
  assert.match(card, /evidence|증거/i)
})

test('AX competitor objection answer card grounds scripts in exact existing commands and paths', () => {
  const card = readCard()

  for (const referencedPath of referencedPaths) {
    assert.ok(existsSync(join(repoRoot, referencedPath)), `${referencedPath} should exist`)
    assert.ok(card.includes(referencedPath), `${referencedPath} should be documented`)
  }

  for (const command of exactCommands) {
    assert.ok(card.includes(command), `${command} should be documented exactly`)
  }

  for (const term of ['BLOCK', 'REVIEW', 'PASS', 'scan-mcp', 'scan-diff', 'scan-log', 'SARIF']) {
    assert.ok(card.includes(term), `${term} should be present`)
  }
})

test('AX competitor objection answer card cites public references without unsupported claims', () => {
  const card = readCard()

  for (const reference of requiredReferences) {
    assert.ok(card.includes(reference), `${reference} should be cited`)
  }

  assert.match(card, /Agentshield/i)
  assert.match(card, /fake adoption/i)
  assert.match(card, /certification/i)
  assert.match(card, /broad-platform/i)
  assert.match(card, /rollout gate/i)

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(card, forbiddenClaimPattern)
  }
})
