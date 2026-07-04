// OIDC token verification port. Phase 1 ships a complete StaticOidcVerifier
// (usable for pre-shared / on-prem tokens and as the acceptance-test double). A
// production JwksOidcVerifier that validates GitHub/GitLab id-tokens against the
// provider JWKS (issuer + audience + expiry) implements this same interface.

export interface OidcClaims {
  readonly subject: string
  readonly provider: 'github' | 'gitlab'
}

export interface OidcVerifier {
  /** Return the verified claims, or null if the token is not valid/known. */
  verify(token: string): OidcClaims | null
}

export class StaticOidcVerifier implements OidcVerifier {
  private readonly tokens = new Map<string, OidcClaims>()

  constructor(entries: Record<string, OidcClaims> = {}) {
    for (const [token, claims] of Object.entries(entries)) this.tokens.set(token, claims)
  }

  add(token: string, claims: OidcClaims): void {
    this.tokens.set(token, claims)
  }

  verify(token: string): OidcClaims | null {
    return this.tokens.get(token) ?? null
  }
}
