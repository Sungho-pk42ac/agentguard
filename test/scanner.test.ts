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
    'GITHUB_TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz"',
  ].join('\n')
  const findings = scanMcpConfig(config)

  assert.ok(findings.some((f) => f.id === 'mcp-filesystem-wide-root' && f.severity === 'critical'))
  assert.ok(findings.some((f) => f.id === 'mcp-env-token' && f.severity === 'high'))
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
