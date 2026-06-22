import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { isAlias, parseDocument, visit } from 'yaml'
import { hasDuplicateJsonObjectKey } from './json-policy.js'
import {
  approvalRules,
  deniedCommandRules,
  deniedReadRules,
  hasPolicyAliasConflict,
  mcpApprovalRules,
  mcpDeniedServerRules,
  mcpDeniedToolRules,
  ownPolicyValue,
  policyFileSchema,
  type PolicyFile,
  type RawMcpPolicy,
} from './policy-schema.js'
import { DEFAULT_POLICY, type McpPolicy, type Policy } from './rules.js'

const defaultPolicyFiles = ['agent-policy.yaml', 'agent-policy.yml', 'agent-policy.json'] as const
const policyKeyAliases: Readonly<Record<string, string>> = {
  'deny-read': 'deny_read',
  'denied-read': 'denied_read',
  'deny-reads': 'deny_reads',
  'denied-reads': 'denied_reads',
  'deny-commands': 'deny_commands',
  'denied-commands': 'denied_commands',
  'require-approval': 'require_approval',
  'require-approval-operations': 'require_approval_operations',
  'approval-required': 'approval_required',
  'approval-required-operations': 'approval_required_operations',
  'deny-servers': 'deny_servers',
  'denied-servers': 'denied_servers',
  'deny-tools': 'deny_tools',
  'denied-tools': 'denied_tools',
  'require-approval-tools': 'require_approval_tools',
  'approval-required-tools': 'approval_required_tools',
} as const

type PolicyLoadErrorReason = 'malformed' | 'missing' | 'unreadable' | 'unsupported'

export class PolicyLoadError extends Error {
  constructor(_path: string, reason: PolicyLoadErrorReason) {
    super(`Unable to load policy file: ${reason} policy file`)
    this.name = 'PolicyLoadError'
  }
}

export function loadPolicy(path?: string): Policy {
  const policyPath = path ?? discoverDefaultPolicyPath()
  if (!policyPath) return clonePolicy(DEFAULT_POLICY)
  if (!['.json', '.yaml', '.yml'].includes(extname(policyPath).toLowerCase())) throw new PolicyLoadError(policyPath, 'unsupported')

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
    parsed = normalizePolicyValue(parsePolicyContents(policyPath, contents))
  } catch (error: unknown) {
    if (error instanceof PolicyLoadError) throw error
    if (error instanceof Error) throw new PolicyLoadError(policyPath, 'malformed')
    throw error
  }

  const result = policyFileSchema.safeParse(parsed)
  if (!result.success || hasPolicyAliasConflict(result.data)) {
    throw new PolicyLoadError(policyPath, 'malformed')
  }

  return mergePolicy(DEFAULT_POLICY, result.data)
}

function discoverDefaultPolicyPath(): string | undefined {
  let dir = process.cwd()
  while (true) {
    for (const file of defaultPolicyFiles) {
      const path = join(dir, file)
      if (existsSync(path)) return path
    }

    const parentDir = dirname(dir)
    if (parentDir === dir) return undefined
    dir = parentDir
  }
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
  const document = parseDocument(contents, { merge: false, prettyErrors: false, resolveKnownTags: false, stringKeys: true, uniqueKeys: true })
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

function mergePolicy(defaultPolicy: Policy, userPolicy: PolicyFile): Policy {
  const overrides = ownPolicyValue(userPolicy, 'overrides')
  return {
    denyRead: mergeList(defaultPolicy.denyRead, deniedReadRules(overrides), deniedReadRules(userPolicy)),
    denyCommands: mergeList(defaultPolicy.denyCommands, deniedCommandRules(overrides), deniedCommandRules(userPolicy)),
    requireApproval: mergeList(defaultPolicy.requireApproval, approvalRules(overrides), approvalRules(userPolicy)),
    mcp: mergeMcpPolicy(defaultPolicy.mcp, ownPolicyValue(overrides, 'mcp'), ownPolicyValue(userPolicy, 'mcp')),
  }
}

function normalizePolicyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizePolicyValue)
  if (!isRecord(value)) return value

  const normalizedValue: Record<string, unknown> = Object.create(null)
  for (const [key, childValue] of Object.entries(value)) {
    const normalizedKey = normalizePolicyKey(key)
    if (isUnsafePolicyKey(normalizedKey) || Object.hasOwn(normalizedValue, normalizedKey)) {
      throw new SyntaxError('Unsafe policy key')
    }
    normalizedValue[normalizedKey] = normalizePolicyValue(childValue)
  }
  return normalizedValue
}

function isRecord(value: unknown): value is { readonly [key: string]: unknown } {
  return typeof value === 'object' && value !== null
}

function isUnsafePolicyKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype'
}

function normalizePolicyKey(key: string): string {
  return policyKeyAliases[key] ?? key
}

function mergeMcpPolicy(defaultPolicy: McpPolicy, overridePolicy?: RawMcpPolicy, extensionPolicy?: RawMcpPolicy): McpPolicy {
  return {
    denyServers: unique(mergeList(defaultPolicy.denyServers, mcpDeniedServerRules(overridePolicy), mcpDeniedServerRules(extensionPolicy)).map((server) => server.toLowerCase())),
    denyTools: mergeList(defaultPolicy.denyTools, mcpDeniedToolRules(overridePolicy), mcpDeniedToolRules(extensionPolicy)),
    requireApprovalTools: mergeList(defaultPolicy.requireApprovalTools, mcpApprovalRules(overridePolicy), mcpApprovalRules(extensionPolicy)),
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
      denyTools: [...policy.mcp.denyTools],
      requireApprovalTools: [...policy.mcp.requireApprovalTools],
    },
  }
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}
