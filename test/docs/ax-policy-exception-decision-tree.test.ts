import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const decisionTreePath = join(repoRoot, 'docs', 'ax-policy-exception-decision-tree.md')

const requiredHeadings = [
  '## Purpose',
  '## Decision tree',
  '## BLOCK/REVIEW/PASS exception matrix',
  '## Fixture-backed evidence commands',
  '## Public reference borrow/avoid/action notes',
  '## Machine-contract boundaries',
  '## Non-claim guardrails',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixturePaths: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixturePaths: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixturePaths: ['examples/agent-policy.yaml', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixturePaths: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const requiredPublicUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://code.claude.com/docs/en/security',
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
  'https://github.com/snyk/agent-scan',
  'https://github.com/asamassekou10/ship-safe',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|production\s+customer/i,
  /AgentGuard[^\n|.]{0,100}(?:실제\s*채택|채택\s*완료|운영\s*실적|레퍼런스\s*보유|enterprise\s+adopted)/i,
  /(?:OWASP|Anthropic|Claude|GitHub|Snyk|ShipSafe|MCP)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|인증을\s*받은|검증\s*완료|certified|endorsed|approved|verified)/i,
  /(?:SOC\s*2|ISO\s*27001)[^\n|.]{0,60}(?:인증(?:\s*완료)?|준수(?:\s*완료)?|certified|compliant|verified)/i,
  /AgentGuard[^\n|.]{0,100}(?:GitHub|Snyk|ShipSafe|Claude)[^\n|.]{0,80}(?:parity|동급|대체|replacement)/i,
  /AgentGuard[^\n|.]{0,100}(?:전체\s*AI\s*(?:인프라\s*)?보안\s*플랫폼|종합\s*AI\s*보안\s*플랫폼|full-stack\s+AI\s+security\s+platform)/i,
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

function readDecisionTree(): string {
  return readFileSync(decisionTreePath, 'utf8')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX policy exception decision tree exists and is linked from the root README', () => {
  assert.ok(existsSync(decisionTreePath), 'docs/ax-policy-exception-decision-tree.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX policy exception decision tree\]\(docs\/ax-policy-exception-decision-tree\.md\)/)
})

test('AX policy exception decision tree keeps the required headings in order', () => {
  const decisionTree = readDecisionTree()
  let previousIndex = -1

  for (const heading of requiredHeadings) {
    const headingIndex = decisionTree.indexOf(heading)
    assert.ok(headingIndex > previousIndex, `${heading} should exist after the previous required heading`)
    previousIndex = headingIndex
  }
})

test('AX policy exception decision tree maps decisions to exception outcomes and approval conditions', () => {
  const decisionTree = readDecisionTree()

  for (const term of [
    '대상권',
    'AX Rollout Guard',
    '30초',
    '정책 예외',
    'human approval',
    'permission narrowing',
    'least privilege',
    'BLOCK',
    'REVIEW',
    'PASS',
    'PR diff',
    'MCP',
    'transcript',
  ] as const) {
    assert.match(decisionTree, new RegExp(escapeRegExp(term), 'i'))
  }
})

test('AX policy exception decision tree names exact fixture-backed evidence commands and existing fixtures', () => {
  const decisionTree = readDecisionTree()

  for (const { command, fixturePaths } of fixtureBackedCommands) {
    assert.ok(decisionTree.includes(command), `${command} should be documented exactly`)

    for (const fixturePath of fixturePaths) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      assert.ok(decisionTree.includes(fixturePath), `${fixturePath} should be documented`)
    }
  }

  assert.match(decisionTree, /fixture-backed|저장소 fixture|합성 fixture/i)
  assert.match(decisionTree, /Markdown report/)
  assert.match(decisionTree, /SARIF/)
})

test('AX policy exception decision tree cites required public references with borrow avoid action framing', () => {
  const decisionTree = readDecisionTree()

  for (const referenceUrl of requiredPublicUrls) {
    assert.ok(decisionTree.includes(referenceUrl), `${referenceUrl} should be cited`)
  }

  assert.match(decisionTree, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(decisionTree, /OWASP Agentic AI/)
  assert.match(decisionTree, /Claude Code Security/)
  assert.match(decisionTree, /GitHub SARIF/)
  assert.match(decisionTree, /Snyk agent-scan/)
  assert.match(decisionTree, /ShipSafe MCP/)
})

test('AX policy exception decision tree preserves English-compatible machine contracts', () => {
  const decisionTree = readDecisionTree()

  for (const contract of [
    'AgentGuard',
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'SARIF',
    'JSON',
    'rule IDs',
    'English-compatible',
  ] as const) {
    assert.ok(decisionTree.includes(contract), `${contract} should stay documented`)
  }

  assert.doesNotMatch(decisionTree, /(?:CLI|명령어|rule ID|룰 ID|규칙 ID|verdict|판정|SARIF|JSON)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX policy exception decision tree bans unsupported adoption certification and parity claims', () => {
  const decisionTree = readDecisionTree()

  assert.match(decisionTree, /fake adoption/i)
  assert.match(decisionTree, /certification/i)
  assert.match(decisionTree, /product parity/i)

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(decisionTree, forbiddenClaimPattern)
  }
})
