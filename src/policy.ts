import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
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
const defaultPolicyFiles = ['agent-policy.yaml', 'agent-policy.json'] as const

type RawPolicy = z.infer<typeof rawPolicySchema>
type PolicyFile = z.infer<typeof policyFileSchema>

export class PolicyLoadError extends Error {
  readonly path: string

  constructor(path: string, reason: 'malformed' | 'unreadable') {
    super(`Unable to load policy file: ${reason} policy file`)
    this.name = 'PolicyLoadError'
    this.path = path
  }
}

export function loadPolicy(path?: string): Policy {
  const policyPath = path ?? discoverDefaultPolicyPath()
  if (!policyPath) return clonePolicy(DEFAULT_POLICY)

  let contents: string
  try {
    contents = readFileSync(policyPath, 'utf8')
  } catch (error: unknown) {
    if (error instanceof Error) throw new PolicyLoadError(policyPath, 'unreadable')
    throw error
  }

  let parsed: unknown
  try {
    parsed = parsePolicyContents(policyPath, contents)
  } catch (error: unknown) {
    if (error instanceof Error) throw new PolicyLoadError(policyPath, 'malformed')
    throw error
  }

  const result = policyFileSchema.safeParse(parsed ?? {})
  if (!result.success) throw new PolicyLoadError(policyPath, 'malformed')

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
  if (extname(path).toLowerCase() === '.json') return JSON.parse(contents)
  return parse(contents)
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
