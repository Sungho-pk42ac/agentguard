import type { Severity } from '../rules.js'
import type { ScanVerdict } from '../core.js'

/** Canonical severity colour tokens.
 *  high uses hex so chalk.hex() auto-degrades instead of erroring on 'orange'.
 *  Never use the string 'orange' — it is not a chalk named colour. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'red',
  high: '#d78700',
  medium: 'yellow',
  low: 'gray',
}

/** Verdict badge background + high-contrast foreground. */
export const VERDICT_BADGE: Record<ScanVerdict, { readonly bg: string; readonly fg: string }> = {
  PASS:   { bg: 'green',  fg: 'black' },
  REVIEW: { bg: 'yellow', fg: 'black' },
  BLOCK:  { bg: 'red',    fg: 'white' },
}

/** Shared Panel border configuration. */
export const BORDER = { style: 'round' as const, color: 'cyan' as const }

/** Icon map: per-tab + per-surface, each with a width-1 Unicode glyph and a
 *  width-1 ASCII fallback for AGENTGUARD_ASCII=1 environments. */
export const ICONS: Record<string, { readonly unicode: string; readonly ascii: string }> = {
  // ── Tabs ────────────────────────────────────────────────────────────────
  overview:    { unicode: '●', ascii: 'o' },
  agents:      { unicode: '◆', ascii: '*' },
  credentials: { unicode: '■', ascii: '#' },
  posture:     { unicode: '▲', ascii: '^' },
  baseline:    { unicode: '⊙', ascii: '@' },
  offboard:    { unicode: '✓', ascii: '+' },
  // ── Surfaces ────────────────────────────────────────────────────────────
  'shell-rc':    { unicode: '●', ascii: 'o' },
  'ai-tool-dir': { unicode: '▸', ascii: '>' },
  'agent-config':{ unicode: '◆', ascii: '*' },
  'npm-global':  { unicode: '■', ascii: '#' },
  'project-file':{ unicode: '▲', ascii: '^' },
}

/** Returns true when AGENTGUARD_ASCII=1 is set in the environment. */
export function asciiMode(): boolean {
  return process.env['AGENTGUARD_ASCII'] === '1'
}

/** Look up the width-1 glyph for a named icon, honouring ASCII mode.
 *  Returns an empty string for unknown names. */
export function glyph(name: string): string {
  const icon = ICONS[name]
  if (!icon) return ''
  return asciiMode() ? icon.ascii : icon.unicode
}
