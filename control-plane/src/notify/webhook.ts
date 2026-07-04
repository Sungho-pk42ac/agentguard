import type { AlertNotification, NotifierPort } from './port.js'

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ status: number }>

// Posts a Slack/Teams-compatible incoming-webhook message. The payload only
// carries already-redacted finding metadata (rule, surface, severity, location,
// fingerprint) — never a raw secret. Delivery is bounded by a timeout so a hung
// webhook cannot stall alert processing.
export class WebhookNotifier implements NotifierPort {
  constructor(
    private readonly webhookUrl: string,
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
    private readonly timeoutMs = 5_000,
  ) {}

  async notify(n: AlertNotification): Promise<void> {
    const text =
      `:rotating_light: AgentGuard: new *${n.severity}* finding \`${n.ruleId}\` ` +
      `(${n.surface}) on asset ${n.assetId} at ${n.location} [org ${n.orgId}, fp ${n.fingerprint.slice(0, 8)}]`
    const res = await this.fetchImpl(this.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(this.timeoutMs),
    })
    if (res.status >= 300) {
      throw new Error(`webhook delivery failed (HTTP ${res.status})`)
    }
  }
}
