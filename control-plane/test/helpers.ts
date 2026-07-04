import { createHmac } from 'node:crypto'
import { buildFingerprint, type ReportFinding, type ReportPayload } from '../src/contract.js'

export function finding(over: Partial<ReportFinding> = {}): ReportFinding {
  const base = {
    ruleId: 'openai-key',
    surface: 'secret',
    severity: 'critical' as const,
    location: '~/.zshrc:42',
    evidenceRedacted: 'sk-p…0000',
  }
  const merged = { ...base, ...over }
  return {
    ...merged,
    fingerprint:
      over.fingerprint ??
      buildFingerprint({ ruleId: merged.ruleId, location: merged.location, evidenceRedacted: merged.evidenceRedacted }),
  }
}

export function payload(orgId: string, assetId: string, findings: ReportFinding[], over: Partial<ReportPayload> = {}): ReportPayload {
  return {
    schemaVersion: 1,
    orgId,
    assetId,
    actor: { type: 'device-token', subject: `${assetId}@${orgId}` },
    scannedAt: '2026-07-04T00:00:00.000Z',
    agentVersion: '0.3.0',
    findings,
    ...over,
  }
}

export function deviceHeaders(assetId: string, secret: string, body: string, tsSeconds: number): Record<string, string> {
  const signature = createHmac('sha256', secret).update(`${tsSeconds}.${body}`).digest('hex')
  return {
    'content-type': 'application/json',
    'x-agentguard-asset': assetId,
    'x-agentguard-timestamp': String(tsSeconds),
    'x-agentguard-signature': `v1=${signature}`,
  }
}

export function oidcHeaders(assetId: string, token: string, tsSeconds: number): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-agentguard-asset': assetId,
    'x-agentguard-timestamp': String(tsSeconds),
    authorization: `Bearer ${token}`,
  }
}
