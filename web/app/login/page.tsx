'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import type { AuthResult } from '@/lib/types'
import { Panel, ErrorLine } from '@/components/ui'
import { saveSessionHint, clearSessionHint, useSessionHint } from '@/lib/session'

type Mode = 'signin' | 'create-org'

export default function LoginPage() {
  const router = useRouter()
  const hint = useSessionHint()
  const [mode, setMode] = useState<Mode>('signin')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result =
        mode === 'signin'
          ? await api.post<AuthResult>('/v1/auth/login', { email, password })
          : await api.post<AuthResult>('/v1/auth/register', { orgName, email, password })
      saveSessionHint(result, email)
      router.push('/')
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function onSignOut() {
    setError(null)
    setSigningOut(true)
    try {
      await api.post('/v1/auth/logout')
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setError(err)
      }
    } finally {
      clearSessionHint()
      setSigningOut(false)
      window.location.reload()
    }
  }

  if (hint) {
    return (
      <div className="auth-center">
        <div className="auth-card">
          <Panel title="Signed in">
            <p className="notice">Signed in as {hint.email ?? hint.role}.</p>
            <ErrorLine error={error} />
            <button type="button" onClick={onSignOut} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </Panel>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-center">
      <div className="auth-card">
        <Panel title={mode === 'signin' ? 'Sign in' : 'Create org'}>
          <form onSubmit={onSubmit}>
            {mode === 'create-org' ? (
              <>
                <label htmlFor="orgName">Organization name</label>
                <input
                  id="orgName"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                />
              </>
            ) : null}

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />

            <ErrorLine error={error} />

            <button type="submit" disabled={submitting} style={{ marginTop: 16 }}>
              {submitting
                ? mode === 'signin'
                  ? 'Signing in…'
                  : 'Creating org…'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Create org'}
            </button>
          </form>

          <p className="notice" style={{ marginTop: 16 }}>
            {mode === 'signin' ? (
              <>
                Need an organization?{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setError(null)
                    setMode('create-org')
                  }}
                >
                  Create org →
                </a>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setError(null)
                    setMode('signin')
                  }}
                >
                  Sign in →
                </a>
              </>
            )}
          </p>
        </Panel>
      </div>
    </div>
  )
}
