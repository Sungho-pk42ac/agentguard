#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadPolicy, PolicyLoadError } from './policy.js'
import { scanDiff, scanFiles, scanMcpConfig, scanText } from './scanner.js'
import { toMarkdown, toSarif } from './report.js'
import type { Finding } from './rules.js'

interface CliArgs {
  readonly cmd: string
  readonly cleanArgs: readonly string[]
  readonly json: boolean
  readonly sarif: boolean
  readonly out?: string
  readonly policyPath?: string
}

function printVersion(): never {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  console.log(packageJson.version)
  process.exit(0)
}

function usage(exitCode = 2): never {
  const output = `Usage:
  agentguard scan-files [path]
  agentguard scan-diff < diff.patch
  agentguard scan-log < transcript.log
  agentguard scan-mcp < config.toml
  agentguard report < input.txt

Options:
  --help, -h                    Print this usage information
  --version, -v                 Print the package version
  --json                         Print JSON findings
  --sarif                        Print SARIF 2.1.0 for GitHub code scanning
  --policy <path>, --policy=<path>  Load agent-policy.yaml/json
  --out <file>, --out=<file>        Write output to file`
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
  return { cmd, cleanArgs, json, sarif, out, policyPath }
}

function isOptionValue(value: string | undefined): value is string {
  return value !== undefined && !value.startsWith('--')
}

function hasValidPositionalArgs(cmd: string, cleanArgs: readonly string[]): boolean {
  if (cmd === 'scan-files') return cleanArgs.length <= 1
  if (cmd === 'scan-diff' || cmd === 'scan-log' || cmd === 'scan-mcp' || cmd === 'report') return cleanArgs.length === 0
  return true
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (!parsedArgs) usage()
const { cmd, cleanArgs, json, sarif, out, policyPath } = parsedArgs
if (cmd === '--help' || cmd === '-h') usage(0)
if (cmd === '--version' || cmd === '-v') printVersion()
if (!hasValidPositionalArgs(cmd, cleanArgs)) usage()
if (json && sarif) {
  console.error('--json and --sarif cannot be combined')
  process.exit(2)
}

const stdin = () => readFileSync(0, 'utf8')
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
  switch (cmd) {
    case 'scan-files': findings = scanFiles(cleanArgs[0] ?? process.cwd(), policy); break
    case 'scan-diff': findings = scanDiff(stdin(), policy); break
    case 'scan-log': findings = scanText(stdin(), 'agent-log', policy); break
    case 'scan-mcp': findings = scanMcpConfig(stdin(), policy); break
    case 'report': findings = scanText(stdin(), 'stdin', policy); break
    default: usage()
  }
} catch (error: unknown) {
  if (cmd === 'scan-files') {
    console.error(`Could not scan files: ${fileScanErrorMessage(error)}`)
    process.exit(2)
  }
  throw error
}

function fileScanErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code)
    if (code === 'ENOENT') return 'workspace path was not found'
    if (code === 'ENOTDIR') return 'workspace path is not a directory'
    if (code === 'EACCES' || code === 'EPERM') return 'workspace path is not readable'
  }
  return 'unable to read workspace path'
}

const output = sarif ? toSarif(findings) : json ? JSON.stringify(findings, null, 2) : toMarkdown(findings)
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
