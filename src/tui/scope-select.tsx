import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { SCOPE_ITEMS, type ScopeItem, type ScopeKey } from '../residual-scan.js'
import { clampIndex, toggleInList } from './view-model.js'

export interface ScopeSelectProps {
  readonly items?: readonly ScopeItem[]
  readonly initial?: readonly ScopeKey[]
  // Confirm with the selected scopes; an empty array means cancel.
  readonly onConfirm: (scopes: ScopeKey[]) => void
}

// Checkbox scope picker used by the offboarding flow. Space toggles, Enter
// confirms, `a`/`n` select all/none, Esc/q cancels.
export function ScopeSelect({ items = SCOPE_ITEMS, initial, onConfirm }: ScopeSelectProps): React.ReactElement {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<ScopeKey[]>([...(initial ?? items.map((item) => item.key))])

  useInput((char, key) => {
    if (key.upArrow || char === 'k') return setIndex((i) => clampIndex(i - 1, items.length))
    if (key.downArrow || char === 'j') return setIndex((i) => clampIndex(i + 1, items.length))
    if (char === ' ') return setSelected((s) => toggleInList(s, items[clampIndex(index, items.length)].key))
    if (char === 'a') return setSelected(items.map((item) => item.key))
    if (char === 'n') return setSelected([])
    if (key.return) return onConfirm(selected)
    if (key.escape || char === 'q') onConfirm([])
  })

  const cursor = clampIndex(index, items.length)

  return (
    <Box flexDirection="column">
      <Text color="cyan">Select scan scope (space toggle · a all · n none · Enter start · q cancel)</Text>
      {items.map((item, offset) => {
        const checked = selected.includes(item.key)
        const isCursor = offset === cursor
        return (
          <Text key={item.key} inverse={isCursor}>
            {isCursor ? '›' : ' '} [{checked ? 'x' : ' '}] {item.label}
          </Text>
        )
      })}
      <Text dimColor>{selected.length} scope(s) selected</Text>
    </Box>
  )
}
