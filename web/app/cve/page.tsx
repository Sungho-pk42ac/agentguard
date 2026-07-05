'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import type { Finding } from '@/lib/types'
import { Panel, ErrorLine, Loading, Empty, SeverityBadge } from '@/components/ui'
import { useSessionHint } from '@/lib/session'

export default function CvePage() {
  const hint = useSessionHint()
  const isAdmin = hint?.role === 'admin'

  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<unknown>(null)
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ findings: Finding[] }>('/v1/findings')
      setFindings(res.findings)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true)
      else setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function refreshCve() {
    setRefreshing(true)
    setRefreshError(null)
    setRefreshNotice(null)
    try {
      await api.post('/v1/cve/refresh')
      setRefreshNotice('Refresh triggered — enrichment runs asynchronously against osv.dev and is best-effort; reload shortly to see updates.')
    } catch (e) {
      setRefreshError(e)
    } finally {
      setRefreshing(false)
    }
  }

  const cveFindings = (findings ?? []).filter((f) => f.cveIds && f.cveIds.length > 0)

  return (
    <>
      <h1 className="page-title">CVE tracking</h1>
      <p className="page-sub">Findings matched against known CVEs (osv.dev best-effort enrichment).</p>

      {loading ? <Loading what="findings" /> : null}
      <ErrorLine error={error} />

      {needsAuth ? (
        <Panel title="Sign in required">
          <p className="notice">
            Connect to your organization to view CVE data. <Link href="/login/">Sign in →</Link>
          </p>
        </Panel>
      ) : null}

      {isAdmin ? (
        <Panel title="Enrichment">
          <button onClick={refreshCve} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh CVE data'}
          </button>
          {refreshNotice ? <p className="notice">{refreshNotice}</p> : null}
          <ErrorLine error={refreshError} />
        </Panel>
      ) : null}

      {findings ? (
        <Panel title="Findings with CVE matches">
          {cveFindings.length === 0 ? (
            <Empty message="No findings currently carry CVE matches." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>CVE IDs</th>
                  <th>CVE severity</th>
                  <th>Asset</th>
                </tr>
              </thead>
              <tbody>
                {cveFindings.map((f) => (
                  <tr key={f.fingerprint}>
                    <td className="mono">{f.location}</td>
                    <td className="mono">{(f.cveIds ?? []).join(', ')}</td>
                    <td>
                      <SeverityBadge severity={f.cveSeverity ?? 'unknown'} />
                    </td>
                    <td>{f.assetId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      ) : null}
    </>
  )
}
