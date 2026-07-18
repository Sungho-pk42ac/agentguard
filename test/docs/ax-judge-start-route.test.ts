import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const examplesPath = join(repoRoot, 'docs', 'examples.md')

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

test('AX judge start route is discoverable near the top of examples', () => {
  const examples = read(examplesPath)
  const headingIndex = examples.indexOf('## AX judge start route (첫 60초)')
  const firstCatalogIndex = examples.indexOf('## Risky MCP config')

  assert.ok(headingIndex > 0, 'judge start route heading should exist')
  assert.ok(firstCatalogIndex > headingIndex, 'judge route should appear before the long example catalog')

  const requiredLinks = [
    ['AX company problem intake kit', 'docs/ax-company-problem-intake-kit.md'],
    ['AX 30-second demo card', 'docs/ax-30-second-demo-card.md'],
    ['AX fresh-clone verifier card', 'docs/ax-fresh-clone-verifier-card.md'],
    ['AX SARIF reviewer loop card', 'docs/ax-sarif-reviewer-loop-card.md'],
    ['AX release attestation receipt', 'docs/ax-release-attestation-receipt.md'],
  ] as const

  for (const [label, target] of requiredLinks) {
    assert.match(examples, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing route label ${label}`)
    assert.ok(existsSync(join(repoRoot, target)), `linked route target should exist: ${target}`)
  }
})

test('AX judge start route pins exact fixture-backed commands and existing fixture paths', () => {
  const examples = read(examplesPath)
  const requiredCommands = [
    'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    'node dist/index.js scan-mcp < examples/risky-mcp.json',
    'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-judge-start-route.sarif < examples/risky-pr.diff',
  ] as const
  const requiredFixtures = [
    'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    'examples/risky-mcp.json',
    'examples/agent-policy.yaml',
    'examples/agent-transcript.log',
    'examples/risky-pr.diff',
  ] as const

  for (const command of requiredCommands) {
    assert.ok(examples.includes(command), `examples route should include exact command: ${command}`)
  }

  for (const fixture of requiredFixtures) {
    assert.ok(existsSync(join(repoRoot, normalize(fixture))), `referenced fixture should exist: ${fixture}`)
  }
})

test('AX judge start route cites public reference signals without overclaiming', () => {
  const examples = read(examplesPath)

  for (const referenceSignal of [
    'MCP Security Best Practices',
    'GitHub SARIF upload docs',
    'npm provenance statements',
    'OWASP LLM/agentic risk framing',
  ] as const) {
    assert.match(examples, new RegExp(referenceSignal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing public reference signal ${referenceSignal}`)
  }

  for (const machineTerm of ['PASS', 'REVIEW', 'BLOCK', 'scan-diff', 'scan-mcp', 'scan-log', 'SARIF'] as const) {
    assert.match(examples, new RegExp(machineTerm), `machine contract should remain visible: ${machineTerm}`)
  }

  for (const forbidden of [
    /customer adoption/i,
    /vendor parity/i,
    /external endorsement/i,
    /자동 승인/,
    /실제 운영 채택/,
  ] as const) {
    assert.doesNotMatch(examples, forbidden, `examples route should avoid fake claim: ${forbidden}`)
  }
})
