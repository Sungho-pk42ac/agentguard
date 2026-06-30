import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const scenarioRoot = join(repoRoot, 'examples', 'enterprise-scenarios')
const requiredScenarios = [
  'commerce-voc-agent',
  'finance-audit-agent',
  'hr-recruiting-agent',
  'travel-reservation-agent',
] as const
const requiredFiles = [
  'README.md',
  'risky-pr.diff',
  'risky-mcp.json',
  'agent-transcript.log',
  'expected-approval-report.md',
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

function readScenarioFile(scenarioName: string, fileName: string): string {
  return readFileSync(join(scenarioRoot, scenarioName, fileName), 'utf8')
}

test('enterprise AX rollout scenarios include a complete Korean approval-demo pack', () => {
  assert.ok(existsSync(scenarioRoot), 'enterprise-scenarios directory should exist')
  const scenarios = readdirSync(scenarioRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  for (const scenarioName of requiredScenarios) {
    assert.ok(scenarios.includes(scenarioName), `${scenarioName} scenario should exist`)
    for (const fileName of requiredFiles) {
      assert.ok(existsSync(join(scenarioRoot, scenarioName, fileName)), `${scenarioName}/${fileName} should exist`)
    }

    const scenarioReadme = readScenarioFile(scenarioName, 'README.md')
    const expectedReport = readScenarioFile(scenarioName, 'expected-approval-report.md')

    assert.match(scenarioReadme, /AX Rollout Guard/)
    assert.match(scenarioReadme, /BLOCK → 정책\/수정 조건 → PASS/)
    assert.match(scenarioReadme, /agentguard scan-diff/)
    assert.match(scenarioReadme, /agentguard scan-mcp/)
    assert.match(scenarioReadme, /agentguard scan-log/)

    assert.match(expectedReport, /# AX Rollout Guard 승인 리포트/)
    assert.match(expectedReport, /업무 영향/)
    assert.match(expectedReport, /배포 조건/)
    assert.match(expectedReport, /승인 체크리스트/)
    assert.match(expectedReport, /판정: BLOCK/)
  }

  const commerceReadme = readScenarioFile('commerce-voc-agent', 'README.md')
  const financeReadme = readScenarioFile('finance-audit-agent', 'README.md')
  const hrRecruitingReadme = readScenarioFile('hr-recruiting-agent', 'README.md')
  const travelReadme = readScenarioFile('travel-reservation-agent', 'README.md')
  assert.match(commerceReadme, /커머스 VOC/)
  assert.match(financeReadme, /재무 감사|감사 증빙/)
  assert.match(hrRecruitingReadme, /HR|인사|채용|recruiting|candidate|지원자/i)
  assert.match(travelReadme, /여행|예약|노선|좌석|취소|환불/)
})

test('enterprise scenario fixtures stay synthetic and do not claim fake adoption', () => {
  const combined = requiredScenarios
    .flatMap((scenarioName) => requiredFiles.map((fileName) => readScenarioFile(scenarioName, fileName)))
    .join('\n')

  assert.doesNotMatch(combined, /실제 고객|고객사|도입 완료|certified|SOC 2|ISO 27001/i)
  assert.doesNotMatch(combined, /sk-[A-Za-z0-9_-]{20,}/)
  assert.doesNotMatch(combined, /gh[pousr]_[A-Za-z0-9]{20,}/)
  assert.doesNotMatch(combined, /github_pat_[A-Za-z0-9_]{30,}/)
  assert.doesNotMatch(combined, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  assert.doesNotMatch(combined, /010-?\d{4}-?\d{4}/)
})
