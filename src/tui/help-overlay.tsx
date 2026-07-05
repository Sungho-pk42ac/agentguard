import { Box, Text } from 'ink'
import { Panel } from './panel.js'

// Keybinds grouped by intent (Korean group headers) and sorted within each group.
interface KeyEntry { readonly key: string; readonly label: string }
interface KeyGroup { readonly header: string; readonly keys: readonly KeyEntry[] }

const GROUPS: readonly KeyGroup[] = [
  {
    header: '탐색',
    keys: [
      { key: 'tab / →',         label: '다음 탭' },
      { key: 'shift+tab / ←',   label: '이전 탭' },
      { key: '탭 순서',         label: 'Overview → Credentials → Posture → Agents → Baseline → Offboard → Fleet' },
      { key: '↑/k  ↓/j',       label: '목록 이동 (자격증명·포스처)' },
      { key: 'enter',            label: '세부정보 토글 (목록 탭)' },
    ],
  },
  {
    header: '필터',
    keys: [
      { key: 'f',                label: '심각도 필터 순환' },
      { key: 'g',                label: '심각도 정렬 토글' },
      { key: '/',                label: '검색 시작' },
      { key: 'esc (검색 중)',    label: '검색 취소 및 초기화' },
      { key: 'enter (검색 중)',  label: '검색 유지 및 종료' },
    ],
  },
  {
    header: '스캔',
    keys: [
      { key: 'r',                label: '재스캔' },
      { key: '1',                label: 'Quick 프리셋 재스캔 (기본)' },
      { key: '2',                label: 'Project 프리셋 재스캔' },
      { key: '3',                label: 'Full 프리셋 재스캔' },
      { key: 'w',                label: '자동 재스캔 토글 (30초 간격)' },
    ],
  },
  {
    header: '액션',
    keys: [
      { key: 'e',                label: '선택한 항목을 에디터로 열기 (목록 탭)' },
      { key: 'i',                label: '현재 항목 숨기기 / 표시' },
      { key: 's',                label: '기준선 저장 (기준선 탭)' },
      { key: 'o',                label: '오프보딩 시작' },
    ],
  },
  {
    header: '일반',
    keys: [
      { key: '?',                label: '도움말 토글' },
      { key: 'q / esc',          label: '종료' },
    ],
  },
]

/** DUMB overlay: keybinds grouped in 2-column layout inside a framed Panel modal.
 *  The dashboard's single useInput closes it on any key press — behavior unchanged. */
export function HelpOverlay(): React.ReactElement {
  const KEY_COL = 22 // padEnd width for the key column

  return (
    <Box flexDirection="column" alignItems="center">
      <Panel title="AgentGuard 키보드 단축키">
        {GROUPS.map((group) => (
          <Box key={group.header} flexDirection="column" marginTop={1}>
            <Text bold color="cyan">{group.header}</Text>
            {group.keys.map(({ key, label }) => (
              <Box key={key}>
                <Text color="yellow">{key.padEnd(KEY_COL)}</Text>
                <Text>  {label}</Text>
              </Box>
            ))}
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>아무 키나 누르면 닫힘</Text>
        </Box>
      </Panel>
    </Box>
  )
}
