import { Box, Text } from 'ink'

// Large ASCII wordmark. "AGENTGUARD" in 5-row block letters (~50 cols) — shown big
// and centered on the fullscreen loading splash. A `compact` one-line variant is
// used as the dashboard header so the brand is present on the analysis view too.
const LOGO: readonly string[] = [
  ' ██   ███ ████ █  █ ████  ███ █  █  ██  ███  ███  ',
  '█  █ █    █    ██ █  █   █    █  █ █  █ █  █ █  █ ',
  '████ █ ██ ███  █ ██  █   █ ██ █  █ ████ ███  █  █ ',
  '█  █ █  █ █    █  █  █   █  █ █  █ █  █ █ █  █  █ ',
  '█  █  ███ ████ █  █  █    ███  ██  █  █ █  █ ███  ',
]

const TAGLINE = '로컬 AI 에이전트 생애주기 보안 스캐너'

export interface BannerProps {
  // Single-line wordmark header (dashboard chrome) instead of the big block logo.
  readonly compact?: boolean
  readonly tagline?: string
}

export function Banner({ compact, tagline }: BannerProps = {}): React.ReactElement {
  const subtitle = tagline ?? TAGLINE

  if (compact) {
    return (
      <Box>
        <Text color="cyanBright" bold>
          ◆ AGENTGUARD
        </Text>
        <Text dimColor>{'  ·  '}{subtitle}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" alignItems="center" marginY={1}>
      {LOGO.map((row, i) => (
        <Text key={i} color="cyanBright" bold>
          {row}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>{subtitle}</Text>
      </Box>
    </Box>
  )
}
