import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const docPath = join(repoRoot, 'docs', 'ax-pr-gate-first-run-decision-record.md')
const readmePath = join(repoRoot, 'README.md')
const examplesPath = join(repoRoot, 'docs', 'examples.md')
const githubActionPath = join(repoRoot, 'docs', 'github-action.md')

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

const requiredCommands = [
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/pr-gate-first-run.sarif < examples/risky-pr.diff',
] as const

const requiredFixtures = [
  'examples/risky-pr.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
] as const

test('AX PR gate first-run decision record is discoverable and contract-backed', () => {
  assert.ok(existsSync(docPath), 'decision record doc should exist')
  const doc = read(docPath)

  assert.match(doc, /^# AX PR gate first-run decision record/m)
  for (const heading of [
    '## When to fill this out',
    '## Source-of-record fields',
    '## Output-to-owner routing',
    '## Fixture-backed smoke commands',
    '## Decision record template',
    '## Boundaries',
  ] as const) {
    assert.match(doc, new RegExp('^' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm'), `missing heading ${heading}`)
  }

  for (const term of ['conclusion', 'finding-count', 'advisory-count', 'review-count', 'block-count', 'report-path', 'json-path', 'sarif-path'] as const) {
    assert.match(doc, new RegExp('`' + term + '`'), `doc should mention action output/input ${term}`)
  }

  assert.match(doc, /required status check/i)
  assert.match(doc, /block-count[\s\S]{0,160}weighted risk score/i)
  assert.match(doc, /Markdown/i)
  assert.match(doc, /JSON/i)
  assert.match(doc, /SARIF/i)
  assert.match(doc, /security owner|service owner|rollout owner/i)
  assert.match(doc, /PASS[\s\S]{0,240}REVIEW[\s\S]{0,240}BLOCK/)

  for (const command of requiredCommands) {
    assert.ok(doc.includes(command), `doc should include exact command: ${command}`)
  }

  for (const fixture of requiredFixtures) {
    assert.ok(existsSync(join(repoRoot, normalize(fixture))), `referenced fixture should exist: ${fixture}`)
  }
})

test('entrypoints link the AX PR gate first-run decision record', () => {
  const readme = read(readmePath)
  const examples = read(examplesPath)
  const githubAction = read(githubActionPath)

  assert.match(readme, /\[AX PR gate first-run decision record\]\(docs\/ax-pr-gate-first-run-decision-record\.md\)/)
  assert.match(examples, /\[AX PR gate first-run decision record\]\(ax-pr-gate-first-run-decision-record\.md\)/)
  assert.match(githubAction, /\[AX PR gate first-run decision record\]\(ax-pr-gate-first-run-decision-record\.md\)/)
})

test('AX PR gate first-run decision record preserves machine contracts and avoids fake claims', () => {
  const doc = read(docPath)
  for (const machineTerm of ['PASS', 'REVIEW', 'BLOCK', 'scan-diff', 'scan-mcp', 'scan-log', 'SARIF'] as const) {
    assert.match(doc, new RegExp('`?' + machineTerm + '`?'), `machine contract term should remain visible: ${machineTerm}`)
  }

  const forbiddenClaims = [
    /certifi(?:es|cation)/i,
    /official approval/i,
    /automatic approval/i,
    /replaces security review/i,
    /runtime enforcement/i,
    /hosted monitoring/i,
    /same as Snyk/i,
    /same as AI-Infra-Guard/i,
    /same as agentic-radar/i,
  ]
  for (const pattern of forbiddenClaims) {
    assert.doesNotMatch(doc, pattern)
  }
})
