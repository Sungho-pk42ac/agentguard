import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { isAlias, parseDocument, visit } from 'yaml'
import { z } from 'zod'
import { hasDuplicateJsonObjectKey } from './json-policy.js'
import { DEFAULT_POLICY, type McpPolicy, type Policy } from './rules.js'

const stringListSchema = z.array(z.string().trim().min(1))

const rawMcpPolicySchema = z
  .object({
    deny_servers: stringListSchema.optional(),
    denied_servers: stringListSchema.optional(),
    deny_tools: stringListSchema.optional(),
    denied_tools: stringListSchema.optional(),
    require_approval_tools: stringListSchema.optional(),
    require_approval: stringListSchema.optional(),
    approval_required: stringListSchema.optional(),
  })
  .strict()

const rawPolicySchema = z
  .object({
    deny_read: stringListSchema.optional(),
    deny_reads: stringListSchema.optional(),
    denied_reads: stringListSchema.optional(),
    deny_commands: stringListSchema.optional(),
    denied_commands: stringListSchema.optional(),
    require_approval: stringListSchema.optional(),
    approval_required: stringListSchema.optional(),
    approval_required_operations: stringListSchema.optional(),
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
  constructor(_path: string, reason: PolicyLoadErrorReason) {
    super(`Unable to load policy file: ${reason} policy file`)
    this.name = 'PolicyLoadError'
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
  if (hasUnsafeObjectKey(parsed) || !result.success || hasPolicyAliasConflict(result.data)) {
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

function mergePolicy(defaultPolicy: Policy, userPolicy: PolicyFile): Policy {
  const overrides = userPolicy.overrides
  return {
    denyRead: mergeList(defaultPolicy.denyRead, deniedReadRules(overrides), deniedReadRules(userPolicy)),
    denyCommands: mergeList(defaultPolicy.denyCommands, deniedCommandRules(overrides), deniedCommandRules(userPolicy)),
    requireApproval: mergeList(defaultPolicy.requireApproval, approvalRules(overrides), approvalRules(userPolicy)),
    mcp: mergeMcpPolicy(defaultPolicy.mcp, overrides?.mcp, userPolicy.mcp),
  }
}

function deniedReadRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return policy?.deny_read ?? policy?.deny_reads ?? policy?.denied_reads
}

function deniedCommandRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return policy?.deny_commands ?? policy?.denied_commands
}

function approvalRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return policy?.require_approval ?? policy?.approval_required ?? policy?.approval_required_operations
}

function hasPolicyAliasConflict(policy: PolicyFile): boolean {
  return hasRawAliasConflict(policy) || hasRawAliasConflict(policy.overrides)
}

function hasRawAliasConflict(policy: RawPolicy | undefined): boolean {
  return (
    hasAliasConflict([policy?.deny_read, policy?.deny_reads, policy?.denied_reads]) ||
    hasAliasConflict([policy?.deny_commands, policy?.denied_commands]) ||
    hasAliasConflict([policy?.require_approval, policy?.approval_required, policy?.approval_required_operations]) ||
    hasMcpAliasConflict(policy?.mcp)
  )
}

function hasMcpAliasConflict(policy: RawPolicy['mcp'] | undefined): boolean {
  return (
    hasAliasConflict([policy?.deny_servers, policy?.denied_servers]) ||
    hasAliasConflict([policy?.deny_tools, policy?.denied_tools]) ||
    hasAliasConflict([policy?.require_approval_tools, policy?.require_approval, policy?.approval_required])
  )
}

function hasAliasConflict(values: readonly (readonly string[] | undefined)[]): boolean {
  return values.filter((value) => value !== undefined).length > 1
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
      mergeList(defaultPolicy.denyServers, mcpDeniedServerRules(overridePolicy), mcpDeniedServerRules(extensionPolicy)).map(
        (server) => server.toLowerCase(),
      ),
    ),
    denyTools: mergeList(defaultPolicy.denyTools, mcpDeniedToolRules(overridePolicy), mcpDeniedToolRules(extensionPolicy)),
    requireApprovalTools: mergeList(
      defaultPolicy.requireApprovalTools,
      mcpApprovalRules(overridePolicy),
      mcpApprovalRules(extensionPolicy),
    ),
  }
}

function mcpDeniedServerRules(policy: RawPolicy['mcp'] | undefined): readonly string[] | undefined {
  return policy?.deny_servers ?? policy?.denied_servers
}

function mcpDeniedToolRules(policy: RawPolicy['mcp'] | undefined): readonly string[] | undefined {
  return policy?.deny_tools ?? policy?.denied_tools
}

function mcpApprovalRules(policy: RawPolicy['mcp'] | undefined): readonly string[] | undefined {
  return policy?.require_approval_tools ?? policy?.require_approval ?? policy?.approval_required
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
