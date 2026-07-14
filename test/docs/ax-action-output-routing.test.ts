import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const actionDocPath = join(repoRoot, 'docs', 'github-action.md')
const examplesDocPath = join(repoRoot, 'docs', 'examples.md')

const requiredOutputNames = ['conclusion', 'finding-count', 'review-count', 'block-count'] as const
const requiredReferenceUrls = [
  'https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

test('GitHub Action docs include AX output routing contract', () => {
  assert.ok(existsSync(actionDocPath), 'docs/github-action.md should exist')
  const doc = read(actionDocPath)

  assert.match(doc, /## AX approval output routing/)
  for (const name of requiredOutputNames) {
    assert.match(doc, new RegExp('`' + name + '`'), `docs should mention ${name}`)
  }

  assert.match(doc, /finding-count[\s\S]*total non-advisory/i)
  assert.match(doc, /review-count[\s\S]*medium\/high\/critical/i)
  assert.match(doc, /block-count[\s\S]*weighted/i)
  assert.match(doc, /fail-on: block[\s\S]*does not change/i)
  assert.match(doc, /branch protection|required status check/i)
  assert.match(doc, /artifact/i)
  assert.match(doc, /SARIF/i)

  for (const url of requiredReferenceUrls) {
    assert.ok(doc.includes(url), `docs should cite public reference ${url}`)
  }

  const forbiddenClaims = [
    /automatically approves/i,
    /automatic approval/i,
    /replaces security review/i,
    /runtime authorization enforcement/i,
    /same as Snyk/i,
    /same as AI-Infra-Guard/i,
    /same as agentic-radar/i,
  ]
  for (const pattern of forbiddenClaims) {
    assert.doesNotMatch(doc, pattern)
  }
})

test('examples index links the AX action output routing section', () => {
  const examplesDoc = read(examplesDocPath)
  assert.match(examplesDoc, /\[AX GitHub Action output routing\]\(github-action\.md#ax-approval-output-routing\)/)
})
