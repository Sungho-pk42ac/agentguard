// Org-scoped tenancy invariant (§6.5 / [R3/NEW-CR-3]): every StoragePort
// read is org-scoped OR keyed by a globally-unique row id (email,
// session/device token, invite code — see model.ts's own doc comment) —
// EXCEPT `cve_cache`, which is the SOLE surface that intentionally SHARES
// data across every org (public osv.dev advisory data, no org/asset/finding
// identity). This test parses storage/port.ts's own interface declaration so
// it fails loudly the moment any FUTURE method silently widens tenancy,
// without needing to be hand-updated for unrelated StoragePort growth.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { test } from 'node:test'
import { MemoryStorage } from '../src/storage/memory.js'
import { SqliteStorage } from '../src/storage/sqlite.js'
import type { StoragePort } from '../src/storage/port.js'
import type { CveCacheRecord } from '../src/model.js'

const PORT_SRC_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/storage/port.ts')

function extractInterfaceBody(source: string): string {
  const marker = 'export interface StoragePort {'
  const start = source.indexOf(marker)
  assert.ok(start >= 0, 'StoragePort interface declaration not found in storage/port.ts')
  const braceStart = start + marker.length - 1
  let depth = 0
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(braceStart + 1, i)
    }
  }
  throw new Error('unterminated StoragePort interface body')
}

function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if ('([{<'.includes(ch)) depth++
    if (')]}>'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim().length > 0) parts.push(cur)
  return parts
}

interface MethodSig {
  readonly name: string
  readonly firstParam: string | undefined
}

function extractMethods(body: string): MethodSig[] {
  const methods: MethodSig[] = []
  const nameRe = /(^|\n)[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)\(/g
  let m: RegExpExecArray | null
  while ((m = nameRe.exec(body))) {
    const name = m[2]!
    const parenStart = m.index + m[0].length - 1
    let depth = 0
    let end = -1
    for (let i = parenStart; i < body.length; i++) {
      if (body[i] === '(') depth++
      else if (body[i] === ')') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end === -1) continue
    const params = splitTopLevel(body.slice(parenStart + 1, end))
    const first = params[0]
    const firstParamName = first ? first.trim().split(/[:?]/)[0]!.trim() : undefined
    methods.push({ name, firstParam: firstParamName && firstParamName.length > 0 ? firstParamName : undefined })
  }
  return methods
}

// Reads (as opposed to pure writes) are the only surface that can leak data
// across tenants — a write's caller already supplied every field, including
// orgId, inside the record it's writing.
const READ_PREFIX = /^(get|list|is|exists|consume|count|approve|transition|resolve)/

// Pre-existing surfaces keyed by a globally-unique row id (documented in
// model.ts: "Every record is org-scoped except lookups keyed by a
// globally-unique row id (email, session/device token, invite/user code)").
// The key itself is an unguessable/unique identifier — fundamentally
// different from cve_cache's INTENTIONAL cross-tenant data sharing.
const GLOBAL_UNIQUE_KEY_READS = new Set([
  'getUserByEmail',
  'consumeInvite',
  'getSession',
  'getDeviceAuthByDeviceCode',
  'approveDeviceAuthByUserCode',
  'consumeDeviceAuth',
  'countRecentLoginFailures',
])

test('StoragePort: every read is org-scoped or globally-unique-key-scoped, EXCEPT cve_cache', () => {
  const source = readFileSync(PORT_SRC_PATH, 'utf8')
  const body = extractInterfaceBody(source)
  const methods = extractMethods(body)
  assert.ok(methods.length > 20, 'sanity: the interface should have parsed a substantial method list')

  const reads = methods.filter((m) => READ_PREFIX.test(m.name))
  const unscoped = reads.filter((m) => m.firstParam !== 'orgId' && !GLOBAL_UNIQUE_KEY_READS.has(m.name))

  assert.deepEqual(
    unscoped.map((m) => m.name).sort(),
    ['getCveCache'],
    'cve_cache must be the ONLY read surface that is neither org-scoped nor globally-unique-key-scoped; ' +
      'any other name here is an unreviewed tenancy widening',
  )

  // The paired write must exist too (documented alongside the read).
  assert.ok(
    methods.some((m) => m.name === 'putCveCache'),
    'putCveCache must exist alongside getCveCache',
  )

  // The whitelist rationale must be documented in the source, not just in this test.
  assert.match(source, /SOLE intentionally-global/, 'storage/port.ts must document the cve_cache whitelist rationale')
  assert.match(source, /cve_cache/i)
})

const impls: Array<[string, () => StoragePort]> = [
  ['memory', () => new MemoryStorage()],
  ['sqlite', () => new SqliteStorage(':memory:')],
]

for (const [name, make] of impls) {
  test(`${name}: cve_cache is functionally global (no org dimension in its key at all)`, async () => {
    const s = make()
    const record: CveCacheRecord = {
      vulnIds: ['GHSA-x'],
      details: [{ id: 'GHSA-x', severity: 'critical' }],
      fetchedAt: 1000,
      status: 'fresh',
    }
    await s.putCveCache('npm', 'leftpad', '1.0.0', record)
    // No orgId parameter exists on this surface at all — any caller for any
    // org reads the exact same cached row for the same (ecosystem, pkg, version).
    assert.deepEqual(await s.getCveCache('npm', 'leftpad', '1.0.0'), record)
    assert.equal(await s.getCveCache('npm', 'other-pkg', '1.0.0'), undefined)
    await s.close()
  })

  test(`${name}: every other well-known read stays strictly org-scoped (spot check)`, async () => {
    const s = make()
    await s.createAsset({ orgId: 'orgA', assetId: 'a1', label: 'a1', kind: 'pc', authKind: 'device-token', secret: 's', lastSeenAt: null, createdAt: 0 })
    await s.createAsset({ orgId: 'orgB', assetId: 'a1', label: 'a1', kind: 'pc', authKind: 'device-token', secret: 's', lastSeenAt: null, createdAt: 0 })
    assert.equal((await s.getAsset('orgA', 'a1'))?.orgId, 'orgA')
    assert.equal((await s.getAsset('orgB', 'a1'))?.orgId, 'orgB')
    s.close()
  })
}
