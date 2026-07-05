'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { Panel, ErrorLine, Loading, Empty } from '@/components/ui'
import { useSessionHint } from '@/lib/session'

// Real server shape (auth/routes.ts handleListMembers): {id,email,role,createdAt}.
// A local Member interface matches the wire exactly.
interface Member {
  readonly id: string
  readonly email: string
  readonly role: 'admin' | 'member'
  readonly createdAt: number
}

interface InviteResult {
  readonly code: string
  readonly expiresAt: number
}

export default function OrgPage() {
  const hint = useSessionHint()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [inviteError, setInviteError] = useState<unknown>(null)
  const [inviting, setInviting] = useState(false)
  const [invite, setInvite] = useState<InviteResult | null>(null)

  const isAdmin = hint?.role === 'admin'

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await api.get<{ members: Member[] }>('/v1/orgs/members')
        if (alive) setMembers(res.members)
      } catch (e) {
        if (!alive) return
        if (e instanceof ApiError && e.status === 401) setNeedsAuth(true)
        else if (e instanceof ApiError && e.status === 403) setForbidden(true)
        else setError(e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function onCreateInvite() {
    setInviteError(null)
    setInvite(null)
    setInviting(true)
    try {
      const res = await api.post<InviteResult>('/v1/orgs/invites', { role: inviteRole })
      setInvite(res)
    } catch (e) {
      setInviteError(e)
    } finally {
      setInviting(false)
    }
  }

  return (
    <>
      <h1 className="page-title">Organization</h1>
      <p className="page-sub">Members and invites for your org.</p>

      {loading ? <Loading what="org" /> : null}
      <ErrorLine error={error} />

      {needsAuth ? (
        <Panel title="Sign in required">
          <p className="notice">
            Sign in to manage your organization. <Link href="/login/">Sign in →</Link>
          </p>
        </Panel>
      ) : null}

      {forbidden || (members && !isAdmin) ? (
        <Panel title="Members">
          <p className="notice">Only org admins can view and manage members and invites.</p>
        </Panel>
      ) : null}

      {members && isAdmin ? (
        <>
          <Panel title="Members">
            {members.length === 0 ? (
              <Empty message="No members yet." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.email}</td>
                      <td>{m.role}</td>
                      <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Create invite">
            <label htmlFor="inviteRole">Role</label>
            <select
              id="inviteRole"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>

            <ErrorLine error={inviteError} />

            <button type="button" onClick={onCreateInvite} disabled={inviting} style={{ marginTop: 16 }}>
              {inviting ? 'Creating invite…' : 'Create invite'}
            </button>

            {invite ? (
              <div style={{ marginTop: 16 }}>
                <label>Invite code</label>
                <code className="mono" style={{ display: 'block', padding: '10px 12px', background: 'var(--bg-elev)', borderRadius: 6, wordBreak: 'break-all' }}>
                  {invite.code}
                </code>
                <p className="notice" style={{ marginTop: 8 }}>
                  Single-use, expires {new Date(invite.expiresAt).toLocaleString()}.
                </p>
              </div>
            ) : null}
          </Panel>
        </>
      ) : null}
    </>
  )
}
