import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { applyCleanup, planCleanup, type CleanupPlanItem } from '../src/cleanup-actions.js'
import type { ResidualCredential } from '../src/residual.js'

function workspace(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `agentguard-${prefix}-`))
}

function residual(partial: Partial<ResidualCredential> & Pick<ResidualCredential, 'id' | 'surface'>): ResidualCredential {
  return {
    kind: 'api-key',
    severity: 'critical',
    location: partial.location ?? partial.id,
    evidence: 'redacted',
    recommendation: 'rotate',
    ...partial,
  }
}

test('planCleanup maps a shell-rc line residual to a remove-line action', () => {
  const [item] = planCleanup([residual({ id: 'a', surface: 'shell-rc', path: '/home/x/.bashrc', location: '/home/x/.bashrc', line: 3 })])
  assert.equal(item.action, 'remove-line')
  assert.equal(item.line, 3)
})

test('planCleanup advises (never auto-edits) for npm-global and agent-config', () => {
  const items = planCleanup([
    residual({ id: 'n', surface: 'npm-global', location: 'npm-global:@openai/codex' }),
    residual({ id: 'c', surface: 'agent-config', path: '/home/x/claude_desktop_config.json', kind: 'mcp-perm' }),
  ])
  assert.ok(items.every((i) => i.action === 'advise'))
})

test('planCleanup deletes a sensitive project file but advises on inline code secrets', () => {
  const del = planCleanup([residual({ id: 'e', surface: 'project-file', path: '/repo/.env', location: '/repo/.env' })])
  assert.equal(del[0].action, 'delete-file')
  const code = planCleanup([residual({ id: 's', surface: 'project-file', path: '/repo/app.ts', location: '/repo/app.ts', line: 12 })])
  assert.equal(code[0].action, 'advise')
})

test('planCleanup deletes an AI tool directory vs file based on the filesystem', () => {
  const ws = workspace('cleanup-plan')
  const dir = join(ws, '.claude')
  mkdirSync(dir)
  const file = join(ws, '.claude.json')
  writeFileSync(file, '{}')
  const items = planCleanup([
    residual({ id: 'd', surface: 'ai-tool-dir', path: dir, location: dir }),
    residual({ id: 'f', surface: 'ai-tool-dir', path: file, location: file }),
  ])
  assert.equal(items[0].action, 'delete-dir')
  assert.equal(items[1].action, 'delete-file')
})

test('SAFETY INVARIANT: without approval, applyCleanup mutates nothing', () => {
  const ws = workspace('cleanup-noapprove')
  const target = join(ws, 'secret.env')
  writeFileSync(target, 'OPENAI_API_KEY=sk-xxxxxxxxxxxx\n')
  const plan: CleanupPlanItem[] = [{ residualId: 'e', action: 'delete-file', target, reason: 'x' }]

  const { records, trashDir } = applyCleanup(plan, { approved: false, homeDir: ws })

  assert.equal(existsSync(target), true, 'target file must still exist')
  assert.equal(readFileSync(target, 'utf8'), 'OPENAI_API_KEY=sk-xxxxxxxxxxxx\n')
  assert.equal(trashDir, undefined, 'no trash dir may be created without approval')
  assert.equal(existsSync(join(ws, '.agentguard')), false)
  assert.equal(records[0].status, 'skipped')
})

test('approved delete-file moves the target to the recoverable trash', () => {
  const ws = workspace('cleanup-delete')
  const target = join(ws, 'secret.env')
  writeFileSync(target, 'OPENAI_API_KEY=sk-xxxxxxxxxxxx\n')
  const plan: CleanupPlanItem[] = [{ residualId: 'e', action: 'delete-file', target, reason: 'x' }]

  const { records } = applyCleanup(plan, { approved: true, homeDir: ws, now: new Date('2026-07-04T00:00:00Z') })

  assert.equal(existsSync(target), false, 'original must be moved out')
  assert.equal(records[0].status, 'applied')
  assert.ok(records[0].backupPath, 'a backup path must be recorded')
  assert.equal(existsSync(records[0].backupPath!), true, 'backup must exist and be recoverable')
  assert.equal(readFileSync(records[0].backupPath!, 'utf8'), 'OPENAI_API_KEY=sk-xxxxxxxxxxxx\n')
})

test('approved remove-line backs up the file then drops only the offending line', () => {
  const ws = workspace('cleanup-line')
  const target = join(ws, '.bashrc')
  writeFileSync(target, 'export A=1\nexport OPENAI_API_KEY=sk-xxxxxxxx\nexport B=2\n')
  const plan: CleanupPlanItem[] = [{ residualId: 'k', action: 'remove-line', target, line: 2, reason: 'x' }]

  const { records } = applyCleanup(plan, { approved: true, homeDir: ws, now: new Date('2026-07-04T00:00:00Z') })

  assert.equal(records[0].status, 'applied')
  assert.equal(readFileSync(target, 'utf8'), 'export A=1\nexport B=2\n')
  assert.equal(readFileSync(records[0].backupPath!, 'utf8'), 'export A=1\nexport OPENAI_API_KEY=sk-xxxxxxxx\nexport B=2\n')
})

test('approved delete-dir moves a whole directory to the trash', () => {
  const ws = workspace('cleanup-dir')
  const dir = join(ws, '.claude')
  mkdirSync(dir)
  writeFileSync(join(dir, 'config.json'), '{"token":"sk-xxxxxxxxxxxx"}')
  const plan: CleanupPlanItem[] = [{ residualId: 'd', action: 'delete-dir', target: dir, reason: 'x' }]

  const { records } = applyCleanup(plan, { approved: true, homeDir: ws, now: new Date('2026-07-04T00:00:00Z') })

  assert.equal(existsSync(dir), false)
  assert.equal(records[0].status, 'applied')
  assert.equal(existsSync(join(records[0].backupPath!, 'config.json')), true)
})

test('cross-volume EXDEV falls back to copy + remove', () => {
  const ws = workspace('cleanup-exdev')
  const target = join(ws, 'secret.env')
  writeFileSync(target, 'k=v\n')
  const plan: CleanupPlanItem[] = [{ residualId: 'e', action: 'delete-file', target, reason: 'x' }]

  const { records } = applyCleanup(plan, {
    approved: true,
    homeDir: ws,
    fs: {
      rename: () => {
        throw Object.assign(new Error('EXDEV'), { code: 'EXDEV' })
      },
    },
  })

  assert.equal(records[0].status, 'applied')
  assert.equal(existsSync(target), false)
  assert.equal(existsSync(records[0].backupPath!), true)
})

test('locked-file EBUSY retries once then succeeds', () => {
  const ws = workspace('cleanup-ebusy')
  const target = join(ws, 'secret.env')
  writeFileSync(target, 'k=v\n')
  const plan: CleanupPlanItem[] = [{ residualId: 'e', action: 'delete-file', target, reason: 'x' }]

  let calls = 0
  const { records } = applyCleanup(plan, {
    approved: true,
    homeDir: ws,
    fs: {
      rename: (from, to) => {
        calls += 1
        if (calls === 1) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' })
        writeFileSync(to, readFileSync(from))
        writeFileSync(from, '') // simulate move
      },
    },
  })

  assert.equal(calls, 2)
  assert.equal(records[0].status, 'applied')
})

test('a persistently locked file is reported as failed, not silently dropped', () => {
  const ws = workspace('cleanup-ebusy-fail')
  const target = join(ws, 'secret.env')
  writeFileSync(target, 'k=v\n')
  const plan: CleanupPlanItem[] = [{ residualId: 'e', action: 'delete-file', target, reason: 'x' }]

  const { records } = applyCleanup(plan, {
    approved: true,
    homeDir: ws,
    fs: {
      rename: () => {
        throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' })
      },
    },
  })

  assert.equal(records[0].status, 'failed')
  assert.match(records[0].error ?? '', /EBUSY/)
  assert.equal(existsSync(target), true, 'a failed move must leave the original in place')
})
