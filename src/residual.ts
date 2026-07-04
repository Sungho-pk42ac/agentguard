import type { Severity } from './rules.js'

// A residual credential / configuration surface found during an offboarding or
// audit sweep. Detectors (shell-rc, npm-global, posture, file scan, AI tool
// dirs) all normalize their output to this shape so the findings explorer,
// baseline/diff, cleanup planner, and audit report share one contract.

export type ResidualKind = 'api-key' | 'config' | 'mcp-perm'

export interface ResidualCredential {
  // Stable identity for baseline/diff. MUST NOT embed the secret value so that
  // rotation is tracked separately (see baseline --track-rotation).
  readonly id: string
  readonly kind: ResidualKind
  readonly severity: Severity
  // Detector/source label, e.g. 'shell-rc' | 'npm-global' | 'agent-config'
  // | 'project-file' | 'ai-tool-dir'.
  readonly surface: string
  // Normalized (forward-slash) location for display and identity.
  readonly location: string
  // Native filesystem path a cleanup action would operate on, when applicable.
  readonly path?: string
  // 1-based line for line-scoped residuals inside a file.
  readonly line?: number
  // Redacted, human-facing evidence. NEVER a raw secret value.
  readonly evidence: string
  readonly recommendation: string
}

export function residualId(surface: string, location: string, line?: number, tag?: string): string {
  const parts = [surface, location]
  if (line !== undefined) parts.push(`L${line}`)
  if (tag !== undefined) parts.push(tag)
  return parts.join(':')
}

export function residualSeverityRank(kind: ResidualKind): Severity {
  switch (kind) {
    case 'api-key':
      return 'critical'
    case 'mcp-perm':
      return 'high'
    case 'config':
      return 'medium'
  }
}
