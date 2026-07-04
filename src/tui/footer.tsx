import { Box, Text } from 'ink'

export interface FooterProps {
  readonly findings: number
  readonly critical: number
  readonly scannedAt: number | null
  readonly now: number
  readonly offboardActive: boolean
  readonly loading: boolean
}

// Bottom keybind + status bar (tokscale-style). Keybinds reflect the active mode.
export function Footer({ findings, critical, scannedAt, now, offboardActive, loading }: FooterProps): React.ReactElement {
  const keys = offboardActive
    ? '[keys] offboard in progress · [q] back'
    : '[tab] view  [↑↓] scroll  [f] filter  [enter] detail  [o] offboard  [r] rescan  [q] quit'
  const ago = scannedAt === null ? '—' : `${Math.max(0, Math.round((now - scannedAt) / 1000))}s ago`
  const status = loading ? 'scanning…' : `${findings} findings · ${critical} critical · last scan ${ago}`
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{keys}</Text>
      <Text>{status}</Text>
    </Box>
  )
}
