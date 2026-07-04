import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { handleEnroll, type EnrollDeps } from '../src/ingest.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'

const NOW = Date.UTC(2026, 6, 4)

function ctx(): { storage: MemoryStorage; deps: EnrollDeps } {
  const storage = new MemoryStorage()
  const oidc = new StaticOidcVerifier({ 'good-token': { subject: 'repo:acme/web', provider: 'github' } })
  return { storage, deps: { storage, oidcVerifier: oidc, now: () => NOW, mintToken: () => 'device-secret' } }
}

test('OIDC enroll is rejected (403) when the identity is not granted for the org', () => {
  const c = ctx()
  const res = handleEnroll(JSON.stringify({ orgId: 'orgA', oidcToken: 'good-token', assetId: 'ci1' }), c.deps)
  assert.equal(res.status, 403, 'ungranted OIDC identity must not self-enroll into an org')
  assert.equal(c.storage.getAsset('orgA', 'ci1'), undefined)
})

test('OIDC enroll succeeds once granted, and re-enroll is a 409 (no clobber)', () => {
  const c = ctx()
  c.storage.grantOidc('orgA', 'github', 'repo:acme/web')
  const first = handleEnroll(JSON.stringify({ orgId: 'orgA', oidcToken: 'good-token', assetId: 'ci1' }), c.deps)
  assert.equal(first.status, 200)
  assert.equal(c.storage.getAsset('orgA', 'ci1')?.authKind, 'oidc')
  const again = handleEnroll(JSON.stringify({ orgId: 'orgA', oidcToken: 'good-token', assetId: 'ci1' }), c.deps)
  assert.equal(again.status, 409, 're-enroll must not clobber an existing binding')
})

test('OIDC enroll with an unknown token is rejected (401)', () => {
  const c = ctx()
  c.storage.grantOidc('orgA', 'github', 'repo:acme/web')
  const res = handleEnroll(JSON.stringify({ orgId: 'orgA', oidcToken: 'forged', assetId: 'ci1' }), c.deps)
  assert.equal(res.status, 401)
})

test('PC enroll consumes a one-time code, issues a device token, and refuses re-enroll (409)', () => {
  const c = ctx()
  c.storage.putEnrollmentCode('orgA', createHash('sha256').update('CODE1').digest('hex'), NOW + 1000)
  c.storage.putEnrollmentCode('orgA', createHash('sha256').update('CODE2').digest('hex'), NOW + 1000)
  const first = handleEnroll(JSON.stringify({ orgId: 'orgA', enrollmentCode: 'CODE1', assetId: 'pc1' }), c.deps)
  assert.equal(first.status, 200)
  assert.equal(first.json.deviceToken, 'device-secret')
  // a second code, same assetId -> conflict
  const again = handleEnroll(JSON.stringify({ orgId: 'orgA', enrollmentCode: 'CODE2', assetId: 'pc1' }), c.deps)
  assert.equal(again.status, 409)
})

test('PC enroll with an invalid code is rejected (401)', () => {
  const c = ctx()
  const res = handleEnroll(JSON.stringify({ orgId: 'orgA', enrollmentCode: 'NOPE', assetId: 'pc1' }), c.deps)
  assert.equal(res.status, 401)
})
