#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
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

function usage(): never {
  console.error(`Usage:
  agentguard scan-files [path]
  agentguard scan-diff < diff.patch
  agentguard scan-log < transcript.log
  agentguard scan-mcp < config.toml
  agentguard report < input.txt

Options:
  --json           Print JSON findings
  --sarif          Print SARIF 2.1.0 for GitHub code scanning
  --policy <path>  Load agent-policy.yaml/json
  --out <file>     Write output to file`)
  process.exit(2)
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
      out = value
      index += 1
      continue
    }
    if (arg.startsWith('--out=')) {
      const value = arg.slice('--out='.length)
      if (value.length === 0) return undefined
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
  return { cmd, cleanArgs, json, sarif, out, policyPath }
}

function isOptionValue(value: string | undefined): value is string {
  return value !== undefined && !value.startsWith('--')
}

const parsedArgs = parseArgs(process.argv.slice(2))
if (!parsedArgs) usage()
const { cmd, cleanArgs, json, sarif, out, policyPath } = parsedArgs

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
switch (cmd) {
  case 'scan-files': findings = scanFiles(cleanArgs[0] ?? process.cwd(), policy); break
  case 'scan-diff': findings = scanDiff(stdin(), policy); break
  case 'scan-log': findings = scanText(stdin(), 'agent-log', policy); break
  case 'scan-mcp': findings = scanMcpConfig(stdin(), policy); break
  case 'report': findings = scanText(stdin(), 'stdin', policy); break
  default: usage()
}

const output = sarif ? toSarif(findings) : json ? JSON.stringify(findings, null, 2) : toMarkdown(findings)
if (out) writeFileSync(out, output + '\n')
else console.log(output)
process.exit(findings.some((f) => f.severity === 'critical') ? 1 : 0)
