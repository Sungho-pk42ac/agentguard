import { readFileSync, statSync } from 'node:fs'
import { scanInput } from './core.js'
import { UPDATE_COMMAND } from './update-check.js'

export type DoctorLanguage = 'ko' | 'en'

interface DoctorCheck {
  readonly id: 'package_version' | 'examples_directory' | 'scanner_smoke'
  readonly label: string
  readonly detail: string
  readonly passed: boolean
}

interface DoctorResult {
  readonly exitCode: number
  readonly output: string
}

interface DoctorOptions {
  readonly json?: boolean
}

interface DoctorJsonOutput {
  readonly schemaVersion: 1
  readonly tool: 'agentguard'
  readonly status: 'PASS' | 'FAIL'
  readonly checks: readonly DoctorCheck[]
  readonly updateCommand: string
}

export function runDoctor(lang: DoctorLanguage = 'ko', options: DoctorOptions = {}): DoctorResult {
  const checks = [packageVersionCheck(lang), examplesDirectoryCheck(lang), scannerSmokeCheck(lang)]
  const exitCode = checks.every((check) => check.passed) ? 0 : 1
  if (options.json === true) {
    const jsonOutput: DoctorJsonOutput = {
      schemaVersion: 1,
      tool: 'agentguard',
      status: exitCode === 0 ? 'PASS' : 'FAIL',
      checks,
      updateCommand: UPDATE_COMMAND,
    }
    return {
      exitCode,
      output: JSON.stringify(jsonOutput, null, 2),
    }
  }

  const lines = [doctorTitle(lang), ...checks.map((check) => `${check.passed ? 'PASS' : 'FAIL'} ${check.label} - ${check.detail}`), updateHint(lang)]
  const output = lines.join('\n')

  return {
    exitCode,
    output,
  }
}

function doctorTitle(lang: DoctorLanguage): string {
  return lang === 'ko' ? 'AgentGuard 준비 상태' : 'AgentGuard readiness'
}

function updateHint(lang: DoctorLanguage): string {
  return lang === 'ko'
    ? `INFO 업데이트 - 최신 버전 설치: ${UPDATE_COMMAND}`
    : `INFO update - install the latest: ${UPDATE_COMMAND}`
}

function packageVersionCheck(lang: DoctorLanguage): DoctorCheck {
  const version = readPackageVersion()
  if (version === undefined) {
    return {
      id: 'package_version',
      label: 'package version',
      detail: lang === 'ko' ? 'package.json 버전을 읽을 수 없음' : 'could not read package.json version',
      passed: false,
    }
  }
  return {
    id: 'package_version',
    label: 'package version',
    detail: lang === 'ko' ? `${version} 읽기 가능` : `${version} readable`,
    passed: true,
  }
}

function examplesDirectoryCheck(lang: DoctorLanguage): DoctorCheck {
  try {
    const examplesUrl = new URL('../examples', import.meta.url)
    const exists = statSync(examplesUrl, { throwIfNoEntry: false })?.isDirectory() === true

    if (exists) {
      return {
        id: 'examples_directory',
        label: 'examples directory',
        detail: lang === 'ko' ? '예제 디렉터리 확인' : 'examples directory found',
        passed: true,
      }
    }
    return {
      id: 'examples_directory',
      label: 'examples directory',
      detail: lang === 'ko' ? '예제 디렉터리 없음' : 'examples directory missing',
      passed: false,
    }
  } catch (error: unknown) {
    return {
      id: 'examples_directory',
      label: 'examples directory',
      detail: lang === 'ko' ? `예제 디렉터리 확인 오류: ${errorMessage(error, lang)}` : `examples directory check error: ${errorMessage(error, lang)}`,
      passed: false,
    }
  }
}

function scannerSmokeCheck(lang: DoctorLanguage): DoctorCheck {
  try {
    const safeResult = scanInput('text', 'agent completed a readonly review without sensitive output')
    const riskyResult = scanInput('text', 'agent attempted rm -rf /tmp/agentguard-doctor-smoke')
    const passed = safeResult.findingCount === 0 && riskyResult.findingCount > 0

    if (passed) {
      return {
        id: 'scanner_smoke',
        label: 'scanner smoke',
        detail: lang === 'ko' ? '안전/위험 샘플 감지 확인' : 'safe/risky sample detection ok',
        passed: true,
      }
    }
    return {
      id: 'scanner_smoke',
      label: 'scanner smoke',
      detail: lang === 'ko' ? '안전/위험 샘플 감지 실패' : 'safe/risky sample detection failed',
      passed: false,
    }
  } catch (error: unknown) {
    return {
      id: 'scanner_smoke',
      label: 'scanner smoke',
      detail: lang === 'ko' ? `스캐너 실행 오류: ${errorMessage(error, lang)}` : `scanner execution error: ${errorMessage(error, lang)}`,
      passed: false,
    }
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

function errorMessage(error: unknown, lang: DoctorLanguage): string {
  if (error instanceof Error) return error.message
  return lang === 'ko' ? '알 수 없는 오류' : 'unknown error'
}

function isRecord(value: unknown): value is { readonly version?: unknown } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
