import { readVersion } from './version.js'

// On-demand update check. AgentGuard is offline-by-default, so this NEVER runs
// at startup — it only reaches the network when the user explicitly asks
// (`/update` in the session). The exact upgrade command is always available
// statically so users can update immediately even without a network check.

export const PACKAGE_NAME = '@pk42ac/agentguard'
export const UPDATE_COMMAND = `npm i -g ${PACKAGE_NAME}@latest`

export interface UpdateStatus {
  readonly current: string
  readonly latest?: string
  readonly updateAvailable: boolean
  readonly checked: boolean
  readonly command: string
}

// Compare dotted numeric versions (ignoring any pre-release/build suffix).
// Returns -1 if a<b, 0 if equal, 1 if a>b.
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .split(/[+-]/)[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  const length = Math.max(pa.length, pb.length)
  for (let i = 0; i < length; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

export function isNewer(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0
}

type FetchImpl = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

export interface UpdateCheckOptions {
  readonly current?: string
  readonly packageName?: string
  readonly timeoutMs?: number
  readonly fetchImpl?: FetchImpl
}

export async function fetchLatestVersion(packageName: string, options: UpdateCheckOptions = {}): Promise<string | undefined> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchImpl | undefined)
  if (!fetchImpl) return undefined
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 4000)
  try {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`
    const response = await fetchImpl(url, { signal: controller.signal })
    if (!response.ok) return undefined
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && typeof (body as { version?: unknown }).version === 'string') {
      return (body as { version: string }).version
    }
    return undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

export async function checkForUpdate(options: UpdateCheckOptions = {}): Promise<UpdateStatus> {
  const current = options.current ?? readVersion()
  const packageName = options.packageName ?? PACKAGE_NAME
  const latest = await fetchLatestVersion(packageName, options)
  return {
    current,
    latest,
    updateAvailable: latest !== undefined && isNewer(latest, current),
    checked: latest !== undefined,
    command: `npm i -g ${packageName}@latest`,
  }
}

// Human-facing one-liner for a completed check.
export function formatUpdateStatus(status: UpdateStatus, lang: 'ko' | 'en' = 'ko'): string {
  if (!status.checked) {
    return lang === 'ko'
      ? `업데이트 확인 실패(오프라인일 수 있음). 수동 업데이트: ${status.command}`
      : `Update check failed (you may be offline). Update manually: ${status.command}`
  }
  if (status.updateAvailable) {
    return lang === 'ko'
      ? `업데이트 가능: ${status.current} → ${status.latest}. 실행: ${status.command}`
      : `Update available: ${status.current} → ${status.latest}. Run: ${status.command}`
  }
  return lang === 'ko'
    ? `최신 버전입니다 (${status.current}).`
    : `You are on the latest version (${status.current}).`
}
