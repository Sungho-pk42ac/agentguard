import { Box, Text } from 'ink'
import type { ScanVerdict } from '../core.js'
import type { SurfaceBar } from './dashboard-data.js'
import { VERDICT_BADGE } from './theme.js'
import { severityColor } from './view-model.js'

// Partial-block characters for fractional bar segments (left-heavy halves).
// Index 0 = narrowest (⅛), index 6 = fullest before █.
const PARTIAL_BLOCKS = ['▏', '▎', '▍', '▌', '▋', '▊', '▉']
const FULL_BLOCK = '█'

/** Verdict badge: one contiguous <Text> run with background colour + contrast fg.
 *  Padding spaces are OUTSIDE the coloured run so the badge is visually bounded. */
export function VerdictBadge({ verdict, critical }: { readonly verdict: ScanVerdict; readonly critical: number }): React.ReactElement {
  const badge = VERDICT_BADGE[verdict]
  const label = critical > 0 ? `${verdict} · ${critical} critical` : verdict
  // No leading/trailing padding inside the badge so the tab bar width stays ≤100.
  // The background colour already provides a visual boundary.
  return (
    <Text backgroundColor={badge.bg} color={badge.fg}>{label}</Text>
  )
}

export interface HeroChartProps {
  readonly surfaces: readonly SurfaceBar[]
  readonly columns?: number
}

// Snapshot bar chart: findings-by-surface, colored by the surface's max severity.
// Uses full █ for integer segments and a partial block glyph for the fractional
// remainder so bars reflect the exact proportion without rounding.
export function HeroChart({ surfaces, columns = 80 }: HeroChartProps): React.ReactElement {
  if (surfaces.length === 0) {
    return <Text color="green">PASS — no residual credentials found</Text>
  }
  const maxCount = Math.max(...surfaces.map((s) => s.count))
  const labelWidth = Math.min(18, Math.max(6, ...surfaces.map((s) => s.surface.length)))
  // Reserve space: label + 1 gap + bar + 1 gap + count (up to 4 digits)
  const barMax = Math.max(4, Math.min(columns - labelWidth - 8, 40))
  return (
    <Box flexDirection="column">
      <Text bold>Findings by surface</Text>
      {surfaces.map((s) => {
        const scaledFloat = maxCount > 0 ? (s.count / maxCount) * barMax : 0
        const fullBlocks = Math.max(0, Math.floor(scaledFloat))
        const remainder = scaledFloat - fullBlocks
        // Only render a partial block when the remainder is >= 1/14 (half of ▏ threshold)
        const partialIdx = remainder >= 1 / 14 ? Math.min(6, Math.floor(remainder * 7)) : -1
        const bar = FULL_BLOCK.repeat(fullBlocks) + (partialIdx >= 0 ? PARTIAL_BLOCKS[partialIdx] : '')
        const label = s.surface.slice(0, labelWidth).padEnd(labelWidth)
        return (
          <Text key={s.surface} color={severityColor(s.severity)}>
            {label} {bar} {s.count}
          </Text>
        )
      })}
    </Box>
  )
}
