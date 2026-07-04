import { createControlPlane, type ControlPlaneDeps } from './server.js'
import { SqliteStorage } from './storage/sqlite.js'
import { StaticOidcVerifier } from './verify/oidc.js'
import { WebhookNotifier } from './notify/webhook.js'
import { RecordingNotifier } from './notify/recording.js'
import type { AlertNotification, NotifierPort } from './notify/port.js'

// Runnable single-node control plane. Storage defaults to node:sqlite (file via
// AGENTGUARD_CP_DB, else in-memory). Alerts go to a Slack/Teams webhook when
// AGENTGUARD_CP_WEBHOOK is set, otherwise to stderr. OIDC uses a static verifier
// here; production swaps in a JWKS verifier implementing the same port.

class ConsoleNotifier implements NotifierPort {
  private readonly recorder = new RecordingNotifier()
  async notify(n: AlertNotification): Promise<void> {
    await this.recorder.notify(n)
    console.error(`[alert] ${n.severity} ${n.ruleId} on ${n.assetId} (org ${n.orgId}) @ ${n.location}`)
  }
}

function buildDeps(): ControlPlaneDeps {
  const storage = new SqliteStorage(process.env.AGENTGUARD_CP_DB ?? ':memory:')
  const notifier: NotifierPort = process.env.AGENTGUARD_CP_WEBHOOK
    ? new WebhookNotifier(process.env.AGENTGUARD_CP_WEBHOOK)
    : new ConsoleNotifier()
  const oidcVerifier = new StaticOidcVerifier()
  return {
    storage,
    notifier,
    oidcVerifier,
    now: () => Date.now(),
    freshnessWindowSec: 300,
    staleThresholdHours: Number(process.env.AGENTGUARD_CP_STALE_HOURS) || 48,
  }
}

const port = Number(process.env.PORT) || 8787
const server = createControlPlane(buildDeps())
server.listen(port, () => {
  console.error(`AgentGuard Control Plane listening on http://127.0.0.1:${port} (Observe / Phase 1)`)
})
