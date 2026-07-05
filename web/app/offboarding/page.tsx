'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import type { OffboardingTask } from '@/lib/types'
import { Panel, ErrorLine, Loading, Empty } from '@/components/ui'
import { useSessionHint } from '@/lib/session'

// Server taskJson() (control-plane/src/offboarding.ts) returns more fields than
// the fixed @/lib/types OffboardingTask projection — audit trail + timestamps —
// which the detail view needs. Extend locally rather than touching shared types.
interface AuditEntry {
  readonly at: number
  readonly from: string
  readonly to: string
  readonly actor: string
}

interface OffboardingDetail extends OffboardingTask {
  readonly createdAt: number
  readonly updatedAt: number
  readonly audit: AuditEntry[]
}

const NEXT_STATUS: Record<OffboardingTask['status'], OffboardingTask['status'] | null> = {
  open: 'sweeping',
  sweeping: 'done',
  done: null,
}

export default function OffboardingPage() {
  const hint = useSessionHint()
  const isAdmin = hint?.role === 'admin'

  const [tasks, setTasks] = useState<OffboardingTask[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OffboardingDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<unknown>(null)

  const [transitionBusy, setTransitionBusy] = useState(false)
  const [transitionError, setTransitionError] = useState<unknown>(null)

  const [empId, setEmpId] = useState('')
  const [empEmail, setEmpEmail] = useState('')
  const [empName, setEmpName] = useState('')
  const [effectiveAt, setEffectiveAt] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<unknown>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ tasks: OffboardingTask[] }>('/v1/workflows/offboarding')
      setTasks(res.tasks)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true)
      else setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const task = await api.get<OffboardingDetail>(`/v1/workflows/offboarding/${id}`)
      setDetail(task)
    } catch (e) {
      setDetailError(e)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  function selectTask(id: string) {
    setSelectedId(id)
    setDetail(null)
    setTransitionError(null)
    loadDetail(id)
  }

  async function transition(to: OffboardingTask['status']) {
    if (!selectedId) return
    setTransitionBusy(true)
    setTransitionError(null)
    try {
      const updated = await api.post<OffboardingDetail>(`/v1/workflows/offboarding/${selectedId}/transition`, { to })
      setDetail(updated)
      setTasks((ts) => (ts ? ts.map((t) => (t.id === updated.id ? updated : t)) : ts))
    } catch (e) {
      setTransitionError(e)
    } finally {
      setTransitionBusy(false)
    }
  }

  async function startOffboarding() {
    if (!empId.trim() || !empEmail.trim() || !empName.trim() || !effectiveAt.trim()) return
    setCreateBusy(true)
    setCreateError(null)
    try {
      await api.post('/v1/workflows/offboarding', {
        employee: { id: empId.trim(), email: empEmail.trim(), name: empName.trim() },
        effectiveAt: effectiveAt.trim(),
      })
      setEmpId('')
      setEmpEmail('')
      setEmpName('')
      setEffectiveAt('')
      await loadList()
    } catch (e) {
      setCreateError(e)
    } finally {
      setCreateBusy(false)
    }
  }

  const next = detail ? NEXT_STATUS[detail.status] : null

  return (
    <>
      <h1 className="page-title">Offboarding</h1>
      <p className="page-sub">Employee departures and the resulting asset-sweep workflow.</p>

      {loading ? <Loading what="offboarding tasks" /> : null}
      <ErrorLine error={error} />

      {needsAuth ? (
        <Panel title="Sign in required">
          <p className="notice">
            Connect to your organization to view offboarding tasks. <Link href="/login/">Sign in →</Link>
          </p>
        </Panel>
      ) : null}

      {isAdmin ? (
        <Panel title="Start offboarding">
          <div className="grid cols-2">
            <div>
              <label htmlFor="off-id">Employee ID</label>
              <input id="off-id" value={empId} onChange={(e) => setEmpId(e.target.value)} />
              <label htmlFor="off-email">Employee email</label>
              <input id="off-email" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="off-name">Employee name</label>
              <input id="off-name" value={empName} onChange={(e) => setEmpName(e.target.value)} />
              <label htmlFor="off-effective">Effective at (ISO date/time)</label>
              <input id="off-effective" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} placeholder="2026-07-05T00:00:00Z" />
            </div>
          </div>
          <button
            onClick={startOffboarding}
            disabled={createBusy || !empId.trim() || !empEmail.trim() || !empName.trim() || !effectiveAt.trim()}
          >
            {createBusy ? 'Starting…' : 'Start offboarding'}
          </button>
          <ErrorLine error={createError} />
        </Panel>
      ) : null}

      {tasks ? (
        <Panel title="Tasks">
          {tasks.length === 0 ? (
            <Empty message="No offboarding tasks." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Unmatched</th>
                  <th>Effective at</th>
                  <th>Assets</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} onClick={() => selectTask(t.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      {t.employee.name} <span className="notice">({t.employee.email})</span>
                    </td>
                    <td>
                      <span className="badge unknown">{t.status}</span>
                    </td>
                    <td>{t.unmatched ? <span className="badge high">unmatched</span> : '—'}</td>
                    <td className="mono">{t.effectiveAt}</td>
                    <td>{t.assetIds.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      ) : null}

      {selectedId ? (
        <Panel title={`Task detail — ${selectedId}`}>
          {detailLoading ? <Loading what="task detail" /> : null}
          <ErrorLine error={detailError} />
          {detail ? (
            <>
              <p className="notice mono" style={{ fontSize: 12 }}>
                {detail.employee.name} · {detail.employee.email} · status <span className="badge unknown">{detail.status}</span>
                {detail.unmatched ? <> · <span className="badge high">unmatched</span></> : null}
              </p>
              <p className="notice">Assets: {detail.assetIds.length > 0 ? detail.assetIds.join(', ') : 'none matched'}</p>

              {isAdmin && next ? (
                <>
                  <button onClick={() => transition(next)} disabled={transitionBusy}>
                    {transitionBusy ? 'Transitioning…' : `Advance to ${next}`}
                  </button>
                  <ErrorLine error={transitionError} />
                </>
              ) : null}

              <h3 style={{ fontSize: 13, color: 'var(--fg-dim)', marginTop: 16 }}>Audit trail</h3>
              {detail.audit.length === 0 ? (
                <Empty message="No audit entries." />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Actor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.audit.map((a, i) => (
                      <tr key={i}>
                        <td className="mono">{new Date(a.at).toISOString()}</td>
                        <td>{a.from || '—'}</td>
                        <td>{a.to}</td>
                        <td>{a.actor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : null}
        </Panel>
      ) : null}
    </>
  )
}
