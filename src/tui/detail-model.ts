import type { Severity } from '../rules.js'

/**
 * KO rationale shown for each severity level in the detail panel.
 * These are presentation-only strings — no scan or severity logic.
 */
export const severityRationaleKO: Record<Severity, string> = {
  critical: '즉각적인 보안 위협 — 키 노출 또는 전체 접근 권한',
  high: '높은 위험 — 빠른 조치 필요',
  medium: '중간 위험 — 구성 검토 권장',
  low: '낮은 위험 — 모범 사례 개선',
}

/**
 * KO remediation hint keyed by surface/category.
 * Callers fall back to item.recommendation when the surface is absent ('unknown').
 */
export const categoryRemediationKO: Readonly<Record<string, string>> = {
  // secret / AI tool directory → key rotation
  secret: '키 회전 후 이전 키 즉시 폐기',
  'ai-tool-dir': '키 회전 후 이전 키 즉시 폐기',
  // sensitive / project files → delete or gitignore
  'sensitive-file': '파일 삭제 또는 .gitignore에 추가',
  'project-file': '파일 삭제 또는 .gitignore에 추가',
  // MCP / agent config → reduce permissions
  'mcp-risk': '에이전트 권한 축소 및 최소 권한 원칙 적용',
  'agent-config': '에이전트 권한 축소 및 최소 권한 원칙 적용',
  // npm global → logout + remove
  'npm-global': 'npm 로그아웃 후 해당 패키지 제거',
  // PII → delete or pseudonymise
  pii: '개인정보 제거 또는 가명화 처리',
}

/**
 * Returns the KO remediation for a surface, or '' when the surface is unknown.
 * Callers SHOULD fall back to item.recommendation when the return value is ''.
 */
export function lookupCategoryRemediation(surface: string): string {
  return categoryRemediationKO[surface] ?? ''
}
