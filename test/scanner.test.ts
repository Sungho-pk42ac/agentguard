import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scanDiff, scanMcpConfig, scanText } from '../src/scanner.js'
import { riskScore, toSarif } from '../src/report.js'

test('detects secrets in text and redacts evidence', () => {
  const findings = scanText('OPENAI_API_KEY="sk-abcdefghijklmnopqrstuvwxyz"')
  assert.equal(findings[0]?.severity, 'critical')
  assert.match(findings[0]?.evidence ?? '', /sk-a…/)
})

test('scanDiff only checks added lines', () => {
  const findings = scanDiff('- sk-oldoldoldoldoldoldoldold\n+ sk-newnewnewnewnewnewnewnew')
  assert.equal(findings.length, 1)
  assert.match(findings[0].evidence, /new/)
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

test('emits SARIF for GitHub code scanning', () => {
  const findings = scanDiff('+ const token = "ghp_abcdefghijklmnopqrstuvwxyz"')
  const sarif = JSON.parse(toSarif(findings))

  assert.equal(sarif.version, '2.1.0')
  assert.equal(sarif.runs[0].tool.driver.name, 'AgentGuard')
  assert.equal(sarif.runs[0].tool.driver.rules[0].properties['security-severity'], '9.0')
  assert.deepEqual(sarif.runs[0].tool.driver.rules[0].properties.tags, ['security', 'agentguard'])
  assert.equal(sarif.runs[0].tool.driver.rules[0].properties.precision, 'high')
  assert.equal(sarif.runs[0].results[0].ruleId, 'github-token')
  assert.equal(sarif.runs[0].results[0].level, 'error')
  assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'diff')
})
