import { render, Box, Text, useApp, useInput, useStdout } from 'ink'
import { homedir } from 'node:os'
import { useEffect, useReducer } from 'react'
import type { Severity } from '../rules.js'
import { AgentsView } from './agents-view.js'
import { buildDashboardData, type DashboardData, loadDashboardData } from './dashboard-data.js'
import { FindingsView } from './findings-view.js'
import { Footer } from './footer.js'
import { HeroChart, VerdictBadge } from './hero-chart.js'
import { Offboard } from './offboard.js'
import { nextSeverityFilter } from './view-model.js'

export type TabId = 'overview' | 'agents' | 'credentials' | 'posture' | 'offboard'

const TABS: readonly { readonly id: TabId; readonly label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'agents', label: 'Agents' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'posture', label: 'Posture' },
  { id: 'offboard', label: 'Offboard' },
]

interface State {
  readonly activeTab: TabId
  readonly loading: boolean
  readonly data: DashboardData | null
  readonly filter?: Severity
  readonly cursor: number
  readonly detailOpen: boolean
  readonly offboardActive: boolean
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
  }
}

export interface DashboardProps {
  // Injectable scan for tests (defaults to the real, offline scan).
  readonly loader?: () => DashboardData
  readonly onExit?: () => void
}

const EMPTY_DATA = (): DashboardData => buildDashboardData([], Date.now())

export function Dashboard({ loader, onExit }: DashboardProps): React.ReactElement {
  const app = useApp()
  const { stdout } = useStdout()
  const columns = stdout?.columns ?? 80
  const [state, dispatch] = useReducer(reducer, {
    activeTab: 'overview',
    loading: true,
    data: null,
    cursor: 0,
    detailOpen: false,
    offboardActive: false,
    now: Date.now(),
  })

  const runScan = loader ?? (() => loadDashboardData({ projectPath: process.cwd() }))
  const exit = onExit ?? app.exit

  function rescan(): void {
    dispatch({ type: 'loading' })
    // Async boundary BEFORE the synchronous scan (collectResiduals ->
    // spawnSync 'npm ls -g') so the loading frame paints and Ink is not frozen.
    setTimeout(() => {
      let data: DashboardData
      try {
        data = runScan()
      } catch {
        data = EMPTY_DATA()
      }
      dispatch({ type: 'data', data })
    }, 0)
  }

  useEffect(() => {
    rescan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isFindingsTab = state.activeTab === 'credentials' || state.activeTab === 'posture'

  useInput(
    (char, key) => {
      if (key.escape || char === 'q') return exit()
      if (char === 'r') return rescan()
      if (key.tab && key.shift) return dispatch({ type: 'tab', dir: -1 })
      if (key.tab || key.rightArrow) return dispatch({ type: 'tab', dir: 1 })
      if (key.leftArrow) return dispatch({ type: 'tab', dir: -1 })
      if (char === 'o' || (key.return && state.activeTab === 'offboard')) return dispatch({ type: 'openOffboard' })
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
    if (state.loading || !data) return <Text color="cyan">Scanning… (collecting residual credentials)</Text>
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
            scanOptions={{ projectPath: process.cwd() }}
            applyOptions={{ homeDir: homedir() }}
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
