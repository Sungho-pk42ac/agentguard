import { Box, Text } from 'ink'
import type { ScanVerdict } from '../core.js'
import type { SurfaceBar } from './dashboard-data.js'
import { severityColor } from './view-model.js'

const VERDICT_COLOR: Record<ScanVerdict, string> = { PASS: 'green', REVIEW: 'yellow', BLOCK: 'red' }
const BAR_GLYPH = '█'

export function VerdictBadge({ verdict, critical }: { readonly verdict: ScanVerdict; readonly critical: number }): React.ReactElement {
  return (
    <Text color={VERDICT_COLOR[verdict]} bold>
      {verdict}
      {critical > 0 ? ` · ${critical} critical` : ''}
    </Text>
  )
}

export interface HeroChartProps {
  readonly surfaces: readonly SurfaceBar[]
  readonly columns?: number
}

// Snapshot bar chart: findings-by-surface, colored by the surface's max severity.
// No time-series (agentguard has no temporal data). Empty state short-circuits
// BEFORE any count/maxCount division.
export function HeroChart({ surfaces, columns = 80 }: HeroChartProps): React.ReactElement {
  if (surfaces.length === 0) {
    return <Text color="green">PASS — no residual credentials found</Text>
  }
  const maxCount = Math.max(...surfaces.map((s) => s.count))
  const labelWidth = Math.min(18, Math.max(6, ...surfaces.map((s) => s.surface.length)))
  const barMax = Math.max(4, Math.min(columns - labelWidth - 10, 40))
  return (
    <Box flexDirection="column">
      <Text bold>Findings by surface</Text>
      {surfaces.map((s) => {
        const scaled = maxCount > 0 ? Math.max(1, Math.round((s.count / maxCount) * barMax)) : 0
        const label = s.surface.slice(0, labelWidth).padEnd(labelWidth)
        return (
          <Text key={s.surface} color={severityColor(s.severity)}>
            {label} {BAR_GLYPH.repeat(scaled)} {s.count}
          </Text>
        )
      })}
    </Box>
  )
}
