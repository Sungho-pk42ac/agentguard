'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import type { McpCatalog, McpCatalogEntry } from '@/lib/types'
import { Panel, ErrorLine, Loading, Empty } from '@/components/ui'
import { useSessionHint } from '@/lib/session'

export default function McpPage() {
  const hint = useSessionHint()
  const isAdmin = hint?.role === 'admin'

  const [catalog, setCatalog] = useState<McpCatalog | null>(null)
  const [entries, setEntries] = useState<McpCatalogEntry[]>([])
  const [strictMode, setStrictMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<unknown>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const c = await api.get<McpCatalog>('/v1/mcp/catalog')
      setCatalog(c)
      setEntries(c.entries)
      setStrictMode(c.mcpStrictMode)
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

  function toggleApproved(serverName: string) {
    setEntries((es) => es.map((e) => (e.serverName === serverName ? { ...e, approved: !e.approved } : e)))
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const result = await api.put<McpCatalog>('/v1/mcp/catalog', {
        entries: entries.map((e) => ({ serverName: e.serverName, approved: e.approved, riskTags: e.riskTags, note: e.note })),
        mcpStrictMode: strictMode,
      })
      setCatalog(result)
      setEntries(result.entries)
      setStrictMode(result.mcpStrictMode)
    } catch (e) {
      setSaveError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h1 className="page-title">MCP catalog</h1>
      <p className="page-sub">Org-managed approval list for local MCP servers — deny-by-default.</p>

      {loading ? <Loading what="MCP catalog" /> : null}
      <ErrorLine error={error} />

      {needsAuth ? (
        <Panel title="Sign in required">
          <p className="notice">
            Connect to your organization to view the MCP catalog. <Link href="/login/">Sign in →</Link>
          </p>
        </Panel>
      ) : null}

      {catalog ? (
        <>
          <Panel title="Strict mode">
            {isAdmin ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} style={{ width: 'auto' }} />
                Enforce MCP strict mode (block unapproved servers)
              </label>
            ) : (
              <p className="notice">
                Strict mode is <strong>{strictMode ? 'ON' : 'OFF'}</strong>.
              </p>
            )}
          </Panel>

          <Panel title="Servers">
            {entries.length === 0 ? (
              <Empty message="No MCP servers in the catalog." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Server</th>
                    <th>Approved</th>
                    <th>Risk tags</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.serverName}>
                      <td className="mono">{e.serverName}</td>
                      <td>
                        {isAdmin ? (
                          <input type="checkbox" checked={e.approved} onChange={() => toggleApproved(e.serverName)} style={{ width: 'auto' }} />
                        ) : (
                          <span className={`badge ${e.approved ? 'ok' : 'high'}`}>{e.approved ? 'approved' : 'denied'}</span>
                        )}
                      </td>
                      <td>{e.riskTags.join(', ') || '—'}</td>
                      <td>{e.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          {isAdmin ? (
            <Panel title="Save changes">
              <button onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save catalog'}
              </button>
              <ErrorLine error={saveError} />
            </Panel>
          ) : null}
        </>
      ) : null}
    </>
  )
}
