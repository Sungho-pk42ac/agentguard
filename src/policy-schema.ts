import { z } from 'zod'

const stringListSchema = z.array(z.string().trim().min(1))

const rawMcpPermissionSchema = z
  .object({
    deny_servers: stringListSchema.optional(),
    denied_servers: stringListSchema.optional(),
    denyServers: stringListSchema.optional(),
    deniedServers: stringListSchema.optional(),
    deny_tools: stringListSchema.optional(),
    denied_tools: stringListSchema.optional(),
    denyTools: stringListSchema.optional(),
    deniedTools: stringListSchema.optional(),
    require_approval_tools: stringListSchema.optional(),
    approval_required_tools: stringListSchema.optional(),
    require_approval: stringListSchema.optional(),
    approval_required: stringListSchema.optional(),
    requireApprovalTools: stringListSchema.optional(),
    approvalRequiredTools: stringListSchema.optional(),
    requireApproval: stringListSchema.optional(),
    approvalRequired: stringListSchema.optional(),
  })
  .strict()

const rawMcpPolicySchema = rawMcpPermissionSchema.extend({ permissions: rawMcpPermissionSchema.optional() }).strict()

const rawPolicySchema = z
  .object({
    deny_read: stringListSchema.optional(),
    deny_reads: stringListSchema.optional(),
    denied_reads: stringListSchema.optional(),
    denyRead: stringListSchema.optional(),
    deny_commands: stringListSchema.optional(),
    denied_commands: stringListSchema.optional(),
    denyCommands: stringListSchema.optional(),
    deniedCommands: stringListSchema.optional(),
    require_approval: stringListSchema.optional(),
    require_approval_operations: stringListSchema.optional(),
    approval_required: stringListSchema.optional(),
    approval_required_operations: stringListSchema.optional(),
    requireApproval: stringListSchema.optional(),
    requireApprovalOperations: stringListSchema.optional(),
    approvalRequired: stringListSchema.optional(),
    approvalRequiredOperations: stringListSchema.optional(),
    mcp: rawMcpPolicySchema.optional(),
  })
  .strict()

export const policyFileSchema = rawPolicySchema.extend({
  overrides: rawPolicySchema.optional(),
})

export type RawPolicy = z.infer<typeof rawPolicySchema>
export type RawMcpPermission = z.infer<typeof rawMcpPermissionSchema>
export type RawMcpPolicy = z.infer<typeof rawMcpPolicySchema>
export type PolicyFile = z.infer<typeof policyFileSchema>

export function deniedReadRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return (
    ownPolicyValue(policy, 'deny_read') ??
    ownPolicyValue(policy, 'deny_reads') ??
    ownPolicyValue(policy, 'denied_reads') ??
    ownPolicyValue(policy, 'denyRead')
  )
}

export function deniedCommandRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return (
    ownPolicyValue(policy, 'deny_commands') ??
    ownPolicyValue(policy, 'denied_commands') ??
    ownPolicyValue(policy, 'denyCommands') ??
    ownPolicyValue(policy, 'deniedCommands')
  )
}

export function approvalRules(policy: RawPolicy | undefined): readonly string[] | undefined {
  return (
    ownPolicyValue(policy, 'require_approval') ??
    ownPolicyValue(policy, 'require_approval_operations') ??
    ownPolicyValue(policy, 'approval_required') ??
    ownPolicyValue(policy, 'approval_required_operations') ??
    ownPolicyValue(policy, 'requireApproval') ??
    ownPolicyValue(policy, 'requireApprovalOperations') ??
    ownPolicyValue(policy, 'approvalRequired') ??
    ownPolicyValue(policy, 'approvalRequiredOperations')
  )
}

export function hasPolicyAliasConflict(policy: PolicyFile): boolean {
  return hasRawAliasConflict(policy) || hasRawAliasConflict(ownPolicyValue(policy, 'overrides'))
}

export function ownPolicyValue<T extends object, K extends keyof T>(policy: T | undefined, key: K): T[K] | undefined {
  if (policy === undefined || !Object.hasOwn(policy, key)) return undefined
  return policy[key]
}

export function mcpDeniedServerRules(policy: RawMcpPolicy | undefined): readonly string[] | undefined {
  return combineRuleLists(mcpPermissionDeniedServerRules(policy), mcpPermissionDeniedServerRules(ownPolicyValue(policy, 'permissions')))
}

export function mcpDeniedToolRules(policy: RawMcpPolicy | undefined): readonly string[] | undefined {
  return combineRuleLists(mcpPermissionDeniedToolRules(policy), mcpPermissionDeniedToolRules(ownPolicyValue(policy, 'permissions')))
}

export function mcpApprovalRules(policy: RawMcpPolicy | undefined): readonly string[] | undefined {
  return combineRuleLists(mcpPermissionApprovalRules(policy), mcpPermissionApprovalRules(ownPolicyValue(policy, 'permissions')))
}

function hasRawAliasConflict(policy: RawPolicy | undefined): boolean {
  return (
    hasAliasConflict([
      ownPolicyValue(policy, 'deny_read'),
      ownPolicyValue(policy, 'deny_reads'),
      ownPolicyValue(policy, 'denied_reads'),
      ownPolicyValue(policy, 'denyRead'),
    ]) ||
    hasAliasConflict([
      ownPolicyValue(policy, 'deny_commands'),
      ownPolicyValue(policy, 'denied_commands'),
      ownPolicyValue(policy, 'denyCommands'),
      ownPolicyValue(policy, 'deniedCommands'),
    ]) ||
    hasAliasConflict([
      ownPolicyValue(policy, 'require_approval'),
      ownPolicyValue(policy, 'require_approval_operations'),
      ownPolicyValue(policy, 'approval_required'),
      ownPolicyValue(policy, 'approval_required_operations'),
      ownPolicyValue(policy, 'requireApproval'),
      ownPolicyValue(policy, 'requireApprovalOperations'),
      ownPolicyValue(policy, 'approvalRequired'),
      ownPolicyValue(policy, 'approvalRequiredOperations'),
    ]) ||
    hasMcpAliasConflict(ownPolicyValue(policy, 'mcp'))
  )
}

function hasMcpAliasConflict(policy: RawMcpPolicy | undefined): boolean {
  return hasMcpPermissionAliasConflict(policy) || hasMcpPermissionAliasConflict(ownPolicyValue(policy, 'permissions'))
}

function hasMcpPermissionAliasConflict(policy: RawMcpPermission | undefined): boolean {
  return (
    hasAliasConflict([
      ownPolicyValue(policy, 'deny_servers'),
      ownPolicyValue(policy, 'denied_servers'),
      ownPolicyValue(policy, 'denyServers'),
      ownPolicyValue(policy, 'deniedServers'),
    ]) ||
    hasAliasConflict([
      ownPolicyValue(policy, 'deny_tools'),
      ownPolicyValue(policy, 'denied_tools'),
      ownPolicyValue(policy, 'denyTools'),
      ownPolicyValue(policy, 'deniedTools'),
    ]) ||
    hasAliasConflict([
      ownPolicyValue(policy, 'require_approval_tools'),
      ownPolicyValue(policy, 'approval_required_tools'),
      ownPolicyValue(policy, 'require_approval'),
      ownPolicyValue(policy, 'approval_required'),
      ownPolicyValue(policy, 'requireApprovalTools'),
      ownPolicyValue(policy, 'approvalRequiredTools'),
      ownPolicyValue(policy, 'requireApproval'),
      ownPolicyValue(policy, 'approvalRequired'),
    ])
  )
}

function hasAliasConflict(values: readonly (readonly string[] | undefined)[]): boolean {
  return values.filter((value) => value !== undefined).length > 1
}

function mcpPermissionDeniedServerRules(policy: RawMcpPermission | undefined): readonly string[] | undefined {
  return (
    ownPolicyValue(policy, 'deny_servers') ??
    ownPolicyValue(policy, 'denied_servers') ??
    ownPolicyValue(policy, 'denyServers') ??
    ownPolicyValue(policy, 'deniedServers')
  )
}

function mcpPermissionDeniedToolRules(policy: RawMcpPermission | undefined): readonly string[] | undefined {
  return (
    ownPolicyValue(policy, 'deny_tools') ??
    ownPolicyValue(policy, 'denied_tools') ??
    ownPolicyValue(policy, 'denyTools') ??
    ownPolicyValue(policy, 'deniedTools')
  )
}

function mcpPermissionApprovalRules(policy: RawMcpPermission | undefined): readonly string[] | undefined {
  return (
    ownPolicyValue(policy, 'require_approval_tools') ??
    ownPolicyValue(policy, 'approval_required_tools') ??
    ownPolicyValue(policy, 'require_approval') ??
    ownPolicyValue(policy, 'approval_required') ??
    ownPolicyValue(policy, 'requireApprovalTools') ??
    ownPolicyValue(policy, 'approvalRequiredTools') ??
    ownPolicyValue(policy, 'requireApproval') ??
    ownPolicyValue(policy, 'approvalRequired')
  )
}

function combineRuleLists(
  directValues: readonly string[] | undefined,
  permissionValues: readonly string[] | undefined,
): readonly string[] | undefined {
  if (directValues === undefined && permissionValues === undefined) return undefined
  return unique([...(directValues ?? []), ...(permissionValues ?? [])])
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}
