// Read-side authorization. Dashboard / read endpoints MUST derive the org from
// an authenticated viewer token, never from a client-supplied ?org=. Phase 1
// ships a StaticViewerAuth (config/seeded viewer keys, also the test double); a
// production SSO/session adapter implements the same port.

export interface ViewerAuth {
  /** Return the org a viewer token is authorized to read, or null. */
  resolveOrg(token: string | undefined): string | null
}

export class StaticViewerAuth implements ViewerAuth {
  private readonly tokens = new Map<string, string>()

  constructor(entries: Record<string, string> = {}) {
    for (const [token, orgId] of Object.entries(entries)) this.tokens.set(token, orgId)
  }

  add(token: string, orgId: string): void {
    this.tokens.set(token, orgId)
  }

  resolveOrg(token: string | undefined): string | null {
    if (!token) return null
    return this.tokens.get(token) ?? null
  }
}

// ── native session auth (M2a, additive) ──
// Read endpoints accept EITHER a legacy viewer token (ViewerAuth.resolveOrg,
// above — untouched) OR an authenticated session (PrincipalResolver, below).
// A viewer token carries no role and MUST NOT be accepted by admin/member
// endpoints — those require a resolved Principal.

import type { Role } from '../model.js'
import type { StoragePort } from '../storage/port.js'

export interface Principal {
  readonly orgId: string
  readonly userId: string
  readonly role: Role
}

export interface PrincipalInput {
  readonly bearer?: string
  readonly cookie?: string
}

export interface PrincipalResolver {
  /** Return the authenticated principal for a Bearer token or session cookie, or null. */
  resolvePrincipal(input: PrincipalInput): Promise<Principal | null>
}

/** Session-backed principal resolver. Bearer takes precedence over cookie. */
export class SessionAuth implements PrincipalResolver {
  constructor(
    private readonly storage: StoragePort,
    private readonly now: () => number,
  ) {}

  async resolvePrincipal(input: PrincipalInput): Promise<Principal | null> {
    const token = input.bearer ?? input.cookie
    if (!token) return null
    const session = await this.storage.getSession(token)
    if (!session) return null
    if (session.expiresAt < this.now()) return null
    await this.storage.touchSession(token, this.now())
    return { orgId: session.orgId, userId: session.userId, role: session.role }
  }
}
