'use client'

import type { ReactNode } from 'react'
import type { Severity } from '@/lib/types'

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="panel">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}

export function SeverityBadge({ severity }: { severity: Severity | 'unknown' | 'advisory' }) {
  return <span className={`badge ${severity}`}>{severity}</span>
}

export function verdictFor(riskScore: number, critical: number): 'PASS' | 'REVIEW' | 'BLOCK' {
  if (critical > 0) return 'BLOCK'
  if (riskScore > 0) return 'REVIEW'
  return 'PASS'
}

export function VerdictBadge({ verdict }: { verdict: 'PASS' | 'REVIEW' | 'BLOCK' }) {
  return <span className={`verdict ${verdict}`}>{verdict}</span>
}

export function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : String(error)
  return <div className="error">{msg}</div>
}

export function Loading({ what = 'data' }: { what?: string }) {
  return <p className="notice">Loading {what}…</p>
}

export function Empty({ message }: { message: string }) {
  return <p className="notice">{message}</p>
}
