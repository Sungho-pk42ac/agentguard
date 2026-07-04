import { ALL_SCOPES, collectResiduals, type ResidualScanOptions } from '../residual-scan.js'
import type { ResidualCredential } from '../residual.js'
import { verdictForFindings, type ScanVerdict } from '../core.js'
import type { Finding, Severity } from '../rules.js'
import { severityScore } from '../rules.js'
import { residualToItem, type ExplorerItem } from './view-model.js'
import { scanNpmGlobalAsync } from '../detectors/npm-global.js'

// Pure data layer for the dashboard. Runs ONE scan via existing exports
// (collectResiduals — which already folds in agent-config posture, so there is
// no re-detection and no double count) and derives everything the tabs need.
// The synchronous scan is invoked by the component only AFTER an async boundary
// so Ink can paint a loading frame first (collectResiduals -> scanNpmGlobal ->
// spawnSync 'npm ls -g' blocks the event loop otherwise).

export interface SurfaceBar {
  readonly surface: string
  readonly count: number
  readonly severity: Severity
}

export interface DashboardData {
  readonly residuals: readonly ResidualCredential[]
  // Residuals split by surface family for the tabs (all via residualToItem).
  readonly credentialItems: readonly ExplorerItem[]
  readonly postureItems: readonly ExplorerItem[]
  readonly agentItems: readonly ExplorerItem[]
  readonly allItems: readonly ExplorerItem[]
  readonly verdict: ScanVerdict
  readonly aggregate: { readonly findings: number; readonly critical: number }
  readonly surfaces: readonly SurfaceBar[]
  readonly scannedAt: number
}

// Surface families → tabs. Keyed on the ACTUAL residual.surface labels emitted
// by collectResiduals (note: 'project-file' is SINGULAR, distinct from the
// SCOPE_ITEMS key 'project-files').
const CREDENTIAL_SURFACES = new Set(['shell-rc', 'ai-tool-dir', 'project-file'])
const POSTURE_SURFACES = new Set(['agent-config'])
const AGENT_SURFACES = new Set(['npm-global', 'ai-tool-dir'])

function maxSeverity(residuals: readonly ResidualCredential[]): Severity {
  let best: Severity = 'low'
  for (const r of residuals) {
    if (severityScore(r.severity) > severityScore(best)) best = r.severity
  }
  return best
}

// Verdict adapter: verdictForFindings is typed for Finding[] and only reads
// `.severity`; feed the residual set through a {severity} projection.
export function verdictForResiduals(residuals: readonly ResidualCredential[]): ScanVerdict {
  return verdictForFindings(residuals.map((r) => ({ severity: r.severity }) as Finding))
}

export function surfaceBars(residuals: readonly ResidualCredential[]): SurfaceBar[] {
  const bySurface = new Map<string, ResidualCredential[]>()
  for (const r of residuals) {
    const list = bySurface.get(r.surface) ?? []
    list.push(r)
    bySurface.set(r.surface, list)
  }
  return [...bySurface.entries()]
    .map(([surface, list]) => ({ surface, count: list.length, severity: maxSeverity(list) }))
    .sort((a, b) => b.count - a.count || severityScore(b.severity) - severityScore(a.severity))
}

export interface LoadDashboardOptions extends ResidualScanOptions {
  readonly now?: number
}

export function buildDashboardData(residuals: readonly ResidualCredential[], now: number = Date.now()): DashboardData {
  const filterSurfaces = (set: Set<string>) => residuals.filter((r) => set.has(r.surface)).map(residualToItem)
  return {
    residuals,
    credentialItems: filterSurfaces(CREDENTIAL_SURFACES),
    postureItems: filterSurfaces(POSTURE_SURFACES),
    agentItems: filterSurfaces(AGENT_SURFACES),
    allItems: residuals.map(residualToItem),
    verdict: verdictForResiduals(residuals),
    aggregate: {
      findings: residuals.length,
      critical: residuals.filter((r) => r.severity === 'critical').length,
    },
    surfaces: surfaceBars(residuals),
    scannedAt: now,
  }
}

// Synchronous scan (collectResiduals). MUST be called behind an async boundary
// by the component so the loading frame paints first.
export function loadDashboardData(options: LoadDashboardOptions = {}): DashboardData {
  const residuals = collectResiduals(options)
  return buildDashboardData(residuals, options.now)
}

// Async twin of loadDashboardData for the interactive dashboard. Runs the fast,
// bounded local surfaces synchronously, then awaits the global npm CLI inventory
// via non-blocking spawn so the loading spinner keeps animating instead of
// freezing the terminal. Produces the same residual set as the sync path (npm
// residuals appended after the local ones).
export async function loadDashboardDataAsync(options: LoadDashboardOptions = {}): Promise<DashboardData> {
  const effective = options.scope ?? ALL_SCOPES
  const local = collectResiduals({ ...options, scope: effective.filter((s) => s !== 'npm-global') })
  const npm = effective.includes('npm-global') ? await scanNpmGlobalAsync({ platform: options.platform }) : []
  return buildDashboardData([...local, ...npm], options.now)
}
