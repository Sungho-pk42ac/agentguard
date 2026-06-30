import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
const koreanReadme = readFileSync(join(repoRoot, 'README.ko.md'), 'utf8')

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

test('README links to the Korean README near the top', () => {
  const linkMatch = rootReadme.match(/\[한국어\]\(\.?\/?README\.ko\.md\)/)

  assert.ok(linkMatch, 'Korean README link should exist in README.md')
  const linkIndex = linkMatch.index ?? -1
  assert.ok(linkIndex >= 0 && linkIndex < 500, 'Korean README link should stay near the top of README.md')
})

test('Korean README positions AgentGuard as Korean-first for agent security teams', () => {
  assert.match(koreanReadme, /한국어 우선 AgentOps 보안 스캐너/)
  assert.match(koreanReadme, /한국 팀/)
  assert.match(koreanReadme, /Codex/)
  assert.match(koreanReadme, /Claude Code/)
  assert.match(koreanReadme, /Hermes/)
  assert.match(koreanReadme, /MCP 설정/)
  assert.match(koreanReadme, /에이전트 트랜스크립트\/로그/)
  assert.match(koreanReadme, /PR diff/)
})

test('Korean README keeps machine-facing contracts English-compatible', () => {
  assert.match(koreanReadme, /런타임 엔진/)
  assert.match(koreanReadme, /리포트 출력/)
  assert.match(koreanReadme, /CLI commands/)
  assert.match(koreanReadme, /rule IDs/)
  assert.match(koreanReadme, /SARIF\/API\/machine fields/)
  assert.match(koreanReadme, /English-compatible/)
  assert.match(koreanReadme, /global-standard/)
  assert.match(koreanReadme, /agentguard scan-files/)
  assert.match(koreanReadme, /agentguard scan-diff/)
  assert.match(koreanReadme, /agentguard scan-mcp/)
  assert.match(koreanReadme, /secret\.github_token/)
  assert.match(koreanReadme, /mcp\.broad_filesystem_access/)
})

test('Korean README does not imply CLI commands or rule IDs are renamed to Korean', () => {
  const agentguardCommands = koreanReadme.match(/`agentguard\s+[^`]+`/g) ?? []

  assert.ok(agentguardCommands.length >= 3, 'Korean README should document untranslated agentguard commands')
  for (const command of agentguardCommands) {
    assert.doesNotMatch(command, /[가-힣]/)
  }

  assert.doesNotMatch(koreanReadme, /(?:CLI|명령어|rule ID|룰 ID|규칙 ID)[^\n]*(?:한국어로|한글로|번역|변경|바뀝)/i)
})
