import { Box, Text } from 'ink'
import type { Severity } from '../rules.js'
import { clampIndex, type ExplorerItem, filterItems, severityColor, sortItemsBySeverity } from './view-model.js'

const WINDOW = 10

export interface FindingsViewProps {
  readonly title: string
  readonly items: readonly ExplorerItem[]
  readonly cursor: number
  readonly filter?: Severity
  readonly detailOpen: boolean
}

// DUMB findings list — reuses the view-model primitives (sortItemsBySeverity,
// filterItems, clampIndex, severityColor). Owns NO input; the dashboard's single
// global useInput drives cursor/filter/detail. Mirrors the tokscale scrollable
// list (bold colored header + dim detail).
export function FindingsView({ title, items, cursor, filter, detailOpen }: FindingsViewProps): React.ReactElement {
  const filtered = filterItems(sortItemsBySeverity(items), { severity: filter })
  const header = (
    <Text color="cyan">
      {title} — {filtered.length}/{items.length}
      {filter ? `  [severity: ${filter}]` : ''}
    </Text>
  )
  if (filtered.length === 0) {
    return (
      <Box flexDirection="column">
        {header}
        <Text dimColor>{items.length === 0 ? 'No findings.' : `No findings at severity ${filter}.`}</Text>
      </Box>
    )
  }
  const idx = clampIndex(cursor, filtered.length)
  const start = Math.max(0, Math.min(idx - Math.floor(WINDOW / 2), Math.max(0, filtered.length - WINDOW)))
  const visible = filtered.slice(start, start + WINDOW)
  const selected = filtered[idx]
  return (
    <Box flexDirection="column">
      {header}
      {visible.map((item, offset) => {
        const isSelected = start + offset === idx
        return (
          <Text key={start + offset} color={severityColor(item.severity)} inverse={isSelected}>
            {isSelected ? '›' : ' '} [{item.severity.padEnd(8)}] {item.surface.padEnd(14)} {item.location}
          </Text>
        )
      })}
      {detailOpen && selected ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Detail</Text>
          <Text>
            {selected.location}
            {selected.line ? `:${selected.line}` : ''}
          </Text>
          <Text>evidence: {selected.evidence}</Text>
          <Text dimColor>fix: {selected.recommendation}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
