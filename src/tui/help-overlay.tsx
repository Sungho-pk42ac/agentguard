import { Box, Text } from 'ink'

// All keybinds with Korean labels. Rendered as a DUMB read-only overlay;
// the dashboard's single useInput closes it on any key.
const KEYBINDS: readonly { key: string; label: string }[] = [
  { key: '?', label: '도움말 토글' },
  { key: 'q / esc', label: '종료' },
  { key: 'r', label: '재스캔' },
  { key: 'tab / →', label: '다음 탭' },
  { key: 'shift+tab / ←', label: '이전 탭' },
  { key: '/', label: '검색 시작' },
  { key: 'esc  (검색 중)', label: '검색 취소 및 초기화' },
  { key: 'enter  (검색 중)', label: '검색 유지 및 종료' },
  { key: '1', label: 'Quick 프리셋 재스캔 (기본)' },
  { key: '2', label: 'Project 프리셋 재스캔' },
  { key: '3', label: 'Full 프리셋 재스캔' },
  { key: 'g', label: '심각도 정렬 토글' },
  { key: 'w', label: '자동 재스캔 토글 (30초 간격)' },
  { key: 'o', label: '오프보딩 시작' },
  { key: '↑/k  ↓/j', label: '목록 이동 (자격증명·포스처 탭)' },
  { key: 'enter', label: '세부정보 토글 (목록 탭)' },
  { key: 'f', label: '심각도 필터 순환 (목록 탭)' },
  { key: 'i', label: '현재 항목 숨기기 / 표시 (목록 탭)' },
  { key: 's', label: '기준선 저장 (기준선 탭)' },
]

/** DUMB overlay listing all keybinds with Korean labels. Closed by any key press. */
export function HelpOverlay(): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingLeft={1} paddingRight={1}>
      <Text bold color="cyan">AgentGuard 키보드 단축키</Text>
      {KEYBINDS.map(({ key, label }) => (
        <Box key={key}>
          <Text color="yellow">{key.padEnd(24)}</Text>
          <Text>  {label}</Text>
        </Box>
      ))}
      <Text dimColor>아무 키나 누르면 닫힘</Text>
    </Box>
  )
}
