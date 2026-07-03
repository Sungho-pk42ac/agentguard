import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { scanFiles } from '../src/scanner.js'
import type { Policy } from '../src/rules.js'

test('scanFiles reports findings with forward-slash paths regardless of host OS', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-path-normalize-'))
  const workspace = join(dir, 'workspace')
  const nestedPrivate = join(workspace, 'nested', 'private')
  mkdirSync(nestedPrivate, { recursive: true })
  writeFileSync(join(nestedPrivate, 'session.txt'), 'plain text placeholder')
  const policy: Policy = {
    denyRead: ['private/**'],
    denyCommands: [],
    requireApproval: [],
    mcp: { denyServers: [], denyTools: [], requireApprovalTools: [] },
  }

  const findings = scanFiles(workspace, policy)
  const finding = findings.find((candidate) => candidate.id === 'denied-read-path')

  assert.ok(finding, 'expected a denied-read-path finding')
  assert.ok(finding.file.includes('/'), `expected finding.file to include '/': ${finding.file}`)
  assert.ok(!finding.file.includes('\\'), `expected finding.file to not include '\\': ${finding.file}`)
})
