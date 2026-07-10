import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import YAML from 'yaml'

const ACTION_PATHS = ['action.yml', '.github/actions/agentguard/action.yml'] as const
const SAFE_POLICY_PATHS = ['', 'examples/agent-policy.yaml', 'policies/team.yaml'] as const
const UNSAFE_POLICY_PATHS = [
  'C:/tmp/policy.yaml',
  '..',
  '../policy.yaml',
  'policies/../secret.yaml',
  'policies/team.yaml\nconclusion=pass',
  'policies/team.yaml\tbackup',
  'policies/team.yaml\u0007',
] as const

function scanRunFor(actionPath: string): string {
  const action = YAML.parse(readFileSync(actionPath, 'utf8'))
  const scanStep = action.runs.steps.find((step: { id?: string }) => step.id === 'scan')
  assert.ok(scanStep)
  return scanStep.run as string
}

function policyPathValidationExit(actionPath: string, candidate: string): { readonly status: number | null; readonly stderr: string } {
  const scanRun = scanRunFor(actionPath)
  const artifactMatch = scanRun.match(/validate_artifact_path\(\) \{[\s\S]*?\n\s*\}/)
  const policyMatch = scanRun.match(/validate_policy_path\(\) \{[\s\S]*?\n\s*\}/)
  assert.ok(artifactMatch, `${actionPath} should define validate_artifact_path()`)
  assert.ok(policyMatch, `${actionPath} should define validate_policy_path()`)

  const script = `${artifactMatch[0]}\n${policyMatch[0]}\nvalidate_policy_path "$AG_POLICY_PATH"`
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AG_POLICY_PATH: candidate,
      MSYS2_ARG_CONV_EXCL: '*',
      MSYS2_ENV_CONV_EXCL: 'AG_POLICY_PATH',
    },
  })
  return { status: result.status, stderr: result.stderr }
}

test('policy-path validation is wired before diff and scanner commands in both GitHub Actions', () => {
  for (const actionPath of ACTION_PATHS) {
    const scanRun = scanRunFor(actionPath)
    const assignmentIndex = scanRun.indexOf('policy_path="$POLICY_PATH"')
    const invocationIndex = scanRun.indexOf('validate_policy_path "$policy_path"')
    const scannerIndex = scanRun.indexOf('scan-diff "${policy_args[@]}"')

    assert.match(scanRun, /\/\*\|\[A-Za-z\]:\*\)/, `${actionPath}: policy-path validation should reject POSIX and Windows absolute paths`)
    assert.ok(assignmentIndex >= 0, `${actionPath}: policy_path assignment should exist`)
    assert.ok(invocationIndex > assignmentIndex, `${actionPath}: policy-path validation should run after assignment`)
    assert.ok(invocationIndex < scanRun.indexOf('rm -f --'), `${actionPath}: policy-path validation should run before rm`)
    assert.ok(invocationIndex < scanRun.indexOf('mkdir -p --'), `${actionPath}: policy-path validation should run before mkdir`)
    assert.ok(invocationIndex < scanRun.indexOf('git diff --no-ext-diff'), `${actionPath}: policy-path validation should run before git diff`)
    assert.ok(scannerIndex >= 0, `${actionPath}: scanner command should exist`)
    assert.ok(invocationIndex < scannerIndex, `${actionPath}: policy-path validation should run before scanner`)
  }
})

test('policy-path validation accepts empty and workspace-relative paths in both GitHub Actions', () => {
  for (const actionPath of ACTION_PATHS) {
    for (const policyPath of SAFE_POLICY_PATHS) {
      assert.equal(policyPathValidationExit(actionPath, policyPath).status, 0, `${actionPath} should allow ${policyPath}`)
    }
  }
})

test('policy-path validation rejects unsafe paths in both GitHub Actions', () => {
  for (const actionPath of ACTION_PATHS) {
    for (const policyPath of UNSAFE_POLICY_PATHS) {
      const result = policyPathValidationExit(actionPath, policyPath)
      assert.equal(result.status, 2, `${actionPath} should reject ${JSON.stringify(policyPath)}`)
      assert.match(result.stderr, /policy-path: .*must/)
    }
  }
})
