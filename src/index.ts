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
import { shouldLaunchRepl } from './tui/entry.js'

interface CliArgs {
  readonly cmd: string
  readonly cleanArgs: readonly string[]
  readonly json: boolean
  readonly sarif: boolean
  readonly out?: string
  readonly policyPath?: string
  readonly markdownLanguage: MarkdownLanguage
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
  agentguard posture [경로] [--json]
  agentguard doctor [--lang ko|en]
  agentguard repl

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

Options:
  --help, -h                        도움말 출력
  --version, -v                     버전 출력
  --json                            JSON 형식으로 결과 출력
  --sarif                           GitHub 코드 스캐닝용 SARIF 2.1.0 출력
  --lang ko|en, --lang=ko|en        마크다운 리포트 언어 (기본값: ko)
  --policy <path>, --policy=<path>  agent-policy.yaml/json 로드
  --out <file>, --out=<file>        결과를 파일로 저장`
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
    if (arg.startsWith('--')) return undefined
    if (!cmd) cmd = arg
    else cleanArgs.push(arg)
  }

  if (!cmd) return undefined
  if (['--help', '-h', '--version', '-v'].includes(cmd) && cleanArgs.length > 0) return undefined
  return { cmd, cleanArgs, json, sarif, out, policyPath, markdownLanguage }
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
} else {
  const parsedArgs = parseArgs(rawArgs)
  if (!parsedArgs) usage()
  const { cmd, cleanArgs, json, sarif, out, policyPath, markdownLanguage } = parsedArgs
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
  process.exit(findings.some((f) => f.severity === 'critical') ? 1 : 0)
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
