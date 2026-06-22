import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { isAlias, parseDocument, visit } from 'yaml'
import { z } from 'zod'
import { hasDuplicateJsonObjectKey } from './json-policy.js'
import { DEFAULT_POLICY, type McpPolicy, type Policy } from './rules.js'

const stringListSchema = z.array(z.string().trim().min(1))

const rawMcpPermissionSchema = z
  .object({
    deny_servers: stringListSchema.optional(),
    denied_servers: stringListSchema.optional(),
    deny_tools: stringListSchema.optional(),
    denied_tools: stringListSchema.optional(),
    require_approval_tools: stringListSchema.optional(),
    approval_required_tools: stringListSchema.optional(),
    require_approval: stringListSchema.optional(),
    approval_required: stringListSchema.optional(),
  })
  .strict()

const rawMcpPolicySchema = rawMcpPermissionSchema.extend({ permissions: rawMcpPermissionSchema.optional() }).strict()

const rawPolicySchema = z
  .object({
    deny_read: stringListSchema.optional(),
    deny_reads: stringListSchema.optional(),
    denied_reads: stringListSchema.optional(),
    deny_commands: stringListSchema.optional(),
    denied_commands: stringListSchema.optional(),
    require_approval: stringListSchema.optional(), require_approval_operations: stringListSchema.optional(),
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
type RawMcpPermission = z.infer<typeof rawMcpPermissionSchema>
type RawMcpPolicy = z.infer<typeof rawMcpPolicySchema>
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

function deniedReadRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return ownPolicyValue(policy, 'deny_read') ?? ownPolicyValue(policy, 'deny_reads') ?? ownPolicyValue(policy, 'denied_reads')
}

function deniedCommandRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return ownPolicyValue(policy, 'deny_commands') ?? ownPolicyValue(policy, 'denied_commands')
}

function approvalRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return ownPolicyValue(policy, 'require_approval') ?? ownPolicyValue(policy, 'require_approval_operations') ?? ownPolicyValue(policy, 'approval_required') ?? ownPolicyValue(policy, 'approval_required_operations')
}

function hasPolicyAliasConflict(policy: PolicyFile): boolean {
  return hasRawAliasConflict(policy) || hasRawAliasConflict(ownPolicyValue(policy, 'overrides'))
}

function hasRawAliasConflict(policy: RawPolicy | undefined): boolean {
  return (
    hasAliasConflict([ownPolicyValue(policy, 'deny_read'), ownPolicyValue(policy, 'deny_reads'), ownPolicyValue(policy, 'denied_reads')]) ||
    hasAliasConflict([ownPolicyValue(policy, 'deny_commands'), ownPolicyValue(policy, 'denied_commands')]) ||
    hasAliasConflict([ownPolicyValue(policy, 'require_approval'), ownPolicyValue(policy, 'require_approval_operations'), ownPolicyValue(policy, 'approval_required'), ownPolicyValue(policy, 'approval_required_operations')]) ||
    hasMcpAliasConflict(ownPolicyValue(policy, 'mcp'))
  )
}

function hasMcpAliasConflict(policy: RawMcpPolicy | undefined): boolean {
  return hasMcpPermissionAliasConflict(policy) || hasMcpPermissionAliasConflict(ownPolicyValue(policy, 'permissions'))
}

function hasMcpPermissionAliasConflict(policy: RawMcpPermission | undefined): boolean {
  return (
    hasAliasConflict([ownPolicyValue(policy, 'deny_servers'), ownPolicyValue(policy, 'denied_servers')]) ||
    hasAliasConflict([ownPolicyValue(policy, 'deny_tools'), ownPolicyValue(policy, 'denied_tools')]) ||
    hasAliasConflict([
      ownPolicyValue(policy, 'require_approval_tools'),
      ownPolicyValue(policy, 'approval_required_tools'),
      ownPolicyValue(policy, 'require_approval'),
      ownPolicyValue(policy, 'approval_required'),
    ])
  )
}

function hasAliasConflict(values: readonly (readonly string[] | undefined)[]): boolean { return values.filter((value) => value !== undefined).length > 1 }

function normalizePolicyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizePolicyValue)
  if (!isRecord(value)) return value

  const normalizedValue: Record<string, unknown> = Object.create(null)
  for (const [key, childValue] of Object.entries(value)) {
    if (isUnsafePolicyKey(key)) throw new SyntaxError('Unsafe policy key')
    normalizedValue[key] = normalizePolicyValue(childValue)
  }
  return normalizedValue
}

function isRecord(value: unknown): value is { readonly [key: string]: unknown } {
  return typeof value === 'object' && value !== null
}

function isUnsafePolicyKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype'
}

function ownPolicyValue<T extends object, K extends keyof T>(policy: T | undefined, key: K): T[K] | undefined {
  if (policy === undefined || !Object.hasOwn(policy, key)) return undefined
  return policy[key]
}

function mergeMcpPolicy(defaultPolicy: McpPolicy, overridePolicy?: RawMcpPolicy, extensionPolicy?: RawMcpPolicy): McpPolicy {
  return {
    denyServers: unique(mergeList(defaultPolicy.denyServers, mcpDeniedServerRules(overridePolicy), mcpDeniedServerRules(extensionPolicy)).map((server) => server.toLowerCase())),
    denyTools: mergeList(defaultPolicy.denyTools, mcpDeniedToolRules(overridePolicy), mcpDeniedToolRules(extensionPolicy)),
    requireApprovalTools: mergeList(defaultPolicy.requireApprovalTools, mcpApprovalRules(overridePolicy), mcpApprovalRules(extensionPolicy)),
  }
}

function mcpDeniedServerRules(policy: RawMcpPolicy | undefined): readonly string[] | undefined {
  return combineRuleLists(mcpPermissionDeniedServerRules(policy), mcpPermissionDeniedServerRules(ownPolicyValue(policy, 'permissions')))
}

function mcpDeniedToolRules(policy: RawMcpPolicy | undefined): readonly string[] | undefined {
  return combineRuleLists(mcpPermissionDeniedToolRules(policy), mcpPermissionDeniedToolRules(ownPolicyValue(policy, 'permissions')))
}

function mcpApprovalRules(policy: RawMcpPolicy | undefined): readonly string[] | undefined {
  return combineRuleLists(mcpPermissionApprovalRules(policy), mcpPermissionApprovalRules(ownPolicyValue(policy, 'permissions')))
}

function mcpPermissionDeniedServerRules(policy: RawMcpPermission | undefined): readonly string[] | undefined {
  return ownPolicyValue(policy, 'deny_servers') ?? ownPolicyValue(policy, 'denied_servers')
}

function mcpPermissionDeniedToolRules(policy: RawMcpPermission | undefined): readonly string[] | undefined {
  return ownPolicyValue(policy, 'deny_tools') ?? ownPolicyValue(policy, 'denied_tools')
}

function mcpPermissionApprovalRules(policy: RawMcpPermission | undefined): readonly string[] | undefined {
  return ownPolicyValue(policy, 'require_approval_tools') ?? ownPolicyValue(policy, 'approval_required_tools') ?? ownPolicyValue(policy, 'require_approval') ?? ownPolicyValue(policy, 'approval_required')
}

function mergeList(
  defaultValues: readonly string[],
  overrideValues: readonly string[] | undefined,
  extensionValues: readonly string[] | undefined,
): readonly string[] {
  const baseValues = overrideValues ?? defaultValues
  return unique([...baseValues, ...(extensionValues ?? [])])
}

function combineRuleLists(
  directValues: readonly string[] | undefined,
  permissionValues: readonly string[] | undefined,
): readonly string[] | undefined {
  if (directValues === undefined && permissionValues === undefined) return undefined
  return unique([...(directValues ?? []), ...(permissionValues ?? [])])
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
