import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type ResidualCredential, residualId } from '../residual.js'
import { SECRET_PATTERNS } from '../rules.js'
import { normalizePath, redact } from '../scanner.js'

// Shell-rc key detector (NEW in v0.3.0). Reads per-OS shell startup files and
// flags inline API keys / credential-named environment assignments. This is a
// STATIC read only — rc files are never sourced or executed.

export interface ShellRcScanOptions {
  readonly homeDir?: string
  readonly platform?: NodeJS.Platform
}

const POSIX_RC_FILES = ['.bashrc', '.zshrc', '.profile', '.bash_profile', '.zprofile', '.bash_login']

const WINDOWS_PROFILE_FILES = [
  join('Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
  join('Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
  join('Documents', 'PowerShell', 'profile.ps1'),
  join('Documents', 'WindowsPowerShell', 'profile.ps1'),
]

// Credential-named env var assigned an opaque inline value. Handles bash/zsh
// (`export NAME=v`, `NAME=v`), Windows cmd (`set NAME=v`) and PowerShell
// (`$env:NAME = "v"`). The value is any run of >=8 non-space, non-quote chars.
const RC_ENV_ASSIGNMENT_RE =
  /\b([A-Za-z_][A-Za-z0-9_]*(?:API[_-]?KEY|APIKEY|TOKEN|SECRET|PASSWORD|PASSWD)[A-Za-z0-9_]*)\b\s*=\s*(["']?)([^\s"'#]{8,})\2/i

export function shellRcCandidatePaths(options: ShellRcScanOptions = {}): string[] {
  const home = options.homeDir ?? homedir()
  const platform = options.platform ?? process.platform
  const relatives = platform === 'win32' ? [...WINDOWS_PROFILE_FILES, ...POSIX_RC_FILES] : POSIX_RC_FILES
  return relatives.map((relative) => join(home, relative))
}

// Pure scan of one rc file's content. Exported for direct unit testing.
export function scanShellRcText(text: string, file: string): ResidualCredential[] {
  const out: ResidualCredential[] = []
  const location = normalizePath(file)
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    const lineNo = index + 1
    // A comment line is inert; skip so commented-out samples are not flagged.
    if (/^\s*#/.test(line)) return
    let matchedKnown = false
    // Collect all secret-pattern matches with spans so an overlapping generic
    // assignment match (which wraps the specific key) is not double-reported.
    const hits = SECRET_PATTERNS.flatMap((pattern) =>
      [...line.matchAll(pattern.re)].map((match) => ({
        pattern,
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      })),
    )
    const specificSpans = hits.filter((h) => h.pattern.id !== 'generic-secret-assignment')
    for (const hit of hits) {
      if (
        hit.pattern.id === 'generic-secret-assignment' &&
        specificSpans.some((s) => s.start < hit.end && hit.start < s.end)
      ) {
        continue
      }
      matchedKnown = true
      out.push({
        id: residualId('shell-rc', location, lineNo, hit.pattern.id),
        kind: 'api-key',
        severity: 'critical',
        surface: 'shell-rc',
        location,
        path: file,
        line: lineNo,
        evidence: `${hit.pattern.title}: ${redact(hit.text)}`,
        recommendation: 'Remove the exported credential from the shell startup file and rotate the key.',
      })
    }
    if (matchedKnown) return
    const envMatch = RC_ENV_ASSIGNMENT_RE.exec(line)
    if (envMatch) {
      const varName = envMatch[1]
      out.push({
        id: residualId('shell-rc', location, lineNo, varName),
        kind: 'api-key',
        severity: 'high',
        surface: 'shell-rc',
        location,
        path: file,
        line: lineNo,
        evidence: `Credential-named env var ${varName} assigned inline: ${redact(envMatch[3])}`,
        recommendation: 'Move the secret out of the shell startup file (use a secret manager) and rotate it.',
      })
    }
  })
  return out
}

export function scanShellRc(options: ShellRcScanOptions = {}): ResidualCredential[] {
  const out: ResidualCredential[] = []
  for (const file of shellRcCandidatePaths(options)) {
    if (!existsSync(file)) continue
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    out.push(...scanShellRcText(text, file))
  }
  return out
}
