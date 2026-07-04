import { Box, Text } from 'ink'

// Colored ASCII wordmark shown on the dashboard launch/loading screen (where the
// old Node deprecation warning used to print). Pure presentation — no state, no
// scan. Block-letter rows are fixed-width (25 cols) so the two words stay aligned.
const AGENT: readonly string[] = [
  ' ██   ███ ████ █  █ ████ ',
  '█  █ █    █    ██ █  █   ',
  '████ █ ██ ███  █ ██  █   ',
  '█  █ █  █ █    █  █  █   ',
  '█  █  ███ ████ █  █  █   ',
]

const GUARD: readonly string[] = [
  ' ███ █  █  ██  ███  ███  ',
  '█    █  █ █  █ █  █ █  █ ',
  '█ ██ █  █ ████ ███  █  █ ',
  '█  █ █  █ █  █ █ █  █  █ ',
  ' ███  ██  █  █ █  █ ███  ',
]

export interface BannerProps {
  // Optional one-line tagline under the wordmark (defaults to the Korean subtitle).
  readonly tagline?: string
}

export function Banner({ tagline }: BannerProps = {}): React.ReactElement {
  const subtitle = tagline ?? '로컬 AI 에이전트 생애주기 보안 스캐너  ·  v0.3.0'
  return (
    <Box flexDirection="column" marginBottom={1}>
      {AGENT.map((row, i) => (
        <Text key={`a${i}`} color="cyanBright" bold>
          {row}
        </Text>
      ))}
      {GUARD.map((row, i) => (
        <Text key={`g${i}`} color="green" bold>
          {row}
        </Text>
      ))}
      <Text dimColor>{subtitle}</Text>
    </Box>
  )
}
