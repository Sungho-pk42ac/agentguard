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

// Bottom keybind + status bar (tokscale-style). Keybinds reflect the active mode.
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
  const keys = offboardActive
    ? '[keys] offboard in progress · [q] back'
    : '[tab] view  [↑↓] scroll  [f] filter  [enter] detail  [i] hide  [/] search  [g] sort  [w] watch  [1/2/3] preset  [o] offboard  [r] rescan  [?] help  [q] quit'
  const ago = scannedAt === null ? '—' : `${Math.max(0, Math.round((now - scannedAt) / 1000))}s ago`
  const statusParts = [
    loading ? 'scanning…' : `${findings} findings · ${critical} critical · last scan ${ago}`,
  ]
  if (watchOn) statusParts.push('[watch 30s]')
  if (sortActive) statusParts.push('[sort: severity]')
  if (searchQuery.trim()) statusParts.push(`[검색: ${searchQuery}]`)
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{keys}</Text>
      <Text>{statusParts.join('  ')}</Text>
    </Box>
  )
}
