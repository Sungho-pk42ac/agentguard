import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const crosswalkPath = join(repoRoot, 'docs', 'ax-judge-rubric-crosswalk.md')

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://openai.com/index/new-tools-for-building-agents/',
  'https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

const fixtureBackedCommands = [
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i,
  /(?:OWASP|OpenAI|GitHub|Tencent|splx-ai|AX)[^\n|.]{0,250}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|certification|verified|approved|endorsed)/i,
  /(?:GitHub\s+code\s+scanning|GitHub\s+security\s+products?|Tencent|splx-ai|AI-Infra-Guard|agentic-radar)[^\n|.]{0,250}(?:대체|replacement|parity|동등)/i,
  /AgentGuard[^\n|.]{0,250}(?:대체|replacement|parity|동등|전체\s*AI\s*(?:인프라\s*)?보안\s*플랫폼|full\s+AI\s+security\s+platform)/i,
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    const hasPackage = existsSync(join(currentDir, 'package.json'))
    const hasDocs = existsSync(join(currentDir, 'docs'))
    const hasTests = existsSync(join(currentDir, 'test'))
    if (hasPackage && hasDocs && hasTests) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find repo root in the directory tree')
    currentDir = parentDir
  }
}

function readCrosswalk(): string {
  return readFileSync(crosswalkPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX judge rubric crosswalk exists and is linked from public docs', () => {
  assert.ok(existsSync(crosswalkPath), 'docs/ax-judge-rubric-crosswalk.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX judge rubric crosswalk\]\(docs\/ax-judge-rubric-crosswalk\.md\)/)
  assert.match(examplesDoc, /\[AX judge rubric crosswalk\]\(ax-judge-rubric-crosswalk\.md\)/)
})

test('AX judge rubric crosswalk is Korean-first and covers key judging lenses', () => {
  const crosswalk = readCrosswalk()
  const requiredHeadings = [
    '# AX judge rubric crosswalk',
    '## 사용 목적',
    '## AX judging lens → AgentGuard evidence',
    '## Fixture-backed evidence commands',
    '## Public reference borrow/avoid map',
    '## Machine-contract boundary',
    '## Non-claim guardrails',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(crosswalk, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const lens of ['현업 문제 적합성', 'agent/tool surface', '반복 가능한 evidence', 'approval decision'] as const) {
    expectLiteral(crosswalk, lens)
  }
})

test('AX judge rubric crosswalk cites required public references', () => {
  const crosswalk = readCrosswalk()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(crosswalk, referenceUrl)
  }
})

test('AX judge rubric crosswalk uses exact fixture-backed commands and existing paths', () => {
  const crosswalk = readCrosswalk()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(crosswalk, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(crosswalk, fixturePath)
    }
  }

  for (const artifact of ['agentguard.sarif', 'BLOCK', 'REVIEW', 'PASS'] as const) {
    expectLiteral(crosswalk, artifact)
  }
})

test('AX judge rubric crosswalk preserves English-compatible machine terms', () => {
  const crosswalk = readCrosswalk()

  for (const machineTerm of [
    'agentguard scan-log',
    'agentguard scan-mcp',
    'agentguard scan-diff',
    'CLI',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
  ] as const) {
    expectLiteral(crosswalk, machineTerm)
  }

  assert.doesNotMatch(crosswalk, /(?:CLI|rule IDs?|JSON|SARIF|API|machine fields)[^\r\n]*(?:한국어로|한글로|번역|변경|rename)/i)
})

test('AX judge rubric crosswalk avoids fake adoption certification replacement and parity claims', () => {
  const crosswalk = readCrosswalk()

  for (const guardrail of [
    'No fake adoption claim',
    'No certification claim',
    'No replacement claim',
    'No parity claim',
  ] as const) {
    expectLiteral(crosswalk, guardrail)
  }

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(crosswalk, forbiddenClaimPattern)
  }
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
