import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadPolicy } from '../../src/policy.js'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const guidePath = join(repoRoot, 'docs', 'team-rollout-baseline-guide.md')

const requiredFixturePaths = [
  'examples/risky-pr.diff',
  'examples/risky-mcp.json',
  'examples/agent-transcript.log',
  'examples/agent-policy.yaml',
  'examples/agent-policy.team.yaml',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-log --policy examples/agent-policy.team.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-diff --json --out .agentguard-demo/findings.json < examples/risky-pr.diff',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
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

function readGuide(): string {
  return readFileSync(guidePath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('team rollout baseline guide exists and is linked from public docs entrypoints', () => {
  assert.ok(existsSync(guidePath), 'docs/team-rollout-baseline-guide.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const englishReadme = readFileSync(join(repoRoot, 'README.en.md'), 'utf8')
  const actionDocs = readFileSync(join(repoRoot, 'docs', 'github-action.md'), 'utf8')

  assert.match(rootReadme, /\[Team rollout baseline guide\]\(docs\/team-rollout-baseline-guide\.md\)/)
  assert.match(englishReadme, /\[Team rollout baseline guide\]\(docs\/team-rollout-baseline-guide\.md\)/)
  assert.match(englishReadme, /baseline\/noise triage[\s\S]{0,220}false-positive[\s\S]{0,220}allowlist/i)
  assert.match(actionDocs, /\[Team rollout baseline guide\]\(team-rollout-baseline-guide\.md\)/)
})

test('team rollout baseline guide covers Korean-first baseline false-positive operations', () => {
  const guide = readGuide()
  const requiredHeadings = [
    '## 첫날 baseline/noise triage',
    '## PASS / REVIEW / BLOCK 운영 기준',
    '## False-positive와 allowlist boundary',
    '## PR reviewer handoff evidence',
    '## Rerun freshness checklist',
    '## Machine-contract boundaries',
  ] as const

  assert.match(guide, /^# Team rollout baseline guide/m)
  assert.match(guide, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(guide, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['baseline', 'false-positive', 'allowlist', 'suppression engine 없음', 'SARIF', 'PR comment', 'artifact'] as const) {
    expectLiteral(guide, term)
  }
})

test('team rollout baseline guide pins exact fixture-backed evidence commands', () => {
  const guide = readGuide()

  for (const fixturePath of requiredFixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(guide, fixturePath)
  }

  for (const command of exactCommands) {
    expectLiteral(guide, command)
  }

  expectLiteral(guide, '.agentguard-demo/findings.json')
  expectLiteral(guide, '.agentguard-demo/agentguard.sarif')
  assert.match(guide, /risky 입력은 BLOCK으로 non-zero exit가 날 수 있음/)
})

test('team rollout policy example documents first-day copy-paste safety boundaries', () => {
  const guide = readGuide()
  const policyPath = join(repoRoot, 'examples', 'agent-policy.team.yaml')
  assert.ok(existsSync(policyPath), 'examples/agent-policy.team.yaml should exist')
  const policy = readFileSync(policyPath, 'utf8')

  for (const entry of [
    '.env*',
    '~/.ssh/**',
    '.ssh/**',
    'auth.json',
    'credentials.json',
    '.aws/**',
    '.kube/**',
    'rm -rf',
    'git push --force',
    'gh secret view',
    'npm publish',
    'deploy',
    'db:migrate',
    'vercel --prod',
    'github.merge_pull_request',
    'filesystem.write_file',
  ] as const) {
    expectLiteral(policy, entry)
  }

  expectLiteral(guide, 'examples/agent-policy.team.yaml')
  expectLiteral(guide, '첫날 팀 rollout policy')
  expectLiteral(guide, 'node dist/index.js scan-log --policy examples/agent-policy.team.yaml < examples/agent-transcript.log')

  const parsedPolicy = loadPolicy(policyPath)
  assert.ok(parsedPolicy.denyRead.includes('~/.ssh/**'))
  assert.ok(parsedPolicy.denyRead.includes('.ssh/**'))
  assert.ok(parsedPolicy.denyCommands.includes('git push --force'))
  assert.ok(parsedPolicy.requireApproval.includes('vercel --prod'))
  assert.ok(parsedPolicy.mcp.requireApprovalTools.includes('github.merge_pull_request'))
})

test('team rollout baseline guide preserves current implementation boundaries', () => {
  const guide = readGuide()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'GitHub Action inputs',
    'machine fields',
    'fail-on: block',
  ] as const) {
    expectLiteral(guide, contract)
  }

  assert.match(guide, /새 suppression engine을 제공한다고 말하지 않는다/)
  assert.doesNotMatch(guide, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|rename)/i)
})

test('team rollout baseline guide bans unsupported adoption certification and parity claims', () => {
  const guide = readGuide()

  assert.doesNotMatch(guide, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(guide, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(guide, /(?:OWASP|Snyk|GitHub)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(guide, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
