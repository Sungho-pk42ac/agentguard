import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const scenarioRoot = join(repoRoot, 'examples', 'enterprise-scenarios')
const matrixPath = join(repoRoot, 'docs', 'ax-demo-scenario-matrix.md')
const currentEnterpriseScenarios = readdirSync(scenarioRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

function readMatrix(): string {
  return readFileSync(matrixPath, 'utf8')
}

test('AX demo scenario matrix exists and is linked from the root README docs list', () => {
  assert.ok(existsSync(matrixPath), 'docs/ax-demo-scenario-matrix.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX demo scenario matrix\]\(docs\/ax-demo-scenario-matrix\.md\)/)
})

test('AX demo scenario matrix covers every current enterprise scenario with judge-facing columns', () => {
  const matrix = readMatrix()

  const requiredColumnLabels = [
    'Company problem',
    'Risk surface',
    'Risk hypothesis',
    'AgentGuard evidence',
    'Expected initial verdict',
    'Fix/policy/PASS story',
    '30-second demo angle',
    'Reference signal',
  ] as const

  for (const label of requiredColumnLabels) {
    assert.ok(matrix.includes(label), `${label} should be present`)
  }

  for (const scenarioName of currentEnterpriseScenarios) {
    assert.ok(matrix.includes(scenarioName), `${scenarioName} should be present`)
    const scenarioDir = join(scenarioRoot, scenarioName)
    assert.ok(existsSync(join(scenarioDir, 'risky-pr.diff')), `${scenarioName}/risky-pr.diff should exist`)
    assert.ok(existsSync(join(scenarioDir, 'risky-mcp.json')), `${scenarioName}/risky-mcp.json should exist`)
    assert.ok(existsSync(join(scenarioDir, 'agent-transcript.log')), `${scenarioName}/agent-transcript.log should exist`)
  }

  assert.match(matrix, /커머스 VOC/)
  assert.match(matrix, /재무 감사|감사 증빙/)
  assert.match(matrix, /HR|인사|채용|recruiting|candidate|지원자/i)
  assert.match(matrix, /여행|예약|노선|좌석|취소|환불/)
})

test('AX demo scenario matrix preserves scoped English-compatible evidence terms', () => {
  const matrix = readMatrix()

  const requiredTerms = [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'PR diff',
    'MCP config',
    'agent transcript/log',
    'JSON',
    'SARIF',
    'secret exposure',
    'tool misuse',
    'excessive agency',
    'BLOCK',
    'PASS',
  ] as const

  for (const term of requiredTerms) {
    assert.ok(matrix.includes(term), `${term} should be present`)
  }

  assert.match(matrix, /MCP config permission/)
  assert.match(matrix, /PR diff \+ MCP \+ transcript evidence/)
})

test('AX demo scenario matrix documents local agent config posture as a new risk surface', () => {
  const matrix = readMatrix()

  const requiredFixturePaths = [
    'examples/claude-desktop-config.json',
    'examples/cursor-mcp.json',
    'examples/codex-transcript.jsonl',
  ] as const

  for (const fixturePath of requiredFixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.ok(matrix.includes(fixturePath), `${fixturePath} should be documented`)
  }

  const requiredCommands = [
    'agentguard scan-mcp < examples/claude-desktop-config.json',
    'agentguard scan-mcp < examples/cursor-mcp.json',
    'agentguard scan-log < examples/codex-transcript.jsonl',
  ] as const

  for (const command of requiredCommands) {
    assert.ok(matrix.includes(command), `${command} should be documented exactly`)
  }

  assert.match(matrix, /Claude Desktop/)
  assert.match(matrix, /Cursor/)
  assert.match(matrix, /JSONL/)
})

test('AX demo scenario matrix does not claim fake adoption, certification, or broad coverage', () => {
  const matrix = readMatrix()

  assert.doesNotMatch(matrix, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(matrix, /SOC\s*2|ISO\s*27001|공식\s*인증|certified/i)
  assert.doesNotMatch(matrix, /(?:full|complete|전체)\s+(?:OWASP|MCP|coverage|conformance|준수|커버리지)/i)
  assert.doesNotMatch(matrix, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+platform/i)
})
