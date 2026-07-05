#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { scanCliCommand } from './core.js'
import { runDoctor, type DoctorLanguage } from './doctor.js'
import { loadPolicy, PolicyLoadError } from './policy.js'
import { scanAgentPosture, postureReportToText } from './posture.js'
import { toMarkdown, toSarif, type MarkdownLanguage } from './report.js'
import { MAX_FILE_BYTES } from './scanner.js'
import { resolveScanInput, ScanInputError } from './scan-input.js'
import type { Finding } from './rules.js'
import { severityScore } from './rules.js'
import { resolveIdentity, EnrollmentError } from './enrollment.js'
import { buildReportPayload, pushReport, RedactionError, ReportPushError } from './report-push.js'
import { shouldLaunchRepl } from './tui/entry.js'
import { resolveCommand } from './cli/table.js'
import { openInEditor } from './open-in-editor.js'
import { login, logout, enroll, AuthError } from './auth-client.js'
import { readSession, writeSession, clearSession } from './session.js'
import { enrollmentPath } from './enrollment.js'
import { createInterface } from 'node:readline'

interface CliArgs {
  readonly cmd: string
  readonly cleanArgs: readonly string[]
  readonly json: boolean
  readonly sarif: boolean
  readonly out?: string
  readonly policyPath?: string
  readonly markdownLanguage: MarkdownLanguage
  readonly push: boolean
  readonly endpoint?: string
  readonly org?: string
  readonly asset?: string
  readonly open: boolean
  readonly email?: string
  readonly code?: string
  readonly label?: string
}

function printVersion(): never {
  console.log(readPackageVersion())
  process.exit(0)
}

function usage(exitCode = 2): never {
  const output = `Usage:
  agentguard scan-files [경로]
  agentguard scan-diff < diff.patch
  agentguard scan-log < transcript.log
  agentguard scan-mcp < config.toml
  agentguard scan-mcp config.toml
  agentguard report < input.txt
  agentguard report --push --endpoint <url> [--org <id>] [--asset <id>]
  agentguard posture [경로] [--json]
  agentguard doctor [--lang ko|en]
  agentguard repl
  agentguard scan files [경로]
  agentguard scan diff < diff.patch
  agentguard scan log < transcript.log
  agentguard scan mcp < config.toml
  agentguard open <path[:line]>
  agentguard login --endpoint <url> --email <e>
  agentguard logout
  agentguard enroll --endpoint <url> --org <id> --code <c> [--label <l>]

AI 에이전트 보안 감사 — diff, 로그, MCP 설정, 파일을 검사해 위험 행동을 탐지합니다.

사용 예시:
  # Unix / macOS
  cat diff.patch | agentguard scan-diff
  agentguard scan-mcp config.toml

  # PowerShell (Windows)
  Get-Content config.toml | agentguard scan-mcp
  Get-Content diff.patch | agentguard scan-diff

  # JSON · SARIF 출력
  agentguard scan-diff --json < diff.patch
  agentguard scan-mcp --sarif config.toml
  agentguard scan-diff --push --endpoint https://cp.example < diff.patch

Options:
  --help, -h                        도움말 출력
  --version, -v                     버전 출력
  --json                            JSON 형식으로 결과 출력
  --sarif                           GitHub 코드 스캐닝용 SARIF 2.1.0 출력
  --lang ko|en, --lang=ko|en        마크다운 리포트 언어 (기본값: ko)
  --policy <path>, --policy=<path>  agent-policy.yaml/json 로드
  --out <file>, --out=<file>        결과를 파일로 저장
  --push                            스캔 결과(redacted만)를 control plane로 전송
  --endpoint <url>                  control plane 주소 (--push와 함께 사용)
  --org <id>, --asset <id>          조직·자산 식별자 (미지정 시 enrollment에서 해석)
  --open                            스캔 후 가장 심각한 finding을 에디터에서 열기
  --email <email>                   login 계정 이메일
  --code <code>                     enroll 등록 코드
  --label <label>                   enroll 자산 라벨`
  if (exitCode === 0) console.log(output)
  else console.error(output)
  process.exit(exitCode)
}

function doctorUsage(exitCode = 2): never {
  const output = `Usage:
  agentguard doctor [--lang ko|en]

Checks:
  package version readability, examples directory presence, scanner smoke test`
  if (exitCode === 0) console.log(output)
  else console.error(output)
  process.exit(exitCode)
}

function postureUsage(exitCode = 2): never {
  const output = `Usage:
  agentguard posture [path] [--json]

Checks:
  local Claude/Codex/Gemini/MCP config posture, broad filesystem roots, writable paths, credential env passthrough, local agent-policy presence`
  if (exitCode === 0) console.log(output)
  else console.error(output)
  process.exit(exitCode)
}

function parseArgs(args: readonly string[]): CliArgs | undefined {
  let cmd: string | undefined
  const cleanArgs: string[] = []
  let json = false
  let sarif = false
  let out: string | undefined
  let policyPath: string | undefined
  let markdownLanguage: MarkdownLanguage = 'ko'
  let push = false
  let endpoint: string | undefined
  let org: string | undefined
  let asset: string | undefined
  let open = false
  let email: string | undefined
  let code: string | undefined
  let label: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h' || arg === '--version' || arg === '-v') {
      if (cmd || cleanArgs.length > 0) return undefined
      cmd = arg
      continue
    }
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg === '--sarif') {
      sarif = true
      continue
    }
    if (arg === '--lang') {
      const value = args[index + 1]
      if (!isMarkdownLanguage(value)) return undefined
      markdownLanguage = value
      index += 1
      continue
    }
    if (arg.startsWith('--lang=')) {
      const value = arg.slice('--lang='.length)
      if (!isMarkdownLanguage(value)) return undefined
      markdownLanguage = value
      continue
    }
    if (arg === '--out') {
      const value = args[index + 1]
      if (!isOptionValue(value)) return undefined
      if (out !== undefined) return undefined
      out = value
      index += 1
      continue
    }
    if (arg.startsWith('--out=')) {
      const value = arg.slice('--out='.length)
      if (value.length === 0) return undefined
      if (out !== undefined) return undefined
      out = value
      continue
    }
    if (arg === '--policy') {
      const value = args[index + 1]
      if (!isOptionValue(value)) return undefined
      if (policyPath !== undefined) return undefined
      policyPath = value
      index += 1
      continue
    }
    if (arg.startsWith('--policy=')) {
      const value = arg.slice('--policy='.length)
      if (value.length === 0) return undefined
      if (policyPath !== undefined) return undefined
      policyPath = value
      continue
    }
    if (arg === '--push') {
      push = true
      continue
    }
    if (arg === '--endpoint' || arg === '--org' || arg === '--asset') {
      const value = args[index + 1]
      if (!isOptionValue(value)) return undefined
      if (arg === '--endpoint') { if (endpoint !== undefined) return undefined; endpoint = value }
      else if (arg === '--org') { if (org !== undefined) return undefined; org = value }
      else { if (asset !== undefined) return undefined; asset = value }
      index += 1
      continue
    }
    if (arg.startsWith('--endpoint=') || arg.startsWith('--org=') || arg.startsWith('--asset=')) {
      const eq = arg.indexOf('=')
      const key = arg.slice(2, eq)
      const value = arg.slice(eq + 1)
      if (value.length === 0) return undefined
      if (key === 'endpoint') { if (endpoint !== undefined) return undefined; endpoint = value }
      else if (key === 'org') { if (org !== undefined) return undefined; org = value }
      else { if (asset !== undefined) return undefined; asset = value }
      continue
    }
    if (arg === '--open') {
      open = true
      continue
    }
    if (arg === '--email' || arg === '--code' || arg === '--label') {
      const value = args[index + 1]
      if (!isOptionValue(value)) return undefined
      if (arg === '--email') { if (email !== undefined) return undefined; email = value }
      else if (arg === '--code') { if (code !== undefined) return undefined; code = value }
      else { if (label !== undefined) return undefined; label = value }
      index += 1
      continue
    }
    if (arg.startsWith('--email=') || arg.startsWith('--code=') || arg.startsWith('--label=')) {
      const eq2 = arg.indexOf('=')
      const key2 = arg.slice(2, eq2)
      const value2 = arg.slice(eq2 + 1)
      if (value2.length === 0) return undefined
      if (key2 === 'email') { if (email !== undefined) return undefined; email = value2 }
      else if (key2 === 'code') { if (code !== undefined) return undefined; code = value2 }
      else { if (label !== undefined) return undefined; label = value2 }
      continue
    }
    if (arg.startsWith('--')) return undefined
    if (!cmd) cmd = arg
    else cleanArgs.push(arg)
  }

  if (!cmd) return undefined
  if (['--help', '-h', '--version', '-v'].includes(cmd) && cleanArgs.length > 0) return undefined
  return { cmd, cleanArgs, json, sarif, out, policyPath, markdownLanguage, push, endpoint, org, asset, open, email, code, label }
}

function isMarkdownLanguage(value: string | undefined): value is MarkdownLanguage {
  return value === 'ko' || value === 'en'
}

function isOptionValue(value: string | undefined): value is string {
  return value !== undefined && !value.startsWith('--')
}

function hasValidPositionalArgs(cmd: string, cleanArgs: readonly string[]): boolean {
  if (cmd === 'scan-files') return cleanArgs.length <= 1
  if (cmd === 'scan-diff' || cmd === 'scan-log' || cmd === 'scan-mcp' || cmd === 'report') return cleanArgs.length <= 1
  return true
}

interface DoctorArgs {
  readonly lang: DoctorLanguage
}

interface PostureArgs {
  readonly path: string
  readonly json: boolean
}

function parseDoctorArgs(args: readonly string[]): DoctorArgs | undefined {
  let lang: DoctorLanguage = 'ko'
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') doctorUsage(0)
    if (arg === '--lang') {
      const value = args[index + 1]
      if (!isMarkdownLanguage(value)) return undefined
      lang = value
      index += 1
      continue
    }
    if (arg.startsWith('--lang=')) {
      const value = arg.slice('--lang='.length)
      if (!isMarkdownLanguage(value)) return undefined
      lang = value
      continue
    }
    return undefined
  }
  return { lang }
}

function parsePostureArgs(args: readonly string[]): PostureArgs | undefined {
  let path = process.cwd()
  let json = false
  let pathSeen = false
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') postureUsage(0)
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg.startsWith('-')) return undefined
    if (pathSeen) return undefined
    path = arg
    pathSeen = true
  }
  return { path, json }
}
async function promptPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    // Non-interactive (piped) stdin: read exactly one line, no masking needed/possible.
    return new Promise((resolve, reject) => {
      const rl = createInterface({ input: process.stdin, terminal: false })
      let line: string | undefined
      rl.on('line', (input) => {
        if (line === undefined) line = input
      })
      rl.on('close', () => resolve(line ?? ''))
      rl.on('error', reject)
    })
  }
  return new Promise((resolve) => {
    process.stderr.write('Password: ')
    const stdin = process.stdin
    let password = ''
    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
    }
    const onData = (char: string) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        cleanup()
        process.stderr.write('\n')
        resolve(password)
        return
      }
      if (char === '\u0003') {
        cleanup()
        process.exit(130)
      }
      if (char === '\u007f' || char === '\b') {
        password = password.slice(0, -1)
        return
      }
      password += char
    }
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    stdin.on('data', onData)
  })
}

const rawArgs = process.argv.slice(2)
if (shouldLaunchRepl(rawArgs, Boolean(process.stdin.isTTY), Boolean(process.stdout.isTTY))) {
  // NOTE: shouldLaunchRepl (and the explicit `repl`/`--interactive` triggers)
  // now launch the dashboard, not the retired REPL. Name kept for continuity.
  const { renderDashboard } = await import('./tui/dashboard.js')
  await renderDashboard()
} else if (rawArgs[0] === 'doctor') {
  const doctorArgs = parseDoctorArgs(rawArgs.slice(1))
  if (doctorArgs === undefined) doctorUsage()
  const result = runDoctor(doctorArgs.lang)
  console.log(result.output)
  process.exit(result.exitCode)
} else if (rawArgs[0] === 'posture') {
  const postureArgs = parsePostureArgs(rawArgs.slice(1))
  if (postureArgs === undefined) postureUsage()
  try {
    const report = scanAgentPosture(postureArgs.path)
    console.log(postureArgs.json ? JSON.stringify(report, null, 2) : postureReportToText(report))
    process.exit(report.findingCount > 0 ? 1 : 0)
  } catch (error: unknown) {
    console.error(`Could not scan posture: ${postureScanErrorMessage(error)}`)
    process.exit(2)
  }
} else if (rawArgs[0] === 'open') {
  const parsed = parseArgs(rawArgs)
  if (!parsed) usage()
  const target = parsed.cleanArgs[0]
  if (!target) usage()
  const match = /^(.+):(\d+)$/.exec(target)
  const file = match ? match[1] : target
  const line = match ? Number(match[2]) : undefined
  const result = openInEditor(file, line)
  console.error(`${result.command} ${result.args.join(' ')}`)
  if (result.message) console.error(result.message)
  process.exit(0)
} else if (rawArgs[0] === 'login') {
  const parsed = parseArgs(rawArgs)
  if (!parsed || !parsed.endpoint || !parsed.email) usage()
  const password = await promptPassword()
  try {
    const result = await login({ endpoint: parsed.endpoint, email: parsed.email, password })
    writeSession({
      endpoint: parsed.endpoint,
      sessionToken: result.sessionToken,
      orgId: result.orgId,
      role: result.role,
      email: parsed.email,
    })
    console.error(`로그인 성공: ${parsed.email} (org ${result.orgId})`)
    process.exit(0)
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      console.error(`로그인 실패: ${error.message}`)
      process.exit(2)
    }
    throw error
  }
} else if (rawArgs[0] === 'logout') {
  const session = readSession()
  if (session) {
    try {
      await logout({ endpoint: session.endpoint, token: session.sessionToken })
    } catch {
      // network failure is tolerated — the local session is cleared regardless
    }
  }
  clearSession()
  process.exit(0)
} else if (rawArgs[0] === 'enroll') {
  const parsed = parseArgs(rawArgs)
  if (!parsed || !parsed.endpoint || !parsed.org || !parsed.code) usage()
  try {
    const result = await enroll({
      endpoint: parsed.endpoint,
      orgId: parsed.org,
      code: parsed.code,
      label: parsed.label,
    })
    const path = enrollmentPath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(
      path,
      JSON.stringify({ orgId: parsed.org, assetId: result.assetId, deviceToken: result.deviceToken }, null, 2) + '\n',
    )
    console.error(`등록 완료: asset ${result.assetId} (org ${parsed.org})`)
    process.exit(0)
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      console.error(`등록 실패: ${error.message}`)
      process.exit(2)
    }
    throw error
  }
} else {
  const resolved = resolveCommand(rawArgs)
  const effectiveArgs = resolved === undefined ? rawArgs : [resolved.canonical, ...resolved.rest]
  const parsedArgs = parseArgs(effectiveArgs)
  if (!parsedArgs) usage()
  const { cmd, cleanArgs, json, sarif, out, policyPath, markdownLanguage, push, endpoint, org, asset, open } = parsedArgs
  if (cmd === '--help' || cmd === '-h') usage(0)
  if (cmd === '--version' || cmd === '-v') printVersion()
  if (!hasValidPositionalArgs(cmd, cleanArgs)) usage()
  if (!isScanCommand(cmd)) usage()
  if (json && sarif) {
    console.error('--json and --sarif cannot be combined')
    process.exit(2)
  }

  const stdin = () => {
    const raw = readFileSync(0)
    if (raw.byteLength > MAX_FILE_BYTES) {
      console.error(`Could not read stdin: input is ${raw.byteLength} bytes, exceeding the ${MAX_FILE_BYTES} byte limit. Scan a smaller input.`)
      process.exit(2)
    }
    return raw.toString('utf8')
  }
  let findings: Finding[] = []
  const policy = (() => {
    try {
      return loadPolicy(policyPath)
    } catch (error: unknown) {
      if (error instanceof PolicyLoadError) {
        console.error(error.message)
        process.exit(2)
      }
      throw error
    }
  })()
  try {
    const input = cmd === 'scan-files'
      ? ''
      : (() => {
          try {
            return resolveScanInput({
              isTTY: Boolean(process.stdin.isTTY),
              arg: cleanArgs[0],
              readStdin: stdin,
              readFile: (p) => {
                const raw = readFileSync(p)
                if (raw.byteLength > MAX_FILE_BYTES) {
                  throw new Error(`input is ${raw.byteLength} bytes, exceeding the ${MAX_FILE_BYTES} byte limit. Scan a smaller input.`)
                }
                return raw.toString('utf8')
              },
            })
          } catch (error: unknown) {
            if (error instanceof ScanInputError) {
              console.error(`Could not read ${cmd} input: ${error.reason}`)
              process.exit(2)
            }
            throw error
          }
        })()
    findings = scanCliCommand(cmd, {
      input,
      workspacePath: cleanArgs[0],
      policy,
    })
  } catch (error: unknown) {
    if (cmd === 'scan-files') {
      console.error(`Could not scan files: ${fileScanErrorMessage(error)}`)
      process.exit(2)
    }
    throw error
  }

  function fileScanErrorMessage(error: unknown): string {
    if (hasErrorCode(error)) {
      const code = String(error.code)
      if (code === 'ENOENT') return 'workspace path was not found'
      if (code === 'ENOTDIR') return 'workspace path is not a directory'
      if (code === 'EACCES' || code === 'EPERM') return 'workspace path is not readable'
    }
    return 'unable to read workspace path'
  }

  const output = sarif ? toSarif(findings) : json ? JSON.stringify(findings, null, 2) : toMarkdown(findings, { lang: markdownLanguage })
  if (out) {
    try {
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, output + '\n')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Could not write output: ${message}`)
      process.exit(2)
    }
  } else console.log(output)
  if (open) {
    const openable = findings.filter((f): f is Finding & { file: string; line: number } => f.file !== undefined && f.line !== undefined)
    if (openable.length > 0) {
      const best = openable.reduce((top, f) => (severityScore(f.severity) > severityScore(top.severity) ? f : top))
      openInEditor(best.file, best.line)
    }
  }
  if (push) {
    if (!endpoint) {
      console.error('--push requires --endpoint <control-plane-url>')
      process.exit(2)
    }
    try {
      const identity = resolveIdentity({ orgId: org, assetId: asset })
      // buildReportPayload validates the wire schema AND runs the client
      // redaction guard; a raw-secret leak throws HERE, before any network call.
      const payload = buildReportPayload(findings, {
        orgId: identity.orgId,
        assetId: identity.assetId,
        actor: identity.actor,
      })
      const result = await pushReport(endpoint, payload, identity)
      let accepted: Record<string, unknown> = {}
      try {
        const parsed: unknown = JSON.parse(result.body)
        if (parsed && typeof parsed === 'object') accepted = parsed as Record<string, unknown>
      } catch {
        // non-JSON body; ignore
      }
      const newCritical = accepted.newCriticalCount
      console.error(
        `Pushed ${payload.findings.length} finding(s) to ${endpoint} (org ${identity.orgId}, asset ${identity.assetId})` +
          (newCritical !== undefined ? ` — ${String(newCritical)} new critical` : ''),
      )
    } catch (error: unknown) {
      if (error instanceof RedactionError) {
        console.error(`Redaction guard blocked the push (nothing left this machine): ${error.message}`)
        process.exit(3)
      }
      if (error instanceof EnrollmentError) {
        console.error(`Could not resolve enrollment: ${error.message}`)
        process.exit(2)
      }
      if (error instanceof ReportPushError) {
        console.error(`Report push failed: ${error.message}`)
        process.exit(2)
      }
      throw error
    }
  }
  // [R3/NEW-CR-1] Advisory findings (e.g. mcp-unapproved) never gate the exit code.
  process.exit(findings.some((f) => f.severity === 'critical' && !f.advisory) ? 1 : 0)
}

function readPackageVersion(): string {
  const packageJson: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  if (packageJson && typeof packageJson === 'object' && 'version' in packageJson && typeof packageJson.version === 'string') {
    return packageJson.version
  }
  return '0.0.0'
}

function isScanCommand(cmd: string): boolean {
  return cmd === 'scan-files' || cmd === 'scan-diff' || cmd === 'scan-log' || cmd === 'scan-mcp' || cmd === 'report'
}

function postureScanErrorMessage(error: unknown): string {
  if (hasErrorCode(error)) {
    const code = String(error.code)
    if (code === 'ENOENT') return 'path was not found'
    if (code === 'ENOTDIR') return 'path is not a directory'
    if (code === 'EACCES' || code === 'EPERM') return 'path is not readable'
  }
  return 'unable to read posture path'
}

function hasErrorCode(error: unknown): error is { readonly code: unknown } {
  return error !== null && typeof error === 'object' && 'code' in error
}
