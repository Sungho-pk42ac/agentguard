import { assetStatuses, summarize, trend, type AssetStatus, type FleetSummary, type TrendPoint } from './aggregate.js'
import type { FindingFilter, Severity } from './model.js'
import type { StoragePort } from './storage/port.js'
import type { HandlerResponse } from './ingest.js'

export interface ReadDeps {
  readonly storage: StoragePort
  readonly now: () => number
  readonly staleThresholdHours?: number
}

export async function handleSummary(orgId: string, deps: ReadDeps): Promise<HandlerResponse> {
  const summary = summarize(await deps.storage.listFindings(orgId), await deps.storage.listAssets(orgId))
  return { status: 200, json: summary as unknown as Record<string, unknown> }
}

export async function handleTrend(orgId: string, windowDays: number, deps: ReadDeps): Promise<HandlerResponse> {
  const points = trend(await deps.storage.listFindings(orgId), { now: deps.now(), windowDays })
  return { status: 200, json: { points } }
}

export async function handleAssets(orgId: string, deps: ReadDeps): Promise<HandlerResponse> {
  const statuses = assetStatuses(await deps.storage.listAssets(orgId), {
    now: deps.now(),
    staleThresholdHours: deps.staleThresholdHours ?? 48,
  })
  return { status: 200, json: { assets: statuses } }
}

export async function handleFindings(orgId: string, filter: FindingFilter, deps: ReadDeps): Promise<HandlerResponse> {
  const findings = (await deps.storage.listFindings(orgId, filter)).map((f) => ({
    assetId: f.assetId,
    ruleId: f.ruleId,
    surface: f.surface,
    severity: f.severity,
    location: f.location,
    evidenceRedacted: f.evidenceRedacted,
    fingerprint: f.fingerprint,
    firstSeen: f.firstSeen,
    lastSeen: f.lastSeen,
    status: f.status,
    // CVE enrichment (§6.5) + advisory flag (§6.1): public, redaction-safe,
    // additive. Exposed so the CVE view and advisory badges have real data;
    // absent on findings that were never enriched / are not advisory.
    ...(f.cveIds && f.cveIds.length > 0 ? { cveIds: f.cveIds } : {}),
    ...(f.cveSeverity ? { cveSeverity: f.cveSeverity } : {}),
    ...(f.advisory ? { advisory: true } : {}),
  }))
  return { status: 200, json: { findings } }
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#f7768e',
  high: '#d78700',
  medium: '#f9e2af',
  low: '#6c7086',
}

function bars(counts: Record<string, number>): string {
  const max = Math.max(1, ...Object.values(counts))
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => {
      const width = Math.round((n / max) * 220)
      return `<div class="row"><span class="lbl">${esc(label)}</span><span class="bar" style="width:${width}px"></span><span class="n">${n}</span></div>`
    })
    .join('')
}

/** Server-rendered fleet dashboard for one org (reads the /v1 API model only). */
export async function renderDashboardHtml(orgId: string, deps: ReadDeps): Promise<string> {
  const findingsList = await deps.storage.listFindings(orgId)
  const assetsList = await deps.storage.listAssets(orgId)
  const summary: FleetSummary = summarize(findingsList, assetsList)
  const assets: AssetStatus[] = assetStatuses(assetsList, {
    now: deps.now(),
    staleThresholdHours: deps.staleThresholdHours ?? 48,
  })
  const points: TrendPoint[] = trend(findingsList, { now: deps.now(), windowDays: 30 })
  const staleCount = assets.filter((a) => a.stale).length
  const verdict = summary.bySeverity.critical > 0 ? 'BLOCK' : summary.totalFindings > 0 ? 'REVIEW' : 'PASS'
  const verdictColor = verdict === 'BLOCK' ? '#f7768e' : verdict === 'REVIEW' ? '#f9e2af' : '#a6e3a1'

  const severityBars = (['critical', 'high', 'medium', 'low'] as Severity[])
    .map((sev) => {
      const n = summary.bySeverity[sev]
      const max = Math.max(1, summary.totalFindings)
      const width = Math.round((n / max) * 220)
      return `<div class="row"><span class="lbl" style="color:${SEVERITY_COLOR[sev]}">${sev}</span><span class="bar" style="width:${width}px;background:${SEVERITY_COLOR[sev]}"></span><span class="n">${n}</span></div>`
    })
    .join('')

  const assetRows = assets
    .map(
      (a) =>
        `<tr><td>${esc(a.assetId)}</td><td>${esc(a.label)}</td><td>${esc(a.kind)}</td><td>${
          a.lastSeenAt ? esc(new Date(a.lastSeenAt).toISOString()) : '—'
        }</td><td>${a.stale ? '<span class="stale">STALE</span>' : '<span class="ok">ok</span>'}</td></tr>`,
    )
    .join('')

  const trendMax = Math.max(1, ...points.map((p) => p.riskScore))
  const spark = points
    .map((p) => {
      const h = Math.round((p.riskScore / trendMax) * 40)
      return `<span class="spike" title="${esc(p.date)}: ${p.riskScore}" style="height:${Math.max(1, h)}px"></span>`
    })
    .join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>AgentGuard Control Plane — ${esc(orgId)}</title>
<style>
  body{margin:0;background:#11111b;color:#cdd6f4;font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
  header{padding:18px 26px;border-bottom:1px solid #1f2335;display:flex;align-items:center;gap:16px}
  header h1{font-size:18px;margin:0;letter-spacing:.02em}
  .badge{font-weight:700;padding:3px 12px;border-radius:12px;color:#11111b;background:${verdictColor}}
  main{padding:22px 26px;display:grid;grid-template-columns:1fr 1fr;gap:26px;max-width:1100px}
  section{background:#181825;border:1px solid #262a3d;border-radius:12px;padding:16px 18px}
  section h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#9399b2;margin:0 0 12px}
  .row{display:flex;align-items:center;gap:10px;margin:5px 0}
  .lbl{width:110px;color:#bac2de;font-family:Consolas,monospace;font-size:13px}
  .bar{height:12px;background:#89dceb;border-radius:3px;min-width:2px}
  .n{color:#9399b2}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #262a3d}
  th{color:#9399b2;font-weight:600}
  .stale{color:#f7768e;font-weight:700}.ok{color:#a6e3a1}
  .spark{display:flex;align-items:flex-end;gap:2px;height:44px}
  .spike{width:8px;background:#89dceb;border-radius:2px 2px 0 0}
  .kpi{font-size:28px;font-weight:800}
  footer{padding:14px 26px;color:#585b70;font-size:12px}
</style></head><body>
<header><h1>AgentGuard Control Plane</h1><span class="badge">${verdict}</span><span style="color:#9399b2">org ${esc(orgId)} · ${summary.totalFindings} findings · risk ${summary.riskScore} · ${staleCount} stale asset(s)</span></header>
<main>
  <section><h2>Findings by surface</h2>${bars(summary.bySurface) || '<div class="n">no findings</div>'}</section>
  <section><h2>Findings by severity</h2>${severityBars}</section>
  <section style="grid-column:1/3"><h2>Risk trend (30d cumulative)</h2><div class="spark">${spark}</div></section>
  <section style="grid-column:1/3"><h2>Assets</h2><table><tr><th>Asset</th><th>Label</th><th>Kind</th><th>Last seen</th><th>Status</th></tr>${assetRows || '<tr><td colspan="5" class="n">no assets enrolled</td></tr>'}</table></section>
</main>
<footer>Redacted findings only — raw secrets never leave the reporting machine. Read-only Observe dashboard.</footer>
</body></html>`
}
