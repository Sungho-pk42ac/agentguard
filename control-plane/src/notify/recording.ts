import type { AlertNotification, NotifierPort } from './port.js'

// Records delivered alerts in memory. The acceptance-test double, and also a
// useful console/audit sink for dev control planes.
export class RecordingNotifier implements NotifierPort {
  readonly sent: AlertNotification[] = []

  async notify(notification: AlertNotification): Promise<void> {
    this.sent.push(notification)
  }
}
