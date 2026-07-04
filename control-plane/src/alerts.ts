import type { ReportFinding } from './contract.js'
import type { NotifierPort } from './notify/port.js'
import type { StoragePort } from './storage/port.js'

// Alert engine. Fires on findings that are (a) severity critical and (b) NEW
// for the org (no prior alert for that fingerprint). Dedup is keyed on
// (orgId, fingerprint) via the alerts table, so the same fingerprint never
// fires twice — even across assets or re-reports.

export interface AlertDeps {
  readonly storage: StoragePort
  readonly notifier: NotifierPort
  readonly now: () => number
  readonly channel?: string
}

export async function processAlerts(
  orgId: string,
  assetId: string,
  findings: readonly ReportFinding[],
  deps: AlertDeps,
): Promise<number> {
  const channel = deps.channel ?? 'default'
  let fired = 0
  const seenThisBatch = new Set<string>()
  for (const finding of findings) {
    if (finding.severity !== 'critical') continue
    if (seenThisBatch.has(finding.fingerprint)) continue
    seenThisBatch.add(finding.fingerprint)
    if (deps.storage.alertExists(orgId, finding.fingerprint)) continue
    const firedAt = deps.now()
    deps.storage.recordAlert({ orgId, fingerprint: finding.fingerprint, severity: finding.severity, firedAt, channel })
    await deps.notifier.notify({
      orgId,
      assetId,
      ruleId: finding.ruleId,
      surface: finding.surface,
      severity: finding.severity,
      fingerprint: finding.fingerprint,
      location: finding.location,
      firedAt,
    })
    fired += 1
  }
  return fired
}
