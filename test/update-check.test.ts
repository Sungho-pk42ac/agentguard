import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkForUpdate,
  compareVersions,
  formatUpdateStatus,
  isNewer,
  UPDATE_COMMAND,
} from '../src/update-check.js'

test('compareVersions orders dotted numeric versions', () => {
  assert.equal(compareVersions('0.3.0', '0.2.0'), 1)
  assert.equal(compareVersions('0.2.0', '0.3.0'), -1)
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0)
  assert.equal(compareVersions('0.10.0', '0.9.0'), 1)
  assert.equal(compareVersions('1.2.3-beta.1', '1.2.3'), 0)
})

test('isNewer is true only when latest is strictly ahead', () => {
  assert.equal(isNewer('0.4.0', '0.3.0'), true)
  assert.equal(isNewer('0.3.0', '0.3.0'), false)
  assert.equal(isNewer('0.2.0', '0.3.0'), false)
})

test('checkForUpdate reports an available update from an injected registry', async () => {
  const status = await checkForUpdate({
    current: '0.3.0',
    fetchImpl: async () => ({ ok: true, json: async () => ({ version: '0.4.0' }) }),
  })
  assert.equal(status.updateAvailable, true)
  assert.equal(status.checked, true)
  assert.equal(status.latest, '0.4.0')
  assert.equal(status.command, UPDATE_COMMAND)
})

test('checkForUpdate reports up-to-date when latest equals current', async () => {
  const status = await checkForUpdate({
    current: '0.3.0',
    fetchImpl: async () => ({ ok: true, json: async () => ({ version: '0.3.0' }) }),
  })
  assert.equal(status.updateAvailable, false)
  assert.equal(status.checked, true)
})

test('checkForUpdate degrades gracefully when the registry is unreachable', async () => {
  const status = await checkForUpdate({
    current: '0.3.0',
    fetchImpl: async () => {
      throw new Error('offline')
    },
  })
  assert.equal(status.checked, false)
  assert.equal(status.updateAvailable, false)
  assert.equal(status.command, UPDATE_COMMAND)
})

test('checkForUpdate degrades gracefully on a non-ok response', async () => {
  const status = await checkForUpdate({
    current: '0.3.0',
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
  })
  assert.equal(status.checked, false)
})

test('formatUpdateStatus surfaces the exact upgrade command', () => {
  const available = formatUpdateStatus(
    { current: '0.3.0', latest: '0.4.0', updateAvailable: true, checked: true, command: UPDATE_COMMAND },
    'ko',
  )
  assert.match(available, /0\.3\.0 → 0\.4\.0/)
  assert.match(available, /npm i -g @pk42ac\/agentguard@latest/)

  const current = formatUpdateStatus(
    { current: '0.3.0', updateAvailable: false, checked: true, command: UPDATE_COMMAND },
    'ko',
  )
  assert.match(current, /최신 버전/)

  const offline = formatUpdateStatus(
    { current: '0.3.0', updateAvailable: false, checked: false, command: UPDATE_COMMAND },
    'en',
  )
  assert.match(offline, /Update manually: npm i -g @pk42ac\/agentguard@latest/)
})
