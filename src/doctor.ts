import { readFileSync, statSync } from 'node:fs'
import YAML from 'yaml'
import { scanInput } from './core.js'
import { UPDATE_COMMAND } from './update-check.js'

export type DoctorLanguage = 'ko' | 'en'

interface DoctorCheck {
  readonly id: 'package_version' | 'examples_directory' | 'scanner_smoke' | 'github_action_contract'
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
  readonly generatedAt: string
  readonly checks: readonly DoctorCheck[]
  readonly summary: {
    readonly total: number
    readonly passed: number
    readonly failed: number
  }
  readonly packageVersion: string
  readonly updateCommand: string
}

export function runDoctor(lang: DoctorLanguage = 'ko', options: DoctorOptions = {}): DoctorResult {
  const checks = [packageVersionCheck(lang), examplesDirectoryCheck(lang), scannerSmokeCheck(lang), githubActionContractCheck(lang)]
  const exitCode = checks.every((check) => check.passed) ? 0 : 1
  if (options.json === true) {
    const passed = checks.filter((check) => check.passed).length
    const jsonOutput: DoctorJsonOutput = {
      schemaVersion: 1,
      tool: 'agentguard',
      status: exitCode === 0 ? 'PASS' : 'FAIL',
      generatedAt: new Date().toISOString(),
      checks,
      summary: {
        total: checks.length,
        passed,
        failed: checks.length - passed,
      },
      updateCommand: UPDATE_COMMAND,
      packageVersion: readPackageVersion() ?? 'unknown',
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

function githubActionContractCheck(lang: DoctorLanguage): DoctorCheck {
  const requiredInputs = ['base-sha', 'head-sha', 'fail-on', 'package-version', 'report-path', 'json-path', 'sarif-path'] as const
  try {
    const actionText = readFileSync(new URL('../action.yml', import.meta.url), 'utf8')
    // The TypeScript build emits a flat dist/ layout, so ../action.yml points
    // at the package/repo root both in tsx tests and installed npm tarballs.
    const action = YAML.parse(actionText) as unknown
    const inputs = isRecord(action) && isRecord(action['inputs']) ? action['inputs'] : {}
    const runs = isRecord(action) && isRecord(action['runs']) ? action['runs'] : {}
    const steps = Array.isArray(runs['steps']) ? runs['steps'] : []
    const missing = requiredInputs.filter((field) => !isRecord(inputs[field]))
    const hasCompositeRun = runs['using'] === 'composite'
    const scanStep = steps.find((step) => isRecord(step) && step['id'] === 'scan' && typeof step['run'] === 'string' && step['run'].includes('scan-diff'))
    const scanRun = isRecord(scanStep) && typeof scanStep['run'] === 'string' ? scanStep['run'] : ''
    const hasScanStep = scanRun.length > 0
    const hasPackageVersionGuard = scanRun.includes('validate_package_version "$package_version"')
    const hasArtifactPathGuard = ['report_path', 'json_path', 'sarif_path'].every((name) =>
      scanRun.includes(`validate_artifact_path "$${name}"`),
    )

    if (missing.length === 0 && hasCompositeRun && hasScanStep && hasPackageVersionGuard && hasArtifactPathGuard) {
      return {
        id: 'github_action_contract',
        label: 'GitHub Action contract',
        detail:
          lang === 'ko'
            ? 'action.yml 재사용 PR gate 확인: base-sha, head-sha, fail-on, package-version, report-path, json-path, sarif-path, artifact path guard, scan step'
            : 'action.yml reusable PR gate ok: base-sha, head-sha, fail-on, package-version, report-path, json-path, sarif-path, artifact path guard, scan step',
        passed: true,
      }
    }

    const reasons = [
      ...missing.map((field) => `missing ${field}`),
      ...(hasCompositeRun ? [] : ['missing composite runs contract']),
      ...(hasScanStep ? [] : ['missing scan step']),
      ...(hasPackageVersionGuard ? [] : ['missing package-version guard']),
      ...(hasArtifactPathGuard ? [] : ['missing artifact path guard']),
    ]
    return {
      id: 'github_action_contract',
      label: 'GitHub Action contract',
      detail: lang === 'ko' ? `action.yml 재사용 PR gate 불완전: ${reasons.join(', ')}` : `action.yml reusable PR gate incomplete: ${reasons.join(', ')}`,
      passed: false,
    }
  } catch (error: unknown) {
    return {
      id: 'github_action_contract',
      label: 'GitHub Action contract',
      detail: lang === 'ko' ? `action.yml 확인 오류: ${errorMessage(error, lang)}` : `action.yml check error: ${errorMessage(error, lang)}`,
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

  if (isRecord(packageJson) && typeof packageJson['version'] === 'string' && packageJson['version'].length > 0) {
    return packageJson['version']
  }
  return undefined
}

function errorMessage(error: unknown, lang: DoctorLanguage): string {
  if (error instanceof Error) return error.message
  return lang === 'ko' ? '알 수 없는 오류' : 'unknown error'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
