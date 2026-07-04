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
