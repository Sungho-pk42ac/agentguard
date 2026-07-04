import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as cli from '../../src/contract/report-payload.js'
import * as cp from '../src/contract.js'
import { payload, finding } from './helpers.js'

// The control plane MUST validate against the EXACT same schema the report
// agent uses. The re-export makes them one object; these tests fail loudly if
// that ever drifts (e.g. someone copies the schema instead of re-exporting).

test('control-plane re-export is the same schema object as the CLI contract', () => {
  assert.equal(cp.reportPayloadSchema, cli.reportPayloadSchema)
  assert.equal(cp.buildFingerprint, cli.buildFingerprint)
  assert.equal(cp.SCHEMA_VERSION, cli.SCHEMA_VERSION)
})

test('a golden payload validates identically on both entry points', () => {
  const good = payload('org_acme', 'asset_pc1', [finding()])
  assert.deepEqual(cli.reportPayloadSchema.parse(good), cp.reportPayloadSchema.parse(good))
})

test('both reject an unknown key (strict) and a bad fingerprint', () => {
  const withExtra = { ...payload('o', 'a', [finding()]), rogue: true }
  assert.equal(cli.reportPayloadSchema.safeParse(withExtra).success, false)
  assert.equal(cp.reportPayloadSchema.safeParse(withExtra).success, false)

  const badFp = payload('o', 'a', [finding({ fingerprint: 'not-hex' })])
  assert.equal(cp.reportPayloadSchema.safeParse(badFp).success, false)
})
