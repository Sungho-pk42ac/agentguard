import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleFindings } from '../src/dashboard.js'
import { MemoryStorage } from '../src/storage/memory.js'
import type { ReportFinding } from '../src/contract.js'

function deps() {
  const storage = new MemoryStorage()
  return { storage, now: () => Date.now(), staleThresholdHours: 48 }
}

function rf(over: Partial<ReportFinding>): ReportFinding {
  return {
    ruleId: 'npm-vuln',
    surface: 'npm-global',
    severity: 'high',
    location: 'lodash@4.17.4',
    evidenceRedacted: 'lodash@4.17.4',
    fingerprint: 'a'.repeat(32),
    ...over,
  }
}

// Regression (G003/G004 integration): the CVE view and advisory badges are dead
// unless /v1/findings actually echoes the enrichment fields. handleFindings
// previously mapped a fixed allowlist that dropped cveIds/cveSeverity/advisory,
// so the web CVE page always rendered empty. These fields are public,
// redaction-safe, and additive.
test('handleFindings echoes cveIds + cveSeverity after CVE enrichment (updateFindingCve)', () => {
  const d = deps()
  const fp = 'a'.repeat(32)
  d.storage.upsertFinding('orgA', 'pc1', rf({ fingerprint: fp }), 0)
  d.storage.updateFindingCve('orgA', 'pc1', fp, ['GHSA-jf85-cpcp-j695', 'CVE-2019-10744'], 'critical')
  const res = handleFindings('orgA', {}, d)
  assert.equal(res.status, 200)
  const [f] = (res.json as { findings: Array<Record<string, unknown>> }).findings
  assert.deepEqual(f.cveIds, ['GHSA-jf85-cpcp-j695', 'CVE-2019-10744'])
  assert.equal(f.cveSeverity, 'critical')
})

test('handleFindings echoes advisory:true for an advisory finding, and omits the fields when absent', () => {
  const d = deps()
  d.storage.upsertFinding('orgA', 'pc1', rf({ ruleId: 'mcp-unapproved', surface: 'mcp-risk', severity: 'low', advisory: true, fingerprint: 'b'.repeat(32) }), 0)
  d.storage.upsertFinding('orgA', 'pc1', rf({ fingerprint: 'c'.repeat(32) }), 0) // plain finding, no cve/advisory
  const res = handleFindings('orgA', {}, d)
  const findings = (res.json as { findings: Array<Record<string, unknown>> }).findings
  const advisory = findings.find((f) => f.fingerprint === 'b'.repeat(32))!
  const plain = findings.find((f) => f.fingerprint === 'c'.repeat(32))!
  assert.equal(advisory.advisory, true)
  assert.equal('advisory' in plain, false, 'non-advisory findings do not carry the flag')
  assert.equal('cveIds' in plain, false, 'un-enriched findings do not carry cveIds')
})
