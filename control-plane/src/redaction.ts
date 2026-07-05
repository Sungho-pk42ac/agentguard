import type { ReportPayload } from './contract.js'

// Server-side redaction re-check. This is INDEPENDENT of the client's
// SECRET_PATTERNS sweep (defense in depth): it combines secret-shape prefixes
// with a Shannon-entropy check on long contiguous token runs, so it can catch a
// raw secret the client patterns would miss. Any hit -> the ingest returns 422
// and NOTHING is persisted (never a silent stale store).

const SHAPE_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /npm_[A-Za-z0-9]{36}/,
  /AKIA[0-9A-Z]{16}/,
  /AIzaSy[0-9A-Za-z_-]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
]

function shannonEntropy(value: string): number {
  const freq = new Map<string, number>()
  for (const ch of value) freq.set(ch, (freq.get(ch) ?? 0) + 1)
  let entropy = 0
  for (const count of freq.values()) {
    const p = count / value.length
    entropy -= p * Math.log2(p)
  }
  return entropy
}

/**
 * True if a string looks like a raw secret by shape OR by high-entropy token run.
 *
 * `entropy` (default true) enables the generic high-entropy-run heuristic. Turn
 * it OFF for server-minted STRUCTURAL identifiers (orgId/assetId): those are
 * opaque high-entropy tokens BY DESIGN (e.g. `org_` + 24 hex ≈ 4.0 bits/char),
 * never a free-text field where an agent could leak a scanned secret, so the
 * entropy run would false-positive and 422 every real org's first report. The
 * shape check still runs so a literal `sk-`/`ghp_`/`AKIA`-shaped id is caught.
 */
export function looksLikeRawSecret(value: string, opts: { entropy?: boolean } = {}): boolean {
  const useEntropy = opts.entropy ?? true
  for (const re of SHAPE_PATTERNS) {
    if (re.test(value)) return true
  }
  if (!useEntropy) return false
  for (const match of value.matchAll(/[A-Za-z0-9_-]{25,}/g)) {
    const run = match[0]
    const mixed = (/[A-Za-z]/.test(run) && /[0-9]/.test(run)) || run.length >= 40
    if (mixed && shannonEntropy(run) > 3.5) return true
  }
  return false
}

export interface RedactionCheck {
  readonly leak: boolean
  readonly field?: string
}

/** Scan every human-facing string in a payload for a raw secret leak. */
export function payloadRedactionCheck(payload: ReportPayload): RedactionCheck {
  // Free-text / agent-supplied fields get the FULL check (shape + entropy).
  const candidates: Array<[string, string]> = [
    ['actor.subject', payload.actor.subject],
    ['scannedAt', payload.scannedAt],
    ['agentVersion', payload.agentVersion],
  ]
  for (let i = 0; i < payload.findings.length; i++) {
    const f = payload.findings[i]
    candidates.push([`findings[${i}].evidenceRedacted`, f.evidenceRedacted])
    candidates.push([`findings[${i}].location`, f.location])
    candidates.push([`findings[${i}].ruleId`, f.ruleId])
    candidates.push([`findings[${i}].surface`, f.surface])
  }
  for (const [field, value] of candidates) {
    if (looksLikeRawSecret(value)) return { leak: true, field }
  }
  // Server-minted STRUCTURAL identifiers are opaque high-entropy tokens by
  // design, so they get the shape-only check (entropy off) — otherwise a real
  // `org_<hex>` / minted assetId false-positives and 422s every first report.
  for (const [field, value] of [['orgId', payload.orgId], ['assetId', payload.assetId]] as const) {
    if (looksLikeRawSecret(value, { entropy: false })) return { leak: true, field }
  }
  return { leak: false }
}
