import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scanDiff, scanMcpConfig, scanText } from '../src/scanner.js'
import { riskScore } from '../src/report.js'

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
