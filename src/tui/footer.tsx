import { Box, Text } from 'ink'

export interface FooterProps {
  readonly findings: number
  readonly critical: number
  readonly scannedAt: number | null
  readonly now: number
  readonly offboardActive: boolean
  readonly loading: boolean
  /** S10: whether 30s auto-rescan is active. */
  readonly watchOn?: boolean
  /** S8: whether severity sort is active. */
  readonly sortActive?: boolean
  /** S7: current search query (shown when non-empty). */
  readonly searchQuery?: string
}

// Bottom keybind chip bar + status line.  Key tokens are rendered as [chip]
// groups so they stand out from prose.  Status is right-aligned in its own row.
export function Footer({
  findings,
  critical,
  scannedAt,
  now,
  offboardActive,
  loading,
  watchOn = false,
  sortActive = false,
  searchQuery = '',
}: FooterProps): React.ReactElement {
  const ago = scannedAt === null ? '—' : `${Math.max(0, Math.round((now - scannedAt) / 1000))}s ago`

  const statusParts: string[] = [
    loading ? 'scanning…' : `${findings} findings · ${critical} critical · last scan ${ago}`,
  ]
  if (watchOn) statusParts.push('[watch 30s]')
  if (sortActive) statusParts.push('[sort: severity]')
  if (searchQuery.trim()) statusParts.push(`[검색: ${searchQuery}]`)

  if (offboardActive) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>[keys] offboard in progress · [q] back</Text>
        <Text dimColor>{statusParts.join('  ')}</Text>
      </Box>
    )
  }

  // Navigation chips grouped by intent
  const navChips  = '[tab] view  [↑↓/jk] scroll  [enter] detail'
  const filterChips = '[f] filter  [g] sort  [/] search  [i] hide'
  const scanChips = '[1/2/3] preset  [r] rescan  [w] watch'
  const actionChips = '[o] offboard  [?] help  [q] quit'
  const keybindLine = `${navChips}   ${filterChips}   ${scanChips}   ${actionChips}`

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{keybindLine}</Text>
      <Text color="cyan">{statusParts.join('  ')}</Text>
    </Box>
  )
}
