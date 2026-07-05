'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import type { FleetSummary, Meta } from '@/lib/types'
import { Panel, Stat, ErrorLine, Loading, VerdictBadge, verdictFor } from '@/components/ui'
import { useSessionHint } from '@/lib/session'

export default function OverviewPage() {
  const hint = useSessionHint()
  const [summary, setSummary] = useState<FleetSummary | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const m = await api.get<Meta>('/v1/meta')
        if (alive) setMeta(m)
        const s = await api.get<FleetSummary>('/v1/dashboard/summary')
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

  return (
    <>
      <h1 className="page-title">Overview</h1>
      <p className="page-sub">Fleet-wide AI agent security posture at a glance.</p>

      {loading ? <Loading what="overview" /> : null}
      <ErrorLine error={error} />

      {needsAuth ? (
        <Panel title="Sign in required">
          <p className="notice">
            Connect to your organization to see fleet posture.{' '}
            <Link href="/login/">Sign in →</Link>
          </p>
        </Panel>
      ) : null}

      {summary ? (
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
          <Panel title="Explore">
            <p className="notice">
              <Link href="/fleet/">Fleet dashboard →</Link> &nbsp;·&nbsp;
              <Link href="/report/">Shadow AI executive report →</Link>
            </p>
          </Panel>
        </>
      ) : null}

      {meta ? (
        <p className="notice mono" style={{ fontSize: 12 }}>
          control-plane v{meta.version} · wire schema {meta.schemaVersions.join(',')}
          {hint ? ` · signed in as ${hint.email ?? hint.role}` : ''}
        </p>
      ) : null}
    </>
  )
}
