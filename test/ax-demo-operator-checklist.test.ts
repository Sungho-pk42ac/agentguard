import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const checklistPath = join(repoRoot, 'docs', 'ax-demo-operator-checklist.md')

const referencedPaths = [
  'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'examples/agent-policy.yaml',
  'docs/ax-competitor-objection-answer-card.md',
  'docs/ax-judge-evidence-index.md',
  'docs/ax-sarif-reviewer-loop-card.md',
] as const

const exactCommands = [
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
] as const

const requiredReferences = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning',
  'https://github.com/snyk/agent-scan',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i,
  /(?:OWASP|GitHub|Snyk|Tencent|splx-ai|Agentshield)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|endorsed|certified|approved)/i,
  /AgentGuard[^\n|.]{0,120}(?:대체|replacement|parity|동등|전체\s*AI\s*(?:인프라\s*)?보안\s*플랫폼)/i,
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

function readChecklist(): string {
  return readFileSync(checklistPath, 'utf8')
}

test('AX demo operator checklist exists and is linked from public docs', () => {
  assert.ok(existsSync(checklistPath), 'docs/ax-demo-operator-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX demo operator checklist\]\(docs\/ax-demo-operator-checklist\.md\)/)
  assert.match(examplesDoc, /\[AX demo operator checklist\]\(ax-demo-operator-checklist\.md\)/)
})

test('AX demo operator checklist maps a timed live flow to exact fixture-backed commands', () => {
  const checklist = readChecklist()

  for (const heading of ['## 3-minute operator flow', '## Expected exits and artifacts', '## Fallback wording']) {
    assert.ok(checklist.includes(heading), `${heading} should be present`)
  }

  for (const command of exactCommands) {
    assert.ok(checklist.includes(command), `${command} should be documented exactly`)
  }

  for (const referencedPath of referencedPaths) {
    assert.ok(existsSync(join(repoRoot, referencedPath)), `${referencedPath} should exist`)
    assert.ok(checklist.includes(referencedPath), `${referencedPath} should be documented`)
  }

  for (const term of ['BLOCK', 'REVIEW', 'PASS', 'non-zero exit', 'SARIF', 'machine contracts', 'rule IDs']) {
    assert.ok(checklist.includes(term), `${term} should be present`)
  }
})

test('AX demo operator checklist ties public references to borrow avoid guidance without overclaiming', () => {
  const checklist = readChecklist()

  for (const reference of requiredReferences) {
    assert.ok(checklist.includes(reference), `${reference} should be cited`)
  }

  for (const term of ['Borrow', 'Avoid', 'AX 인재전쟁', 'tool misuse', 'reviewer-visible artifact']) {
    assert.ok(checklist.includes(term), `${term} should be present`)
  }

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(checklist, forbiddenClaimPattern)
  }
})
