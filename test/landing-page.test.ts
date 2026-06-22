import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'

test('premium landing page documents AgentGuard value without fake trust claims', () => {
  const html = readFileSync('docs/landing.html', 'utf8')
  const size = statSync('docs/landing.html').size

  assert.ok(size > 15_000, 'landing page should be a substantial standalone asset')
  assert.match(html, /AgentOps security/i)
  assert.match(html, /Codex/i)
  assert.match(html, /Claude Code/i)
  assert.match(html, /MCP/i)
  assert.match(html, /Scan PR diffs/i)
  assert.match(html, /example report/i)
  assert.match(html, /trust & security/i)
  assert.match(html, /No fake customer logos/i)
  assert.doesNotMatch(html, /<script\s+src=/i)
  assert.doesNotMatch(html, /<link\s[^>]*rel=["']stylesheet/i)
  assert.doesNotMatch(html, /<img\s[^>]*src=["']https?:/i)
  assert.doesNotMatch(html, /trusted by \d/i)
  assert.doesNotMatch(html, /Fortune 500/i)
  assert.doesNotMatch(html, /\$\d+[MBK]? saved/i)
})
