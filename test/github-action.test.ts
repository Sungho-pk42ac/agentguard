import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import YAML from 'yaml'

function actionConclusion(actionPath: string, findings: readonly Record<string, unknown>[]): string {
  const action = YAML.parse(readFileSync(actionPath, 'utf8'))
  const scanStep = action.runs.steps.find((step: { id?: string }) => step.id === 'scan')
  assert.ok(scanStep)
  const scanRun = scanStep.run as string
  const match = scanRun.match(/conclusion=\$\(node --input-type=module -e "([\s\S]*?)" -- "\$json_path"\)/)
  assert.ok(match, 'action should compute conclusion from JSON findings with node -e')

  const dir = mkdtempSync(join(tmpdir(), 'agentguard-action-verdict-'))
  try {
    const jsonPath = join(dir, 'findings.json')
    writeFileSync(jsonPath, JSON.stringify(findings), 'utf8')
    return execFileSync(process.execPath, ['--input-type=module', '-e', match[1], '--', jsonPath], { encoding: 'utf8' }).trim()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('published GitHub Action exposes a team-ready PR gate contract', () => {
  const action = YAML.parse(readFileSync('action.yml', 'utf8'))

  assert.equal(action.name, 'AgentGuard')
  assert.equal(action.inputs['base-sha'].required, true)
  assert.equal(action.inputs['head-sha'].required, true)
  assert.equal(action.inputs['fail-on'].default, 'block')
  assert.equal(action.inputs['sarif-path'].default, 'agentguard.sarif')
  assert.equal(action.outputs['conclusion'].value, '${{ steps.scan.outputs.conclusion }}')
  assert.equal(action.outputs['report-path'].value, '${{ steps.scan.outputs.report-path }}')
  assert.equal(action.outputs['sarif-path'].value, '${{ steps.scan.outputs.sarif-path }}')

  const stepText = JSON.stringify(action.runs.steps)
  const scanStep = action.runs.steps.find((step: { id?: string }) => step.id === 'scan')
  assert.ok(scanStep)
  const scanRun = scanStep.run as string

  assert.match(stepText, /npx --yes/)
  assert.ok(scanRun.includes('if [[ ! "$BASE_SHA" =~ ^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$ ]]'))
  assert.match(scanRun, /base-sha must be a 40 or 64-character commit SHA/)
  assert.ok(scanRun.includes('if [[ ! "$HEAD_SHA" =~ ^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$ ]]'))
  assert.match(scanRun, /head-sha must be a 40 or 64-character commit SHA/)
  assert.match(scanRun, /git diff --no-ext-diff --unified=0 "\$BASE_SHA" "\$HEAD_SHA"/)
  assert.match(scanRun, /"\$\{agentguard_cmd\[@\]\}" scan-diff "\$\{policy_args\[@\]\}" --json --out "\$json_path"/)
  assert.match(scanRun, /"\$\{agentguard_cmd\[@\]\}" scan-diff "\$\{policy_args\[@\]\}" --sarif --out "\$sarif_path"/)
  assert.match(scanRun, /GITHUB_STEP_SUMMARY/)
  assert.match(scanRun, /fail_on/)
  assert.match(scanRun, /const weight = \{ low: 1, medium: 2, high: 3, critical: 4 \}/)
  assert.match(scanRun, /filter\(\(finding\) => !finding\.advisory\)/)
  assert.match(scanRun, /score >= 8/)
  assert.doesNotMatch(scanRun, /severity === 'critical'/)
  assert.ok(scanRun.includes('[[ "$conclusion" == "block" && "$fail_on" =~ ^(block|review)$ ]]'))
  assert.doesNotMatch(scanRun, /node dist\/index\.js/)
})

test('legacy local action uses the same risk-score verdict as the CLI', () => {
  const action = YAML.parse(readFileSync('.github/actions/agentguard/action.yml', 'utf8'))
  const scanStep = action.runs.steps.find((step: { id?: string }) => step.id === 'scan')
  assert.ok(scanStep)
  const scanRun = scanStep.run as string

  assert.match(scanRun, /const weight = \{ low: 1, medium: 2, high: 3, critical: 4 \}/)
  assert.match(scanRun, /filter\(\(finding\) => !finding\.advisory\)/)
  assert.match(scanRun, /score >= 8/)
  assert.doesNotMatch(scanRun, /severity === 'critical'/)
})

test('team adoption docs provide copy-paste reusable action workflow', () => {
  const docs = readFileSync('docs/github-action.md', 'utf8')

  assert.match(docs, /uses: Sungho-pk42ac\/agentguard@main/)
  assert.match(docs, /fail-on: block/)
  assert.match(docs, /sarif-path: agentguard\.sarif/)
  assert.match(docs, /github\/codeql-action\/upload-sarif@v3/)
  assert.match(docs, /body-path: agent-risk-report\.md/)
  assert.match(docs, /permissions:[\s\S]*contents: read[\s\S]*pull-requests: write[\s\S]*security-events: write/)
})

test('published and local actions compute conclusions from score-based non-advisory risk', () => {
  const cases: ReadonlyArray<readonly [string, readonly Record<string, unknown>[], string]> = [
    ['empty findings pass', [], 'pass'],
    ['advisory critical does not gate', [{ severity: 'critical', advisory: true }], 'pass'],
    ['one critical remains review because score is below block threshold', [{ severity: 'critical' }], 'review'],
    ['two critical findings block', [{ severity: 'critical' }, { severity: 'critical' }], 'block'],
    ['mixed high and critical below threshold reviews', [{ severity: 'high' }, { severity: 'critical' }], 'review'],
    ['three high findings block', [{ severity: 'high' }, { severity: 'high' }, { severity: 'high' }], 'block'],
  ]

  for (const [name, findings, expected] of cases) {
    assert.equal(actionConclusion('action.yml', findings), expected, `published action: ${name}`)
    assert.equal(actionConclusion('.github/actions/agentguard/action.yml', findings), expected, `local action: ${name}`)
  }
})

test('GitHub Action exposes PR diff report artifact/comment contract', () => {
  const actionPath = '.github/actions/agentguard/action.yml'
  assert.equal(existsSync(actionPath), true)

  const action = YAML.parse(readFileSync(actionPath, 'utf8'))
  assert.equal(action.name, 'AgentGuard PR diff scan')
  assert.equal(action.outputs['report-path'].description, 'Path to the markdown AgentGuard report artifact')
  assert.equal(action.outputs['json-path'].description, 'Path to the JSON AgentGuard findings artifact')
  assert.equal(action.outputs['json-path'].value, '${{ steps.scan.outputs.json-path }}')
  assert.equal(action.outputs['conclusion'].description, 'pass, review, or block based on AgentGuard findings')

  const stepText = JSON.stringify(action.runs.steps)
  const scanStep = action.runs.steps.find((step: { id?: string }) => step.id === 'scan')
  assert.ok(scanStep)
  const scanRun = scanStep.run as string
  assert.match(stepText, /git diff/)
  assert.match(stepText, /agent-risk-report\.md/)
  assert.match(stepText, /GITHUB_STEP_SUMMARY/)
  assert.match(stepText, /const weight = \{ low: 1, medium: 2, high: 3, critical: 4 \}/)
  assert.match(stepText, /filter\(\(finding\) => !finding\.advisory\)/)
  assert.ok(scanRun.includes('if [[ ! "$BASE_SHA" =~ ^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$ ]]'))
  assert.match(scanRun, /base-sha must be a 40 or 64-character commit SHA/)
  assert.ok(scanRun.includes('if [[ ! "$HEAD_SHA" =~ ^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$ ]]'))
  assert.match(scanRun, /head-sha must be a 40 or 64-character commit SHA/)
  assert.match(scanRun, /BASE_SHA/)
  assert.match(scanRun, /HEAD_SHA/)
  assert.match(scanRun, /echo "json-path=\$json_path"/)
  assert.match(scanRun, /" -- "\$json_path"\)/)
  assert.match(scanRun, /rm -f -- "\$report_path" "\$json_path"/)
  assert.match(scanRun, /mkdir -p -- "\$\(dirname -- "\$report_path"\)"/)
  assert.match(scanRun, /mkdir -p -- "\$\(dirname -- "\$json_path"\)"/)
  assert.match(scanRun, /\[\[ ! -s "\$json_path" \]\]/)
  assert.match(scanRun, /\[\[ ! -s "\$report_path" \]\]/)
  assert.match(scanRun, /AgentGuard did not create the JSON findings artifact/)
  assert.match(scanRun, /AgentGuard did not create the markdown report artifact/)
  assert.doesNotMatch(scanRun, /inputs\.base-sha.*inputs\.head-sha/)
  assert.doesNotMatch(stepText, /process\.exit\(1\).*review/i)
})

test('README workflow still uploads and comments the report when AgentGuard blocks', () => {
  const readme = readFileSync('README.md', 'utf8')

  assert.match(readme, /Upload AgentGuard report[\s\S]*if: \$\{\{ !cancelled\(\) \}\}/)
  assert.match(readme, /Comment AgentGuard report on PR[\s\S]*if: \$\{\{ !cancelled\(\) \}\}/)
})

test('README documents copy-paste PR comment workflow using the local action', () => {
  const readme = readFileSync('README.md', 'utf8')

  assert.match(readme, /uses: \.\/\.github\/actions\/agentguard/)
  assert.match(readme, /actions\/upload-artifact@v4/)
  assert.match(readme, /peter-evans\/create-or-update-comment@v4/)
  assert.match(readme, /agent-risk-report\.md/)
  assert.match(readme, /github\.event\.pull_request\.base\.sha/)
})

test('README documents SARIF upload workflow and sample output', () => {
  const readme = readFileSync('README.md', 'utf8')

  assert.match(readme, /node dist\/index\.js scan-diff --sarif --out agentguard\.sarif/)
  assert.match(readme, /github\/codeql-action\/upload-sarif@v3/)
  assert.match(readme, /sarif_file: agentguard\.sarif/)
  assert.match(readme, /examples\/agentguard\.sarif/)

  const sample = JSON.parse(readFileSync('examples/agentguard.sarif', 'utf8'))
  assert.equal(sample.version, '2.1.0')
  assert.equal(sample.runs[0].tool.driver.name, 'AgentGuard')
  assert.equal(sample.runs[0].tool.driver.rules[0].id, 'github-token')
})
