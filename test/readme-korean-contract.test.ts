import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
const englishReadme = readFileSync(join(repoRoot, 'README.en.md'), 'utf8')
const terminalDemoSvg = readFileSync(join(repoRoot, 'docs/agentguard-terminal-demo.svg'), 'utf8')

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

test('root README is the Korean-first entry point and links to English near the top', () => {
  const linkMatch = rootReadme.match(/\[English\]\(\.?\/?README\.en\.md\)/)

  assert.ok(linkMatch, 'English README link should exist in README.md')
  const linkIndex = linkMatch.index ?? -1
  assert.ok(linkIndex >= 0 && linkIndex < 500, 'English README link should stay near the top of README.md')
  assert.doesNotMatch(rootReadme.slice(0, 1000), /Security scanner for AI coding agents/)
})

test('root README positions AgentGuard as Korean-first for agent security teams', () => {
  assert.match(rootReadme, /한국어 우선 AgentOps 보안 스캐너/)
  assert.match(rootReadme, /한국 팀/)
  assert.match(rootReadme, /Codex/)
  assert.match(rootReadme, /Claude Code/)
  assert.match(rootReadme, /Hermes/)
  assert.match(rootReadme, /MCP 설정/)
  assert.match(rootReadme, /에이전트 트랜스크립트\/로그/)
  assert.match(rootReadme, /PR diff/)
})

test('root README keeps machine-facing contracts English-compatible', () => {
  assert.match(rootReadme, /런타임 엔진/)
  assert.match(rootReadme, /리포트 출력/)
  assert.match(rootReadme, /CLI commands/)
  assert.match(rootReadme, /rule IDs/)
  assert.match(rootReadme, /SARIF\/API\/machine fields/)
  assert.match(rootReadme, /English-compatible/)
  assert.match(rootReadme, /global-standard/)
  assert.match(rootReadme, /agentguard scan-files/)
  assert.match(rootReadme, /agentguard scan-diff/)
  assert.match(rootReadme, /agentguard scan-mcp/)
  assert.match(rootReadme, /secret\.github_token/)
  assert.match(rootReadme, /mcp\.broad_filesystem_access/)
})

test('root README terminal demo is Korean-first while preserving English-compatible output fields', () => {
  assert.match(rootReadme, /alt="[^"]*한국어-first 터미널 데모[^"]*"/)
  assert.match(terminalDemoSvg, /AgentGuard 한국어-first 터미널 데모/)
  assert.match(terminalDemoSvg, /한국 팀을 위한 에이전트 보안 점검/)
  assert.match(terminalDemoSvg, /CLI \/ verdict \/ rule IDs \/ SARIF fields는 English-compatible/)
  assert.match(terminalDemoSvg, /Verdict: BLOCK/)
  assert.match(terminalDemoSvg, /Severity/)
  assert.match(terminalDemoSvg, /mcp-risk/)
})

test('root README does not imply CLI commands or rule IDs are renamed to Korean', () => {
  const agentguardCommands = rootReadme.match(/`agentguard\s+[^`]+`/g) ?? []

  assert.ok(agentguardCommands.length >= 3, 'Korean README should document untranslated agentguard commands')
  for (const command of agentguardCommands) {
    assert.doesNotMatch(command, /[가-힣]/)
  }

  assert.doesNotMatch(rootReadme, /(?:CLI|명령어|rule ID|룰 ID|규칙 ID)[^\n]*(?:한국어로|한글로|번역|변경|바뀝)/i)
})

test('English README is available as the secondary language document', () => {
  assert.match(englishReadme, /\[한국어\]\(README\.md\)/)
  assert.match(englishReadme, /Security scanner for AI coding agents/)
})
