import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { isAlias, parseDocument, visit } from 'yaml'
import { z } from 'zod'
import { DEFAULT_POLICY, type McpPolicy, type Policy } from './rules.js'

const stringListSchema = z.array(z.string().trim().min(1))

const rawMcpPolicySchema = z
  .object({
    deny_servers: stringListSchema.optional(),
    require_approval_tools: stringListSchema.optional(),
  })
  .strict()

const rawPolicySchema = z
  .object({
    deny_read: stringListSchema.optional(),
    deny_commands: stringListSchema.optional(),
    require_approval: stringListSchema.optional(),
    approval_required: stringListSchema.optional(),
    mcp: rawMcpPolicySchema.optional(),
  })
  .strict()

const policyFileSchema = rawPolicySchema.extend({
  overrides: rawPolicySchema.optional(),
})
const defaultPolicyFiles = ['agent-policy.yaml', 'agent-policy.yml', 'agent-policy.json'] as const

type RawPolicy = z.infer<typeof rawPolicySchema>
type PolicyFile = z.infer<typeof policyFileSchema>
type PolicyLoadErrorReason = 'malformed' | 'missing' | 'unreadable' | 'unsupported'

export class PolicyLoadError extends Error {
  declare readonly path: string

  constructor(path: string, reason: PolicyLoadErrorReason) {
    super(`Unable to load policy file: ${reason} policy file`)
    this.name = 'PolicyLoadError'
    Object.defineProperty(this, 'path', {
      enumerable: false,
      value: path,
    })
  }
}

export function loadPolicy(path?: string): Policy {
  const policyPath = path ?? discoverDefaultPolicyPath()
  if (!policyPath) return clonePolicy(DEFAULT_POLICY)

  let contents: string
  try {
    contents = readFileSync(policyPath, 'utf8')
  } catch (error: unknown) {
    if (error instanceof Error) {
      const reason: PolicyLoadErrorReason =
        'code' in error && error.code === 'ENOENT' ? 'missing' : 'unreadable'
      throw new PolicyLoadError(policyPath, reason)
    }
    throw error
  }

  let parsed: unknown
  try {
    parsed = parsePolicyContents(policyPath, contents)
  } catch (error: unknown) {
    if (error instanceof PolicyLoadError) throw error
    if (error instanceof Error) throw new PolicyLoadError(policyPath, 'malformed')
    throw error
  }

  const result = policyFileSchema.safeParse(parsed)
  if (hasUnsafeObjectKey(parsed) || !result.success || hasApprovalAliasConflict(result.data)) {
    throw new PolicyLoadError(policyPath, 'malformed')
  }

  return mergePolicy(DEFAULT_POLICY, result.data)
}

function discoverDefaultPolicyPath(): string | undefined {
  for (const file of defaultPolicyFiles) {
    const path = join(process.cwd(), file)
    if (existsSync(path)) return path
  }
  return undefined
}

function parsePolicyContents(path: string, contents: string): unknown {
  const normalizedContents = contents.startsWith('\uFEFF') ? contents.slice(1) : contents
  if (normalizedContents.trim().length === 0) return {}

  switch (extname(path).toLowerCase()) {
    case '.json':
      return parseJsonPolicy(normalizedContents)
    case '.yaml':
    case '.yml':
      return parseYamlPolicy(normalizedContents)
    default:
      throw new PolicyLoadError(path, 'unsupported')
  }
}

function parseYamlPolicy(contents: string): unknown {
  const document = parseDocument(contents, { uniqueKeys: true })
  if (document.errors.length > 0 || document.warnings.length > 0 || hasUnsafeYamlNode(document)) {
    throw new SyntaxError('Malformed YAML policy')
  }
  return document.toJSON()
}

function hasUnsafeYamlNode(document: ReturnType<typeof parseDocument>): boolean {
  let hasUnsafeNode = false
  visit(document, (_key, node) => {
    if (
      isAlias(node) ||
      (node && typeof node === 'object' && 'anchor' in node && typeof node.anchor === 'string') ||
      (node && typeof node === 'object' && 'tag' in node && typeof node.tag === 'string')
    ) {
      hasUnsafeNode = true
      return visit.BREAK
    }
    return undefined
  })
  return hasUnsafeNode
}

function parseJsonPolicy(contents: string): unknown {
  const parsed: unknown = JSON.parse(contents)
  if (hasDuplicateJsonObjectKey(contents)) throw new SyntaxError('Duplicate JSON object key')
  return parsed
}

function hasDuplicateJsonObjectKey(contents: string): boolean {
  const objectKeyStack: Array<Set<string> | undefined> = []
  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index]
    if (char === '{') objectKeyStack.push(new Set())
    else if (char === '[') objectKeyStack.push(undefined)
    else if (char === '}' || char === ']') objectKeyStack.pop()
    else if (char === '"') {
      const token = readJsonString(contents, index)
      index = token.nextIndex - 1
      if (nextJsonToken(contents, token.nextIndex) !== ':') continue

      const currentKeys = objectKeyStack[objectKeyStack.length - 1]
      if (!currentKeys) continue
      if (currentKeys.has(token.value)) return true
      currentKeys.add(token.value)
    }
  }
  return false
}

function readJsonString(contents: string, startIndex: number): { readonly value: string; readonly nextIndex: number } {
  let value = ''
  for (let index = startIndex + 1; index < contents.length; index += 1) {
    const char = contents[index]
    if (char === '"') return { value, nextIndex: index + 1 }
    if (char !== '\\') {
      value += char
      continue
    }

    const escaped = contents[index + 1]
    if (escaped === undefined) throw new SyntaxError('Unterminated JSON escape')
    if (escaped === 'u') {
      value += String.fromCharCode(Number.parseInt(contents.slice(index + 2, index + 6), 16))
      index += 5
      continue
    }

    value += decodeJsonEscape(escaped)
    index += 1
  }
  throw new SyntaxError('Unterminated JSON string')
}

function decodeJsonEscape(escaped: string): string {
  switch (escaped) {
    case '"':
    case '\\':
    case '/':
      return escaped
    case 'b':
      return '\b'
    case 'f':
      return '\f'
    case 'n':
      return '\n'
    case 'r':
      return '\r'
    case 't':
      return '\t'
    default:
      throw new SyntaxError('Invalid JSON escape')
  }
}

function nextJsonToken(contents: string, startIndex: number): string | undefined {
  for (let index = startIndex; index < contents.length; index += 1) {
    const char = contents[index]
    if (char !== ' ' && char !== '\n' && char !== '\r' && char !== '\t') return char
  }
  return undefined
}

function mergePolicy(defaultPolicy: Policy, userPolicy: PolicyFile): Policy {
  const overrides = userPolicy.overrides
  return {
    denyRead: mergeList(defaultPolicy.denyRead, overrides?.deny_read, userPolicy.deny_read),
    denyCommands: mergeList(defaultPolicy.denyCommands, overrides?.deny_commands, userPolicy.deny_commands),
    requireApproval: mergeList(defaultPolicy.requireApproval, approvalRules(overrides), approvalRules(userPolicy)),
    mcp: mergeMcpPolicy(defaultPolicy.mcp, overrides?.mcp, userPolicy.mcp),
  }
}

function approvalRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return policy?.require_approval ?? policy?.approval_required
}

function hasApprovalAliasConflict(policy: PolicyFile): boolean {
  return hasRawApprovalAliasConflict(policy) || hasRawApprovalAliasConflict(policy.overrides)
}

function hasRawApprovalAliasConflict(policy: RawPolicy | undefined): boolean {
  return policy?.require_approval !== undefined && policy.approval_required !== undefined
}

function hasUnsafeObjectKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasUnsafeObjectKey)
  if (!isRecord(value)) return false

  return Object.keys(value).some((key) => isUnsafePolicyKey(key) || hasUnsafeObjectKey(value[key]))
}

function isRecord(value: unknown): value is { readonly [key: string]: unknown } {
  return typeof value === 'object' && value !== null
}

function isUnsafePolicyKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype'
}

function mergeMcpPolicy(defaultPolicy: McpPolicy, overridePolicy?: RawPolicy['mcp'], extensionPolicy?: RawPolicy['mcp']): McpPolicy {
  return {
    denyServers: unique(
      mergeList(defaultPolicy.denyServers, overridePolicy?.deny_servers, extensionPolicy?.deny_servers).map((server) =>
        server.toLowerCase(),
      ),
    ),
    requireApprovalTools: mergeList(
      defaultPolicy.requireApprovalTools,
      overridePolicy?.require_approval_tools,
      extensionPolicy?.require_approval_tools,
    ),
  }
}

function mergeList(
  defaultValues: readonly string[],
  overrideValues: readonly string[] | undefined,
  extensionValues: readonly string[] | undefined,
): readonly string[] {
  const baseValues = overrideValues ?? defaultValues
  return unique([...baseValues, ...(extensionValues ?? [])])
}

function clonePolicy(policy: Policy): Policy {
  return {
    denyRead: [...policy.denyRead],
    denyCommands: [...policy.denyCommands],
    requireApproval: [...policy.requireApproval],
    mcp: {
      denyServers: [...policy.mcp.denyServers],
      requireApprovalTools: [...policy.mcp.requireApprovalTools],
    },
  }
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}
