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
}

export interface Policy {
  denyRead: string[]
  denyCommands: string[]
  requireApproval: string[]
}

export const DEFAULT_POLICY: Policy = {
  denyRead: ['.env', '.env.*', '**/.env*', '**/id_rsa', '**/auth.json', '**/credentials.json', '**/.ssh/**'],
  denyCommands: ['rm -rf', 'git push --force', 'gh secret view', 'printenv', 'cat .env'],
  requireApproval: ['deploy', 'db:migrate', 'supabase db push', 'vercel --prod', 'gh workflow edit'],
}

export const SECRET_PATTERNS: Array<{ id: string; title: string; re: RegExp }> = [
  { id: 'openai-key', title: 'OpenAI-style API key', re: /sk-[A-Za-z0-9_\-]{20,}/g },
  { id: 'github-token', title: 'GitHub token', re: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { id: 'aws-access-key', title: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/g },
  { id: 'private-key', title: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: 'generic-secret-assignment', title: 'Hardcoded secret assignment', re: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\n]{12,}['"]/gi },
]

export const PII_PATTERNS: Array<{ id: string; title: string; re: RegExp }> = [
  { id: 'kr-phone', title: 'Korean phone number', re: /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g },
  { id: 'email', title: 'Email address', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { id: 'kr-rrn-like', title: 'Korean resident-registration-like number', re: /\d{6}[-\s]?[1-4]\d{6}/g },
]

export const SENSITIVE_FILE_RE = /(^|\/)(\.env(\..*)?|id_rsa|id_ed25519|auth\.json|credentials\.json|\.npmrc|\.pypirc)$/

export function severityScore(severity: Severity): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity]
}
