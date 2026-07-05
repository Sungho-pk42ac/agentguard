import { Box, Text } from 'ink'
import { useEffect, useRef, useState } from 'react'
import type { Severity } from '../rules.js'
import { readSession, type SessionFile } from '../session.js'
import { Panel } from './panel.js'
import { SEVERITY_COLOR } from './theme.js'

// Fleet tab: org-wide, control-plane-backed summary (the "verify" step of the
// scan → fix → verify workflow). Dumb-ish component that owns its own fetch
// lifecycle (mirrors the Dashboard's own setTimeout(0) + alive-guard pattern)
// but takes no input — the dashboard's single useInput owner is untouched.

export interface FleetAssetSummary {
  readonly assetId: string
  readonly label: string
  readonly count: number
  readonly riskScore: number
}

/** Shape returned by GET {endpoint}/v1/dashboard/summary (see control-plane/src/aggregate.ts FleetSummary). */
export interface FleetSummary {
  readonly totalFindings: number
  readonly riskScore: number
  readonly bySeverity: Record<Severity, number>
  readonly byAsset: readonly FleetAssetSummary[]
}

export interface FleetFetchResponse {
  readonly status: number
  json(): Promise<unknown>
}
export type FleetFetchLike = (url: string, init: { readonly headers: Record<string, string> }) => Promise<FleetFetchResponse>

export interface FleetViewProps {
  /** Home dir passed through to readSessionFn (defaults to os.homedir() inside readSession). */
  readonly homeDir?: string
  /** Injectable session reader (defaults to src/session.ts readSession). */
  readonly readSessionFn?: (home?: string) => SessionFile | undefined
  /** Injectable fetch for the control-plane summary call (defaults to globalThis.fetch). */
  readonly fetchImpl?: FleetFetchLike
}

type FleetState =
  | { readonly kind: 'no-session' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly summary: FleetSummary }
  | { readonly kind: 'error'; readonly reason: string }

const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low']

export function FleetView({ homeDir, readSessionFn, fetchImpl }: FleetViewProps): React.ReactElement {
  const reader = readSessionFn ?? readSession
  const session = reader(homeDir)
  const [state, setState] = useState<FleetState>(session ? { kind: 'loading' } : { kind: 'no-session' })
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!session) return
    setState({ kind: 'loading' })
    const timer = setTimeout(() => {
      const fetcher = fetchImpl ?? (globalThis.fetch as unknown as FleetFetchLike)
      if (typeof fetcher !== 'function') {
        if (alive.current) setState({ kind: 'error', reason: 'no fetch implementation available (Node >=20 required)' })
        return
      }
      const url = `${session.endpoint.replace(/\/+$/, '')}/v1/dashboard/summary`
      fetcher(url, { headers: { authorization: `Bearer ${session.sessionToken}` } })
        .then(async (res) => {
          if (res.status !== 200) {
            if (alive.current) setState({ kind: 'error', reason: `HTTP ${res.status}` })
            return
          }
          const summary = (await res.json()) as FleetSummary
          if (alive.current) setState({ kind: 'loaded', summary })
        })
        .catch((error: unknown) => {
          if (alive.current) setState({ kind: 'error', reason: error instanceof Error ? error.message : String(error) })
        })
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.endpoint, session?.sessionToken, fetchImpl])

  if (state.kind === 'no-session') {
    return (
      <Box flexDirection="column">
        <Text dimColor>로그인 필요 — agentguard login --endpoint &lt;url&gt; --email &lt;e&gt;</Text>
        <Text dimColor>로컬 전용 모드로 계속 사용 가능</Text>
      </Box>
    )
  }

  if (state.kind === 'loading') {
    return <Text dimColor>플릿 요약을 불러오는 중…</Text>
  }

  if (state.kind === 'error') {
    return <Text color="red">컨트롤 플레인 연결 실패: {state.reason}</Text>
  }

  const { summary } = state
  const max = Math.max(1, ...SEVERITY_ORDER.map((sev) => summary.bySeverity[sev] ?? 0))

  return (
    <Box flexDirection="column">
      <Text color="cyan">Fleet — {summary.totalFindings} findings · risk {summary.riskScore}</Text>
      <Panel title="심각도별 (bySeverity)">
        {SEVERITY_ORDER.map((sev) => {
          const n = summary.bySeverity[sev] ?? 0
          const width = Math.max(0, Math.round((n / max) * 20))
          return (
            <Text key={sev} color={SEVERITY_COLOR[sev]}>
              {sev.padEnd(8)} {'█'.repeat(width)} {n}
            </Text>
          )
        })}
      </Panel>
      <Panel title="자산별 (byAsset)">
        {summary.byAsset.length === 0 ? (
          <Text dimColor>등록된 자산이 없습니다.</Text>
        ) : (
          summary.byAsset.map((asset) => (
            <Text key={asset.assetId}>
              {asset.label.padEnd(20)} {String(asset.count).padStart(4)} findings  risk {asset.riskScore}
            </Text>
          ))
        )}
      </Panel>
    </Box>
  )
}
