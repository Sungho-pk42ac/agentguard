import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const demoDocPath = join(repoRoot, 'docs', 'ax-before-after-rollout-demo.md')
const riskyFixturePath = 'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json'
const fixedFixturePath = 'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json'
const riskyPrDiffFixturePath = 'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff'
const fixedPrDiffFixturePath = 'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff'
const readonlyExportReadmePath =
  'examples/ax-rollout-before-after/commerce-voc-mcp/readonly-voc-export/README.md'
const fixturePaths = [riskyFixturePath, fixedFixturePath, riskyPrDiffFixturePath, fixedPrDiffFixturePath] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

function readDemoDoc(): string {
  return readFileSync(demoDocPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function runScanDiff(fixturePath: string): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'scan-diff'], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: readFileSync(join(repoRoot, fixturePath), 'utf8'),
    timeout: 10_000,
  })

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

test('AX before/after rollout demo doc exists and is linked from public docs', () => {
  assert.ok(existsSync(demoDocPath), 'docs/ax-before-after-rollout-demo.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const englishReadme = readFileSync(join(repoRoot, 'README.en.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX before\/after rollout demo\]\(docs\/ax-before-after-rollout-demo\.md\)/)
  assert.match(englishReadme, /\[AX before\/after rollout demo\]\(docs\/ax-before-after-rollout-demo\.md\)/)
  assert.match(examplesDoc, /\[AX before\/after rollout demo\]\(ax-before-after-rollout-demo\.md\)/)
})

test('AX before/after rollout demo uses existing risky and fixed fixtures', () => {
  const demoDoc = readDemoDoc()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(demoDoc, fixturePath)
  }
  assert.ok(existsSync(join(repoRoot, readonlyExportReadmePath)), `${readonlyExportReadmePath} should exist`)

  const requiredCommands = [
    `node dist/index.js scan-mcp < ${riskyFixturePath}`,
    `node dist/index.js scan-mcp < ${fixedFixturePath}`,
    `node dist/index.js scan-diff < ${riskyPrDiffFixturePath}`,
    `node dist/index.js scan-diff < ${fixedPrDiffFixturePath}`,
  ] as const

  for (const command of requiredCommands) {
    expectLiteral(demoDoc, command)
  }
})

test('AX before/after rollout PR diff fixtures reproduce REVIEW then PASS with the built CLI', () => {
  const riskyResult = runScanDiff(riskyPrDiffFixturePath)
  const fixedResult = runScanDiff(fixedPrDiffFixturePath)

  assert.equal(riskyResult.status, 1, riskyResult.stderr)
  assert.match(riskyResult.stdout, /\*\*판정:\*\*\s*REVIEW|\*\*Verdict:\*\*\s*REVIEW/)
  assert.match(riskyResult.stdout, /generic-secret-assignment|하드코딩된 secret assignment/)
  assert.match(riskyResult.stdout, /Email address|이메일|PII/i)

  assert.equal(fixedResult.status, 0, fixedResult.stderr)
  assert.match(fixedResult.stdout, /\*\*판정:\*\*\s*PASS|\*\*Verdict:\*\*\s*PASS/)
  assert.match(fixedResult.stdout, /탐지 건수:\*\*\s*0|Findings:\*\*\s*0/)
})

test('AX before/after rollout demo tells a Korean approval story without changing machine contracts', () => {
  const demoDoc = readDemoDoc()

  for (const term of [
    '회사 문제',
    'risk evidence',
    'BLOCK',
    '수정/정책',
    'PASS',
    'MCP config',
    'mcp.broad_filesystem_access',
    'mcp.filesystem_writable_path',
    'agentguard scan-mcp',
    '회사 문제 → risky agent PR diff → AgentGuard REVIEW/BLOCK evidence → fixed diff → PASS',
    'PR diff',
    'agentguard scan-diff',
    'node dist/index.js scan-diff',
    'config를 evidence로 파싱',
  ] as const) {
    expectLiteral(demoDoc, term)
  }

  assert.match(demoDoc, /^## Before: 위험 fixture/m)
  assert.match(demoDoc, /^## After: 수정\/정책 fixture/m)
  assert.match(demoDoc, /^## PR diff Before: 위험 fixture/m)
  assert.match(demoDoc, /^## PR diff After: 수정 fixture/m)
  assert.match(demoDoc, /\*\*판정:\*\*\s*BLOCK|\*\*Verdict:\*\*\s*BLOCK/)
  assert.match(demoDoc, /\*\*판정:\*\*\s*PASS|\*\*Verdict:\*\*\s*PASS/)
})

test('AX before/after rollout demo avoids fake adoption, certification, and customer claims', () => {
  const combined = [
    readDemoDoc(),
    ...fixturePaths.map((fixturePath) => readFileSync(join(repoRoot, fixturePath), 'utf8')),
  ].join('\n')

  assert.doesNotMatch(combined, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(combined, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(combined, /(?:full|complete|전체)\s+(?:platform|red[-\s]?team|coverage|커버리지|플랫폼)/i)
  assert.doesNotMatch(combined, /sk-[A-Za-z0-9_-]{20,}/)
  assert.doesNotMatch(combined, /gh[pousr]_[A-Za-z0-9]{20,}/)
  assert.doesNotMatch(combined, /github_pat_[A-Za-z0-9_]{30,}/)
})
