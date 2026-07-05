'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import type { Severity } from '@/lib/types'
import { Panel, Stat, SeverityBadge, VerdictBadge, verdictFor, ErrorLine, Loading, Empty } from '@/components/ui'

// Field shapes verified against control-plane/src/dashboard.ts + aggregate.ts
// (the actual JSON producers). See web/app/fleet/page.tsx for the same note:
// byAsset carries riskScore, and /v1/findings echoes `advisory` additively —
// advisory findings are excluded from the headline risk here to match the
// server aggregates, which are already advisory-excluded ([R3/NEW-CR-1]).

interface AssetSummary {
  readonly assetId: string
  readonly label: string
  readonly count: number
  readonly riskScore: number
}

interface FleetSummaryReal {
  readonly totalFindings: number
  readonly riskScore: number
  readonly bySurface: Record<string, number>
  readonly bySeverity: Record<Severity, number>
  readonly byAsset: AssetSummary[]
}

interface AssetStatusReal {
  readonly assetId: string
  readonly label: string
  readonly kind: string
  readonly lastSeenAt: number | null
  readonly stale: boolean
}

interface FindingReal {
  readonly assetId: string
  readonly ruleId: string
  readonly surface: string
  readonly severity: Severity
  readonly location: string
  readonly evidenceRedacted: string
  readonly fingerprint: string
  readonly firstSeen: number
  readonly lastSeen: number
  readonly status: 'open' | 'resolved' | 'allowlisted'
  readonly advisory?: boolean
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low']
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export default function ReportPage() {
  const [summary, setSummary] = useState<FleetSummaryReal | null>(null)
  const [assets, setAssets] = useState<AssetStatusReal[] | null>(null)
  const [findings, setFindings] = useState<FindingReal[] | null>(null)
  const [generatedAt] = useState(() => new Date())
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [s, a, f] = await Promise.all([
          api.get<FleetSummaryReal>('/v1/dashboard/summary'),
          api.get<{ assets: AssetStatusReal[] }>('/v1/assets'),
          api.get<{ findings: FindingReal[] }>('/v1/findings'),
        ])
        if (!alive) return
        setSummary(s)
        setAssets(a.assets)
        setFindings(f.findings)
      } catch (e) {
        if (!alive) return
        if (e instanceof ApiError && e.status === 401) setNeedsAuth(true)
        else setError(e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <Loading what="report" />
  if (needsAuth) {
    return (
      <Panel title="Sign in required">
        <p className="notice">
          Connect to your organization to generate the executive report. <Link href="/login/">Sign in →</Link>
        </p>
      </Panel>
    )
  }
  if (error) return <ErrorLine error={error} />
  if (!summary || !assets || !findings) return <Empty message="No data available for report." />

  const verdict = verdictFor(summary.riskScore, summary.bySeverity.critical)

  // Headline risk figures (riskScore, bySeverity, totalFindings) come straight
  // from /v1/dashboard/summary, which is already advisory-excluded server-side.
  // For the top-findings table we exclude advisory rows too so the exec report
  // never surfaces a finding that does not count toward the risk score.
  const topFindings = [...findings]
    .filter((f) => !f.advisory && (f.severity === 'critical' || f.severity === 'high'))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 15)

  const assetsAtRisk = assets
    .map((a) => {
      const s = summary.byAsset.find((x) => x.assetId === a.assetId)
      return { ...a, count: s?.count ?? 0, riskScore: s?.riskScore ?? 0 }
    })
    .filter((a) => a.count > 0 || a.stale)
    .sort((a, b) => b.riskScore - a.riskScore)

  return (
    <>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <h1 className="page-title">Shadow-AI executive report</h1>
      <p className="page-sub mono" style={{ fontSize: 12 }}>
        Generated {generatedAt.toLocaleString()}
      </p>

      <Panel title="Executive verdict">
        <div className="grid cols-4">
          <Stat label="Total findings" value={summary.totalFindings} />
          <Stat label="Critical" value={summary.bySeverity.critical} />
          <Stat label="Risk score" value={summary.riskScore} />
          <Stat label="Verdict" value={<VerdictBadge verdict={verdict} />} />
        </div>
      </Panel>

      <Panel title="Severity breakdown">
        {summary.totalFindings === 0 ? (
          <Empty message="No findings recorded." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {SEVERITY_ORDER.map((sev) => (
                <tr key={sev}>
                  <td><SeverityBadge severity={sev} /></td>
                  <td className="mono">{summary.bySeverity[sev]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Top critical / high findings">
        {topFindings.length === 0 ? (
          <Empty message="No critical or high findings." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Surface</th>
                <th>Location</th>
                <th>Rule</th>
                <th>Asset</th>
              </tr>
            </thead>
            <tbody>
              {topFindings.map((f) => (
                <tr key={f.fingerprint}>
                  <td><SeverityBadge severity={f.severity} /></td>
                  <td className="mono">{f.surface}</td>
                  <td className="mono">{f.location}</td>
                  <td className="mono">{f.ruleId}</td>
                  <td className="mono">{f.assetId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Assets at risk">
        {assetsAtRisk.length === 0 ? (
          <Empty message="No assets currently flagged at risk." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Kind</th>
                <th>Findings</th>
                <th>Risk score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assetsAtRisk.map((a) => (
                <tr key={a.assetId}>
                  <td>{a.label}</td>
                  <td className="mono">{a.kind}</td>
                  <td className="mono">{a.count}</td>
                  <td className="mono">{a.riskScore}</td>
                  <td>{a.stale ? <span className="badge medium">stale</span> : <span className="badge ok">fresh</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  )
}
