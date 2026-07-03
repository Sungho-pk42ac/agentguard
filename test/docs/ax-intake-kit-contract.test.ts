import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const kitPath = join(repoRoot, 'docs', 'ax-company-problem-intake-kit.md')

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    const hasPackage = existsSync(join(currentDir, 'package.json'))
    const hasDocs = existsSync(join(currentDir, 'docs'))
    const hasTests = existsSync(join(currentDir, 'test'))
    if (hasPackage && hasDocs && hasTests) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

function readKit(): string {
  return readFileSync(kitPath, 'utf8')
}

test('AX company problem intake kit exists and is linked from reviewer-facing docs', () => {
  assert.ok(existsSync(kitPath), 'docs/ax-company-problem-intake-kit.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
  const readmeLinksKit = /\[AX company problem intake kit\]\(docs\/ax-company-problem-intake-kit\.md\)/.test(rootReadme)
  const examplesLinksKit = /\[AX company problem intake kit\]\(ax-company-problem-intake-kit\.md\)/.test(examplesDoc)

  assert.ok(readmeLinksKit || examplesLinksKit, 'README.md or docs/examples.md should link the intake kit')
})

test('AX company problem intake kit covers the required adaptation sections', () => {
  const kit = readKit()

  const requiredHeadings = [
    '## 사용 목적',
    '## 입력 카드',
    '## 변환 절차',
    '## 산출물 템플릿',
    '## 예선과 본선 구분 (Prelim vs final)',
    '## 운영 가드레일 (Guardrails)',
    '## 30초 데모 스크립트',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(kit, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  const requiredContractTerms = [
    '업무 워크플로',
    '에이전트/도구 surface',
    '위험 입력',
    'AgentGuard commands',
    'BLOCK → 수정/정책 → PASS',
    '승인 리포트',
    '승인 조건',
    '배포 승인',
  ] as const

  for (const term of requiredContractTerms) {
    assert.match(kit, new RegExp(escapeRegExp(term)))
  }
})

test('AX company problem intake kit uses AX references without unsupported claims', () => {
  const kit = readKit()

  assert.match(kit, /AX 인재전쟁/)
  assert.match(kit, /6시간\s*현장\s*적응/)
  assert.match(kit, /https:\/\/hackathon\.jocodingax\.ai\//)
  assert.match(kit, /https:\/\/owasp\.org\/www-project-top-10-for-large-language-model-applications\//)
  assert.match(kit, /https:\/\/modelcontextprotocol\.io\/specification\/draft\/basic\/security_best_practices/)
  assert.match(kit, /OWASP/)
  assert.match(kit, /MCP/)
  assert.match(kit, /deterministic rollout gate/)

  assert.doesNotMatch(kit, /(?:certified|verified|audited)\s+(?:by|for)\s+OWASP/i)
  assert.doesNotMatch(kit, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+platform/i)
  assert.doesNotMatch(kit, /(?:SOC 2|ISO 27001)\s+(?:certified|compliant|인증|준수)/i)
  assert.doesNotMatch(kit, /(?:실제 고객|고객사)\s*(?:도입|사용|검증|채택)/)
})

test('AX company problem intake kit preserves English-compatible machine contracts', () => {
  const kit = readKit()

  assert.match(kit, /agentguard scan-diff/)
  assert.match(kit, /agentguard scan-mcp/)
  assert.match(kit, /agentguard scan-log/)
  assert.match(kit, /secret\.github_token/)
  assert.match(kit, /mcp\.broad_filesystem_access/)
  assert.match(kit, /SARIF/)
  assert.doesNotMatch(kit, /(?:CLI|rule ID|machine field)[^\n]*(?:한국어로|한글로|번역|변경|바뀜)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
