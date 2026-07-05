'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import type { PolicyView } from '@/lib/types'
import { Panel, ErrorLine, Loading, Empty } from '@/components/ui'
import { useSessionHint } from '@/lib/session'

// The server's GET /v1/policy view (control-plane/src/policy.ts buildPolicyView)
// only ever includes APPROVED exceptions — pending ones are never listed, since
// there is no list-pending endpoint in the fixed contract. So "pending" exceptions
// only become visible in this tab for the duration of this browser session: we
// track the objects returned directly by POST /v1/policy/exceptions and by the
// approve/reject calls, then drop them from the local pending set once resolved
// (an approved one will also show up in the next /v1/policy refetch).
interface LocalException {
  readonly id: string
  readonly ruleId: string
  readonly reason: string
  readonly status: 'pending' | 'approved' | 'rejected'
  readonly createdAt?: number
}

export default function PolicyPage() {
  const hint = useSessionHint()
  const isAdmin = hint?.role === 'admin'

  const [view, setView] = useState<PolicyView | null>(null)
  const [rulesDraft, setRulesDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const [savingRules, setSavingRules] = useState(false)
  const [saveError, setSaveError] = useState<unknown>(null)

  const [pending, setPending] = useState<LocalException[]>([])
  const [proposeRuleId, setProposeRuleId] = useState('')
  const [proposeReason, setProposeReason] = useState('')
  const [proposeBusy, setProposeBusy] = useState(false)
  const [proposeError, setProposeError] = useState<unknown>(null)

  const [resolveBusyId, setResolveBusyId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<unknown>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const v = await api.get<PolicyView>('/v1/policy')
      setView(v)
      setRulesDraft(v.rules)
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

  async function saveRules() {
    setSavingRules(true)
    setSaveError(null)
    try {
      const result = await api.put<{ rulesVersion: number; exceptionsVersion: number }>('/v1/policy', {
        rules: rulesDraft,
      })
      setView((v) => (v ? { ...v, rules: rulesDraft, rulesVersion: result.rulesVersion, exceptionsVersion: result.exceptionsVersion } : v))
    } catch (e) {
      setSaveError(e)
    } finally {
      setSavingRules(false)
    }
  }

  async function proposeException() {
    if (!proposeRuleId.trim() || !proposeReason.trim()) return
    setProposeBusy(true)
    setProposeError(null)
    try {
      const created = await api.post<LocalException>('/v1/policy/exceptions', {
        ruleId: proposeRuleId.trim(),
        reason: proposeReason.trim(),
      })
      setPending((p) => [...p, created])
      setProposeRuleId('')
      setProposeReason('')
    } catch (e) {
      setProposeError(e)
    } finally {
      setProposeBusy(false)
    }
  }

  async function resolveException(id: string, action: 'approve' | 'reject') {
    setResolveBusyId(id)
    setResolveError(null)
    try {
      const result = await api.post<{ id: string; status: 'approved' | 'rejected'; resolvedAt: number }>(
        `/v1/policy/exceptions/${id}/${action}`,
      )
      setPending((p) => p.filter((e) => e.id !== result.id))
      if (result.status === 'approved') await load()
    } catch (e) {
      setResolveError(e)
    } finally {
      setResolveBusyId(null)
    }
  }

  const pendingVisible = pending.filter((e) => e.status === 'pending')

  return (
    <>
      <h1 className="page-title">Policy</h1>
      <p className="page-sub">Org rules doc, sync versions, and member-proposed exceptions.</p>

      {loading ? <Loading what="policy" /> : null}
      <ErrorLine error={error} />

      {needsAuth ? (
        <Panel title="Sign in required">
          <p className="notice">
            Connect to your organization to view policy. <Link href="/login/">Sign in →</Link>
          </p>
        </Panel>
      ) : null}

      {view ? (
        <>
          <Panel title="Rules">
            <p className="notice mono" style={{ fontSize: 12 }}>
              rulesVersion {view.rulesVersion} · exceptionsVersion {view.exceptionsVersion}
            </p>
            <textarea
              value={rulesDraft}
              onChange={(e) => setRulesDraft(e.target.value)}
              readOnly={!isAdmin}
              rows={14}
              spellCheck={false}
            />
            {isAdmin ? (
              <>
                <button onClick={saveRules} disabled={savingRules || rulesDraft.length === 0}>
                  {savingRules ? 'Saving…' : 'Save rules'}
                </button>
                <ErrorLine error={saveError} />
              </>
            ) : (
              <p className="notice">Read-only — admin role required to edit rules.</p>
            )}
          </Panel>

          <Panel title="Propose an exception">
            <label htmlFor="exc-rule">Rule ID</label>
            <input id="exc-rule" value={proposeRuleId} onChange={(e) => setProposeRuleId(e.target.value)} placeholder="rule id" />
            <label htmlFor="exc-reason">Reason</label>
            <input id="exc-reason" value={proposeReason} onChange={(e) => setProposeReason(e.target.value)} placeholder="why this exception is needed" />
            <button onClick={proposeException} disabled={proposeBusy || !proposeRuleId.trim() || !proposeReason.trim()}>
              {proposeBusy ? 'Submitting…' : 'Submit for approval'}
            </button>
            <ErrorLine error={proposeError} />
          </Panel>

          {pendingVisible.length > 0 ? (
            <Panel title="Pending exceptions (this session)">
              <ErrorLine error={resolveError} />
              <table>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Reason</th>
                    <th>Status</th>
                    {isAdmin ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pendingVisible.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{e.ruleId}</td>
                      <td>{e.reason}</td>
                      <td>
                        <span className="badge unknown">{e.status}</span>
                      </td>
                      {isAdmin ? (
                        <td>
                          <button onClick={() => resolveException(e.id, 'approve')} disabled={resolveBusyId === e.id}>
                            Approve
                          </button>{' '}
                          <button className="secondary" onClick={() => resolveException(e.id, 'reject')} disabled={resolveBusyId === e.id}>
                            Reject
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : null}

          <Panel title="Approved exceptions">
            {view.exceptions.length === 0 ? (
              <Empty message="No approved exceptions." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {view.exceptions.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{e.ruleId}</td>
                      <td>{e.reason}</td>
                      <td>
                        <span className="badge ok">{e.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      ) : null}
    </>
  )
}
