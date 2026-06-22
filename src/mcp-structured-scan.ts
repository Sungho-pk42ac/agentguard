export interface StructuredMcpConfigSignals {
  readonly hasWideFilesystemRoot: boolean
  readonly hasWritablePath: boolean
  readonly hasCredentialEnv: boolean
}

const EMPTY_SIGNALS: StructuredMcpConfigSignals = {
  hasWideFilesystemRoot: false,
  hasWritablePath: false,
  hasCredentialEnv: false,
}

const JSON_STRUCTURED_KEYS = new Set(['args', 'root', 'roots', 'allowed_directories', 'directories', 'paths'])
const TOML_STRUCTURED_KEYS = new Set(['args', 'root', 'roots', 'allowed_directories', 'directories', 'paths'])
const WRITABLE_PATH_FLAGS = new Set(['--allow-write', '--writable'])

export function scanStructuredMcpConfig(text: string): StructuredMcpConfigSignals {
  return mergeSignals(scanJsonMcpConfig(text), scanTomlishMcpConfig(text))
}

function scanJsonMcpConfig(text: string): StructuredMcpConfigSignals {
  const parsed = parseJson(text)
  return parsed === undefined ? EMPTY_SIGNALS : scanJsonValue(parsed, '')
}

function parseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) return undefined
    throw error
  }
}

function scanJsonValue(value: unknown, key: string): StructuredMcpConfigSignals {
  if (typeof value === 'string') return signalsFromJsonTokens(key, [value])
  if (Array.isArray(value)) return signalsFromJsonTokens(key, value.filter(isString))
  if (!isRecord(value)) return EMPTY_SIGNALS

  let signals = EMPTY_SIGNALS
  for (const [childKey, childValue] of Object.entries(value)) {
    if (isEnvKey(childKey) && isRecord(childValue) && hasCredentialEnvKey(childValue)) {
      signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: false, hasCredentialEnv: true })
    }
    signals = mergeSignals(signals, scanJsonValue(childValue, childKey))
  }
  return signals
}

function signalsFromJsonTokens(key: string, tokens: readonly string[]): StructuredMcpConfigSignals {
  return JSON_STRUCTURED_KEYS.has(key.toLowerCase()) ? signalsFromTokens(tokens) : EMPTY_SIGNALS
}

function scanTomlishMcpConfig(text: string): StructuredMcpConfigSignals {
  let section = ''
  let signals = EMPTY_SIGNALS

  for (const rawLine of text.split('\n')) {
    const line = stripTomlishComment(rawLine).trim()
    if (line === '') continue

    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    const matchedSection = sectionMatch?.[1]
    if (matchedSection !== undefined) {
      section = matchedSection.toLowerCase()
      continue
    }

    const assignmentMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/)
    const key = assignmentMatch?.[1]
    const value = assignmentMatch?.[2]
    if (key === undefined || value === undefined) continue

    const keyLower = key.toLowerCase()
    if (section.endsWith('.env') && isCredentialName(key)) {
      signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: false, hasCredentialEnv: true })
    }
    if (TOML_STRUCTURED_KEYS.has(keyLower)) {
      signals = mergeSignals(signals, signalsFromTokens(tomlishStringTokens(value)))
    }
  }

  return signals
}

function signalsFromTokens(tokens: readonly string[]): StructuredMcpConfigSignals {
  return {
    hasWideFilesystemRoot: tokens.some(isWideFilesystemRoot),
    hasWritablePath: tokens.some(isWritablePathFlag),
    hasCredentialEnv: false,
  }
}

function tomlishStringTokens(value: string): readonly string[] {
  const tokens: string[] = []
  const quotedValuePattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g
  for (const match of value.matchAll(quotedValuePattern)) {
    const doubleQuoted = match[1]
    const singleQuoted = match[2]
    if (doubleQuoted !== undefined) tokens.push(doubleQuoted)
    else if (singleQuoted !== undefined) tokens.push(singleQuoted)
  }
  if (tokens.length > 0) return tokens
  return value.split(/[\s,[\]]+/).filter((token) => token.length > 0)
}

function stripTomlishComment(line: string): string {
  let quote: '"' | "'" | undefined
  let escaped = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\' && quote === '"') {
      escaped = true
      continue
    }
    if ((char === '"' || char === "'") && (quote === undefined || quote === char)) {
      quote = quote === char ? undefined : char
      continue
    }
    if (char === '#' && quote === undefined) return line.slice(0, index)
  }
  return line
}

function isWideFilesystemRoot(token: string): boolean {
  return token === '/' || token === '~' || /^[A-Za-z]:[\\/]?$/.test(token)
}

function isWritablePathFlag(token: string): boolean {
  return WRITABLE_PATH_FLAGS.has(token) || token.startsWith('--allow-write=') || token.startsWith('--writable=')
}

function isCredentialName(name: string): boolean {
  return /(?:API_KEY|TOKEN|SECRET|PASSWORD)/i.test(name)
}

function isEnvKey(key: string): boolean {
  return key.toLowerCase() === 'env'
}

function hasCredentialEnvKey(value: Record<string, unknown>): boolean {
  return Object.keys(value).some(isCredentialName)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function mergeSignals(first: StructuredMcpConfigSignals, second: StructuredMcpConfigSignals): StructuredMcpConfigSignals {
  return {
    hasWideFilesystemRoot: first.hasWideFilesystemRoot || second.hasWideFilesystemRoot,
    hasWritablePath: first.hasWritablePath || second.hasWritablePath,
    hasCredentialEnv: first.hasCredentialEnv || second.hasCredentialEnv,
  }
}
