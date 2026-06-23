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

const STRUCTURED_KEYS = new Set(['args', 'root', 'roots', 'alloweddirectories', 'directories', 'paths', 'path'])
const PATH_CONTEXT_KEYS = new Set(['root', 'roots', 'alloweddirectories', 'directories', 'paths', 'path'])
const WRITABLE_PATH_FLAGS = new Set(['--allow-write', '--writable'])
const MAX_JSON_SCAN_DEPTH = 1_000

interface JsonScanFrame {
  readonly value: unknown
  readonly key: string
  readonly depth: number
}

interface TomlishInlineTableEntry {
  readonly key: string
  readonly value: string
}

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
  const stack: JsonScanFrame[] = [{ value, key, depth: 0 }]
  let signals = EMPTY_SIGNALS

  while (stack.length > 0) {
    const frame = stack.pop()
    if (frame === undefined) break

    if (typeof frame.value === 'string') {
      signals = mergeSignals(signals, signalsFromJsonTokens(frame.key, [frame.value]))
      continue
    }

    if (Array.isArray(frame.value)) {
      const stringValues = frame.value.filter(isString)
      signals = mergeSignals(signals, signalsFromJsonTokens(frame.key, stringValues))
      if (
        isEnvKey(frame.key) &&
        stringValues.some((token) => isCredentialName(token) || isCredentialEnvAssignment(token))
      ) {
        signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: false, hasCredentialEnv: true })
      }
      if (frame.depth >= MAX_JSON_SCAN_DEPTH) continue
      for (const childValue of frame.value) {
        // Preserve the array key as context so path entries like { path, writable } stay path-scoped.
        if (!isString(childValue)) stack.push({ value: childValue, key: frame.key, depth: frame.depth + 1 })
      }
      continue
    }

    if (!isRecord(frame.value)) continue

    // Non-string env array entries inherit the array key, so catch descriptors like
    // { name: 'GITHUB_TOKEN', value: '$GITHUB_TOKEN' } when their frame is popped.
    if (isEnvKey(frame.key) && hasCredentialEnvKey(frame.value)) {
      signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: false, hasCredentialEnv: true })
    }

    for (const [childKey, childValue] of Object.entries(frame.value)) {
      if (isEnvKey(childKey) && isRecord(childValue) && hasCredentialEnvKey(childValue)) {
        signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: false, hasCredentialEnv: true })
      }
      if (isJsonWritableSetting(childKey, childValue, frame.value, frame.key)) {
        signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: true, hasCredentialEnv: false })
      }
      if (frame.depth < MAX_JSON_SCAN_DEPTH) stack.push({ value: childValue, key: childKey, depth: frame.depth + 1 })
    }
  }

  return signals
}

function signalsFromJsonTokens(key: string, tokens: readonly string[]): StructuredMcpConfigSignals {
  return STRUCTURED_KEYS.has(normalizeConfigKey(key)) ? signalsFromTokens(tokens) : EMPTY_SIGNALS
}

function scanTomlishMcpConfig(text: string): StructuredMcpConfigSignals {
  let section = ''
  let signals = EMPTY_SIGNALS
  let sectionHasPathContext = false
  let sectionHasWritableSetting = false

  function flushSectionWritableSignal(): void {
    if (sectionHasPathContext && sectionHasWritableSetting) {
      signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: true, hasCredentialEnv: false })
    }
    sectionHasPathContext = false
    sectionHasWritableSetting = false
  }

  for (const rawLine of text.split('\n')) {
    const line = stripTomlishComment(rawLine).trim()
    if (line === '') continue

    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    const matchedSection = sectionMatch?.[1]
    if (matchedSection !== undefined) {
      flushSectionWritableSignal()
      section = matchedSection.toLowerCase()
      continue
    }

    const assignmentMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/)
    const key = assignmentMatch?.[1]
    const value = assignmentMatch?.[2]
    if (key === undefined || value === undefined) continue

    const normalizedKey = normalizeConfigKey(key)
    if (section.endsWith('.env') && isCredentialName(key)) {
      signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: false, hasCredentialEnv: true })
    }
    if (isEnvKey(key) && tomlishInlineTableKeys(value).some(isCredentialName)) {
      signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: false, hasCredentialEnv: true })
    }
    if (tomlishInlineTableHasCredentialEnv(value)) {
      signals = mergeSignals(signals, { hasWideFilesystemRoot: false, hasWritablePath: false, hasCredentialEnv: true })
    }
    if (STRUCTURED_KEYS.has(normalizedKey)) {
      signals = mergeSignals(signals, signalsFromTokens(tomlishStringTokens(value)))
    }
    if (PATH_CONTEXT_KEYS.has(normalizedKey)) sectionHasPathContext = true
    if (isTomlishWritableSetting(normalizedKey, value)) sectionHasWritableSetting = true
  }

  flushSectionWritableSignal()
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

function tomlishInlineTableKeys(value: string): readonly string[] {
  return tomlishInlineTableEntries(value).map((entry) => entry.key)
}

function tomlishInlineTableHasCredentialEnv(value: string, depth = 0): boolean {
  if (depth >= MAX_JSON_SCAN_DEPTH || !value.trim().startsWith('{')) return false
  return tomlishInlineTableEntries(value).some((entry) => {
    if (isEnvKey(entry.key) && tomlishInlineTableKeys(entry.value).some(isCredentialName)) return true
    return tomlishInlineTableHasCredentialEnv(entry.value, depth + 1)
  })
}

function tomlishInlineTableEntries(value: string): readonly TomlishInlineTableEntry[] {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return []
  const inner = trimmed.endsWith('}') ? trimmed.slice(1, -1) : trimmed.slice(1)
  const entries: TomlishInlineTableEntry[] = []
  let keyToken = ''
  let valueToken = ''
  let currentKey = ''
  let readingKey = true
  let quote: '"' | "'" | undefined
  let escaped = false
  let braceDepth = 0
  let bracketDepth = 0

  function pushEntry(): void {
    if (currentKey.length > 0) entries.push({ key: currentKey, value: valueToken.trim() })
    currentKey = ''
    valueToken = ''
  }

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index]
    if (escaped) {
      escaped = false
      if (readingKey) keyToken += char
      else valueToken += char
      continue
    }
    if (char === '\\' && quote === '"') {
      escaped = true
      if (readingKey) keyToken += char
      else valueToken += char
      continue
    }
    if ((char === '"' || char === "'") && (quote === undefined || quote === char)) {
      quote = quote === char ? undefined : char
      if (readingKey) keyToken += char
      else valueToken += char
      continue
    }
    if (quote !== undefined) {
      if (readingKey) keyToken += char
      else valueToken += char
      continue
    }
    if (!readingKey) {
      if (char === '{') braceDepth += 1
      else if (char === '}') braceDepth -= 1
      else if (char === '[') bracketDepth += 1
      else if (char === ']') bracketDepth -= 1
    }
    if (readingKey && char === '=') {
      currentKey = unquoteTomlishInlineKey(keyToken.trim())
      keyToken = ''
      readingKey = false
      continue
    }
    if (!readingKey && char === ',' && braceDepth === 0 && bracketDepth === 0) {
      pushEntry()
      readingKey = true
      continue
    }
    if (readingKey) keyToken += char
    else valueToken += char
  }

  pushEntry()
  return entries
}

function unquoteTomlishInlineKey(key: string): string {
  const quote = key[0]
  if ((quote === '"' || quote === "'") && key.endsWith(quote)) return key.slice(1, -1)
  return key
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
  const rootArgumentValue = token.match(
    /^(?:--?)?(?:root|roots?|path|paths?|allow(?:ed)?[-_]?directories|directories)=(.+)$/i,
  )?.[1]
  const rootValue = normalizeRootTokenValue(rootArgumentValue ?? token)
  return rootValue === '/' || rootValue === '~' || rootValue === '~/' || /^[A-Za-z]:[\\/]?$/.test(rootValue)
}

function normalizeRootTokenValue(value: string): string {
  const trimmed = value.trim()
  if (/^~[\\/]+$/.test(trimmed)) return '~/'
  return trimmed
}

function isWritablePathFlag(token: string): boolean {
  return WRITABLE_PATH_FLAGS.has(token) || token.startsWith('--allow-write=') || token.startsWith('--writable=')
}

function isJsonWritableSetting(key: string, value: unknown, parent: Record<string, unknown>, parentKey: string): boolean {
  const normalizedKey = normalizeConfigKey(key)
  if (!isWritableEnabledSetting(normalizedKey, value)) return false
  // Writable booleans are treated as filesystem/path risk only near path-like keys, not generic MCP args.
  return PATH_CONTEXT_KEYS.has(normalizeConfigKey(parentKey)) || Object.keys(parent).some(isJsonPathContextKey)
}

function isTomlishWritableSetting(normalizedKey: string, value: string): boolean {
  return isWritableEnabledSetting(normalizedKey, parseTomlishScalar(value))
}

function isWritableEnabledSetting(normalizedKey: string, value: unknown): boolean {
  return (normalizedKey === 'writable' && isTrueValue(value)) || (normalizedKey === 'readonly' && isFalseValue(value))
}

function isTrueValue(value: unknown): boolean {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true')
}

function isFalseValue(value: unknown): boolean {
  return value === false || (typeof value === 'string' && value.trim().toLowerCase() === 'false')
}

function parseTomlishScalar(value: string): string {
  const tokens = tomlishStringTokens(value)
  return tokens.length === 1 ? tokens[0] : value.trim()
}

function normalizeConfigKey(key: string): string {
  return key.replace(/[-_]/g, '').toLowerCase()
}

function isJsonPathContextKey(key: string): boolean {
  return PATH_CONTEXT_KEYS.has(normalizeConfigKey(key))
}

function isCredentialName(name: string): boolean {
  return /(?:API_KEY|TOKEN|SECRET|PASSWORD)/i.test(name)
}

function isEnvKey(key: string): boolean {
  return key
    .split('.')
    .map((part) => normalizeConfigKey(unquoteTomlishInlineKey(part.trim())))
    .includes('env')
}

function hasCredentialEnvKey(value: Record<string, unknown>): boolean {
  return Object.entries(value).some(([key, fieldValue]) => {
    if (isCredentialName(key)) return true
    const normalizedKey = key.toLowerCase()
    return (
      (normalizedKey === 'name' || normalizedKey === 'key') &&
      typeof fieldValue === 'string' &&
      isCredentialName(fieldValue)
    )
  })
}

function isCredentialEnvAssignment(value: string): boolean {
  const key = value.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1]
  return key !== undefined && isCredentialName(key)
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
