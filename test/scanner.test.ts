import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { scanDiff, scanFiles, scanMcpConfig, scanText } from '../src/scanner.js'
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
