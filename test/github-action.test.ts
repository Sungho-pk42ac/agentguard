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
