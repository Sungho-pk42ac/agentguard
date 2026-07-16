import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

function run(command: string, args: readonly string[], cwd = process.cwd()): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    // Windows에서 npm/npx는 .cmd 배치 파일이라 shell 없이는 실행 불가 (Node 18.20+ 필수)
    shell: process.platform === 'win32',
    env: { ...process.env, npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

test('npm package tarball installs a working agentguard bin', () => {
  const temp = mkdtempSync(join(tmpdir(), 'agentguard-pack-'))
  try {
    run('npm', ['run', 'build'])
    const packJson = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', temp])) as Array<{ filename: string, files: Array<{ path: string }> }>
    const tarball = join(temp, packJson[0].filename)
    const packedFiles = packJson[0].files.map((file) => file.path).sort()

    assert.ok(packedFiles.includes('dist/index.js'))
    assert.ok(packedFiles.includes('dist/index.d.ts'))
    assert.ok(packedFiles.includes('README.md'))
    assert.ok(packedFiles.includes('README.en.md'))
    assert.ok(packedFiles.includes('action.yml'))
    assert.ok(packedFiles.includes('.github/actions/agentguard/action.yml'))
    assert.ok(packedFiles.includes('package.json'))
    assert.ok(packedFiles.every((path) => !path.startsWith('src/')), `src files should not ship in npm tarball: ${packedFiles.join(', ')}`)
    assert.ok(packedFiles.every((path) => !path.startsWith('test/')), `test files should not ship in npm tarball: ${packedFiles.join(', ')}`)

    run('npm', ['init', '-y'], temp)
    run('npm', ['install', tarball], temp)
    const output = run('npx', ['agentguard', 'scan-log'], temp)
    assert.match(output, /# AgentGuard 위험 리포트/)
    assert.match(output, /\*\*판정:\*\* PASS/)
    const doctorJson = JSON.parse(run('npx', ['agentguard', 'doctor', '--json'], temp)) as {
      status: string
      checks: Array<{ id: string, passed: boolean, detail: string }>
    }
    const actionCheck = doctorJson.checks.find((check) => check.id === 'github_action_contract')
    assert.equal(doctorJson.status, 'PASS')
    assert.equal(actionCheck?.passed, true)
    assert.match(actionCheck?.detail ?? '', /\.github\/actions\/agentguard\/action\.yml/)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test('README documents npm install, package smoke, and provenance release checklist', () => {
  const readme = readFileSync('README.md', 'utf8')

  assert.match(readme, /npm install -g @pk42ac\/agentguard/)
  assert.match(readme, /agentguard scan-files \./)
  assert.match(readme, /npm pack --dry-run/)
  assert.match(readme, /npm publish --provenance --access public/)
  assert.match(readme, /Release checklist/)
})

test('README roadmap does not list implemented work as future roadmap items', () => {
  const readme = readFileSync('README.md', 'utf8')
  const roadmap = readme.split('## Roadmap')[1]

  assert.notEqual(roadmap, undefined, 'README should keep a Roadmap section')
  assert.doesNotMatch(roadmap, /^- GitHub Action PR comment$/m)
  assert.doesNotMatch(roadmap, /^- policy-as-code \(`agent-policy\.yaml`\)$/m)
  assert.doesNotMatch(roadmap, /^- Codex\/Hermes transcript adapters$/m)
})

test('roadmap doc does not list implemented work as future roadmap items', () => {
  const roadmap = readFileSync('docs/roadmap.md', 'utf8')

  assert.doesNotMatch(roadmap, /Claude Desktop MCP config/)
  assert.doesNotMatch(roadmap, /Cursor MCP config/)
  assert.doesNotMatch(roadmap, /read-only filesystem MCP use/)
  assert.doesNotMatch(roadmap, /SARIF rule metadata/)
  assert.doesNotMatch(roadmap, /rule metadata in JSON\/SARIF/)
  assert.doesNotMatch(roadmap, /^- Codex\/Hermes transcript adapters\.$/m)
})

test('release workflow publishes with provenance, a version guard, and OIDC trusted publishing', () => {
  const workflow = readFileSync('.github/workflows/release.yml', 'utf8')

  assert.match(workflow, /--provenance/)
  assert.match(workflow, /GITHUB_REF_NAME#v/)
  assert.match(workflow, /id-token: write/)
  assert.match(workflow, /workflow_dispatch/)
  assert.match(workflow, /npm install -g npm@latest/)
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN/)
  assert.doesNotMatch(workflow, /NPM_TOKEN/)
})

test('release process docs describe the tag flow and the configured trusted publisher', () => {
  const docs = readFileSync('docs/release-process.md', 'utf8')

  assert.match(docs, /git tag v/)
  assert.match(docs, /OIDC/)
  assert.match(docs, /trusted publishing/)
  assert.doesNotMatch(docs, /NPM_TOKEN/)
  assert.doesNotMatch(docs, /does not exist on npm yet/)
})
