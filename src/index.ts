#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { scanDiff, scanFiles, scanMcpConfig, scanText } from './scanner.js'
import { toMarkdown, toSarif } from './report.js'
import type { Finding } from './rules.js'

function usage() {
  console.error(`Usage:
  agentguard scan-files [path]
  agentguard scan-diff < diff.patch
  agentguard scan-log < transcript.log
  agentguard scan-mcp < config.toml
  agentguard report < input.txt

Options:
  --json           Print JSON findings
  --sarif          Print SARIF 2.1.0 for GitHub code scanning
  --out <file>     Write output to file`)
  process.exit(2)
}

const args = process.argv.slice(2)
const cmd = args.shift()
if (!cmd) usage()
const json = args.includes('--json')
const sarif = args.includes('--sarif')
const outIdx = args.indexOf('--out')
const out = outIdx >= 0 ? args[outIdx + 1] : undefined
const cleanArgs = args.filter((a, i) => a !== '--json' && a !== '--sarif' && i !== outIdx && i !== outIdx + 1)

const stdin = () => readFileSync(0, 'utf8')
let findings: Finding[] = []
switch (cmd) {
  case 'scan-files': findings = scanFiles(cleanArgs[0] ?? process.cwd()); break
  case 'scan-diff': findings = scanDiff(stdin()); break
  case 'scan-log': findings = scanText(stdin(), 'agent-log'); break
  case 'scan-mcp': findings = scanMcpConfig(stdin()); break
  case 'report': findings = scanText(stdin(), 'stdin'); break
  default: usage()
}

const output = sarif ? toSarif(findings) : json ? JSON.stringify(findings, null, 2) : toMarkdown(findings)
if (out) writeFileSync(out, output + '\n')
else console.log(output)
process.exit(findings.some((f) => f.severity === 'critical') ? 1 : 0)
