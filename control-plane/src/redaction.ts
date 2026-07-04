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

/** True if a string looks like a raw secret by shape OR by high-entropy token run. */
export function looksLikeRawSecret(value: string): boolean {
  for (const re of SHAPE_PATTERNS) {
    if (re.test(value)) return true
  }
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
  const candidates: Array<[string, string]> = [
    ['actor.subject', payload.actor.subject],
    ['assetId', payload.assetId],
    ['orgId', payload.orgId],
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
  return { leak: false }
}
