import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enrichFindings, extractPackage, severityFromOsvVuln, type EnrichDeps } from '../src/cve.js'
import { handleReport, type IngestDeps } from '../src/ingest.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { SqliteStorage } from '../src/storage/sqlite.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import type { StoragePort } from '../src/storage/port.js'
import type { AssetRecord } from '../src/model.js'
import { deviceHeaders, finding, payload } from './helpers.js'

const NOW = 1_700_000_000_000
const SECRET = 'device-secret-xyz'

function npmFinding(pkg: string, version: string, fingerprint: string) {
  return finding({
    surface: 'npm-global',
    ruleId: 'npm-global-ai-cli',
    location: `npm-global:${pkg}`,
    evidenceRedacted: `Global AI CLI installed: ${pkg}@${version}`,
    fingerprint,
  })
}

// ── mock fetch: records calls, serves canned querybatch/vulns responses ──
interface MockFetchOptions {
  readonly vulnsByPackageIndex: string[][] // querybatch response: vuln ids per query, in order
  readonly vulnDetails: Record<string, unknown> // vuln id -> osv vuln detail JSON
  readonly querybatchFails?: boolean
  readonly querybatchStatus?: number
  readonly hang?: boolean
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response
}

function mockFetch(opts: MockFetchOptions): { fetch: EnrichDeps['fetch']; calls: { url: string; body?: string }[] } {
  const calls: { url: string; body?: string }[] = []
  const fetchFn: EnrichDeps['fetch'] = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body as string | undefined })
    if (opts.hang) return new Promise<Response>(() => {}) // never resolves
    if (url === 'https://api.osv.dev/v1/querybatch') {
      if (opts.querybatchFails) throw new Error('network down')
      if (opts.querybatchStatus && opts.querybatchStatus >= 300) return jsonResponse({}, false, opts.querybatchStatus)
      return jsonResponse({ results: opts.vulnsByPackageIndex.map((ids) => ({ vulns: ids.map((id) => ({ id })) })) })
    }
    const match = /\/v1\/vulns\/(.+)$/.exec(url)
    const id = match?.[1]
    if (id && opts.vulnDetails[id]) return jsonResponse(opts.vulnDetails[id])
    return jsonResponse({}, false, 404)
  }
  return { fetch: fetchFn, calls }
}

function baseEnrichDeps(storage: StoragePort, opts: MockFetchOptions): { deps: EnrichDeps; calls: { url: string; body?: string }[] } {
  const { fetch, calls } = mockFetch(opts)
  return { deps: { storage, fetch, now: () => NOW }, calls }
}

const impls: Array<[string, () => StoragePort]> = [
  ['memory', () => new MemoryStorage()],
  ['sqlite', () => new SqliteStorage(':memory:')],
]

for (const [name, make] of impls) {
  test(`${name}: querybatch is called with the right package set`, async () => {
    const storage = make()
    storage.upsertFinding('orgA', 'a1', npmFinding('leftpad', '1.0.0', 'f'.repeat(32)), NOW)
    const { deps, calls } = baseEnrichDeps(storage, {
      vulnsByPackageIndex: [['GHSA-1']],
      vulnDetails: { 'GHSA-1': { summary: 'bad', severity: [{ type: 'CVSS_V3', score: '9.8' }] } },
    })
    await enrichFindings(deps, 'orgA')
    const batchCall = calls.find((c) => c.url === 'https://api.osv.dev/v1/querybatch')
    assert.ok(batchCall, 'querybatch must be called')
    const parsedBody = JSON.parse(batchCall!.body!)
    assert.deepEqual(parsedBody.queries, [{ package: { name: 'leftpad', ecosystem: 'npm' }, version: '1.0.0' }])
    storage.close()
  })

  test(`${name}: findings carry cveIds + max severity after enrichment`, async () => {
    const storage = make()
    storage.upsertFinding('orgA', 'a1', npmFinding('leftpad', '1.0.0', 'a'.repeat(32)), NOW)
    const { deps } = baseEnrichDeps(storage, {
      vulnsByPackageIndex: [['GHSA-1', 'GHSA-2']],
      vulnDetails: {
        'GHSA-1': { severity: [{ type: 'CVSS_V3', score: '3.0' }] }, // low
        'GHSA-2': { severity: [{ type: 'CVSS_V3', score: '9.8' }] }, // critical
      },
    })
    await enrichFindings(deps, 'orgA')
    const [f] = storage.listFindings('orgA')
    assert.deepEqual(f?.cveIds, ['GHSA-1', 'GHSA-2'])
    assert.equal(f?.cveSeverity, 'critical', 'severity is the MAX across matched vulns')
    storage.close()
  })

  test(`${name}: CVSS score mapping, including unknown (no parseable score/label)`, async () => {
    assert.equal(severityFromOsvVuln({ severity: [{ type: 'CVSS_V3', score: '2.0' }] }), 'low')
    assert.equal(severityFromOsvVuln({ severity: [{ type: 'CVSS_V3', score: '5.5' }] }), 'medium')
    assert.equal(severityFromOsvVuln({ severity: [{ type: 'CVSS_V3', score: '7.2' }] }), 'high')
    assert.equal(severityFromOsvVuln({ severity: [{ type: 'CVSS_V3', score: '9.1' }] }), 'critical')
    assert.equal(severityFromOsvVuln({ severity: [] }), 'unknown')
    assert.equal(severityFromOsvVuln({}), 'unknown')
    assert.equal(severityFromOsvVuln({ database_specific: { severity: 'HIGH' } }), 'high')
    assert.equal(severityFromOsvVuln({ database_specific: { severity: 'not-a-real-label' } }), 'unknown')
  })

  test(`${name}: second enrichment for the same package@version does 0 vuln detail fetches`, async () => {
    const storage = make()
    storage.upsertFinding('orgA', 'a1', npmFinding('leftpad', '1.0.0', 'b'.repeat(32)), NOW)
    const { deps, calls } = baseEnrichDeps(storage, {
      vulnsByPackageIndex: [['GHSA-1']],
      vulnDetails: { 'GHSA-1': { severity: [{ type: 'CVSS_V3', score: '9.8' }] } },
    })
    await enrichFindings(deps, 'orgA')
    const firstVulnFetches = calls.filter((c) => c.url.includes('/v1/vulns/')).length
    assert.equal(firstVulnFetches, 1)

    calls.length = 0
    await enrichFindings(deps, 'orgA')
    const secondVulnFetches = calls.filter((c) => c.url.includes('/v1/vulns/')).length
    assert.equal(secondVulnFetches, 0, 'a fresh cache entry must not re-fetch vuln details')
    assert.equal(calls.filter((c) => c.url === 'https://api.osv.dev/v1/querybatch').length, 0, 'nor re-run querybatch')
    storage.close()
  })

  test(`${name}: cve_cache is global across orgs (org A primes the cache; org B's finding is enriched with 0 new fetches)`, async () => {
    const storage = make()
    storage.upsertFinding('orgA', 'a1', npmFinding('leftpad', '1.0.0', 'c'.repeat(32)), NOW)
    storage.upsertFinding('orgB', 'b1', npmFinding('leftpad', '1.0.0', 'd'.repeat(32)), NOW)
    const { deps, calls } = baseEnrichDeps(storage, {
      vulnsByPackageIndex: [['GHSA-1']],
      vulnDetails: { 'GHSA-1': { severity: [{ type: 'CVSS_V3', score: '9.8' }] } },
    })
    await enrichFindings(deps, 'orgA')
    calls.length = 0
    await enrichFindings(deps, 'orgB')
    assert.equal(calls.length, 0, 'org B must reuse the global cache primed by org A: zero network calls')

    const [fa] = storage.listFindings('orgA')
    const [fb] = storage.listFindings('orgB')
    assert.deepEqual(fa?.cveIds, ['GHSA-1'])
    assert.deepEqual(fb?.cveIds, ['GHSA-1'], "org B's finding IS enriched from the shared global cache")
    storage.close()
  })

  test(`${name}: osv 5xx never blocks or fails ingest (post-persist async)`, async () => {
    const storage = make()
    const asset: AssetRecord = { orgId: 'orgA', assetId: 'pc1', label: 'pc1', kind: 'pc', authKind: 'device-token', secret: SECRET, lastSeenAt: null, createdAt: 0 }
    storage.createAsset(asset)
    const { fetch } = mockFetch({ vulnsByPackageIndex: [], vulnDetails: {}, querybatchStatus: 503 })
    let enqueued: (() => void) | undefined
    const deps: IngestDeps = {
      storage,
      notifier: new RecordingNotifier(),
      oidcVerifier: new StaticOidcVerifier(),
      now: () => NOW,
      enrich: { deps: { storage, fetch, now: () => NOW }, enqueue: (fn) => { enqueued = fn } },
    }
    const body = JSON.stringify(payload('orgA', 'pc1', [npmFinding('leftpad', '1.0.0', 'e'.repeat(32))]))
    const res = await handleReport(body, deviceHeaders('pc1', SECRET, body, Math.floor(NOW / 1000)), deps)
    assert.equal(res.status, 202, 'ingest must accept despite osv 5xx')
    assert.ok(enqueued, 'enrichment must have been enqueued')
    await enqueued!() // run it out-of-band; must not throw
    storage.close()
  })

  test(`${name}: osv throw never blocks or fails ingest`, async () => {
    const storage = make()
    const asset: AssetRecord = { orgId: 'orgA', assetId: 'pc1', label: 'pc1', kind: 'pc', authKind: 'device-token', secret: SECRET, lastSeenAt: null, createdAt: 0 }
    storage.createAsset(asset)
    const { fetch } = mockFetch({ vulnsByPackageIndex: [], vulnDetails: {}, querybatchFails: true })
    let enqueued: (() => void) | undefined
    const deps: IngestDeps = {
      storage,
      notifier: new RecordingNotifier(),
      oidcVerifier: new StaticOidcVerifier(),
      now: () => NOW,
      enrich: { deps: { storage, fetch, now: () => NOW }, enqueue: (fn) => { enqueued = fn } },
    }
    const body = JSON.stringify(payload('orgA', 'pc1', [npmFinding('leftpad', '1.0.0', 'f0'.repeat(16)), finding()]))
    const res = await handleReport(body, deviceHeaders('pc1', SECRET, body, Math.floor(NOW / 1000)), deps)
    assert.equal(res.status, 202)
    assert.ok(enqueued)
    await assert.doesNotReject(async () => enqueued!())
    storage.close()
  })

  test(`${name}: osv hang never blocks ingest (response returns before enrichment settles)`, async () => {
    const storage = make()
    const asset: AssetRecord = { orgId: 'orgA', assetId: 'pc1', label: 'pc1', kind: 'pc', authKind: 'device-token', secret: SECRET, lastSeenAt: null, createdAt: 0 }
    storage.createAsset(asset)
    const { fetch } = mockFetch({ vulnsByPackageIndex: [], vulnDetails: {}, hang: true })
    let enqueueCalled = false
    const deps: IngestDeps = {
      storage,
      notifier: new RecordingNotifier(),
      oidcVerifier: new StaticOidcVerifier(),
      now: () => NOW,
      enrich: {
        deps: { storage, fetch, now: () => NOW },
        // Emulate the default setImmediate-style enqueue: fire the job but
        // do NOT await it — handleReport must already have returned.
        enqueue: (fn) => {
          enqueueCalled = true
          fn()
        },
      },
    }
    const body = JSON.stringify(payload('orgA', 'pc1', [npmFinding('leftpad', '1.0.0', 'a1'.repeat(16))]))
    const res = await handleReport(body, deviceHeaders('pc1', SECRET, body, Math.floor(NOW / 1000)), deps)
    assert.equal(res.status, 202, 'ingest returns even though the enqueued enrichment job is hung forever')
    assert.equal(enqueueCalled, true)
    storage.close()
  })

  test(`${name}: extractPackage only matches package-shaped (npm-global) surfaces`, () => {
    assert.equal(extractPackage({ surface: 'secret', evidenceRedacted: 'sk-p…0000' }), null)
    const parsed = extractPackage({ surface: 'npm-global', evidenceRedacted: 'Global AI CLI installed: @openai/codex@1.2.3' })
    assert.deepEqual(parsed, { ecosystem: 'npm', name: '@openai/codex', version: '1.2.3' })
  })

  test(`${name}: non-package findings are left untouched by enrichment`, async () => {
    const storage = make()
    storage.upsertFinding('orgA', 'a1', finding(), NOW) // secret surface, not package-shaped
    const { deps, calls } = baseEnrichDeps(storage, { vulnsByPackageIndex: [], vulnDetails: {} })
    await enrichFindings(deps, 'orgA')
    assert.equal(calls.length, 0, 'no osv call for a finding with no extractable package')
    const [f] = storage.listFindings('orgA')
    assert.equal(f?.cveIds, undefined)
    storage.close()
  })
}
