import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const deployDir = join(repoRoot, 'deploy')

function readDeployFile(path: string): string {
  return readFileSync(join(deployDir, path), 'utf8')
}

test('self-host compose keeps database passwords in env vars, not inline placeholders', () => {
  const compose = readDeployFile('docker-compose.yml')

  assert.equal(compose.includes('***'), false, 'compose must not contain redaction placeholders as runtime values')
  assert.match(compose, /DATABASE_URL:\s*postgres:\/\/agentguard_api:\$\{POSTGRES_API_PASSWORD\}@postgres:5432\/\$\{POSTGRES_DB:-agentguard\}/)
  assert.match(compose, /MIGRATE_DATABASE_URL:\s*postgres:\/\/\$\{POSTGRES_USER:-agentguard_admin\}:\$\{POSTGRES_PASSWORD\}@postgres:5432\/\$\{POSTGRES_DB:-agentguard\}/)
})

test('self-host env example exists and documents secret-only placeholders', () => {
  const envExamplePath = join(deployDir, '.env.example')
  assert.equal(existsSync(envExamplePath), true, 'docs/self-hosting.md quick start references deploy/.env.example')

  const envExample = readFileSync(envExamplePath, 'utf8')
  assert.match(envExample, /^POSTGRES_PASSWORD=change-me-owner-password$/m)
  assert.match(envExample, /^POSTGRES_API_PASSWORD=change-me-api-password$/m)
  assert.match(envExample, /^AGENTGUARD_CP_VIEWER_KEYS=\{\}$/m)
  assert.doesNotMatch(envExample, /sk-[A-Za-z0-9_-]{20,}|AIzaSy|github_pat_|gh[pousr]_[A-Za-z0-9]/)
})
