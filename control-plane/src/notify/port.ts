import type { Severity } from '../contract.js'

export interface AlertNotification {
  readonly orgId: string
  readonly assetId: string
  readonly ruleId: string
  readonly surface: string
  readonly severity: Severity
  readonly fingerprint: string
  readonly location: string
  readonly firedAt: number
}

// Alert delivery boundary. Phase 1 ships WebhookNotifier (Slack/Teams incoming
// webhooks) and RecordingNotifier (test double). An SMTP EmailNotifier is a
// production adapter implementing the same port.
export interface NotifierPort {
  notify(notification: AlertNotification): Promise<void>
}
