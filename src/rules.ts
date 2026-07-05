export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface Finding {
  id: string
  title: string
  severity: Severity
  category: 'secret' | 'pii' | 'dangerous-command' | 'sensitive-file' | 'mcp-risk' | 'supply-chain' | 'agent-behavior'
  file?: string
  line?: number
  evidence: string
  recommendation: string
  // [R3/NEW-CR-1] REVIEW-tier marker: excluded from severity-gated exit codes,
  // vuln counts, and executive/severity aggregates. Absent/false = normal finding.
  advisory?: boolean
}

export interface McpPolicy {
  readonly denyServers: readonly string[]
  readonly denyTools: readonly string[]
  readonly requireApprovalTools: readonly string[]
}

export interface Policy {
  readonly denyRead: readonly string[]
  readonly denyCommands: readonly string[]
  readonly requireApproval: readonly string[]
  readonly mcp: McpPolicy
}

export const DEFAULT_POLICY: Policy = {
  denyRead: ['.env', '.env.*', '**/.env*', '**/id_rsa', '**/auth.json', '**/credentials.json', '**/.ssh/**'],
  denyCommands: ['rm -rf', 'git push --force', 'gh secret view', 'printenv', 'cat .env'],
  requireApproval: ['deploy', 'db:migrate', 'supabase db push', 'vercel --prod', 'gh workflow edit'],
  mcp: {
    denyServers: ['filesystem', 'postgres', 'supabase', 'github', 'slack', 'google', 'drive'],
    denyTools: [],
    requireApprovalTools: [],
  },
}

export const SECRET_PATTERNS: Array<{ id: string; title: string; re: RegExp }> = [
  { id: 'openai-key', title: 'OpenAI-style API key', re: /(?<![0-9A-Za-z_\-])sk-(?!ant-)[A-Za-z0-9_\-]{20,}(?![0-9A-Za-z_\-])/g },
  { id: 'anthropic-api-key', title: 'Anthropic API key', re: /(?<![0-9A-Za-z_\-])sk-ant-[0-9A-Za-z_\-]{20,}(?![0-9A-Za-z_\-])/g },
  { id: 'github-token', title: 'GitHub token', re: /(?<![0-9A-Za-z_])(?:gh[pousr]_[A-Za-z0-9]{20,40}|github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59})(?![0-9A-Za-z_])/g },
  { id: 'npm-token', title: 'npm access token', re: /(?<![0-9A-Za-z_])npm_[A-Za-z0-9]{36}(?![0-9A-Za-z_])/g },
  { id: 'google-api-key', title: 'Google API key', re: /(?<![0-9A-Za-z_\-])AIzaSy[0-9A-Za-z_\-]{33,34}(?![0-9A-Za-z_\-])/g },
  { id: 'aws-access-key', title: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/g },
  { id: 'private-key', title: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: 'generic-secret-assignment', title: 'Hardcoded secret assignment', re: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\n]{12,}['"]/gi },
]

export const PII_PATTERNS: Array<{ id: string; title: string; re: RegExp }> = [
  { id: 'kr-phone', title: 'Korean phone number', re: /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g },
  { id: 'email', title: 'Email address', re: /[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,255}\.[A-Z]{2,24}/gi },
  { id: 'kr-rrn-like', title: 'Korean resident-registration-like number', re: /\d{6}[-\s]?[1-4]\d{6}/g },
]

export const SENSITIVE_FILE_RE = /(^|\/)(\.env(\..*)?|id_rsa|id_ed25519|auth\.json|credentials\.json|\.npmrc|\.pypirc)$/

export function severityScore(severity: Severity): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity]
}
