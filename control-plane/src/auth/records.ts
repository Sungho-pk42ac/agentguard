// Password hashing + token/id minting for native session auth (M2a).
// scrypt via node:crypto only — no new dependency. Format:
//   scrypt:N=16384,r=8,p=1:<saltB64>:<hashB64>
// Verification re-derives with the STORED params (never the caller's), so a
// future param bump does not break existing hashes, and compares with
// timingSafeEqual (no early-exit branch on content).

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 64
const SALT_LEN = 16

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN)
  const hash = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
  return `scrypt:N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}:${salt.toString('base64')}:${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false
  const params = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(parts[1] ?? '')
  if (!params) return false
  const N = Number(params[1])
  const r = Number(params[2])
  const p = Number(params[3])
  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(parts[2] ?? '', 'base64')
    expected = Buffer.from(parts[3] ?? '', 'base64')
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length === 0) return false
  let actual: Buffer
  try {
    actual = scryptSync(password, salt, expected.length, { N, r, p })
  } catch {
    return false
  }
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

/** 32 random bytes as hex — used for session/csrf/device tokens. */
export function mintToken(): string {
  return randomBytes(32).toString('hex')
}

export function mintId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`
}

// Human-entry device-flow code, e.g. "AB12-CD34". Excludes visually ambiguous
// characters (0/O, 1/I).
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function mintUserCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += USER_CODE_ALPHABET[bytes[i]! % USER_CODE_ALPHABET.length]
    if (i === 3) out += '-'
  }
  return out
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
