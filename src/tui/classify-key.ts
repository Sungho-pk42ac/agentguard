// Pure precedence ladder: converts (state, char, key) → Intent.
// Rungs are filled by later slices and NEVER re-ordered.
// Ladder order:
//   1. offboard-active → none  (C6: offboard owns all input)
//   2. search-capture
//   3. overlay-open
//   4. confirm-full y/N
//   5. global  (q/esc/r/?/1/2/3/g/w/o/tab/arrows)
//   6. list-tab-scoped  (↑↓/j/k/enter/f/i)  [credentials, posture only]
//   7. baseline-tab  (s)
//   8. offboard-tab  (enter)

export type TabId = 'overview' | 'agents' | 'credentials' | 'posture' | 'baseline' | 'offboard'

export interface ClassifyState {
  readonly offboardActive: boolean
  readonly searchCapture: boolean
  readonly overlayOpen: boolean
  /** Waiting for y/N confirmation before a Full-preset scan from a non-project cwd. */
  readonly confirmFull: boolean
  readonly activeTab: TabId
}

export type Intent =
  | { kind: 'quit' }
  | { kind: 'rescan' }
  | { kind: 'tabNext' }
  | { kind: 'tabPrev' }
  | { kind: 'help' }
  | { kind: 'searchOpen' }
  | { kind: 'searchChar'; char: string }
  | { kind: 'searchBackspace' }
  | { kind: 'searchExit' }
  | { kind: 'searchCommit' }
  | { kind: 'preset'; n: 1 | 2 | 3 }
  | { kind: 'sortToggle' }
  | { kind: 'watchToggle' }
  | { kind: 'hide' }
  | { kind: 'move'; delta: number }
  | { kind: 'detail' }
  | { kind: 'filter' }
  | { kind: 'openOffboard' }
  | { kind: 'baselineSave' }
  | { kind: 'confirmYes' }
  | { kind: 'confirmNo' }
  | { kind: 'none' }

export interface KeyInput {
  readonly escape?: boolean
  readonly backspace?: boolean
  readonly return?: boolean
  readonly tab?: boolean
  readonly shift?: boolean
  readonly upArrow?: boolean
  readonly downArrow?: boolean
  readonly leftArrow?: boolean
  readonly rightArrow?: boolean
}

const LIST_TABS = new Set<string>(['credentials', 'posture'])

export function classifyKey(state: ClassifyState, char: string, key: KeyInput): Intent {
  // 1. Offboard active → none (offboard's own useInput owns all input)
  if (state.offboardActive) return { kind: 'none' }

  // 2. Search-capture mode: intercept all printable chars + control keys
  if (state.searchCapture) {
    if (key.escape) return { kind: 'searchExit' }
    if (key.return) return { kind: 'searchCommit' }
    if (key.backspace) return { kind: 'searchBackspace' }
    if (char.length === 1 && char >= ' ') return { kind: 'searchChar', char }
    return { kind: 'none' }
  }

  // 3. Overlay open → any key closes (toggles)
  if (state.overlayOpen) return { kind: 'help' }

  // 4. Confirm-full prompt: only y confirms; everything else cancels
  if (state.confirmFull) {
    if (char === 'y' || char === 'Y') return { kind: 'confirmYes' }
    return { kind: 'confirmNo' }
  }

  // 5. Global keys (available on all tabs)
  if (key.escape || char === 'q') return { kind: 'quit' }
  if (char === 'r') return { kind: 'rescan' }
  if (char === '?') return { kind: 'help' }
  if (char === '/') return { kind: 'searchOpen' }
  if (char === '1') return { kind: 'preset', n: 1 }
  if (char === '2') return { kind: 'preset', n: 2 }
  if (char === '3') return { kind: 'preset', n: 3 }
  if (char === 'g') return { kind: 'sortToggle' }
  if (char === 'w') return { kind: 'watchToggle' }
  if (char === 'o') return { kind: 'openOffboard' }
  if ((key.tab && key.shift) || key.leftArrow) return { kind: 'tabPrev' }
  if (key.tab || key.rightArrow) return { kind: 'tabNext' }

  // 6. List-tab-scoped: credentials and posture only
  if (LIST_TABS.has(state.activeTab)) {
    if (key.upArrow || char === 'k') return { kind: 'move', delta: -1 }
    if (key.downArrow || char === 'j') return { kind: 'move', delta: 1 }
    if (key.return) return { kind: 'detail' }
    if (char === 'f') return { kind: 'filter' }
    if (char === 'i') return { kind: 'hide' }
  }

  // 7. Baseline-tab scoped
  if (state.activeTab === 'baseline' && char === 's') return { kind: 'baselineSave' }

  // 8. Offboard-tab enter
  if (state.activeTab === 'offboard' && key.return) return { kind: 'openOffboard' }

  return { kind: 'none' }
}
