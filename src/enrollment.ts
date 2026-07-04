import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { PushIdentity } from './report-push.js'

// Enrollment identity resolution for the report agent.
//
// Two paths (hybrid enrollment):
//   - CI: an OIDC id-token from the provider (GitHub/GitLab), passed via env.
//   - PC: a device token minted at enrollment time, stored (never a raw secret
//     beyond the token itself) at ~/.agentguard/enrollment.json.

export class EnrollmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnrollmentError'
  }
}

export interface EnrollmentFile {
  readonly orgId: string
  readonly assetId: string
  readonly deviceToken: string
  readonly subject?: string
}

export function enrollmentPath(home: string = homedir()): string {
  return join(home, '.agentguard', 'enrollment.json')
}

export interface ResolveIdentityOptions {
  readonly orgId?: string
  readonly assetId?: string
  readonly home?: string
  readonly env?: NodeJS.ProcessEnv
  readonly readFile?: (path: string) => string
  readonly fileExists?: (path: string) => boolean
}

/**
 * Resolve the report-agent identity + credential.
 *
 * OIDC (CI) is preferred when `AGENTGUARD_OIDC_TOKEN` is set; otherwise the
 * device-token enrollment file is used. CLI flags (`--org`, `--asset`) override
 * the file/env values.
 */
export function resolveIdentity(options: ResolveIdentityOptions = {}): PushIdentity {
  const env = options.env ?? process.env
  const home = options.home ?? homedir()

  const oidcToken = env.AGENTGUARD_OIDC_TOKEN
  if (oidcToken && oidcToken.length > 0) {
    const provider = env.AGENTGUARD_OIDC_PROVIDER === 'gitlab' ? 'gitlab' : 'github'
    const orgId = options.orgId ?? env.AGENTGUARD_ORG
    if (!orgId) throw new EnrollmentError('OIDC report requires --org <id> or AGENTGUARD_ORG')
    const assetId = options.assetId ?? env.AGENTGUARD_ASSET ?? `ci-${provider}`
    return {
      orgId,
      assetId,
      actor: { type: 'oidc', subject: env.AGENTGUARD_OIDC_SUBJECT ?? assetId, provider },
      credential: { kind: 'oidc', token: oidcToken },
    }
  }

  const path = enrollmentPath(home)
  const exists = options.fileExists ?? existsSync
  if (!exists(path)) {
    throw new EnrollmentError(
      `no enrollment found at ${path}; enroll this machine or set AGENTGUARD_OIDC_TOKEN for CI`,
    )
  }
  const read = options.readFile ?? ((p: string) => readFileSync(p, 'utf8'))
  let parsed: EnrollmentFile
  try {
    parsed = JSON.parse(read(path)) as EnrollmentFile
  } catch {
    throw new EnrollmentError('enrollment.json is not valid JSON')
  }
  const orgId = options.orgId ?? parsed.orgId
  const assetId = options.assetId ?? parsed.assetId
  if (!orgId || !assetId || !parsed.deviceToken) {
    throw new EnrollmentError('enrollment.json must contain orgId, assetId, and deviceToken')
  }
  return {
    orgId,
    assetId,
    actor: { type: 'device-token', subject: parsed.subject ?? assetId },
    credential: { kind: 'device-token', secret: parsed.deviceToken },
  }
}
