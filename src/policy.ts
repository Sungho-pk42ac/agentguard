import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'
import { DEFAULT_POLICY, type McpPolicy, type Policy } from './rules.js'

const stringListSchema = z.array(z.string().min(1))

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
    mcp: rawMcpPolicySchema.optional(),
  })
  .strict()

const policyFileSchema = rawPolicySchema.extend({
  overrides: rawPolicySchema.optional(),
})

type RawPolicy = z.infer<typeof rawPolicySchema>
type PolicyFile = z.infer<typeof policyFileSchema>

export class PolicyLoadError extends Error {
  readonly path: string

  constructor(path: string, reason: 'malformed' | 'unreadable') {
    super(`Unable to load policy file ${path}: ${reason} policy file`)
    this.name = 'PolicyLoadError'
    this.path = path
  }
}

export function loadPolicy(path?: string): Policy {
  if (!path) return clonePolicy(DEFAULT_POLICY)

  let contents: string
  try {
    contents = readFileSync(path, 'utf8')
  } catch (error: unknown) {
    if (error instanceof Error) throw new PolicyLoadError(path, 'unreadable')
    throw error
  }

  let parsed: unknown
  try {
    parsed = parse(contents)
  } catch (error: unknown) {
    if (error instanceof Error) throw new PolicyLoadError(path, 'malformed')
    throw error
  }

  const result = policyFileSchema.safeParse(parsed ?? {})
  if (!result.success) throw new PolicyLoadError(path, 'malformed')

  return mergePolicy(DEFAULT_POLICY, result.data)
}

function mergePolicy(defaultPolicy: Policy, userPolicy: PolicyFile): Policy {
  const overrides = userPolicy.overrides
  return {
    denyRead: mergeList(defaultPolicy.denyRead, overrides?.deny_read, userPolicy.deny_read),
    denyCommands: mergeList(defaultPolicy.denyCommands, overrides?.deny_commands, userPolicy.deny_commands),
    requireApproval: mergeList(defaultPolicy.requireApproval, overrides?.require_approval, userPolicy.require_approval),
    mcp: mergeMcpPolicy(defaultPolicy.mcp, overrides?.mcp, userPolicy.mcp),
  }
}

function mergeMcpPolicy(defaultPolicy: McpPolicy, overridePolicy?: RawPolicy['mcp'], extensionPolicy?: RawPolicy['mcp']): McpPolicy {
  return {
    denyServers: mergeList(defaultPolicy.denyServers, overridePolicy?.deny_servers, extensionPolicy?.deny_servers),
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
