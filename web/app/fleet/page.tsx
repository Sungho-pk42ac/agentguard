'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import type { Severity } from '@/lib/types'
import { Panel, Stat, SeverityBadge, VerdictBadge, verdictFor, ErrorLine, Loading, Empty } from '@/components/ui'

// NOTE on server field shapes (verified against control-plane/src/dashboard.ts
// + aggregate.ts, which are the actual JSON producers — @/lib/types is close
// but not exact):
// - FleetSummary.byAsset entries carry `riskScore` (not just count/label).
// - TrendPoint carries `riskScore` (aggregate.ts trend()), not `total`.
// - /v1/findings (handleFindings) echoes `advisory`/`cveIds`/`cveSeverity`
//   additively (present-only). The summary aggregates are already
//   advisory-excluded server-side; advisory/CVE rows are surfaced/badged on
//   the CVE page — the fleet findings list shows them as ordinary rows.

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

interface TrendPointReal {
  readonly date: string
  readonly riskScore: number
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
}

type Tab = 'summary' | 'trend' | 'assets' | 'findings'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'trend', label: 'Trend' },
  { id: 'assets', label: 'Assets' },
  { id: 'findings', label: 'Findings' },
]

function BarList({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return <Empty message="No data." />
  const max = Math.max(1, ...entries.map(([, n]) => n))
  return (
    <div className="grid" style={{ gap: 8 }}>
      {entries.map(([label, n]) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 40px', alignItems: 'center', gap: 8 }}>
          <span className="mono">{label}</span>
          <div className="bar-track">
            <div className="bar" style={{ width: `${Math.round((n / max) * 100)}%` }} />
          </div>
          <span className="mono">{n}</span>
        </div>
      ))}
    </div>
  )
}

function SignInPrompt() {
  return (
    <Panel title="Sign in required">
      <p className="notice">
        Connect to your organization to see fleet posture. <Link href="/login/">Sign in →</Link>
      </p>
    </Panel>
  )
}

function SummaryTab() {
  const [summary, setSummary] = useState<FleetSummaryReal | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const s = await api.get<FleetSummaryReal>('/v1/dashboard/summary')
        if (alive) setSummary(s)
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

  if (loading) return <Loading what="summary" />
  if (needsAuth) return <SignInPrompt />
  if (error) return <ErrorLine error={error} />
  if (!summary) return <Empty message="No summary available." />

  return (
    <>
      <div className="grid cols-4">
        <Stat label="Total findings" value={summary.totalFindings} />
        <Stat label="Critical" value={summary.bySeverity.critical} />
        <Stat label="Risk score" value={summary.riskScore} />
        <Stat
          label="Verdict"
          value={<VerdictBadge verdict={verdictFor(summary.riskScore, summary.bySeverity.critical)} />}
        />
      </div>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Panel title="Findings by surface">
          <BarList counts={summary.bySurface} />
        </Panel>
        <Panel title="Findings by asset">
          <BarList counts={Object.fromEntries(summary.byAsset.map((a) => [a.label, a.count]))} />
        </Panel>
      </div>
    </>
  )
}

function TrendTab() {
  const [windowSel, setWindowSel] = useState<'7d' | '30d' | '90d'>('30d')
  const [points, setPoints] = useState<TrendPointReal[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const r = await api.get<{ points: TrendPointReal[] }>(`/v1/dashboard/trend?window=${windowSel}`)
        if (alive) setPoints(r.points)
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
  }, [windowSel])

  if (needsAuth) return <SignInPrompt />

  return (
    <Panel title="Risk score trend (cumulative)">
      <label htmlFor="window">Window</label>
      <select id="window" value={windowSel} onChange={(e) => setWindowSel(e.target.value as '7d' | '30d' | '90d')}>
        <option value="7d">7 days</option>
        <option value="30d">30 days</option>
        <option value="90d">90 days</option>
      </select>
      {loading ? <Loading what="trend" /> : null}
      <ErrorLine error={error} />
      {!loading && !error && points ? (
        points.length === 0 ? (
          <Empty message="No trend data." />
        ) : (
          <BarList counts={Object.fromEntries(points.map((p) => [p.date, p.riskScore]))} />
        )
      ) : null}
    </Panel>
  )
}

function AssetsTab() {
  const [assets, setAssets] = useState<AssetStatusReal[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await api.get<{ assets: AssetStatusReal[] }>('/v1/assets')
        if (alive) setAssets(r.assets)
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

  if (loading) return <Loading what="assets" />
  if (needsAuth) return <SignInPrompt />
  if (error) return <ErrorLine error={error} />
  if (!assets || assets.length === 0) return <Empty message="No assets enrolled." />

  return (
    <Panel title="Assets">
      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Kind</th>
            <th>Last seen</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.assetId}>
              <td>{a.label}</td>
              <td className="mono">{a.kind}</td>
              <td className="mono">{a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString() : 'never'}</td>
              <td>{a.stale ? <span className="badge medium">stale</span> : <span className="badge ok">fresh</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

function FindingsTab() {
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const [findings, setFindings] = useState<FindingReal[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const qs = severity === 'all' ? '' : `?severity=${severity}`
        const r = await api.get<{ findings: FindingReal[] }>(`/v1/findings${qs}`)
        if (alive) setFindings(r.findings)
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
  }, [severity])

  if (needsAuth) return <SignInPrompt />

  return (
    <Panel title="Findings">
      <label htmlFor="severity">Severity</label>
      <select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | 'all')}>
        <option value="all">All</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      {loading ? <Loading what="findings" /> : null}
      <ErrorLine error={error} />
      {!loading && !error && findings ? (
        findings.length === 0 ? (
          <Empty message="No findings match this filter." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Surface</th>
                <th>Location</th>
                <th>Rule</th>
                <th>Evidence</th>
                <th>Asset</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.fingerprint}>
                  <td><SeverityBadge severity={f.severity} /></td>
                  <td className="mono">{f.surface}</td>
                  <td className="mono">{f.location}</td>
                  <td className="mono">{f.ruleId}</td>
                  <td className="mono">{f.evidenceRedacted}</td>
                  <td className="mono">{f.assetId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </Panel>
  )
}

export default function FleetPage() {
  const [tab, setTab] = useState<Tab>('summary')

  return (
    <>
      <h1 className="page-title">Fleet dashboard</h1>
      <p className="page-sub">Org-wide agent posture: summary, trend, assets, and findings.</p>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? '' : 'secondary'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' ? <SummaryTab /> : null}
      {tab === 'trend' ? <TrendTab /> : null}
      {tab === 'assets' ? <AssetsTab /> : null}
      {tab === 'findings' ? <FindingsTab /> : null}
    </>
  )
}
