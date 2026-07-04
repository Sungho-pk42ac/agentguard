import { Box, Text } from 'ink'
import type { Severity } from '../rules.js'
import { lookupCategoryRemediation, severityRationaleKO } from './detail-model.js'
import { clampIndex, type ExplorerItem, filterItems, severityColor, sortItemsBySeverity } from './view-model.js'

const WINDOW = 10

export interface FindingsViewProps {
  readonly title: string
  readonly items: readonly ExplorerItem[]
  readonly cursor: number
  readonly filter?: Severity
  readonly detailOpen: boolean
  /** S6: item ids hidden for display (verdict/aggregate unchanged). */
  readonly hidden?: ReadonlySet<string>
  /** S7: live search query forwarded to filterItems. */
  readonly query?: string
  /** S8: when true, items are sorted by severity descending. */
  readonly sortActive?: boolean
}

// DUMB findings list — reuses the view-model primitives (sortItemsBySeverity,
// filterItems, clampIndex, severityColor). Owns NO input; the dashboard's single
// global useInput drives cursor/filter/detail. Mirrors the tokscale scrollable
// list (bold colored header + dim detail).
export function FindingsView({ title, items, cursor, filter, detailOpen, hidden, query, sortActive }: FindingsViewProps): React.ReactElement {
  // S6: filter hidden items for display only (verdict/aggregate unchanged).
  const visible = hidden ? items.filter((item) => !hidden.has(item.id)) : items
  // S8: sort by severity when active (default: original order).
  const sorted = sortActive ? sortItemsBySeverity(visible) : [...visible]
  // S7+existing: filter by severity and search query.
  const filtered = filterItems(sorted, { severity: filter, query })

  const sortIndicator = sortActive ? ' [↓ severity]' : ''
  const header = (
    <Text color="cyan">
      {title} — {filtered.length}/{items.length}
      {filter ? `  [severity: ${filter}]` : ''}
      {sortIndicator}
      {query?.trim() ? `  [검색: ${query}]` : ''}
    </Text>
  )

  if (filtered.length === 0) {
    // S2: show 깨끗함 ✓ when the tab genuinely has 0 original items;
    // otherwise show the filter-narrows message.
    const emptyMsg = items.length === 0 ? '깨끗함 ✓  이 범주에서 발견된 항목이 없습니다.' : `No findings at severity ${filter ?? 'any'}.`
    return (
      <Box flexDirection="column">
        {header}
        <Text color={items.length === 0 ? 'green' : undefined} dimColor={items.length !== 0}>{emptyMsg}</Text>
      </Box>
    )
  }

  const idx = clampIndex(cursor, filtered.length)
  const start = Math.max(0, Math.min(idx - Math.floor(WINDOW / 2), Math.max(0, filtered.length - WINDOW)))
  const page = filtered.slice(start, start + WINDOW)
  const selected = filtered[idx]

  return (
    <Box flexDirection="column">
      {header}
      {page.map((item, offset) => {
        const isSelected = start + offset === idx
        return (
          <Text key={`${item.id}-${start + offset}`} color={severityColor(item.severity)} inverse={isSelected}>
            {isSelected ? '›' : ' '} [{item.severity.padEnd(8)}] {item.surface.padEnd(14)} {item.location}
          </Text>
        )
      })}
      {detailOpen && selected ? (
        // S5: detail panel — full path + severity rationale + category KO remediation + recommendation
        <Box flexDirection="column" marginTop={1}>
          <Text bold>세부정보 Detail</Text>
          <Text>
            {selected.location}
            {selected.line ? `:${selected.line}` : ''}
          </Text>
          <Text color={severityColor(selected.severity)}>[심각도] {selected.severity} — {severityRationaleKO[selected.severity]}</Text>
          {(() => {
            const ko = lookupCategoryRemediation(selected.surface)
            return ko ? <Text color="yellow">[조치] {ko}</Text> : null
          })()}
          <Text>evidence: {selected.evidence}</Text>
          <Text dimColor>fix: {selected.recommendation}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
