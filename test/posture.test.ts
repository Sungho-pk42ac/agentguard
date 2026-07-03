import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

function createRiskyAgentWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-posture-'))
  mkdirSync(join(workspace, '.claude'), { recursive: true })
  mkdirSync(join(workspace, '.codex'), { recursive: true })
  mkdirSync(join(workspace, '.gemini'), { recursive: true })

  writeFileSync(
    join(workspace, '.claude', 'mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          filesystem: {
            command: 'mcp-server-filesystem',
            args: ['--root', '/', '--writable'],
            env: {
              GITHUB_TOKEN: 'ghp_should_not_leak_in_output_1234567890',
            },
            mode: 'danger-full-access',
          },
        },
      },
      null,
      2,
    ),
  )

  writeFileSync(
    join(workspace, '.codex', 'config.json'),
    JSON.stringify(
      {
        tools: {
          filesystem: {
            path: '~',
            writable: true,
          },
        },
        env: ['ANTHROPIC_API_KEY'],
      },
      null,
      2,
    ),
  )

  writeFileSync(
    join(workspace, '.gemini', 'settings.json'),
    JSON.stringify(
      {
        mcpServers: {
          local: {
            allowedDirectories: ['C:\\'],
            readOnly: false,
          },
        },
      },
      null,
      2,
    ),
  )

  return workspace
}

function createRiskyClaudeDesktopWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-posture-desktop-'))

  writeFileSync(
    join(workspace, 'claude_desktop_config.json'),
    JSON.stringify(
      {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
            env: {
              GITHUB_TOKEN: 'ghp_should_not_leak_in_output_1234567890',
            },
          },
        },
      },
      null,
      2,
    ),
  )

  return workspace
}

function createRiskyCursorWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-posture-cursor-'))
  mkdirSync(join(workspace, '.cursor'), { recursive: true })

  writeFileSync(
    join(workspace, '.cursor', 'mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
            env: {
              GITHUB_TOKEN: 'ghp_should_not_leak_in_output_1234567890',
            },
          },
        },
      },
      null,
      2,
    ),
  )

  return workspace
}

test('CLI posture reports Cursor MCP config surface risks', () => {
  const workspace = createRiskyCursorWorkspace()
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', 'posture', workspace],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 1, result.stderr)
    assert.equal(result.stderr, '')
    assert.match(result.stdout, /^AgentGuard agent posture/)
    assert.match(result.stdout, /REVIEW cursor mcp config - broad filesystem root/)
    assert.match(result.stdout, /REVIEW cursor mcp config - credential env/)
    assert.doesNotMatch(result.stdout, /ghp_should_not_leak/)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('CLI posture reports Claude Desktop MCP config surface risks', () => {
  const workspace = createRiskyClaudeDesktopWorkspace()
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', 'posture', workspace],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 1, result.stderr)
    assert.equal(result.stderr, '')
    assert.match(result.stdout, /^AgentGuard agent posture/)
    assert.match(result.stdout, /REVIEW claude desktop config - broad filesystem root/)
    assert.match(result.stdout, /REVIEW claude desktop config - credential env/)
    assert.doesNotMatch(result.stdout, /ghp_should_not_leak/)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('CLI posture reports agent config over-permission risks without leaking credentials', () => {
  const workspace = createRiskyAgentWorkspace()
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', 'posture', workspace],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 1, result.stderr)
    assert.equal(result.stderr, '')
    assert.match(result.stdout, /^AgentGuard agent posture/)
    assert.match(result.stdout, /REVIEW claude mcp config - broad filesystem root/)
    assert.match(result.stdout, /REVIEW claude mcp config - full-access agent setting/)
    assert.match(result.stdout, /REVIEW codex config - writable filesystem path/)
    assert.match(result.stdout, /REVIEW gemini mcp config - writable filesystem path/)
    assert.match(result.stdout, /REVIEW policy guardrail - agent-policy\.yaml\|yml\|json not found/)
    assert.match(result.stdout, /credential env/)
    assert.doesNotMatch(result.stdout, /ghp_should_not_leak/)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('CLI posture emits JSON findings for automation', () => {
  const workspace = createRiskyAgentWorkspace()
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', 'posture', workspace, '--json'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 1, result.stderr)
    assert.equal(result.stderr, '')
    const report = JSON.parse(result.stdout) as {
      scannedPath: string
      findingCount: number
      findings: Array<{ id: string; severity: string; surface: string; evidence: string }>
    }

    assert.equal(report.scannedPath, workspace)
    assert.ok(report.findingCount >= 5)
    assert.ok(report.findings.some((finding) => finding.id === 'agent-broad-filesystem-root' && finding.surface === 'claude mcp config'))
    assert.ok(report.findings.some((finding) => finding.id === 'agent-full-access' && finding.surface === 'claude mcp config'))
    assert.ok(report.findings.some((finding) => finding.id === 'agent-writable-filesystem-path' && finding.surface === 'codex config'))
    assert.ok(report.findings.some((finding) => finding.id === 'agent-credential-env' && finding.evidence.includes('[REDACTED]')))
    assert.ok(report.findings.some((finding) => finding.id === 'agent-credential-secret' && finding.evidence === 'credential value [REDACTED]'))
    assert.ok(report.findings.some((finding) => finding.id === 'agent-policy-missing'))
    assert.doesNotMatch(result.stdout, /ghp_should_not_leak/)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('CLI posture passes when config and policy guardrails are scoped', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-posture-safe-'))
  try {
    mkdirSync(join(workspace, '.claude'), { recursive: true })
    writeFileSync(join(workspace, 'agent-policy.yaml'), 'denied_commands:\n  - rm -rf /\n')
    writeFileSync(
      join(workspace, '.claude', 'mcp.json'),
      JSON.stringify({ mcpServers: { filesystem: { args: ['--root', './workspace'], readOnly: true } } }, null, 2),
    )

    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', 'posture', workspace],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')
    assert.match(result.stdout, /^AgentGuard agent posture/)
    assert.match(result.stdout, /PASS policy guardrail - agent-policy found/)
    assert.match(result.stdout, /No agent posture risks found/)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
