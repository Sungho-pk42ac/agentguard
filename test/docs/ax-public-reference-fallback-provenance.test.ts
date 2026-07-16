import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-public-reference-fallback-provenance.md')

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/snyk/agent-scan',
  'https://docs.snyk.io/scan-with-snyk/snyk-cli/scan-agentic-workflows',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://www.npmjs.com/package/agent-scan',
  'https://registry.npmjs.org/agent-scan',
  'https://openai.com/index/introducing-agentkit/',
  'https://registry.npmjs.org/agent-security-scanner-mcp',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-fallback-provenance.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
  },
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

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX public reference fallback provenance card exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-public-reference-fallback-provenance.md should exist')

  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(readme, /\[AX public reference fallback provenance card\]\(docs\/ax-public-reference-fallback-provenance\.md\)/)
  assert.match(examplesDoc, /\[AX public reference fallback provenance card\]\(ax-public-reference-fallback-provenance\.md\)/)
})

test('AX public reference fallback provenance card is Korean-first and labels source status boundaries', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX public reference fallback provenance card',
    '## 목적',
    '## Source status labels',
    '## Public reference fallback ledger',
    '## Exact evidence commands',
    '## Machine contracts',
    '## Non-claim guardrails',
    '## 대상권 operator line',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const label of [
    'PUBLIC_FETCH_200',
    'PUBLIC_WAF_403',
    'PUBLIC_NOT_FOUND_404',
    'PUBLIC_REGISTRY_FALLBACK_200',
    'INSANE_SEARCH_UNAVAILABLE',
    'AUTH_REQUIRED_STOP',
    'normal public fetch',
    'WAF/HTTP 403',
    'HTTP 404 / not found',
    'public registry fallback',
    'insane-search unavailable',
    'authenticated content',
    'public fallback evidence',
  ] as const) {
    expectLiteral(doc, label)
  }
})

test('AX public reference fallback provenance card cites public sources and keeps borrow avoid action rows', () => {
  const doc = readDoc()

  for (const url of publicReferenceUrls) expectLiteral(doc, url)

  assert.match(doc, /\|\s*Public reference\s*\|\s*Source status this run\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  for (const term of [
    'Agentic AI - OWASP Lists Threats and Mitigations',
    'Authorization - Model Context Protocol',
    'Security Best Practices - Model Context Protocol',
    'least privilege',
    'explicit user consent',
    'Uploading a SARIF file to GitHub - GitHub Docs',
    'Security scanner for AI agents, MCP servers and agent skills',
    'HTTP 404 from this run; no evidence should be borrowed from the missing Snyk docs URL',
    'A full-stack AI Red Teaming platform securing AI ecosystems',
    'Detect suspicious AI agents activities on GitHub',
    'latest version `0.0.1`',
    'OpenAI AgentKit public page',
    'PUBLIC_WAF_403`; HTTP 403 from this Hermes environment; no AgentKit page content was read',
    'agent-security-scanner-mcp',
    'latest version `4.4.12`',
    'npm audit for AI agents and MCP servers',
    'Claude Code, Cursor, Windsurf, Cline, OpenClaw, and CI',
    'category pressure',
    'Korean-first rollout approval evidence',
  ] as const) {
    expectLiteral(doc, term)
  }
})

test('AX public reference fallback provenance card uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixture of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixture)), `${fixture} should exist`)
      expectLiteral(doc, fixture)
    }
  }

  for (const lane of ['PR diff', 'MCP config', 'transcript/log', 'SARIF artifact', 'smoke manifest'] as const) {
    expectLiteral(doc, lane)
  }
})

test('AX public reference fallback provenance card preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'agentguard doctor',
    '--policy',
    '--sarif',
    '--out',
    '--json',
    '--lang en',
    'PASS',
    'REVIEW',
    'BLOCK',
    'JSON/SARIF fields',
    'rule IDs',
    'GitHub Action inputs/outputs',
  ] as const) {
    expectLiteral(doc, contract)
  }
})

test('AX public reference fallback provenance card rejects unsupported adoption, certification, parity, and runtime claims', () => {
  const doc = readDoc()
  const linesToScan = doc
    .split('\n')
    .filter((line) => !/^(?:\| |-|## Non-claim guardrails|no )/.test(line.trim()))
    .join('\n')

  for (const requiredGuardrail of [
    'no customer/adoption claim',
    'no external certification',
    'no scanner parity/replacement claim',
    'no runtime authorization claim',
    'no automatic SARIF upload claim',
    'no insane-search overclaim',
  ] as const) {
    expectLiteral(doc, requiredGuardrail)
  }

  assert.doesNotMatch(linesToScan, /(?:actual|real)\s+customer|실고객|도입\s*(?:완료|사례)|customer adoption/i)
  assert.doesNotMatch(linesToScan, /SOC\s*2|ISO[-\s]*27001|certified|certification|공식\s*인증/i)
  assert.doesNotMatch(linesToScan, /(?:agent-scan|AI-Infra-Guard|public scanners?)[^\n]{0,120}(?:replacement|parity|대체|동등|equivalent)/i)
  assert.doesNotMatch(linesToScan, /runtime[^\n]{0,120}(?:OAuth|authorization|session|consent)[^\n]{0,120}(?:enforcement|guarantee|보장|지원)/i)
})
