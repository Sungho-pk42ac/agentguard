import { render, Box, Text, useApp, useInput, useStdout } from 'ink'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { useEffect, useReducer, useRef, useState } from 'react'
import { type BaselineDiff, diffAgainstBaseline, loadBaseline, saveBaseline } from '../baseline.js'
import type { Severity } from '../rules.js'
import { AgentsView } from './agents-view.js'
import { Banner } from './banner.js'
import { BaselineView } from './baseline-view.js'
import { type DashboardData, loadDashboardDataAsync, type LoadDashboardOptions, QUICK_SCOPE, scopeForPreset } from './dashboard-data.js'
import { FindingsView } from './findings-view.js'
import { Footer } from './footer.js'
import { HelpOverlay } from './help-overlay.js'
import { HeroChart, VerdictBadge } from './hero-chart.js'
import { Offboard } from './offboard.js'
import { openInEditor as defaultOpenInEditor, type OpenInEditorOptions, type OpenInEditorResult } from '../open-in-editor.js'
import { readSession, type SessionFile } from '../session.js'
import { FleetView, type FleetFetchLike } from './fleet-view.js'
import { classifyKey } from './classify-key.js'
import { clampIndex, filterItems, nextSeverityFilter, sortItemsBySeverity } from './view-model.js'
import { disableMouseSGR, enableMouseSGR, parseSGR } from './mouse.js'
import { Panel } from './panel.js'
import { glyph } from './theme.js'
import { layoutForWidth } from './layout.js'

// Project markers that make the current directory a real project root. The
// always-on landing scan only walks cwd files when one is present AND cwd is
// not the home directory, so launching `agentguard` from a broad location
// (home, AppData, a drive root) can never trigger an enormous filesystem walk.
const PROJECT_MARKERS = ['.git', 'package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'requirements.txt', 'Gemfile', 'tsconfig.json']

function projectScanPath(cwd: string, home: string): string | undefined {
  if (cwd === home) return undefined
  return PROJECT_MARKERS.some((marker) => existsSync(join(cwd, marker))) ? cwd : undefined
}

export type TabId = 'overview' | 'agents' | 'credentials' | 'posture' | 'baseline' | 'offboard' | 'fleet'

// Workflow-centric IA: scan → fix → verify. Credentials/Posture (actionable
// findings) sit right after Overview; Fleet (org-wide, control-plane-backed)
// is the terminal "verify" tab.
const TABS: readonly { readonly id: TabId; readonly label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'posture', label: 'Posture' },
  { id: 'agents', label: 'Agents' },
  { id: 'baseline', label: 'Baseline' },
  { id: 'offboard', label: 'Offboard' },
  { id: 'fleet', label: 'Fleet' },
]

// List tabs that support ↑↓/j/k/enter/f/i navigation (A4: credentials + posture ONLY).
const LIST_TABS = new Set<TabId>(['credentials', 'posture'])

interface BaselineState {
  readonly has: boolean
  readonly diff: BaselineDiff | null
  readonly message: string | null
}

type Preset = 'quick' | 'project' | 'full'

interface State {
  readonly activeTab: TabId
  readonly loading: boolean
  readonly data: DashboardData | null
  readonly filter?: Severity
  readonly cursor: number
  readonly detailOpen: boolean
  readonly offboardActive: boolean
  readonly baseline: BaselineState
  readonly now: number
  // S1: help overlay
  readonly overlayOpen: boolean
  // S6: session-hide — keyed on ExplorerItem.id; reset on data/rescan
  readonly hidden: ReadonlySet<string>
  // S7: search
  readonly searchQuery: string
  readonly searchCapture: boolean
  // S8: sort mode
  readonly sortActive: boolean
  // S9: preset + confirm prompt
  readonly preset: Preset
  readonly confirmFull: boolean
  // S10: watch auto-rescan
  readonly watchOn: boolean
  // Scan error surface (LOW-fix): a failed scan shows an error, not a false clean PASS.
  readonly scanError: boolean
  // M1b: editor-open status message shown in the footer area.
  readonly editorMessage: string | null
}

type Action =
  | { type: 'loading' }
  | { type: 'data'; data: DashboardData }
  | { type: 'tab'; dir: 1 | -1 }
  | { type: 'setTab'; tabId: TabId }
  | { type: 'move'; delta: number }
  | { type: 'filter' }
  | { type: 'toggleDetail' }
  | { type: 'openOffboard' }
  | { type: 'closeOffboard' }
  | { type: 'baseline'; has: boolean; diff: BaselineDiff | null; message?: string | null }
  | { type: 'toggleOverlay' }
  | { type: 'hideItem'; id: string }
  | { type: 'searchOpen' }
  | { type: 'searchChar'; char: string }
  | { type: 'searchBackspace' }
  | { type: 'searchExit' }
  | { type: 'searchCommit' }
  | { type: 'sortToggle' }
  | { type: 'setPreset'; preset: Preset }
  | { type: 'setConfirmFull'; value: boolean }
  | { type: 'watchToggle' }
  | { type: 'scanError' }
  | { type: 'editorMessage'; message: string | null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, scanError: false }
    case 'scanError':
      return { ...state, loading: false, scanError: true }
    case 'data':
      // S6: reset hidden on data (rescan); also reset cursor to 0
      return { ...state, loading: false, data: action.data, now: Date.now(), hidden: new Set(), cursor: 0, scanError: false }
    case 'tab': {
      const index = TABS.findIndex((t) => t.id === state.activeTab)
      const next = TABS[(index + action.dir + TABS.length) % TABS.length]
      return { ...state, activeTab: next.id, cursor: 0, filter: undefined, detailOpen: false, editorMessage: null }
    }
    case 'setTab':
      return { ...state, activeTab: action.tabId, cursor: 0, filter: undefined, detailOpen: false, editorMessage: null }
    case 'move':
      return { ...state, cursor: Math.max(0, state.cursor + action.delta) }
    case 'filter':
      return { ...state, filter: nextSeverityFilter(state.filter), cursor: 0 }
    case 'toggleDetail':
      return { ...state, detailOpen: !state.detailOpen }
    case 'openOffboard':
      return { ...state, activeTab: 'offboard', offboardActive: true }
    case 'closeOffboard':
      return { ...state, offboardActive: false }
    case 'baseline':
      return { ...state, baseline: { has: action.has, diff: action.diff, message: action.message ?? null } }
    // S1: help overlay
    case 'toggleOverlay':
      return { ...state, overlayOpen: !state.overlayOpen }
    // S6: session-hide
    case 'hideItem': {
      const next = new Set(state.hidden)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return { ...state, hidden: next }
    }
    // S7: search
    case 'searchOpen':
      return { ...state, searchCapture: true, searchQuery: '', detailOpen: false }
    case 'searchChar':
      return { ...state, searchQuery: state.searchQuery + action.char }
    case 'searchBackspace':
      return { ...state, searchQuery: state.searchQuery.slice(0, -1) }
    case 'searchExit':
      return { ...state, searchCapture: false, searchQuery: '', cursor: 0 }
    case 'searchCommit':
      return { ...state, searchCapture: false, cursor: 0 }
    // S8: sort toggle
    case 'sortToggle':
      return { ...state, sortActive: !state.sortActive }
    // S9: preset
    case 'setPreset':
      return { ...state, preset: action.preset }
    case 'setConfirmFull':
      return { ...state, confirmFull: action.value }
    // S10: watch toggle
    case 'watchToggle':
      return { ...state, watchOn: !state.watchOn }
    // M1b: editor-open status message
    case 'editorMessage':
      return { ...state, editorMessage: action.message }
  }
}

export interface DashboardProps {
  /** Injectable scan for tests (defaults to the real async scan).
   * Accepts optional LoadDashboardOptions so tests can capture the scope passed. */
  readonly loader?: (options?: LoadDashboardOptions) => DashboardData
  readonly onExit?: () => void
  /** Home dir for baseline snapshots (defaults to os.homedir()); injectable for tests. */
  readonly homeDir?: string
  /** Current working directory override for tests (defaults to process.cwd()). */
  readonly cwd?: string
  /** Injectable "open in editor" (defaults to the real spawn-based opener); tests inject a fake. */
  readonly openInEditor?: (file: string, line: number | undefined, opts?: OpenInEditorOptions) => OpenInEditorResult
  /** Injectable session reader for the Fleet tab (defaults to src/session.ts readSession). */
  readonly readSessionFn?: (home?: string) => SessionFile | undefined
  /** Injectable fetch for the Fleet tab's control-plane summary call. */
  readonly fetchImpl?: FleetFetchLike
}

const BASELINE_SCAN_ID = 'dashboard'

// Animated loading view: runs its own interval so the terminal shows live motion
// (braille spinner + elapsed seconds) while the async scan is in flight. Kept at
// module scope so a Dashboard re-render never remounts it and resets the timer.
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// Force the terminal window/tab title to the product name. The npm inventory
// child (spawned through a shell) transiently sets the console title to "npm ls";
// re-asserting our OSC title at launch and on every spinner tick keeps the tab
// labeled "agentguard".
const TERMINAL_TITLE = 'agentguard'
function setTerminalTitle(title: string): void {
  if (process.stdout.isTTY) process.stdout.write(`\u001b]0;${title}\u0007`)
}

// S9: scope labels for the per-surface progress checklist shown during loading.
const PRESET_SCOPE_LABELS: Record<Preset, readonly string[]> = {
  quick: ['shell-rc', 'ai-tool-dir', 'agent-config', 'npm-global'],
  project: ['shell-rc', 'ai-tool-dir', 'agent-config', 'npm-global', 'project-files'],
  full: ['shell-rc', 'ai-tool-dir', 'agent-config', 'npm-global', 'project-files'],
}

// S2: KO intro shown in the loading state under Banner.
function Scanning({ preset = 'quick' }: { preset?: Preset }): React.ReactElement {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    setTerminalTitle(TERMINAL_TITLE)
    const id = setInterval(() => {
      setTerminalTitle(TERMINAL_TITLE)
      setTick((t) => t + 1)
    }, 90)
    return () => clearInterval(id)
  }, [])
  const frame = SPINNER_FRAMES[tick % SPINNER_FRAMES.length]
  const seconds = Math.floor((tick * 90) / 1000)
  const scopes = PRESET_SCOPE_LABELS[preset]
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      {/* S4: wrap Banner + tagline + spinner in ONE centered Panel */}
      <Panel>
        <Banner />
        <Text color="cyan">에이전트 환경의 잔류 자격증명을 검사합니다.</Text>
        <Text color="cyan">
          {frame} Scanning… (collecting residual credentials)  {seconds}s
        </Text>
        {scopes.map((s) => (
          <Text key={s} dimColor>  ▸ {s}</Text>
        ))}
        <Text dimColor>querying local configs + global npm inventory — this can take a few seconds</Text>
      </Panel>
    </Box>
  )
}

// Column offset in the tab bar where tabs begin (after "agentguard " prefix).
const TABBAR_PREFIX_COLS = 'agentguard '.length

/** Map a mouse click x-coordinate (1-indexed) to a tab array index, or -1.
 *
 *  Tab geometry with icon + │ separators:
 *    "agentguard " + " {icon}{label} " (per tab) + "│" (between tabs)
 *  Tab width = 1 (space) + 1 (icon) + label.length + 1 (space)
 *            = label.length + 3
 *
 *  The `columns` param is accepted for API consistency with the pure tabgeom
 *  tests but is not used in the geometry calculation (tab widths are label-driven).
 */
export function tabIndexFromX(x: number, _columns?: number): number {
  let col = TABBAR_PREFIX_COLS + 1 // 1-indexed; first tab starts here
  for (let i = 0; i < TABS.length; i++) {
    const w = TABS[i].label.length + 3 // ' {icon}{label} '
    if (x >= col && x < col + w) return i
    col += w + 1 // +1 for │ separator between tabs
  }
  return -1
}

// Physical row of the tab bar when the dashboard chrome is shown: the compact
// banner occupies row 1, so the tab bar renders on row 2. Mouse input is inert
// during offboard/overlay/confirm, so tabs are always at this row when clickable.
export const TAB_BAR_ROW = 2

// Resolve a mouse click (1-indexed x, y) to a tab index, or -1 when the click is
// not on the tab-bar row.
export function tabIndexFromClick(x: number, y: number, columns?: number): number {
  return y === TAB_BAR_ROW ? tabIndexFromX(x, columns) : -1
}

export function Dashboard(props: DashboardProps): React.ReactElement {
  const app = useApp()
  const { stdout } = useStdout()
  const columns = stdout?.columns ?? 80
  // S11: responsive layout config derived from terminal width.
  const layout = layoutForWidth(columns)
  const rows = stdout?.rows
  const home = props.homeDir ?? homedir()
  const cwd = props.cwd ?? process.cwd()

  const [state, dispatch] = useReducer(reducer, {
    activeTab: 'overview',
    loading: true,
    data: null,
    cursor: 0,
    detailOpen: false,
    offboardActive: false,
    baseline: { has: false, diff: null, message: null },
    now: Date.now(),
    overlayOpen: false,
    hidden: new Set<string>(),
    searchQuery: '',
    searchCapture: false,
    sortActive: false,
    preset: 'quick',
    confirmFull: false,
    watchOn: false,
    scanError: false,
    editorMessage: null,
  })
  const alive = useRef(true)
  const offboardActiveRef = useRef(false)
  const presetRef = useRef<Preset>('quick')
  const overlayOpenRef = useRef(false)
  const confirmFullRef = useRef(false)

  // Keep refs in sync for use inside effects/callbacks that capture early closures.
  useEffect(() => { offboardActiveRef.current = state.offboardActive }, [state.offboardActive])
  useEffect(() => { presetRef.current = state.preset }, [state.preset])
  useEffect(() => { overlayOpenRef.current = state.overlayOpen }, [state.overlayOpen])
  useEffect(() => { confirmFullRef.current = state.confirmFull }, [state.confirmFull])

  const projectPath = projectScanPath(cwd, home)
  const runScan = props.loader
  const exit = props.onExit ?? app.exit

  /** Trigger a scan with an explicit preset; captures preset synchronously. */
  function rescanWithPreset(p: Preset): void {
    dispatch({ type: 'loading' })
    dispatch({ type: 'setPreset', preset: p })
    const options = scopeForPreset(p, cwd, projectPath)
    setTimeout(() => {
      if (runScan) {
        let data: DashboardData
        try {
          data = runScan(options)
        } catch {
          if (alive.current) dispatch({ type: 'scanError' })
          return
        }
        if (alive.current) dispatch({ type: 'data', data })
        return
      }
      loadDashboardDataAsync(options)
        .then((data) => {
          if (alive.current) dispatch({ type: 'data', data })
        })
        .catch(() => {
          if (alive.current) dispatch({ type: 'scanError' })
        })
    }, 0)
  }

  // Initial mount scan uses Quick preset (default).
  useEffect(() => {
    rescanWithPreset('quick')
    return () => {
      alive.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // S10: watch auto-rescan — 30s interval when watchOn.
  useEffect(() => {
    if (!state.watchOn) return
    const id = setInterval(() => {
      rescanWithPreset(presetRef.current)
    }, 30_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.watchOn])

  // Load + diff the baseline when the Baseline tab is active (cheap sync file read).
  useEffect(() => {
    if (state.activeTab !== 'baseline' || !state.data || state.loading) return
    try {
      const baseline = loadBaseline(BASELINE_SCAN_ID, home)
      dispatch({
        type: 'baseline',
        has: baseline !== undefined,
        diff: baseline ? diffAgainstBaseline(baseline, state.data.residuals) : null,
      })
    } catch (error) {
      dispatch({
        type: 'baseline',
        has: false,
        diff: null,
        message: 'Baseline load failed: saved snapshot is malformed or unreadable. Press [s] to save current scan as a new baseline.',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTab, state.data])

  // S11: SGR mouse — enable only if raw mode is supported; disable on unmount.
  useEffect(() => {
    if (!(process.stdin as { isRawModeSupported?: boolean }).isRawModeSupported) return
    enableMouseSGR()
    function onData(chunk: Buffer): void {
      const str = chunk.toString()
      const ev = parseSGR(str)
      if (!ev || offboardActiveRef.current || overlayOpenRef.current || confirmFullRef.current) return
      if (ev.kind === 'wheelUp') {
        dispatch({ type: 'move', delta: -1 })
      } else if (ev.kind === 'wheelDown') {
        dispatch({ type: 'move', delta: 1 })
      } else if (ev.kind === 'click' && !ev.release) {
        const idx = tabIndexFromClick(ev.x, ev.y)
        if (idx >= 0) dispatch({ type: 'setTab', tabId: TABS[idx].id })
      }
    }
    process.stdin.on('data', onData)
    return () => {
      disableMouseSGR()
      process.stdin.off('data', onData)
    }
  }, [])

  function saveBaselineNow(): void {
    if (!state.data) return
    try {
      saveBaseline(state.data.residuals, { homeDir: home, scanId: BASELINE_SCAN_ID })
      const baseline = loadBaseline(BASELINE_SCAN_ID, home)
      dispatch({
        type: 'baseline',
        has: true,
        diff: baseline ? diffAgainstBaseline(baseline, state.data.residuals) : null,
        message: `Saved baseline: ${state.data.residuals.length} entr${state.data.residuals.length === 1 ? 'y' : 'ies'} → ~/.agentguard/baselines`,
      })
    } catch (error) {
      dispatch({ type: 'baseline', has: state.baseline.has, diff: state.baseline.diff, message: `Save failed: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  // Resolve the currently visible items for list tabs (for hide/open-editor actions).
  function currentListItems() {
    if (!state.data) return []
    if (state.activeTab === 'credentials') return state.data.credentialItems
    if (state.activeTab === 'posture') return state.data.postureItems
    return []
  }

  // Resolve the currently selected item through the SAME pipeline FindingsView
  // uses (hidden → sort → severity/query filter) so a shared cursor never
  // targets the wrong finding when sort/filter/search is active.
  function resolveSelectedItem() {
    const items = currentListItems()
    const visible = items.filter((item) => !state.hidden.has(item.id))
    const sorted = state.sortActive ? sortItemsBySeverity(visible) : [...visible]
    const filtered = filterItems(sorted, { severity: state.filter, query: state.searchQuery })
    const idx = clampIndex(state.cursor, filtered.length)
    return filtered[idx]
  }

  // M1b: 'e' opens the selected finding's location in an editor. Expands a
  // leading ~ to homeDir before spawning (view-model items carry raw '~/...'
  // paths); injectable via props.openInEditor for tests.
  function openEditorForItem(item: ReturnType<typeof resolveSelectedItem>): void {
    if (!item) return
    const target = item.location.startsWith('~') ? join(home, item.location.slice(1).replace(/^[/\\]/, '')) : item.location
    const opener = props.openInEditor ?? defaultOpenInEditor
    const result = opener(target, item.line)
    const message = result.editor
      ? `에디터로 열었음: ${result.editor} ${target}${item.line !== undefined ? `:${item.line}` : ''}`
      : (result.message ?? `열림: ${result.command}`)
    dispatch({ type: 'editorMessage', message })
  }

  // Single useInput owner — {isActive: !offboardActive} (invariant preserved).
  // All new keys flow through classifyKey; the precedence ladder is NEVER re-ordered.
  useInput(
    (char, key) => {
      const intent = classifyKey(
        {
          offboardActive: state.offboardActive,
          searchCapture: state.searchCapture,
          overlayOpen: state.overlayOpen,
          confirmFull: state.confirmFull,
          activeTab: state.activeTab,
          hasSelection: resolveSelectedItem() !== undefined,
        },
        char,
        key,
      )
      switch (intent.kind) {
        case 'quit':
          exit()
          break
        case 'rescan':
          rescanWithPreset(state.preset)
          break
        case 'help':
          dispatch({ type: 'toggleOverlay' })
          break
        case 'tabNext':
          dispatch({ type: 'tab', dir: 1 })
          break
        case 'tabPrev':
          dispatch({ type: 'tab', dir: -1 })
          break
        case 'searchOpen':
          dispatch({ type: 'searchOpen' })
          break
        case 'searchChar':
          dispatch({ type: 'searchChar', char: intent.char })
          break
        case 'searchBackspace':
          dispatch({ type: 'searchBackspace' })
          break
        case 'searchExit':
          dispatch({ type: 'searchExit' })
          break
        case 'searchCommit':
          dispatch({ type: 'searchCommit' })
          break
        case 'preset': {
          const presets: Preset[] = ['quick', 'project', 'full']
          const p = presets[intent.n - 1]
          // S9: Full from non-project cwd requires y/N confirm.
          if (p === 'full' && !projectPath) {
            dispatch({ type: 'setPreset', preset: 'full' })
            dispatch({ type: 'setConfirmFull', value: true })
          } else {
            rescanWithPreset(p)
          }
          break
        }
        case 'confirmYes':
          dispatch({ type: 'setConfirmFull', value: false })
          rescanWithPreset('full')
          break
        case 'confirmNo':
          dispatch({ type: 'setConfirmFull', value: false })
          break
        case 'sortToggle':
          dispatch({ type: 'sortToggle' })
          break
        case 'watchToggle':
          dispatch({ type: 'watchToggle' })
          break
        case 'hide': {
          const item = resolveSelectedItem()
          if (item) dispatch({ type: 'hideItem', id: item.id })
          break
        }
        case 'openEditor':
          openEditorForItem(resolveSelectedItem())
          break
        case 'move':
          dispatch({ type: 'move', delta: intent.delta })
          break
        case 'detail':
          dispatch({ type: 'toggleDetail' })
          break
        case 'filter':
          dispatch({ type: 'filter' })
          break
        case 'openOffboard':
          dispatch({ type: 'openOffboard' })
          break
        case 'baselineSave':
          saveBaselineNow()
          break
        case 'none':
          break
      }
    },
    { isActive: !state.offboardActive },
  )

  const data = state.data

  function TabBar(): React.ReactElement {
    // Build tab children as a flat array (no Box wrappers) so Ink's default
    // row-flex layout keeps all tabs on a single line.
    // Tab format: ' {icon}{label} ' = label.length+3 chars per tab, │ between.
    // NOTE: at full width (prefix 11 + tabs/│ + space + badge ≈ 101 cols) the bar
    // can exceed a narrow (≤100-col) terminal and Ink clips the trailing badge;
    // it is not width-responsive (known limitation, like the <40-col case). Real
    // terminals are typically wider. Clickable tabs render on row TAB_BAR_ROW (2).
    const tabItems: React.ReactNode[] = []
    TABS.forEach((t, i) => {
      const isActive = t.id === state.activeTab
      const icon = glyph(t.id)
      if (i > 0) {
        tabItems.push(<Text key={`sep-${i}`} color="gray">│</Text>)
      }
      tabItems.push(
        <Text
          key={t.id}
          color={isActive ? 'cyan' : 'gray'}
          inverse={isActive}
        >
          {' '}{icon}{t.label}{' '}
        </Text>
      )
    })
    return (
      <Box>
        <Text color="cyan" bold>agentguard </Text>
        {tabItems}
        {data ? <Text> </Text> : null}
        {data ? <VerdictBadge verdict={data.verdict} critical={data.aggregate.critical} /> : null}
        {state.watchOn ? <Text color="cyan"> [watch]</Text> : null}
      </Box>
    )
  }

  function Body(): React.ReactElement {
    // S9: confirm-full prompt
    if (state.confirmFull) {
      return (
        <Box flexDirection="column">
          <Text color="yellow">⚠ 프로젝트 루트가 감지되지 않았습니다.</Text>
          <Text>현재 디렉토리 ({cwd})를 전체 스캔하시겠습니까?</Text>
          <Text dimColor>[y] 예 — 전체 스캔 시작   [n / 기타 키] 취소</Text>
        </Box>
      )
    }

    // LOW-fix: surface scan failures instead of masking them as a clean 0-finding PASS.
    if (state.scanError) {
      return (
        <Box flexDirection="column">
          <Text color="red">스캔 오류 — 결과를 불러오지 못했습니다. [r] 키로 다시 시도하세요.</Text>
        </Box>
      )
    }
    if (state.loading || !data) return <Scanning preset={state.preset} />
    switch (state.activeTab) {
      case 'overview':
        return (
          <Box flexDirection="column">
            {/* S11: hide chart when terminal is too narrow */}
            {layout.chart !== 'hidden' ? <HeroChart surfaces={data.surfaces} columns={columns} /> : <Text dimColor>narrow terminal — chart hidden</Text>}
            {layout.warn ? <Text color="yellow">⚠ 터미널이 좁습니다</Text> : null}
          </Box>
        )
      case 'agents':
        return <AgentsView data={data} />
      case 'credentials':
        return (
          <FindingsView
            title="Credentials"
            items={data.credentialItems}
            cursor={state.cursor}
            filter={state.filter}
            detailOpen={state.detailOpen}
            hidden={state.hidden}
            query={state.searchQuery}
            sortActive={state.sortActive}
          />
        )
      case 'posture':
        return (
          <FindingsView
            title="Posture"
            items={data.postureItems}
            cursor={state.cursor}
            filter={state.filter}
            detailOpen={state.detailOpen}
            hidden={state.hidden}
            query={state.searchQuery}
            sortActive={state.sortActive}
          />
        )
      case 'baseline':
        return <BaselineView has={state.baseline.has} diff={state.baseline.diff} message={state.baseline.message} />
      case 'offboard':
        return <Text dimColor>Press [o] or [enter] to start the guided offboarding sweep (scope → scan → review → approve → audit report).</Text>
      case 'fleet':
        return <FleetView homeDir={home} readSessionFn={props.readSessionFn ?? readSession} fetchImpl={props.fetchImpl} />
    }
  }

  const footer = (
    <Footer
      findings={data?.aggregate.findings ?? 0}
      critical={data?.aggregate.critical ?? 0}
      scannedAt={data?.scannedAt ?? null}
      now={state.now}
      offboardActive={state.offboardActive}
      loading={state.loading}
      watchOn={state.watchOn}
      sortActive={state.sortActive}
      searchQuery={state.searchQuery}
      editorMessage={state.editorMessage}
    />
  )
  if (state.offboardActive) {
    return (
      <Box flexDirection="column" minHeight={rows ?? 0}>
        <Banner compact />
        <TabBar />
        <Box marginTop={1} flexDirection="column">
          <Offboard
            scanOptions={projectPath ? { projectPath } : {}}
            applyOptions={{ homeDir: home }}
            onExit={() => dispatch({ type: 'closeOffboard' })}
          />
        </Box>
        {footer}
      </Box>
    )
  }

  const chrome = !state.loading && !!data && !state.scanError
  return (
    <Box flexDirection="column" minHeight={rows ?? 0}>
      {chrome ? <Banner compact /> : null}
      {chrome ? <TabBar /> : null}
      <Box marginTop={chrome ? 1 : 0} flexDirection="column" flexGrow={1}>
        {state.overlayOpen ? <HelpOverlay /> : <Body />}
      </Box>
      {chrome ? footer : null}
    </Box>
  )
}

export async function renderDashboard(): Promise<void> {
  setTerminalTitle(TERMINAL_TITLE)
  const fullscreen = Boolean(process.stdout.isTTY)
  // Enter the alternate screen buffer so the dashboard takes over the terminal
  // like a full-screen window and restores the prior scrollback on exit.
  if (fullscreen) process.stdout.write('\u001b[?1049h\u001b[2J\u001b[H')
  const instance = render(<Dashboard />)
  try {
    await instance.waitUntilExit()
  } finally {
    if (fullscreen) process.stdout.write('\u001b[?1049l')
    setTerminalTitle('')
  }
}
