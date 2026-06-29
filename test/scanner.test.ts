import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { scanDiff, scanFiles, scanMcpConfig, scanText } from '../src/scanner.js'
import { riskScore, toSarif } from '../src/report.js'
import type { Policy } from '../src/rules.js'

test('detects secrets in text and redacts evidence', () => {
  const findings = scanText('OPENAI_API_KEY="sk-abcdefghijklmnopqrstuvwxyz"')
  assert.equal(findings[0]?.severity, 'critical')
  assert.match(findings[0]?.evidence ?? '', /sk-a…/)
})

test('detects standalone OpenAI-style API keys in text and redacts evidence', () => {
  const key = `sk-${'A'.repeat(44)}wxyz`
  const findings = scanText(`OPENAI_API_KEY=${key}`)

  const finding = findings.find((candidate) => candidate.id === 'openai-key')
  assert.ok(finding, 'expected an openai-key finding')
  assert.equal(finding.severity, 'critical')
  assert.equal(finding.category, 'secret')
  assert.notEqual(finding.evidence, key)
  assert.match(finding.evidence, /^sk-A…wxyz$/)
})

test('detects project-scoped OpenAI-style API keys in text and redacts evidence', () => {
  const key = `sk-proj-${'A'.repeat(96)}wxyz`
  const findings = scanText(`OPENAI_API_KEY=${key}`)

  const finding = findings.find((candidate) => candidate.id === 'openai-key')
  assert.ok(finding, 'expected an openai-key finding')
  assert.equal(finding.severity, 'critical')
  assert.equal(finding.category, 'secret')
  assert.notEqual(finding.evidence, key)
  assert.match(finding.evidence, /^sk-p…wxyz$/)
})

test('does not flag OpenAI-style key lookalikes embedded in longer tokens', () => {
  const key = `sk-${'A'.repeat(44)}wxyz`
  const findings = scanText(`debug marker: prefix${key}`)

  assert.ok(!findings.some((finding) => finding.id === 'openai-key'))
})

test('detects OpenAI-style API keys followed by non-token delimiters', () => {
  const key = `sk-${'A'.repeat(44)}wxyz`
  const findings = scanText(`OPENAI_API_KEY=${key}; next=value`)

  assert.ok(findings.some((finding) => finding.id === 'openai-key'))
})

test('detects standalone GitHub tokens for supported prefixes and redacts evidence', () => {
  for (const prefix of ['ghp', 'gho', 'ghu', 'ghs', 'ghr']) {
    const key = `${prefix}_${'A'.repeat(36)}wxyz`
    const findings = scanText(`GITHUB_TOKEN=${key}`)
    const finding = findings.find((candidate) => candidate.id === 'github-token')

    assert.ok(finding, `expected a github-token finding for ${prefix}`)
    assert.equal(finding.severity, 'critical')
    assert.equal(finding.category, 'secret')
    assert.notEqual(finding.evidence, key)
    assert.match(finding.evidence, new RegExp(`^${prefix}_…wxyz$`))
  }
})

test('does not flag GitHub token lookalikes embedded in longer tokens', () => {
  const key = `ghp_${'A'.repeat(36)}wxyz`
  const overlong = `ghp_${'A'.repeat(41)}`
  const snakeCase = 'ghp_get_user_profile_information_by_id'
  const findings = scanText(`debug markers: prefix${key} ${key}suffix ${overlong} ${snakeCase}`)

  assert.ok(!findings.some((finding) => finding.id === 'github-token'))
})

test('detects GitHub tokens separated by hyphen delimiters', () => {
  const key = `ghp_${'A'.repeat(36)}wxyz`
  const findings = scanText(`debug markers: pre-${key} ${key}-post`)
  const githubFindings = findings.filter((finding) => finding.id === 'github-token')

  assert.equal(githubFindings.length, 2)
})

test('detects GitHub tokens followed by non-token delimiters', () => {
  const key = `ghp_${'A'.repeat(36)}wxyz`
  const findings = scanText(`GITHUB_TOKEN=${key}; next=value`)

  assert.ok(findings.some((finding) => finding.id === 'github-token'))
})

test('detects Google API keys in text and redacts evidence', () => {
  const key = `AIzaSy${'A'.repeat(29)}wxyz`
  const findings = scanText(`GOOGLE_API_KEY=${key}`)

  const finding = findings.find((candidate) => candidate.id === 'google-api-key')
  assert.ok(finding, 'expected a google-api-key finding')
  assert.equal(finding.severity, 'critical')
  assert.equal(finding.category, 'secret')
  assert.notEqual(finding.evidence, key)
  assert.match(finding.evidence, /^AIza…wxyz$/)
})

test('detects 40-character Google API keys in text and redacts evidence', () => {
  const key = `AIzaSy${'A'.repeat(30)}wxyz`
  const findings = scanText(`GOOGLE_API_KEY=${key}`)

  const finding = findings.find((candidate) => candidate.id === 'google-api-key')
  assert.ok(finding, 'expected a google-api-key finding')
  assert.equal(finding.severity, 'critical')
  assert.equal(finding.category, 'secret')
  assert.notEqual(finding.evidence, key)
  assert.match(finding.evidence, /^AIza…wxyz$/)
})

test('does not flag short AIzaSy-prefixed text as a Google API key', () => {
  const findings = scanText(`debug marker: AIzaSy${'A'.repeat(32)}`)

  assert.ok(!findings.some((finding) => finding.id === 'google-api-key'))
})

test('does not partially match overlong Google API key lookalikes', () => {
  const findings = scanText(`debug marker: AIzaSy${'A'.repeat(35)}`)

  assert.ok(!findings.some((finding) => finding.id === 'google-api-key'))
})

test('does not flag Google API key lookalikes embedded in longer tokens', () => {
  const findings = scanText(`debug marker: prefixAIzaSy${'A'.repeat(29)}wxyz`)

  assert.ok(!findings.some((finding) => finding.id === 'google-api-key'))
})

test('detects Anthropic API keys in text and redacts evidence', () => {
  const key = `sk-ant-api03-${'A'.repeat(91)}wxyz`
  const findings = scanText(`ANTHROPIC_API_KEY=${key}`)

  const finding = findings.find((candidate) => candidate.id === 'anthropic-api-key')
  assert.ok(finding, 'expected an anthropic-api-key finding')
  assert.equal(finding.severity, 'critical')
  assert.equal(finding.category, 'secret')
  assert.notEqual(finding.evidence, key)
  assert.match(finding.evidence, /^sk-a…wxyz$/)
})

test('does not report Anthropic API keys as OpenAI-style keys', () => {
  const key = `sk-ant-api03-${'A'.repeat(91)}wxyz`
  const findings = scanText(`ANTHROPIC_API_KEY=${key}`)

  assert.ok(!findings.some((finding) => finding.id === 'openai-key'))
})

test('detects future Anthropic API key versions without falling through scanners', () => {
  const key = `sk-ant-api100-${'A'.repeat(91)}wxyz`
  const findings = scanText(`ANTHROPIC_API_KEY=${key}`)

  assert.ok(findings.some((finding) => finding.id === 'anthropic-api-key'))
  assert.ok(!findings.some((finding) => finding.id === 'openai-key'))
})

test('detects Anthropic sk-ant fallback tokens without falling through scanners', () => {
  const key = `sk-ant-v1-${'A'.repeat(70)}`
  const findings = scanText(`ANTHROPIC_API_KEY=${key}`)

  assert.ok(findings.some((finding) => finding.id === 'anthropic-api-key'))
  assert.ok(!findings.some((finding) => finding.id === 'openai-key'))
})

test('does not flag short Anthropic API key lookalikes', () => {
  const findings = scanText(`debug marker: sk-ant-${'A'.repeat(19)}`)

  assert.ok(!findings.some((finding) => finding.id === 'anthropic-api-key'))
})

test('detects long Anthropic API key lookalikes without partial leakage', () => {
  const key = `sk-ant-${'A'.repeat(151)}wxyz`
  const findings = scanText(`debug marker: ${key}`)
  const finding = findings.find((candidate) => candidate.id === 'anthropic-api-key')

  assert.ok(finding, 'expected long sk-ant token to be detected instead of silently bypassing')
  assert.notEqual(finding.evidence, key)
  assert.match(finding.evidence, /^sk-a…wxyz$/)
})

test('does not flag Anthropic API key lookalikes embedded in longer tokens', () => {
  const findings = scanText(`debug marker: prefixsk-ant-api03-${'A'.repeat(91)}wxyz`)

  assert.ok(!findings.some((finding) => finding.id === 'anthropic-api-key'))
})

test('scanDiff only checks added lines', () => {
  const findings = scanDiff('- sk-oldoldoldoldoldoldoldold\n+ sk-newnewnewnewnewnewnewnew')
  assert.equal(findings.length, 1)
  assert.match(findings[0].evidence, /new/)
})

test('scanFiles returns normally when workspace contains cyclic symlink', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-symlink-cycle-'))
  const workspace = join(dir, 'workspace')
  mkdirSync(workspace)
  writeFileSync(join(workspace, 'token.txt'), 'GITHUB_TOKEN=ghp_abcdefghijklmnopqrst')
  symlinkSync('.', join(workspace, 'loop'), 'dir')

  assert.doesNotThrow(() => scanFiles(workspace))
  const findings = scanFiles(workspace)
  assert.ok(findings.some((finding) => finding.id === 'github-token' && finding.file === 'token.txt'))
})

test('scanFiles skips self-referential symlinks without crashing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-self-symlink-'))
  const workspace = join(dir, 'workspace')
  mkdirSync(workspace)
  symlinkSync('self', join(workspace, 'self'))

  assert.doesNotThrow(() => scanFiles(workspace))
})

test('scanFiles applies default **/.ssh/** deny-read glob to root-level .ssh files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-root-ssh-deny-'))
  const workspace = join(dir, 'workspace')
  const sshDir = join(workspace, '.ssh')
  mkdirSync(sshDir, { recursive: true })
  writeFileSync(join(sshDir, 'config'), 'Host github.com\n  User git\n')

  const findings = scanFiles(workspace)

  assert.ok(
    findings.some(
      (finding) =>
        finding.id === 'denied-read-path' &&
        finding.file === '.ssh/config' &&
        finding.evidence === '.ssh/config',
    ),
  )
})

test('scanFiles applies default **/id_rsa deny-read glob to root-level key files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-root-id-rsa-deny-'))
  const workspace = join(dir, 'workspace')
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, 'id_rsa'), 'not a real private key')

  const findings = scanFiles(workspace)

  assert.ok(
    findings.some(
      (finding) =>
        finding.id === 'denied-read-path' && finding.file === 'id_rsa' && finding.evidence === 'id_rsa',
    ),
  )
})

test('scanFiles treats **/ deny-read glob prefixes as matching root-level and nested paths', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-double-star-deny-'))
  const workspace = join(dir, 'workspace')
  const rootPrivate = join(workspace, 'private')
  const nestedPrivate = join(workspace, 'nested', 'private')
  mkdirSync(rootPrivate, { recursive: true })
  mkdirSync(nestedPrivate, { recursive: true })
  writeFileSync(join(rootPrivate, 'session.txt'), 'root session placeholder')
  writeFileSync(join(nestedPrivate, 'session.txt'), 'nested session placeholder')
  const policy: Policy = {
    denyRead: ['**/private/**'],
    denyCommands: [],
    requireApproval: [],
    mcp: { denyServers: [], denyTools: [], requireApprovalTools: [] },
  }

  const deniedFiles = scanFiles(workspace, policy)
    .filter((finding) => finding.id === 'denied-read-path')
    .map((finding) => finding.file)
    .sort()

  assert.deepEqual(deniedFiles, ['nested/private/session.txt', 'private/session.txt'])
})

test('detects full access MCP config', () => {
  const findings = scanMcpConfig('sandbox_mode = "danger-full-access"\n[mcp_servers.filesystem]')
  assert.ok(findings.some((f) => f.id === 'mcp-full-access'))
  assert.ok(riskScore(findings) >= 4)
})

test('detects secrets embedded in MCP config env blocks', () => {
  const findings = scanMcpConfig('[mcp_servers.github.env]\nOPENAI_API_KEY = "sk-abcdefghijklmnopqrstuvwxyz"')

  assert.ok(findings.some((f) => f.id === 'openai-key' && f.file === 'mcp-config'))
})

test('flags broad MCP filesystem roots and access tokens', () => {
  const config = [
    '[mcp_servers.filesystem]',
    'args = ["/", "--allow-write"]',
    '[mcp_servers.github.env]',
    'GITHUB_TOKEN = "ghp_ab...wxyz"',
  ].join('\n')
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'))
  assert.ok(findings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
})

test('structured MCP JSON scanner flags filesystem roots and writable paths', () => {
  const config = JSON.stringify({
    mcpServers: {
      filesystem: {
        command: 'mcp-server-filesystem',
        args: ['--root', '/', '--allow-write', '/tmp'],
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'))
  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
})

test('structured MCP JSON scanner flags credential env and Windows drive roots', () => {
  const config = JSON.stringify({
    mcpServers: {
      filesystem: {
        args: ['--root', 'C:\\'],
      },
      github: {
        env: {
          GITHUB_TOKEN: '$GITHUB_TOKEN',
        },
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'))
  assert.ok(findings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
})

test('structured MCP JSON scanner flags credential env string arrays', () => {
  const config = JSON.stringify({
    mcpServers: {
      github: {
        env: ['GITHUB_TOKEN=$GITHUB_TOKEN', 'SAFE_MODE=true'],
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
})

test('structured MCP JSON scanner flags credential env passthrough string arrays', () => {
  const config = JSON.stringify({
    mcpServers: {
      github: {
        env: ['GITHUB_TOKEN', 'SAFE_MODE'],
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
})

test('structured MCP JSON scanner ignores non-credential env string arrays', () => {
  const config = JSON.stringify({
    mcpServers: {
      local: {
        env: ['SAFE_MODE=true', 'LOG_LEVEL=debug'],
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(!findings.some((f) => f.id === 'mcp-env-token'))
})

test('structured MCP JSON scanner flags credential env array objects', () => {
  const configs = [
    JSON.stringify({
      mcpServers: {
        github: {
          env: [
            { name: 'GITHUB_TOKEN', value: '$GITHUB_TOKEN' },
            { key: 'SAFE_MODE', value: 'true' },
          ],
        },
      },
    }),
    JSON.stringify({
      mcpServers: {
        openai: {
          env: [
            { key: 'OPENAI_API_KEY', value: '$OPENAI_API_KEY' },
            { name: 'LOG_LEVEL', value: 'debug' },
          ],
        },
      },
    }),
  ]

  for (const config of configs) {
    const findings = scanMcpConfig(config)
    assert.ok(
      findings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'),
      `expected credential env finding for ${config}`,
    )
  }
})

test('structured MCP JSON scanner ignores non-credential env array objects', () => {
  const config = JSON.stringify({
    mcpServers: {
      local: {
        env: [
          { name: 'LOG_LEVEL', value: 'debug' },
          { key: 'SAFE_MODE', value: 'true' },
        ],
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(!findings.some((f) => f.id === 'mcp-env-token'))
})

test('structured MCP JSON scanner flags trailing slash home roots', () => {
  const config = JSON.stringify({
    mcpServers: {
      filesystemRootProperty: {
        root: '~/',
      },
      filesystemRootArgument: {
        args: ['--root=~/'],
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'))
})

test('structured MCP scanner normalizes home-root variants before broad-root comparison', () => {
  const configs = [
    JSON.stringify({ mcpServers: { filesystem: { root: '~\\' } } }),
    JSON.stringify({ mcpServers: { filesystem: { args: ['--root=~\\'] } } }),
    JSON.stringify({ mcpServers: { filesystem: { root: ' ~/' } } }),
    JSON.stringify({ mcpServers: { filesystem: { root: '~//' } } }),
    '[mcp_servers.filesystem]\nroot = " ~/ "',
    '[mcp_servers.filesystem]\nargs = ["--root=~//"]',
  ]

  for (const config of configs) {
    const findings = scanMcpConfig(config)
    assert.ok(
      findings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'),
      `expected wide-root finding for ${config}`,
    )
  }
})

test('structured MCP scanner does not flag explicit user home roots as broad filesystem roots', () => {
  const configs = [
    JSON.stringify({ mcpServers: { filesystem: { root: '~alice/' } } }),
    JSON.stringify({ mcpServers: { filesystem: { args: ['--root=~alice/'] } } }),
    '[mcp_servers.filesystem]\nroot = "~alice/"',
  ]

  for (const config of configs) {
    const findings = scanMcpConfig(config)
    assert.ok(
      !findings.some((f) => f.id === 'mcp-filesystem-wide-root'),
      `expected no wide-root finding for ${config}`,
    )
  }
})

test('structured MCP JSON scanner flags explicit readOnly false filesystem settings', () => {
  const config = JSON.stringify({
    mcpServers: {
      filesystem: {
        root: './workspace',
        readOnly: false,
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
})

test('structured MCP JSON scanner flags writable true with path context', () => {
  const config = JSON.stringify({
    mcpServers: {
      filesystem: {
        root: './workspace',
        writable: true,
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
})

test('structured MCP JSON scanner flags read-only key variants', () => {
  const config = JSON.stringify({
    mcpServers: {
      dashCaseFilesystem: {
        root: './workspace-a',
        'read-only': false,
      },
      snakeCaseFilesystem: {
        root: './workspace-b',
        read_only: false,
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
})

test('structured MCP JSON scanner flags allowedDirectories and path key variants', () => {
  const config = JSON.stringify({
    mcpServers: {
      filesystem: {
        allowedDirectories: [
          {
            path: './workspace',
            writable: 'true',
          },
        ],
      },
      directPath: {
        path: '/',
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'))
})

test('structured MCP JSON scanner flags writable settings inside path arrays', () => {
  const config = JSON.stringify({
    mcpServers: {
      projectFiles: {
        paths: [
          {
            path: './project',
            writable: true,
          },
        ],
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
})

test('structured MCP JSON scanner ignores explicit read-only filesystem settings', () => {
  const config = JSON.stringify({
    mcpServers: {
      filesystem: {
        root: './workspace',
        readOnly: true,
        writable: false,
      },
      dashCaseFilesystem: {
        root: './workspace-a',
        'read-only': true,
      },
      snakeCaseFilesystem: {
        root: './workspace-b',
        read_only: true,
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(!findings.some((f) => f.id === 'mcp-filesystem-writable-path'))
})

test('structured MCP JSON scanner ignores unrelated writable booleans', () => {
  const config = JSON.stringify({
    mcpServers: {
      logging: {
        command: 'npx',
        config: {
          writable: true,
        },
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(!findings.some((f) => f.id === 'mcp-filesystem-writable-path'))
})

test('structured MCP JSON scanner ignores writable booleans alongside generic args', () => {
  const config = JSON.stringify({
    mcpServers: {
      logging: {
        command: 'npx',
        args: ['my-mcp-server'],
        writable: true,
      },
    },
  })
  const findings = scanMcpConfig(config)

  assert.ok(!findings.some((f) => f.id === 'mcp-filesystem-writable-path'))
})

test('structured MCP JSON scanner returns normally for excessive nesting', () => {
  let config = '{"root":"/"}'
  for (let depth = 0; depth < 20_000; depth += 1) {
    config = `{"child":${config}}`
  }

  assert.doesNotThrow(() => scanMcpConfig(config))
})

test('structured MCP TOML-ish scanner flags writable boolean filesystem settings', () => {
  const config = [
    '[mcp_servers.file-system]',
    'root = "./workspace"',
    'writable = true',
    '[mcp_servers.file_system_alt]',
    'path = "./workspace-alt"',
    'read_only = false',
  ].join('\n')
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
})

test('structured MCP TOML-ish scanner flags writable booleans in generic MCP sections', () => {
  const config = [
    '[mcp_servers.storage]',
    'path = "./workspace"',
    'writable = true',
  ].join('\n')
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
})

test('structured MCP TOML-ish scanner ignores writable booleans without path context', () => {
  const config = [
    '[mcp_servers.cache]',
    'writable = true',
    'readonly = false',
  ].join('\n')
  const findings = scanMcpConfig(config)

  assert.ok(!findings.some((f) => f.id === 'mcp-filesystem-writable-path'))
})

test('structured MCP TOML-ish scanner ignores explicit read-only booleans', () => {
  const config = [
    '[mcp_servers.cache]',
    'writable = false',
    'readonly = true',
  ].join('\n')
  const findings = scanMcpConfig(config)

  assert.ok(!findings.some((f) => f.id === 'mcp-filesystem-writable-path'))
})

test('structured MCP TOML-ish scanner flags home roots and credential env without prose false positives', () => {
  const riskyConfig = [
    '[mcp_servers.filesystem]',
    'args = ["--root", "~", "--writable", "./workspace"]',
    '[mcp_servers.github.env]',
    'GITHUB_TOKEN = "$GITHUB_TOKEN"',
  ].join('\n')
  const prose = 'Documentation says GITHUB_TOKEN can exist in a shell, but this sentence is not an env assignment.'

  const findings = scanMcpConfig(riskyConfig)
  const proseFindings = scanMcpConfig(prose)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'))
  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
  assert.ok(findings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
  assert.ok(!proseFindings.some((f) => f.id === 'mcp-env-token'))
})

test('structured MCP TOML-ish scanner preserves hash characters inside quoted values', () => {
  const config = [
    '[mcp_servers.filesystem]',
    'args = ["--root", "/safe#anchor", "--allow-write=./workspace"] # real comment',
  ].join('\n')
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high'))
})

test('structured MCP TOML-ish scanner flags credential keys in inline env tables', () => {
  const riskyConfig = [
    '[mcp_servers.github]',
    'command = "github-mcp-server"',
    'env = { GITHUB_TOKEN = "redacted", LOG_LEVEL = "info" }',
  ].join('\n')
  const safeConfig = [
    '[mcp_servers.cache]',
    'command = "cache-mcp-server"',
    'env = { SAFE_MODE = "true", LOG_LEVEL = "debug" }',
  ].join('\n')

  const riskyFindings = scanMcpConfig(riskyConfig)
  const safeFindings = scanMcpConfig(safeConfig)

  assert.ok(riskyFindings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
  assert.ok(!safeFindings.some((f) => f.id === 'mcp-env-token'))
})

test('structured MCP TOML-ish scanner ignores credential-like text inside inline env values', () => {
  const config = [
    '[mcp_servers.database]',
    'command = "db-mcp-server"',
    'env = { CONNECTION_STRING = "Host=localhost, Password=redacted", LOG_LEVEL = "info" }',
  ].join('\n')
  const findings = scanMcpConfig(config)

  assert.ok(!findings.some((f) => f.id === 'mcp-env-token'))
})

test('structured MCP TOML-ish scanner handles nested inline env tables without comma desync', () => {
  const arrayConfig = [
    '[mcp_servers.github]',
    'command = "github-mcp-server"',
    'env = { SAFE_LIST = ["a", "b"], GITHUB_TOKEN = "redacted" }',
  ].join('\n')
  const inlineServerConfig = [
    'mcp_servers.github = { command = "github-mcp-server", env = { GITHUB_TOKEN = "redacted" } }',
  ].join('\n')
  const dottedEnvConfig = [
    'mcp_servers.github.env = { GITHUB_TOKEN = "redacted" }',
    'mcp_servers = { github.env = { OPENAI_API_KEY = "redacted" } }',
  ].join('\n')
  const dottedEnvLeafConfig = [
    '[mcp_servers.github]',
    'env.GITHUB_TOKEN = "redacted"',
  ].join('\n')
  const tripleQuotedValueConfig = [
    '[mcp_servers.github]',
    'command = "github-mcp-server"',
    'env = { DESCRIPTION = """A "quote", and GITHUB_TOKEN = redacted""", LOG_LEVEL = "info" }',
  ].join('\n')
  const tripleQuotedBeforeCredentialConfig = [
    '[mcp_servers.github]',
    'command = "github-mcp-server"',
    'env = { DESCRIPTION = """A "quote""", GITHUB_TOKEN = "redacted" }',
  ].join('\n')
  const mismatchedBracketBeforeCredentialConfig = [
    '[mcp_servers.github]',
    'command = "github-mcp-server"',
    'env = { safe_key = ], GITHUB_TOKEN = "redacted" }',
  ].join('\n')

  const arrayFindings = scanMcpConfig(arrayConfig)
  const inlineServerFindings = scanMcpConfig(inlineServerConfig)
  const dottedEnvFindings = scanMcpConfig(dottedEnvConfig)
  const dottedEnvLeafFindings = scanMcpConfig(dottedEnvLeafConfig)
  const tripleQuotedValueFindings = scanMcpConfig(tripleQuotedValueConfig)
  const tripleQuotedBeforeCredentialFindings = scanMcpConfig(tripleQuotedBeforeCredentialConfig)
  const mismatchedBracketBeforeCredentialFindings = scanMcpConfig(mismatchedBracketBeforeCredentialConfig)

  assert.ok(arrayFindings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
  assert.ok(inlineServerFindings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
  assert.ok(dottedEnvFindings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
  assert.ok(dottedEnvLeafFindings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
  assert.ok(!tripleQuotedValueFindings.some((f) => f.id === 'mcp-env-token'))
  assert.ok(tripleQuotedBeforeCredentialFindings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
  assert.ok(mismatchedBracketBeforeCredentialFindings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
})

test('structured MCP TOML-ish scanner returns normally for excessive inline table nesting', () => {
  let config = '{ safe = "value" }'
  for (let depth = 0; depth < 20_000; depth += 1) {
    config = `{ child = ${config} }`
  }

  assert.doesNotThrow(() => scanMcpConfig(`mcp_servers.deep = ${config}`))
})

test('structured MCP scanner flags equals-form broad root arguments', () => {
  const jsonConfig = JSON.stringify({
    mcpServers: {
      filesystem: {
        args: ['--root=/', '--root=C:\\'],
      },
    },
  })
  const tomlishConfig = [
    '[mcp_servers.filesystem]',
    'args = ["--root=/"]',
  ].join('\n')

  const jsonFindings = scanMcpConfig(jsonConfig)
  const tomlishFindings = scanMcpConfig(tomlishConfig)

  assert.ok(jsonFindings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'))
  assert.ok(tomlishFindings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'))
})

test('scanDiff flags structured MCP risks from added config lines only', () => {
  const diff = [
    'diff --git a/config.json b/config.json',
    '--- a/config.json',
    '+++ b/config.json',
    '@@ -1,3 +1,9 @@',
    '-    "args": ["--root", "/"]',
    '+{',
    '+  "mcpServers": {',
    '+    "filesystem": {',
    '+      "args": ["--root", "/", "--allow-write", "./workspace"]',
    '+    }',
    '+  }',
    '+}',
  ].join('\n')

  const removedOnlyDiff = [
    'diff --git a/config.json b/config.json',
    '--- a/config.json',
    '+++ b/config.json',
    '@@ -1,7 +1,1 @@',
    '-{',
    '-  "mcpServers": {',
    '-    "filesystem": {',
    '-      "args": ["--root", "/", "--allow-write", "./workspace"]',
    '-    }',
    '-  }',
    '-}',
    '+{}',
  ].join('\n')
  const partialJsonDiff = [
    'diff --git a/config.json b/config.json',
    '--- a/config.json',
    '+++ b/config.json',
    '@@ -7,1 +7,1 @@',
    '+      "args": ["--root", "/", "--allow-write", "./workspace"]',
  ].join('\n')

  const multilinePartialJsonDiff = [
    'diff --git a/config.json b/config.json',
    '--- a/config.json',
    '+++ b/config.json',
    '@@ -7,1 +7,6 @@',
    '+      "args": [',
    '+        "--root",',
    '+        "/",',
    '+        "--allow-write",',
    '+        "./workspace"',
    '+      ]',
  ].join('\n')

  const safeCrossArrayDiff = [
    'diff --git a/config.json b/config.json',
    '--- a/config.json',
    '+++ b/config.json',
    '@@ -7,1 +7,8 @@',
    '+      "args": [',
    '+        "./workspace"',
    '+      ],',
    '+      "notes": [',
    '+        "/",',
    '+        "--allow-write"',
    '+      ]',
  ].join('\n')

  const windowsNestedPathDiff = [
    'diff --git a/config.json b/config.json',
    '--- a/config.json',
    '+++ b/config.json',
    '@@ -7,1 +7,3 @@',
    '+      "args": ["--root", "C:\\\\Users\\\\project"]',
  ].join('\n')

  const findings = scanDiff(diff)
  const removedOnlyFindings = scanDiff(removedOnlyDiff)
  const partialJsonFindings = scanDiff(partialJsonDiff)
  const multilinePartialJsonFindings = scanDiff(multilinePartialJsonDiff)
  const safeCrossArrayFindings = scanDiff(safeCrossArrayDiff)
  const windowsNestedPathFindings = scanDiff(windowsNestedPathDiff)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical' && f.file === 'diff'))
  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high' && f.file === 'diff'))
  assert.ok(partialJsonFindings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical' && f.file === 'diff'))
  assert.ok(partialJsonFindings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high' && f.file === 'diff'))
  assert.ok(multilinePartialJsonFindings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical' && f.file === 'diff'))
  assert.ok(multilinePartialJsonFindings.some((f) => f.id === 'mcp-filesystem-writable-path' && f.severity === 'high' && f.file === 'diff'))
  assert.ok(!safeCrossArrayFindings.some((f) => f.id === 'mcp-filesystem-wide-root'))
  assert.ok(!safeCrossArrayFindings.some((f) => f.id === 'mcp-filesystem-writable-path'))
  assert.ok(!windowsNestedPathFindings.some((f) => f.id === 'mcp-filesystem-wide-root'))
  assert.ok(!removedOnlyFindings.some((f) => f.id === 'mcp-filesystem-wide-root'))
  assert.ok(!removedOnlyFindings.some((f) => f.id === 'mcp-filesystem-writable-path'))
})

test('scanDiff does not combine structured MCP risks across unrelated files', () => {
  const diff = [
    'diff --git a/config-a.json b/config-a.json',
    '--- a/config-a.json',
    '+++ b/config-a.json',
    '@@ -1,1 +1,1 @@',
    '+      "args": [',
    'diff --git a/config-b.json b/config-b.json',
    '--- a/config-b.json',
    '+++ b/config-b.json',
    '@@ -1,1 +1,1 @@',
    '+        "/", "--allow-write", "./workspace"',
  ].join('\n')

  const findings = scanDiff(diff)

  assert.ok(!findings.some((f) => f.id === 'mcp-filesystem-wide-root'))
  assert.ok(!findings.some((f) => f.id === 'mcp-filesystem-writable-path'))
})

test('scanDiff does not combine structured MCP risks across unrelated hunks in one file', () => {
  const diff = [
    'diff --git a/config.json b/config.json',
    '--- a/config.json',
    '+++ b/config.json',
    '@@ -1,1 +1,1 @@',
    '+      "args": [',
    '@@ -20,1 +20,1 @@',
    '+        "/", "--allow-write", "./workspace"',
  ].join('\n')

  const findings = scanDiff(diff)

  assert.ok(!findings.some((f) => f.id === 'mcp-filesystem-wide-root'))
  assert.ok(!findings.some((f) => f.id === 'mcp-filesystem-writable-path'))
})

test('scanDiff reports repeated structured MCP findings across chunks', () => {
  const diff = [
    'diff --git a/config-a.json b/config-a.json',
    '--- a/config-a.json',
    '+++ b/config-a.json',
    '@@ -1,1 +1,1 @@',
    '+      "args": ["--root", "/", "--allow-write", "./workspace"]',
    'diff --git a/config-b.json b/config-b.json',
    '--- a/config-b.json',
    '+++ b/config-b.json',
    '@@ -1,1 +1,1 @@',
    '+      "args": ["--root", "/", "--allow-write", "./other"]',
  ].join('\n')

  const findingIds = scanDiff(diff).map((finding) => finding.id)

  assert.equal(findingIds.filter((id) => id === 'mcp-filesystem-wide-root').length, 2)
  assert.equal(findingIds.filter((id) => id === 'mcp-filesystem-writable-path').length, 2)
})

test('scanDiff normalizes CRLF added lines for structured MCP scanning', () => {
  const diff = [
    'diff --git a/config.json b/config.json\r',
    '--- a/config.json\r',
    '+++ b/config.json\r',
    '@@ -1,1 +1,1 @@\r',
    '+      "args": ["--root", "/", "--allow-write", "./workspace"]\r',
  ].join('\n')

  const findingIds = scanDiff(diff).map((finding) => finding.id)

  assert.ok(findingIds.includes('mcp-filesystem-wide-root'))
  assert.ok(findingIds.includes('mcp-filesystem-writable-path'))
})

test('scanDiff scans added content lines that begin with plus operators', () => {
  const diff = [
    'diff --git a/src/demo.ts b/src/demo.ts',
    '--- a/src/demo.ts',
    '+++ b/src/demo.ts',
    '@@ -1,1 +1,2 @@',
    '+++const command = "rm -rf /"',
    '+++ rm -rf /',
  ].join('\n')

  const findings = scanDiff(diff)
  const deniedCommandCount = findings.filter((finding) => finding.id === 'denied-command').length

  assert.equal(deniedCommandCount, 1)
})

test('scanDiff ignores plus-prefixed metadata before structured diff hunks', () => {
  const diff = [
    '+rm -rf /',
    'diff --git a/src/demo.ts b/src/demo.ts',
    '--- a/src/demo.ts',
    '+++ b/src/demo.ts',
    '@@ -1,1 +1,1 @@',
    '+console.log("safe")',
  ].join('\n')

  const findingIds = scanDiff(diff).map((finding) => finding.id)

  assert.ok(!findingIds.includes('denied-command'))
})

test('scanDiff treats header-like text inside raw added lines as content', () => {
  const diff = [
    '+const marker = "diff --git a/foo b/foo"',
    '+const token = "ghp_abcdefghijklmnopqrstuvwxyz"',
  ].join('\n')

  const findingIds = scanDiff(diff).map((finding) => finding.id)

  assert.ok(findingIds.includes('github-token'))
})

test('emits SARIF for GitHub code scanning', () => {
  const findings = scanDiff('+ const token = "ghp_abcdefghijklmnopqrstuvwxyz"')
  const sarif = JSON.parse(toSarif(findings))

  assert.equal(sarif.version, '2.1.0')
  assert.equal(sarif.runs[0].tool.driver.name, 'AgentGuard')
  assert.equal(sarif.runs[0].tool.driver.informationUri, 'https://github.com/Sungho-pk42ac/agentguard')
  assert.equal(sarif.runs[0].tool.driver.rules[0].properties['security-severity'], '9.0')
  assert.deepEqual(sarif.runs[0].tool.driver.rules[0].properties.tags, ['security', 'agentguard'])
  assert.equal(sarif.runs[0].tool.driver.rules[0].properties.precision, 'high')
  assert.equal(sarif.runs[0].results[0].ruleId, 'github-token')
  assert.equal(sarif.runs[0].results[0].level, 'error')
  assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'diff')
})
