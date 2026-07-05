import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Local auth-client session cache: ~/.agentguard/session.json.
//
// Written after a successful `agentguard login`, read by `agentguard logout`
// (and, in a later slice, by authenticated commands). Kept deliberately
// separate from `enrollment.ts` (device-token identity for the report agent)
// — a human login session and a machine enrollment are different credentials.

export interface SessionFile {
  readonly endpoint: string
  readonly sessionToken: string
  readonly orgId: string
  readonly role: string
  readonly email: string
}

export function sessionPath(home: string = homedir()): string {
  return join(home, '.agentguard', 'session.json')
}

/** Read the cached session, or `undefined` if none exists / it is unreadable. */
export function readSession(home: string = homedir()): SessionFile | undefined {
  const path = sessionPath(home)
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SessionFile
  } catch {
    return undefined
  }
}

/** Persist a session, best-effort restricting the file to owner read/write. */
export function writeSession(session: SessionFile, home: string = homedir()): void {
  const path = sessionPath(home)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(session, null, 2) + '\n')
  try {
    // chmod is a no-op on win32 (no POSIX permission bits); best-effort elsewhere.
    chmodSync(path, 0o600)
  } catch {
    // ignore
  }
}

/** Remove the cached session, tolerating an already-missing file. */
export function clearSession(home: string = homedir()): void {
  const path = sessionPath(home)
  try {
    unlinkSync(path)
  } catch {
    // already gone
  }
}
