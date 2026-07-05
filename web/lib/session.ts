'use client'

// Lightweight client-side session HINT. This is NOT a session store: the real
// session is the HTTP-only cookie the browser holds and the control plane owns.
// We only cache the non-sensitive {orgId, role, email} the server returned at
// login so the UI can render role-gated controls without a round-trip. It never
// contains the session token. Cleared on logout or a 401.

import { useEffect, useState } from 'react'
import type { AuthResult } from './types'

const KEY = 'agentguard.session.hint'

export interface SessionHint {
  readonly orgId: string
  readonly role: 'admin' | 'member'
  readonly email?: string
}

export function saveSessionHint(auth: AuthResult, email?: string): void {
  if (typeof localStorage === 'undefined') return
  const hint: SessionHint = { orgId: auth.orgId, role: auth.role, email }
  localStorage.setItem(KEY, JSON.stringify(hint))
}

export function clearSessionHint(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(KEY)
}

export function readSessionHint(): SessionHint | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SessionHint
    if (parsed && typeof parsed.orgId === 'string' && (parsed.role === 'admin' || parsed.role === 'member')) {
      return parsed
    }
  } catch {
    /* fall through */
  }
  return null
}

/** React hook: current session hint, reactive to login/logout in this tab. */
export function useSessionHint(): SessionHint | null {
  const [hint, setHint] = useState<SessionHint | null>(null)
  useEffect(() => {
    setHint(readSessionHint())
    const onStorage = () => setHint(readSessionHint())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return hint
}
