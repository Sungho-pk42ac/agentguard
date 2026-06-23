import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

interface PackageJson {
  readonly name?: string
  readonly bin?: Record<string, string>
  readonly files?: readonly string[]
  readonly repository?: { readonly type?: string; readonly url?: string }
  readonly bugs?: { readonly url?: string }
  readonly homepage?: string
  readonly keywords?: readonly string[]
}

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as PackageJson

test('npm package metadata links users to the source, issues, and product category', () => {
  assert.equal(packageJson.name, 'agentguard')
  assert.equal(packageJson.bin?.agentguard, './dist/index.js')
  assert.ok(packageJson.files?.includes('dist'))
  assert.ok(packageJson.files?.includes('examples'))

  assert.equal(packageJson.repository?.type, 'git')
  assert.equal(packageJson.repository?.url, 'git+https://github.com/Sungho-pk42ac/agentguard.git')
  assert.equal(packageJson.bugs?.url, 'https://github.com/Sungho-pk42ac/agentguard/issues')
  assert.equal(packageJson.homepage, 'https://github.com/Sungho-pk42ac/agentguard#readme')
  assert.ok(packageJson.keywords?.includes('agentops'))
  assert.ok(packageJson.keywords?.includes('mcp'))
  assert.ok(packageJson.keywords?.includes('security'))
})
