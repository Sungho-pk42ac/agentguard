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
  readonly engines?: Record<string, string>
  readonly author?: string
  readonly scripts?: Record<string, string>
}

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as PackageJson

test('npm package metadata links users to the source, issues, and product category', () => {
  assert.equal(packageJson.name, '@pk42ac/agentguard')
  assert.equal(packageJson.bin?.agentguard, 'dist/index.js')
  assert.ok(!packageJson.bin?.agentguard.startsWith('./'), 'bin path should have no leading "./" so npm publish does not auto-correct it')
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

test('npm package metadata is hardened for first npm publish', () => {
  assert.equal(packageJson.engines?.node, '>=20')
  assert.ok(packageJson.author && packageJson.author.trim().length > 0, 'author should be a non-empty string')
  assert.ok(packageJson.scripts?.prepublishOnly?.includes('typecheck'), 'prepublishOnly should run typecheck')
  assert.ok(packageJson.scripts?.prepublishOnly?.includes('build'), 'prepublishOnly should run build')
})

test('CHANGELOG documents the v0.2.0 release', () => {
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
  assert.match(changelog, /^## \[Unreleased\]/m, 'CHANGELOG should keep an empty Unreleased stub at the top')
  assert.match(changelog, /^## \[0\.2\.0\]/m, 'CHANGELOG should have a heading promoting Unreleased to 0.2.0')
})
test('runtime dependencies are exactly the expected set — no new packages added', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { dependencies?: Record<string, string> }
  const deps = Object.keys(pkg.dependencies ?? {}).sort()
  assert.deepEqual(deps, ['ink', 'react', 'yaml', 'zod'], `expected exactly {ink, react, yaml, zod} but got {${deps.join(', ')}}`)
})
