import type { Severity } from '../rules.js'
import type { DashboardData } from './dashboard-data.js'

// PURE COMPOSITION over already-gathered DashboardData (residuals from the
// npm-global + ai-tool-dir surfaces). NO new detection, no fs/spawn, no
// mutation — inspection/reason-only (onboarding check). Reuse mandate.

export interface AgentInventoryEntry {
  readonly name: string
  readonly source: string
  readonly severity: Severity
  readonly detail: string
  readonly location: string
}

function deriveName(surface: string, location: string): string {
  // location shapes: 'npm-global:@openai/codex', 'ai-tool-dir:/home/x/.claude'
  const withoutSurface = location.startsWith(`${surface}:`) ? location.slice(surface.length + 1) : location
  if (surface === 'npm-global') return withoutSurface
  // ai-tool-dir → basename of the path
  const parts = withoutSurface.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? withoutSurface
}

export function agentInventory(data: DashboardData): AgentInventoryEntry[] {
  return data.agentItems.map((item) => ({
    name: deriveName(item.surface, item.location),
    source: item.surface,
    severity: item.severity,
    detail: item.evidence,
    location: item.location,
  }))
}
