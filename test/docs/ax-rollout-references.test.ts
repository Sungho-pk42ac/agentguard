import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const referenceDocPath = join(repoRoot, 'docs', 'ax-rollout-references.md')
const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

test('AX rollout references doc exists and is linked from public docs', () => {
  assert.ok(existsSync(referenceDocPath), 'docs/ax-rollout-references.md should exist')

  const readmeLinksReferenceDoc = /\[AX Rollout references\]\(docs\/ax-rollout-references\.md\)/.test(rootReadme)
  const examplesLinksReferenceDoc = /\[AX Rollout references\]\(ax-rollout-references\.md\)/.test(examplesDoc)

  assert.ok(readmeLinksReferenceDoc || examplesLinksReferenceDoc, 'README.md or docs/examples.md should link the reference doc')
})

test('AX rollout references doc cites public references and judging implications', () => {
  const referenceDoc = readFileSync(referenceDocPath, 'utf8')

  const requiredReferences = [
    'https://hackathon.jocodingax.ai/',
    'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
    'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
    'https://github.com/snyk/agent-scan',
    'https://github.com/Tencent/AI-Infra-Guard',
    'https://github.com/splx-ai/agentic-radar',
    'https://github.com/affaan-m/agentshield',
  ]

  for (const referenceUrl of requiredReferences) {
    assert.match(referenceDoc, new RegExp(escapeRegExp(referenceUrl)))
  }

  assert.match(referenceDoc, /비교|차별/)
  assert.match(referenceDoc, /\|\s*Reference\s*\|/)
  assert.match(referenceDoc, /Borrow/)
  assert.match(referenceDoc, /Avoid/)
  assert.match(referenceDoc, /AgentGuard action/)
  assert.match(referenceDoc, /현업성/)
  assert.match(referenceDoc, /결과물성/)
  assert.match(referenceDoc, /차별성/)
  assert.match(referenceDoc, /발표력/)
})

test('AX rollout references doc includes the public research refresh with evidence-surface actions', () => {
  const referenceDoc = readFileSync(referenceDocPath, 'utf8')
  const refreshSectionStart = referenceDoc.indexOf('## Public research refresh')

  assert.notEqual(refreshSectionStart, -1, 'docs/ax-rollout-references.md should include the public research refresh section')

  const refreshSection = referenceDoc.slice(refreshSectionStart)
  const requiredRefreshReferences = [
    'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
    'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
    'https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills',
  ]

  for (const referenceUrl of requiredRefreshReferences) {
    assert.match(refreshSection, new RegExp(escapeRegExp(referenceUrl)))
  }

  for (const evidenceSurface of ['SARIF', 'PR diff', 'MCP', 'transcript/log', 'company-problem worksheet']) {
    assert.match(refreshSection, new RegExp(escapeRegExp(evidenceSurface)))
  }

  assert.match(refreshSection, /\|\s*Signal\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
})

test('AX rollout references doc maps target-prize gaps to next evidence slices', () => {
  const referenceDoc = readFileSync(referenceDocPath, 'utf8')
  const gapSectionStart = referenceDoc.indexOf('## Target-prize gap-to-slice table')

  assert.notEqual(gapSectionStart, -1, 'docs/ax-rollout-references.md should include the target-prize gap table')

  const gapSection = referenceDoc.slice(gapSectionStart)
  const requiredGapReferences = [
    'https://github.com/snyk/agent-scan',
    'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
    'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
    'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  ]

  for (const referenceUrl of requiredGapReferences) {
    assert.match(gapSection, new RegExp(escapeRegExp(referenceUrl)))
  }

  assert.match(gapSection, /\|\s*Target-prize gap\s*\|\s*Public signal\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*Next evidence slice\s*\|/)
  assert.match(gapSection, /Snyk `agent-scan`/)
  assert.match(gapSection, /MCP permission\/credential\/consent/)
  assert.match(gapSection, /SARIF rule\/result\/location\/fingerprint/)
  assert.match(gapSection, /OWASP Agentic AI threat\/mitigation/)
  assert.match(gapSection, /English-compatible/)
  assert.match(gapSection, /No fake adoption, certification, unsupported uniqueness, or broad-platform claim/)
})

test('AX rollout references doc avoids fake adoption, certification, and first mover claims', () => {
  const referenceDoc = readFileSync(referenceDocPath, 'utf8')

  assert.doesNotMatch(referenceDoc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(referenceDoc, /SOC\s*2|ISO\s*27001|공식\s*인증|certified/i)
  assert.doesNotMatch(referenceDoc, /업계\s*(?:최초|유일)|first[-\s]?mover|first and only|only\s+(?:scanner|solution|tool)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
