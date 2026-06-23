import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import YAML from 'yaml'

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
  assert.match(stepText, /severity === 'critical'/)
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
