import { render, Box, Text, useApp, useInput, useStdout } from 'ink'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { useEffect, useReducer, useRef, useState } from 'react'
import { type BaselineDiff, diffAgainstBaseline, loadBaseline, saveBaseline } from '../baseline.js'
import type { Severity } from '../rules.js'
import { AgentsView } from './agents-view.js'
import { BaselineView } from './baseline-view.js'
import { buildDashboardData, type DashboardData, loadDashboardDataAsync } from './dashboard-data.js'
import { FindingsView } from './findings-view.js'
import { Footer } from './footer.js'
import { HeroChart, VerdictBadge } from './hero-chart.js'
import { Offboard } from './offboard.js'
import { nextSeverityFilter } from './view-model.js'

// Project markers that make the current directory a real project root. The
// always-on landing scan only walks cwd files when one is present AND cwd is
// not the home directory, so launching `agentguard` from a broad location
// (home, AppData, a drive root) can never trigger an enormous filesystem walk.
const PROJECT_MARKERS = ['.git', 'package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'requirements.txt', 'Gemfile', 'tsconfig.json']

function projectScanPath(cwd: string, home: string): string | undefined {
  if (cwd === home) return undefined
  return PROJECT_MARKERS.some((marker) => existsSync(join(cwd, marker))) ? cwd : undefined
}

export type TabId = 'overview' | 'agents' | 'credentials' | 'posture' | 'baseline' | 'offboard'

const TABS: readonly { readonly id: TabId; readonly label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'agents', label: 'Agents' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'posture', label: 'Posture' },
  { id: 'baseline', label: 'Baseline' },
  { id: 'offboard', label: 'Offboard' },
]

interface BaselineState {
  readonly has: boolean
  readonly diff: BaselineDiff | null
  readonly message: string | null
}

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
}

type Action =
  | { type: 'loading' }
  | { type: 'data'; data: DashboardData }
  | { type: 'tab'; dir: 1 | -1 }
  | { type: 'move'; delta: number }
  | { type: 'filter' }
  | { type: 'toggleDetail' }
  | { type: 'openOffboard' }
  | { type: 'closeOffboard' }
  | { type: 'baseline'; has: boolean; diff: BaselineDiff | null; message?: string | null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true }
    case 'data':
      return { ...state, loading: false, data: action.data, now: Date.now() }
    case 'tab': {
      const index = TABS.findIndex((t) => t.id === state.activeTab)
      const next = TABS[(index + action.dir + TABS.length) % TABS.length]
      return { ...state, activeTab: next.id, cursor: 0, filter: undefined, detailOpen: false }
    }
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
  }
}

export interface DashboardProps {
  // Injectable scan for tests (defaults to the real, offline scan).
  readonly loader?: () => DashboardData
  readonly onExit?: () => void
  // Home dir for baseline snapshots (defaults to os.homedir()); injectable for tests.
  readonly homeDir?: string
}

const EMPTY_DATA = (): DashboardData => buildDashboardData([], Date.now())
const BASELINE_SCAN_ID = 'dashboard'

// Animated loading view: runs its own interval so the terminal shows live motion
// (braille spinner + elapsed seconds) while the async scan is in flight. Kept at
// module scope so a Dashboard re-render never remounts it and resets the timer.
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function Scanning(): React.ReactElement {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 90)
    return () => clearInterval(id)
  }, [])
  const frame = SPINNER_FRAMES[tick % SPINNER_FRAMES.length]
  const seconds = Math.floor((tick * 90) / 1000)
  return (
    <Box flexDirection="column">
      <Text color="cyan">
        {frame} Scanning… (collecting residual credentials)  {seconds}s
      </Text>
      <Text dimColor>querying local configs + global npm inventory — this can take a few seconds</Text>
    </Box>
  )
}

export function Dashboard({ loader, onExit, homeDir }: DashboardProps): React.ReactElement {
  const app = useApp()
  const { stdout } = useStdout()
  const columns = stdout?.columns ?? 80
  const home = homeDir ?? homedir()
  const [state, dispatch] = useReducer(reducer, {
    activeTab: 'overview',
    loading: true,
    data: null,
    cursor: 0,
    detailOpen: false,
    offboardActive: false,
    baseline: { has: false, diff: null, message: null },
    now: Date.now(),
  })
  const alive = useRef(true)

  const projectPath = projectScanPath(process.cwd(), home)
  const runScan = loader
  const exit = onExit ?? app.exit

  function rescan(): void {
    dispatch({ type: 'loading' })
    // Async boundary BEFORE the scan so the loading frame paints. The default
    // path awaits a non-blocking scan (npm inventory via spawn) so the spinner
    // keeps animating; injected loaders (tests) stay synchronous.
    setTimeout(() => {
      if (runScan) {
        let data: DashboardData
        try {
          data = runScan()
        } catch {
          data = EMPTY_DATA()
        }
        if (alive.current) dispatch({ type: 'data', data })
        return
      }
      loadDashboardDataAsync(projectPath ? { projectPath } : {})
        .then((data) => {
          if (alive.current) dispatch({ type: 'data', data })
        })
        .catch(() => {
          if (alive.current) dispatch({ type: 'data', data: EMPTY_DATA() })
        })
    }, 0)
  }

  useEffect(() => {
    rescan()
    return () => {
      alive.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load + diff the baseline when the Baseline tab is active (cheap sync file read).
  useEffect(() => {
    if (state.activeTab !== 'baseline' || !state.data || state.loading) return
    const baseline = loadBaseline(BASELINE_SCAN_ID, home)
    dispatch({
      type: 'baseline',
      has: baseline !== undefined,
      diff: baseline ? diffAgainstBaseline(baseline, state.data.residuals) : null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTab, state.data])

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

  const isFindingsTab = state.activeTab === 'credentials' || state.activeTab === 'posture'

  useInput(
    (char, key) => {
      if (key.escape || char === 'q') return exit()
      if (char === 'r') return rescan()
      if (key.tab && key.shift) return dispatch({ type: 'tab', dir: -1 })
      if (key.tab || key.rightArrow) return dispatch({ type: 'tab', dir: 1 })
      if (key.leftArrow) return dispatch({ type: 'tab', dir: -1 })
      if (char === 'o' || (key.return && state.activeTab === 'offboard')) return dispatch({ type: 'openOffboard' })
      if (state.activeTab === 'baseline' && char === 's') return saveBaselineNow()
      if (isFindingsTab) {
        if (key.downArrow || char === 'j') return dispatch({ type: 'move', delta: 1 })
        if (key.upArrow || char === 'k') return dispatch({ type: 'move', delta: -1 })
        if (char === 'f') return dispatch({ type: 'filter' })
        if (key.return) return dispatch({ type: 'toggleDetail' })
      }
    },
    { isActive: !state.offboardActive },
  )

  const data = state.data

  function TabBar(): React.ReactElement {
    return (
      <Box>
        <Text color="cyan" bold>agentguard </Text>
        {TABS.map((t) => (
          <Text key={t.id} color={t.id === state.activeTab ? 'cyan' : 'gray'} inverse={t.id === state.activeTab}>
            {' '}
            {t.label}{' '}
          </Text>
        ))}
        {data ? <Text>{'  '}</Text> : null}
        {data ? <VerdictBadge verdict={data.verdict} critical={data.aggregate.critical} /> : null}
      </Box>
    )
  }

  function Body(): React.ReactElement {
    if (state.loading || !data) return <Scanning />
    switch (state.activeTab) {
      case 'overview':
        return (
          <Box flexDirection="column">
            <HeroChart surfaces={data.surfaces} columns={columns} />
          </Box>
        )
      case 'agents':
        return <AgentsView data={data} />
      case 'credentials':
        return <FindingsView title="Credentials" items={data.credentialItems} cursor={state.cursor} filter={state.filter} detailOpen={state.detailOpen} />
      case 'posture':
        return <FindingsView title="Posture" items={data.postureItems} cursor={state.cursor} filter={state.filter} detailOpen={state.detailOpen} />
      case 'baseline':
        return <BaselineView has={state.baseline.has} diff={state.baseline.diff} message={state.baseline.message} />
      case 'offboard':
        return <Text dimColor>Press [o] or [enter] to start the guided offboarding sweep (scope → scan → review → approve → audit report).</Text>
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
    />
  )

  if (state.offboardActive) {
    return (
      <Box flexDirection="column">
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

  return (
    <Box flexDirection="column">
      <TabBar />
      <Box marginTop={1} flexDirection="column">
        <Body />
      </Box>
      {footer}
    </Box>
  )
}

export async function renderDashboard(): Promise<void> {
  const instance = render(<Dashboard />)
  await instance.waitUntilExit()
}
