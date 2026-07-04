import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('CLI --out creates missing parent directories for report files', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-cli-out-'))
  const reportPath = join(workspace, 'nested', 'reports', 'agent-risk-report.md')

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--out', reportPath],
    {
      cwd: process.cwd(),
      input: 'agent completed without sensitive output\n',
      encoding: 'utf8',
    },
  )

  assert.equal(result.stdout, '')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(reportPath), true)
  assert.match(readFileSync(reportPath, 'utf8'), /^# AgentGuard 위험 리포트/)
})

test('CLI --out reports write failures without a raw stack trace', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-cli-out-failure-'))

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--out', workspace],
    {
      cwd: process.cwd(),
      input: 'agent completed without sensitive output\n',
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 2)
  assert.match(result.stderr, /Could not write output/)
  assert.doesNotMatch(result.stderr, /at .*src\/index\.ts/)
})

// stdin은 파일 스캔의 크기 상한(MAX_FILE_BYTES=512_000)이 없어 그대로 두면 무한정
// 커질 수 있다. 이 픽스처는 PII/시크릿 패턴을 피해 상한 검사 전 코드에서도 빠르게
// 끝나도록 만들어, ReDoS 회귀와 상관없이 이 케이스만 단독으로 검증한다.
test('CLI rejects stdin larger than the file-scan size cap with a clear error', () => {
  const oversized = 'benign log line without special markers\n'.repeat(15_000)
  assert.ok(oversized.length > 512_000, 'fixture must exceed the 512_000 byte cap')

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log'],
    {
      cwd: process.cwd(),
      input: oversized,
      encoding: 'utf8',
      timeout: 15_000,
    },
  )

  assert.equal(result.status, 2, `expected usage-error exit code 2, got ${result.status}; stderr: ${result.stderr}`)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /stdin/i)
  assert.match(result.stderr, /512.?000|512.?KB/i)
})

test('CLI help flags print usage to stdout with a success exit', () => {
  for (const helpFlag of ['--help', '-h']) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', helpFlag],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, `${helpFlag} should exit successfully`)
    assert.match(result.stdout, /^Usage:/, `${helpFlag} should print usage to stdout`)
    assert.match(result.stdout, /--help, -h/, `${helpFlag} should document help flags`)
    assert.match(result.stdout, /--version, -v/, `${helpFlag} should document version flags`)
    assert.match(result.stdout, /--policy <path>, --policy=<path>/, `${helpFlag} should document policy equals form`)
    assert.match(result.stdout, /--out <file>, --out=<file>/, `${helpFlag} should document output equals form`)
    assert.match(result.stdout, /agentguard doctor/, `${helpFlag} should document the doctor command`)
    assert.equal(result.stderr, '', `${helpFlag} should not print usage to stderr`)
  }
})

test('CLI doctor prints Korean-first readiness checks with a success exit', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'doctor'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^AgentGuard 준비 상태/)
  assert.match(result.stdout, /PASS package version/)
  assert.match(result.stdout, /PASS examples directory/)
  assert.match(result.stdout, /PASS scanner smoke/)
})

test('CLI doctor supports English readiness output with both lang flag forms', () => {
  for (const args of [['--lang=en'], ['--lang', 'en']]) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', 'doctor', ...args],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')
    assert.match(result.stdout, /^AgentGuard readiness/)
    assert.match(result.stdout, /PASS package version - \d+\.\d+\.\d+ readable/)
    assert.match(result.stdout, /PASS examples directory - examples directory found/)
    assert.match(result.stdout, /PASS scanner smoke - safe\/risky sample detection ok/)
  }
})

test('CLI doctor rejects invalid language options with command usage', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'doctor', '--lang=fr'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:\n  agentguard doctor \[--lang ko\|en\]/)
})

test('CLI doctor help flags print command usage to stdout with a success exit', () => {
  for (const helpFlag of ['--help', '-h']) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', 'doctor', helpFlag],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, `${helpFlag} should exit successfully`)
    assert.match(result.stdout, /^Usage:\n  agentguard doctor/)
    assert.match(result.stdout, /scanner smoke test/)
    assert.equal(result.stderr, '')
  }
})

test('CLI version flags print the package version to stdout with a success exit', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

  for (const versionFlag of ['--version', '-v']) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', versionFlag],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, `${versionFlag} should exit successfully`)
    assert.equal(result.stdout, `${packageJson.version}\n`, `${versionFlag} should print the package version`)
    assert.equal(result.stderr, '', `${versionFlag} should not print to stderr`)
  }
})

test('CLI rejects conflicting JSON and SARIF output flags', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--json', '--sarif'],
    {
      cwd: process.cwd(),
      input: 'agent completed without sensitive output\n',
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /--json and --sarif cannot be combined/)
})

test('CLI rejects duplicate output file flags instead of silently choosing one', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-cli-duplicate-out-'))
  const firstReportPath = join(workspace, 'first.md')
  const secondReportPath = join(workspace, 'second.md')

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--out', firstReportPath, `--out=${secondReportPath}`],
    {
      cwd: process.cwd(),
      input: 'agent completed without sensitive output\n',
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})

test('CLI invalid commands still print usage to stderr with an error exit', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', '--definitely-not-an-option'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})

test('CLI scan-files reports missing workspace paths without a raw stack trace', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-missing-workspace-parent-'))
  try {
    const missingPath = join(workspace, 'does-not-exist')

    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', 'scan-files', missingPath],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 2)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /^Could not scan files:/)
    assert.doesNotMatch(result.stderr, /at .*src\/index\.ts/)
    assert.doesNotMatch(result.stderr, /ENOENT: no such file or directory, scandir/)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('CLI rejects unexpected extra positional arguments', () => {
  const cases: Array<{ command: string; args: string[]; input?: string }> = [
    { command: 'scan-files', args: ['.', 'extra-path'] },
    // scan-diff/log/mcp/report now accept 0..1 positional (S12).
    // Two positionals must still be rejected.
    { command: 'scan-diff', args: ['first.patch', 'extra.patch'], input: '' },
    { command: 'scan-log', args: ['first.log', 'extra.log'], input: 'agent completed without sensitive output\n' },
    { command: 'scan-mcp', args: ['first.toml', 'extra.toml'], input: '[mcp_servers.github]\ncommand = "github"\n' },
    { command: 'report', args: ['first.txt', 'extra.txt'], input: 'agent completed without sensitive output\n' },
  ]

  for (const testCase of cases) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', testCase.command, ...testCase.args],
      {
        cwd: process.cwd(),
        input: testCase.input,
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 2, `${testCase.command} should reject extra positional args`)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /^Usage:/, `${testCase.command} should print usage to stderr`)
  }
})
// ── S12 guard tests ──────────────────────────────────────────────────────────

test('CLI scan-mcp piped with no path and piped with a redundant path produce identical output (stdin-first)', () => {
  const input = '[mcp_servers.github]\ncommand = "github"\n'

  const withoutPath = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-mcp'],
    { cwd: process.cwd(), input, encoding: 'utf8', timeout: 15_000 },
  )

  const withPath = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-mcp', 'redundant-path.toml'],
    { cwd: process.cwd(), input, encoding: 'utf8', timeout: 15_000 },
  )

  assert.equal(withPath.status, withoutPath.status, 'exit code must be identical with/without redundant path')
  assert.equal(withPath.stdout, withoutPath.stdout, 'stdout must be byte-identical with/without redundant path')
})

test('CLI JSON and SARIF output is byte-identical with or without a redundant path when piped (scan-diff, scan-mcp)', () => {
  const mcpInput = '[mcp_servers.github]\ncommand = "github"\n'
  const diffInput = '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n'

  const cases = [
    { cmd: 'scan-diff', input: diffInput, flag: '--json' },
    { cmd: 'scan-diff', input: diffInput, flag: '--sarif' },
    { cmd: 'scan-mcp', input: mcpInput, flag: '--json' },
    { cmd: 'scan-mcp', input: mcpInput, flag: '--sarif' },
  ] as const

  for (const { cmd, input: caseInput, flag } of cases) {
    const without = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', cmd, flag],
      { cwd: process.cwd(), input: caseInput, encoding: 'utf8', timeout: 15_000 },
    )
    const withPath = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', cmd, 'redundant-path.txt', flag],
      { cwd: process.cwd(), input: caseInput, encoding: 'utf8', timeout: 15_000 },
    )
    assert.equal(
      withPath.status, without.status,
      `${cmd} ${flag}: exit code must be identical with/without redundant path`,
    )
    assert.equal(
      withPath.stdout, without.stdout,
      `${cmd} ${flag}: stdout must be byte-identical with/without redundant path`,
    )
  }
})

// ── S13 --help assertions (KO-first + PowerShell examples) ───────────────────

test('CLI --help shows Korean-first content with PowerShell-friendly examples', () => {
  for (const helpFlag of ['--help', '-h']) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', helpFlag],
      { cwd: process.cwd(), encoding: 'utf8' },
    )

    assert.equal(result.status, 0, `${helpFlag} should exit 0`)
    // File-path example (PowerShell-friendly, no redirect needed)
    assert.match(result.stdout, /agentguard scan-mcp config\.toml/, `${helpFlag} should show file-path example`)
    // PowerShell pipe example
    assert.match(result.stdout, /Get-Content config\.toml \| agentguard scan-mcp/, `${helpFlag} should show PowerShell pipe example`)
    // Korean prose present (AI 에이전트 보안 감사)
    assert.match(result.stdout, /AI 에이전트 보안 감사/, `${helpFlag} should contain Korean description`)
  }
})
