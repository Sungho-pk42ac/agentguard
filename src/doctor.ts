import { readFileSync, statSync } from 'node:fs'
import { scanInput } from './core.js'

interface DoctorCheck {
  readonly label: string
  readonly detail: string
  readonly passed: boolean
}

interface DoctorResult {
  readonly exitCode: number
  readonly output: string
}

export function runDoctor(): DoctorResult {
  const checks = [packageVersionCheck(), examplesDirectoryCheck(), scannerSmokeCheck()]
  const output = [
    'AgentGuard 준비 상태',
    ...checks.map((check) => `${check.passed ? 'PASS' : 'FAIL'} ${check.label} - ${check.detail}`),
  ].join('\n')

  return {
    exitCode: checks.every((check) => check.passed) ? 0 : 1,
    output,
  }
}

function packageVersionCheck(): DoctorCheck {
  const version = readPackageVersion()
  return version === undefined
    ? { label: 'package version', detail: 'package.json 버전을 읽을 수 없음', passed: false }
    : { label: 'package version', detail: `${version} 읽기 가능`, passed: true }
}

function examplesDirectoryCheck(): DoctorCheck {
  try {
    const examplesUrl = new URL('../examples', import.meta.url)
    const exists = statSync(examplesUrl, { throwIfNoEntry: false })?.isDirectory() === true

    return exists
      ? { label: 'examples directory', detail: '예제 디렉터리 확인', passed: true }
      : { label: 'examples directory', detail: '예제 디렉터리 없음', passed: false }
  } catch (error: unknown) {
    return { label: 'examples directory', detail: `예제 디렉터리 확인 오류: ${errorMessage(error)}`, passed: false }
  }
}

function scannerSmokeCheck(): DoctorCheck {
  try {
    const safeResult = scanInput('text', 'agent completed a readonly review without sensitive output')
    const riskyResult = scanInput('text', 'agent attempted rm -rf /tmp/agentguard-doctor-smoke')
    const passed = safeResult.findingCount === 0 && riskyResult.findings.some((finding) => finding.id === 'denied-command')

    return passed
      ? { label: 'scanner smoke', detail: '안전/위험 샘플 감지 확인', passed: true }
      : { label: 'scanner smoke', detail: '안전/위험 샘플 감지 실패', passed: false }
  } catch (error: unknown) {
    return { label: 'scanner smoke', detail: `스캐너 실행 오류: ${errorMessage(error)}`, passed: false }
  }
}

function readPackageVersion(): string | undefined {
  let packageJson: unknown
  try {
    packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  } catch {
    return undefined
  }

  if (isRecord(packageJson) && typeof packageJson.version === 'string' && packageJson.version.length > 0) {
    return packageJson.version
  }
  return undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류'
}

function isRecord(value: unknown): value is { readonly version?: unknown } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
