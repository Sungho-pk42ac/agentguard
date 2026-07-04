import { Box, Text } from 'ink'
import type { BaselineDiff } from '../baseline.js'
import { severityColor } from './view-model.js'

export interface BaselineViewProps {
  readonly has: boolean
  readonly diff: BaselineDiff | null
  readonly message: string | null
}

// DUMB view. Renders the baseline/diff state; the dashboard owns input ([s] to
// save) and computes load/diff via the existing baseline exports.
export function BaselineView({ has, diff, message }: BaselineViewProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text color="cyan">Baseline — snapshot &amp; drift ([s] save current scan as baseline)</Text>
      {message ? <Text color="green">{message}</Text> : null}
      {!has || !diff ? (
        <Text dimColor>No baseline saved yet. Press [s] to snapshot the current scan (~/.agentguard/baselines).</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            Drift vs last baseline: <Text color="red">+{diff.appeared.length} appeared</Text>{' · '}
            <Text color="yellow">-{diff.disappeared.length} disappeared</Text>{' · '}
            <Text color="magenta">~{diff.rotated.length} rotated</Text>{' · '}
            <Text dimColor>{diff.unchanged} unchanged</Text>
          </Text>
          {diff.appeared.slice(0, 8).map((r, i) => (
            <Text key={`a${i}`} color={severityColor(r.severity)}>
              + [{r.severity.padEnd(8)}] {r.surface.padEnd(14)} {r.location}
            </Text>
          ))}
          {diff.disappeared.slice(0, 8).map((e, i) => (
            <Text key={`d${i}`} dimColor>
              - [{e.severity.padEnd(8)}] {e.surface.padEnd(14)} {e.location}
            </Text>
          ))}
          {diff.rotated.slice(0, 8).map((r, i) => (
            <Text key={`r${i}`} color="magenta">
              ~ [{r.severity.padEnd(8)}] {r.surface.padEnd(14)} {r.location} (value changed)
            </Text>
          ))}
          {diff.appeared.length === 0 && diff.disappeared.length === 0 && diff.rotated.length === 0 ? (
            <Text color="green">No drift since the last baseline.</Text>
          ) : null}
        </Box>
      )}
    </Box>
  )
}
