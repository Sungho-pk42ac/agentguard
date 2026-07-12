import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import YAML from 'yaml'

function scanRunFor(actionPath: string): string {
  const action = YAML.parse(readFileSync(actionPath, 'utf8'))
  const scanStep = action.runs.steps.find((step: { id?: string }) => step.id === 'scan')
  assert.ok(scanStep)
  return scanStep.run as string
}

function actionConclusion(actionPath: string, findings: readonly Record<string, unknown>[]): string {
  const scanRun = scanRunFor(actionPath)
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

function packageVersionValidationExit(candidate: string): { status: number | null; stderr: string } {
  const scanRun = scanRunFor('action.yml')
  const match = scanRun.match(/validate_package_version\(\) \{[\s\S]*?\n\s*\}/)
  assert.ok(match, 'action should define validate_package_version()')

  const result = spawnSync('bash', ['-c', `${match[0]}\nvalidate_package_version "$1"`, '_', candidate], {
    encoding: 'utf8',
  })
  return { status: result.status, stderr: result.stderr }
}

function artifactPathValidationExit(
  actionPath: string,
  candidate: string,
  inputName = 'report-path',
): { status: number | null; stderr: string } {
  const scanRun = scanRunFor(actionPath)
  const match = scanRun.match(/validate_artifact_path\(\) \{[\s\S]*?\n[}]/)
  assert.ok(match, `${actionPath} should define validate_artifact_path()`)

  const script = `${match[0]}\nvalidate_artifact_path "$AG_CANDIDATE" "$AG_INPUT_NAME"`
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AG_CANDIDATE: candidate,
      AG_INPUT_NAME: inputName,
      MSYS2_ARG_CONV_EXCL: '*',
      MSYS2_ENV_CONV_EXCL: 'AG_CANDIDATE',
    },
  })
  return { status: result.status, stderr: result.stderr }
}

function artifactPathDistinctnessExit(
  actionPath: string,
  reportPath: string,
  jsonPath: string,
  sarifPath: string,
): { status: number | null; stderr: string } {
  const scanRun = scanRunFor(actionPath)
  const match = scanRun.match(/validate_distinct_artifact_paths\(\) \{[\s\S]*?\n[}]/)
  assert.ok(match, `${actionPath} should define validate_distinct_artifact_paths()`)

  const script = `${match[0]}\nvalidate_distinct_artifact_paths "$AG_REPORT_PATH" "$AG_JSON_PATH" "$AG_SARIF_PATH"`
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AG_REPORT_PATH: reportPath,
      AG_JSON_PATH: jsonPath,
      AG_SARIF_PATH: sarifPath,
      MSYS2_ARG_CONV_EXCL: '*',
      MSYS2_ENV_CONV_EXCL: 'AG_REPORT_PATH;AG_JSON_PATH;AG_SARIF_PATH',
    },
  })
  return { status: result.status, stderr: result.stderr }
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

test('published and local GitHub Actions reject unsafe artifact paths before file operations', () => {
  const cases: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['action.yml', ['report_path', 'json_path', 'sarif_path']],
    ['.github/actions/agentguard/action.yml', ['report_path', 'json_path', 'sarif_path']],
  ]

  for (const [actionPath, variables] of cases) {
    const scanRun = scanRunFor(actionPath)
    assert.match(scanRun, /validate_artifact_path\(\)/)
    assert.match(scanRun, /local input_name="\$2"/)
    assert.match(scanRun, /\$input_name: artifact paths must be relative and stay inside the workspace/)
    assert.match(scanRun, /artifact paths must be relative and stay inside the workspace/)
    assert.match(scanRun, /case "\$normalized" in/)
    assert.match(scanRun, /\/\*\|\[A-Za-z\]:\*\)/)

    const validationIndex = scanRun.indexOf('validate_artifact_path()')
    assert.ok(validationIndex >= 0, `${actionPath}: validation function should exist`)
    assert.ok(validationIndex < scanRun.indexOf('rm -f --'), `${actionPath}: validation should run before rm`)
    assert.ok(validationIndex < scanRun.indexOf('mkdir -p --'), `${actionPath}: validation should run before mkdir`)
    assert.ok(validationIndex < scanRun.indexOf('git diff --no-ext-diff'), `${actionPath}: validation should run before git diff`)
    assert.ok(validationIndex < scanRun.indexOf('GITHUB_OUTPUT'), `${actionPath}: validation should run before output emission`)

    for (const variable of variables) {
      const invocation = `validate_artifact_path "$${variable}" "${variable.replace('_path', '-path')}"`
      const invocationIndex = scanRun.indexOf(invocation)
      assert.ok(invocationIndex >= 0, `${actionPath}: ${variable} validation call should exist`)
      assert.ok(invocationIndex < scanRun.indexOf('rm -f --'), `${actionPath}: ${variable} validation call should run before rm`)
      assert.ok(invocationIndex < scanRun.indexOf('mkdir -p --'), `${actionPath}: ${variable} validation call should run before mkdir`)
      assert.ok(invocationIndex < scanRun.indexOf('git diff --no-ext-diff'), `${actionPath}: ${variable} validation call should run before git diff`)
      assert.ok(invocationIndex < scanRun.indexOf('GITHUB_OUTPUT'), `${actionPath}: ${variable} validation call should run before output emission`)
    }
  }
})

test('published and local GitHub Actions reject empty artifact paths', () => {
  const cases: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['action.yml', ['report-path', 'json-path', 'sarif-path']],
    ['.github/actions/agentguard/action.yml', ['report-path', 'json-path', 'sarif-path']],
  ]

  for (const [actionPath, inputNames] of cases) {
    assert.equal(artifactPathValidationExit(actionPath, 'reports/agent-risk-report.md').status, 0)

    for (const inputName of inputNames) {
      const result = artifactPathValidationExit(actionPath, '', inputName)
      assert.equal(result.status, 2, `${actionPath} ${inputName} should reject empty artifact paths`)
      assert.match(result.stderr, new RegExp(`${inputName}: artifact paths must not be empty`))
    }
  }
})

test('published and local GitHub Actions execute artifact path validation for dotted and traversal paths', { skip: process.platform === 'win32' ? 'Git-for-Windows/MSYS rewrites path-like bash arguments before validation' : false }, () => {
  const cases: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['action.yml', ['report-path', 'json-path', 'sarif-path']],
    ['.github/actions/agentguard/action.yml', ['report-path', 'json-path', 'sarif-path']],
  ]
  const safePaths = [
    'reports/v1.2/agent-risk-report.md',
    '.agentguard-demo/agentguard.sarif',
    'reports/v1..2/agent-risk-report.md',
  ] as const
  // POSIX/backslash root absolute paths are covered by the static contract test above.
  // Git-for-Windows/MSYS bash rewrites `/tmp/...` and `\\tmp\\...` before the
  // function sees them, so this executable harness focuses on traversal and
  // Windows drive path forms.
  const unsafePaths = [
    'C:/tmp/report.md',
    'C:\\tmp\\report.md',
    '..',
    '../secret',
    '..\\secret',
    'reports/../secret',
    'reports\\..\\secret',
    'a/..',
    'a\\..',
  ] as const

  for (const [actionPath, inputNames] of cases) {
    for (const safePath of safePaths) {
      assert.equal(artifactPathValidationExit(actionPath, safePath).status, 0, `${actionPath} should allow ${safePath}`)
    }

    for (const inputName of inputNames) {
      for (const unsafePath of unsafePaths) {
        const result = artifactPathValidationExit(actionPath, unsafePath, inputName)
        assert.equal(result.status, 2, `${actionPath} ${inputName} should reject ${unsafePath}`)
        assert.match(result.stderr, new RegExp(`${inputName}: artifact paths must be relative and stay inside the workspace`))
      }
    }
  }
})

test('published and local GitHub Actions reject artifact path control characters', () => {
  const cases: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['action.yml', ['report-path', 'json-path', 'sarif-path']],
    ['.github/actions/agentguard/action.yml', ['report-path', 'json-path', 'sarif-path']],
  ]

  for (const [actionPath, inputNames] of cases) {
    assert.equal(artifactPathValidationExit(actionPath, 'reports/agent-risk-report.md').status, 0)

    for (const inputName of inputNames) {
      for (const unsafe of [
        'reports/agent-risk-report.md\nconclusion=pass',
        'reports/agent-risk-report.md\rconclusion=pass',
        'reports/agent\trisk.md',
      ]) {
        const result = artifactPathValidationExit(actionPath, unsafe, inputName)
        assert.equal(result.status, 2, `${actionPath} ${inputName} should reject control characters`)
        assert.match(result.stderr, new RegExp(`${inputName}: artifact paths must not contain control characters`))
      }
    }
  }
})

test('published and local GitHub Actions reject duplicate artifact paths before scan work', () => {
  const cases = ['action.yml', '.github/actions/agentguard/action.yml'] as const

  for (const actionPath of cases) {
    const scanRun = scanRunFor(actionPath)
    assert.match(scanRun, /validate_distinct_artifact_paths\(\)/)
    assert.match(scanRun, /artifact paths must be distinct/)
    assert.match(scanRun, /local report_candidate="\$\{1\/\/\\\\\/\/\}"/)
    assert.match(scanRun, /local json_candidate="\$\{2\/\/\\\\\/\/\}"/)
    assert.match(scanRun, /local sarif_candidate="\$\{3\/\/\\\\\/\/\}"/)

    const validationIndex = scanRun.indexOf('validate_distinct_artifact_paths "$report_path" "$json_path" "$sarif_path"')
    assert.ok(validationIndex >= 0, `${actionPath}: distinctness validation call should exist`)
    assert.ok(validationIndex < scanRun.indexOf('rm -f --'), `${actionPath}: distinctness validation should run before rm`)
    assert.ok(validationIndex < scanRun.indexOf('mkdir -p --'), `${actionPath}: distinctness validation should run before mkdir`)
    assert.ok(validationIndex < scanRun.indexOf('git diff --no-ext-diff'), `${actionPath}: distinctness validation should run before git diff`)
    assert.ok(validationIndex < scanRun.indexOf('GITHUB_OUTPUT'), `${actionPath}: distinctness validation should run before output emission`)

    assert.equal(
      artifactPathDistinctnessExit(actionPath, 'agent-risk-report.md', 'agent-risk-findings.json', 'agentguard.sarif').status,
      0,
      `${actionPath}: default distinct artifact paths should pass`,
    )

    const duplicateCases: ReadonlyArray<readonly [string, string, string]> = [
      ['same.out', 'same.out', 'agentguard.sarif'],
      ['agent-risk-report.md', 'same.out', 'same.out'],
      ['same.out', 'agent-risk-findings.json', 'same.out'],
      // Executed on POSIX where Bash sees the literal backslash. On Windows,
      // Git-for-Windows/MSYS can rewrite env/path-like values before the
      // extracted Bash guard sees them; static assertions above still pin the
      // action-level slash-normalization contract for the Windows runner.
      ...(process.platform === 'win32' ? [] : ([['reports\\same.out', 'reports/same.out', 'agentguard.sarif']] as const)),
    ]

    for (const [reportPath, jsonPath, sarifPath] of duplicateCases) {
      const result = artifactPathDistinctnessExit(actionPath, reportPath, jsonPath, sarifPath)
      assert.equal(result.status, 2, `${actionPath}: duplicate artifact path combination should fail`)
      assert.match(result.stderr, /artifact paths must be distinct/)
    }
  }
})

test('published GitHub Action validates package-version before constructing npx package spec', () => {
  const scanRun = scanRunFor('action.yml')

  assert.match(scanRun, /validate_package_version\(\)/)
  assert.match(scanRun, /package-version must be a safe npm version or dist-tag/)
  assert.match(scanRun, /case "\$candidate" in/)
  assert.match(scanRun, /\*\[\^0-9A-Za-z._~-\]\*\)/)
  assert.match(scanRun, /validate_package_version "\$package_version"/)

  const validationIndex = scanRun.indexOf('validate_package_version "$package_version"')
  const commandIndex = scanRun.indexOf('agentguard_cmd=(npx --yes "@pk42ac/agentguard@${package_version}")')
  assert.ok(validationIndex >= 0, 'package-version validation call should exist')
  assert.ok(commandIndex >= 0, 'npx package command should still be constructed')
  assert.ok(validationIndex < commandIndex, 'package-version validation should run before constructing npx package spec')
})

test('published GitHub Action package-version validation passes safe versions and rejects unsafe strings', () => {
  for (const safe of ['latest', '0.5.0', '1.2.3-beta.1']) {
    assert.equal(packageVersionValidationExit(safe).status, 0, `${safe} should be accepted`)
  }

  for (const unsafe of ['', 'bad;echo', 'two words', '$VAR', '`id`']) {
    const result = packageVersionValidationExit(unsafe)
    assert.equal(result.status, 2, `${unsafe || '<empty>'} should be rejected`)
    assert.match(result.stderr, /package-version must be a safe npm version or dist-tag/)
  }
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

test('local GitHub Action exposes fail-on gate parity with the published action', () => {
  const action = YAML.parse(readFileSync('.github/actions/agentguard/action.yml', 'utf8'))
  const scanStep = action.runs.steps.find((step: { id?: string }) => step.id === 'scan')
  assert.ok(scanStep)
  const scanRun = scanStep.run as string

  assert.equal(action.inputs['fail-on'].description, 'Gate threshold. Use block to fail only the score-based BLOCK verdict, review to fail any non-pass verdict, or never to report only.')
  assert.equal(action.inputs['fail-on'].required, false)
  assert.equal(action.inputs['fail-on'].default, 'block')
  assert.equal(scanStep.env.FAIL_ON, '${{ inputs.fail-on }}')
  assert.match(scanRun, /fail_on="\$FAIL_ON"/)
  assert.match(scanRun, /case "\$fail_on" in\n\s*block\|review\|never\) ;;/)
  assert.match(scanRun, /fail-on must be one of: block, review, never/)
  const validationIndex = scanRun.indexOf('case "$fail_on" in')
  assert.ok(validationIndex >= 0, 'fail-on validation should exist')
  assert.ok(validationIndex < scanRun.indexOf('git diff --no-ext-diff'), 'fail-on validation should run before reading the PR diff')
  assert.ok(validationIndex < scanRun.indexOf('node dist/index.js scan-diff'), 'fail-on validation should run before scanner execution')
  assert.ok(validationIndex < scanRun.indexOf('GITHUB_OUTPUT'), 'fail-on validation should run before output emission')
  assert.ok(scanRun.includes('[[ "$conclusion" == "block" && "$fail_on" =~ ^(block|review)$ ]]'))
  assert.ok(scanRun.includes('[[ "$conclusion" == "review" && "$fail_on" == "review" ]]'))
})

test('team adoption docs provide copy-paste reusable action workflow', () => {
  const docs = readFileSync('docs/github-action.md', 'utf8')

  assert.match(docs, /uses: Sungho-pk42ac\/agentguard@main/)
  assert.match(docs, /fail-on: block/)
  assert.match(docs, /sarif-path: agentguard\.sarif/)
  assert.match(docs, /github\/codeql-action\/upload-sarif@v3/)
  assert.match(docs, /- name: Upload AgentGuard SARIF\r?\n        if: \$\{\{ !cancelled\(\) && \(github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository\) \}\}/)
  assert.match(docs, /- name: Comment AgentGuard report on PR\r?\n        if: \$\{\{ !cancelled\(\) && github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.repo\.full_name == github\.repository \}\}/)
  assert.match(docs, /- name: Upload AgentGuard artifacts\r?\n        if: \$\{\{ !cancelled\(\) \}\}/)
  assert.match(docs, /body-path: agent-risk-report\.md/)
  assert.match(docs, /permissions:[\s\S]*contents: read[\s\S]*pull-requests: write[\s\S]*security-events: write/)
})

test('team adoption docs explain fork-safe PR permission fallback', () => {
  const docs = readFileSync('docs/github-action.md', 'utf8')

  assert.match(docs, /^## Fork PR permission boundary/m)
  assert.match(docs, /public fork PR/i)
  assert.match(docs, /read-only `GITHUB_TOKEN`/)
  assert.match(docs, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/)
  assert.match(docs, /artifact-only fallback/i)
  assert.match(docs, /pull_request_target/)
  assert.match(docs, /do not check out or execute untrusted fork code/i)
  assert.match(docs, /maintainer can rerun AgentGuard on a same-repository branch/i)
})

test('team adoption docs explain required status check rollout after trial mode', () => {
  const docs = readFileSync('docs/github-action.md', 'utf8')

  assert.match(docs, /^## Required status check rollout/m)
  assert.match(docs, /Start in trial mode with `fail-on: never` or `fail-on: block`/)
  assert.match(docs, /make the AgentGuard workflow job a required status check/i)
  assert.match(docs, /Settings → Branches → Branch protection rules → Require status checks/i)
  assert.match(docs, /Settings → Rules → Rulesets/i)
  assert.match(docs, /gh api repos\/OWNER\/REPO\/branches\/BRANCH\/protection/)
  assert.match(docs, /GET request to inspect the current branch-protection contract/i)
  assert.match(docs, /tighten to `fail-on: review`/)
  assert.match(docs, /Do not use `pull_request_target` to check out or execute untrusted fork code/)
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
  assert.match(scanRun, /rm -f -- "\$report_path" "\$json_path" "\$sarif_path"/)
  assert.match(scanRun, /mkdir -p -- "\$\(dirname -- "\$report_path"\)"/)
  assert.match(scanRun, /mkdir -p -- "\$\(dirname -- "\$json_path"\)"/)
  assert.match(scanRun, /\[\[ ! -s "\$json_path" \]\]/)
  assert.match(scanRun, /\[\[ ! -s "\$report_path" \]\]/)
  assert.match(scanRun, /AgentGuard did not create the JSON findings artifact/)
  assert.match(scanRun, /AgentGuard did not create the markdown report artifact/)
  assert.doesNotMatch(scanRun, /inputs\.base-sha.*inputs\.head-sha/)
  assert.doesNotMatch(stepText, /process\.exit\(1\).*review/i)
})

test('local GitHub Action emits SARIF artifact contract', () => {
  const action = YAML.parse(readFileSync('.github/actions/agentguard/action.yml', 'utf8'))
  const scanStep = action.runs.steps.find((step: { id?: string }) => step.id === 'scan')
  assert.ok(scanStep)
  const scanRun = scanRunFor('.github/actions/agentguard/action.yml')

  assert.equal(action.inputs['sarif-path'].default, 'agentguard.sarif')
  assert.equal(action.outputs['sarif-path'].description, 'Path to the SARIF AgentGuard artifact')
  assert.equal(action.outputs['sarif-path'].value, '${{ steps.scan.outputs.sarif-path }}')
  assert.equal(scanStep.env.SARIF_PATH, '${{ inputs.sarif-path }}')
  assert.match(scanRun, /sarif_path="\$SARIF_PATH"/)
  assert.match(scanRun, /validate_artifact_path "\$sarif_path" "sarif-path"/)
  assert.match(scanRun, /rm -f -- "\$report_path" "\$json_path" "\$sarif_path"/)
  assert.match(scanRun, /mkdir -p -- "\$\(dirname -- "\$sarif_path"\)"/)
  assert.match(scanRun, /node dist\/index\.js scan-diff "\$\{policy_args\[@\]\}" --sarif --out "\$sarif_path"/)
  assert.match(scanRun, /if \[\[ \$json_status -gt 1 \|\| \$sarif_status -gt 1 \|\| \$markdown_status -gt 1 \]\]/)
  assert.match(scanRun, /\[\[ ! -s "\$sarif_path" \]\]/)
  assert.match(scanRun, /AgentGuard did not create the SARIF artifact/)
  assert.match(scanRun, /echo "sarif-path=\$sarif_path"/)
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
