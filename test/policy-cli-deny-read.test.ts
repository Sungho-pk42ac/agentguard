import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { z } from 'zod'

const cliFindingsSchema = z.array(z.object({ id: z.string().optional(), file: z.string().optional() }))

test('CLI applies denied read paths from --policy to scan-files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const workspace = join(dir, 'workspace')
  const secretDir = join(workspace, 'private')
  const policyPath = join(dir, 'agent-policy.yaml')
  mkdirSync(secretDir, { recursive: true })
  writeFileSync(policyPath, ['deny_read:', '  - private/**'].join('\n'))
  writeFileSync(join(secretDir, 'session.txt'), 'session transcript without secrets')

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-files', workspace, '--policy', policyPath, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 1)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  assert.ok(findings.some((finding) => finding.id === 'denied-read-path' && finding.file === 'private/session.txt'))
})
