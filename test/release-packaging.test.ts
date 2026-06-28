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
    assert.ok(packedFiles.includes('package.json'))
    assert.ok(packedFiles.every((path) => !path.startsWith('src/')), `src files should not ship in npm tarball: ${packedFiles.join(', ')}`)
    assert.ok(packedFiles.every((path) => !path.startsWith('test/')), `test files should not ship in npm tarball: ${packedFiles.join(', ')}`)

    run('npm', ['init', '-y'], temp)
    run('npm', ['install', tarball], temp)
    const output = run('npx', ['agentguard', 'scan-log'], temp)
    assert.match(output, /# AgentGuard Risk Report/)
    assert.match(output, /\*\*Verdict:\*\* PASS/)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test('README documents npm install, package smoke, and provenance release checklist', () => {
  const readme = readFileSync('README.md', 'utf8')

  assert.match(readme, /npm install -g agentguard/)
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
})
