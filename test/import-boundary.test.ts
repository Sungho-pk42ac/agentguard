import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// Structural import-boundary guard (plan §M3 / CR7).
//
// The main CLI/TUI package (src/) MUST stay independent of the separate web/
// (Next.js) and editors/ (VS Code) packages: they have their own deps and
// their own toolchains, and the main deps lock ({ink,react,yaml,zod}) must not
// be widened by anything they pull in. This test enforces that:
//   1. the main tsconfig excludes web/ and editors/, and its compile scope is
//      src-only (so a stray build never drags them in), and
//   2. no source file under src/ imports from web/ or editors/ (or their
//      published package names).

const testDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = join(testDir, '..')
const srcDir = join(repoRoot, 'src')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

test('main tsconfig is src-scoped and explicitly excludes web/ and editors/', () => {
  const tsconfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.json'), 'utf8')) as {
    include?: string[]
    exclude?: string[]
    compilerOptions?: { rootDir?: string }
  }
  const include = tsconfig.include ?? []
  assert.ok(
    include.every((g) => g.startsWith('src/')),
    `main tsconfig include must be src-scoped, got: ${JSON.stringify(include)}`,
  )
  assert.equal(tsconfig.compilerOptions?.rootDir, 'src', 'main tsconfig rootDir must be src')
  const exclude = tsconfig.exclude ?? []
  assert.ok(exclude.includes('web'), 'main tsconfig must explicitly exclude web/')
  assert.ok(exclude.includes('editors'), 'main tsconfig must explicitly exclude editors/')
})

test('no src/ file imports from the web/ or editors/ packages (one-way boundary)', () => {
  const files = walk(srcDir)
  assert.ok(files.length > 0, 'expected source files under src/')
  // Matches: import ... from '.../web/...', '@/...web', the published web/editor
  // package names, or any relative climb into ../web or ../editors.
  const forbidden = /from\s+['"](?:[^'"]*\/)?(?:web|editors)\/|from\s+['"]@pk42ac\/agentguard-(?:web|vscode)['"]|from\s+['"](?:\.\.\/)+(?:web|editors)(?:\/|['"])/
  const offenders: string[] = []
  for (const file of files) {
    const body = readFileSync(file, 'utf8')
    if (forbidden.test(body)) offenders.push(file.slice(repoRoot.length + 1))
  }
  assert.deepEqual(offenders, [], `src/ must not import from web/ or editors/; offenders: ${offenders.join(', ')}`)
})

test('the web/ package is a separate package with its own name and Next.js dep (not in main deps)', () => {
  const webPkg = JSON.parse(readFileSync(join(repoRoot, 'web', 'package.json'), 'utf8')) as {
    name?: string
    dependencies?: Record<string, string>
  }
  assert.equal(webPkg.name, '@pk42ac/agentguard-web')
  assert.ok(webPkg.dependencies?.next, 'web/ owns the Next.js dependency')
  const mainPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
  }
  const mainDeps = Object.keys(mainPkg.dependencies ?? {})
  assert.deepEqual(mainDeps.sort(), ['ink', 'react', 'yaml', 'zod'], 'main runtime deps stay locked; web deps never leak in')
  assert.ok(!('next' in (mainPkg.dependencies ?? {})), 'next must never appear in the main package deps')
})

test('the editors/vscode package is a separate package with no runtime deps and never leaks into main', () => {
  const extPkg = JSON.parse(readFileSync(join(repoRoot, 'editors', 'vscode', 'package.json'), 'utf8')) as {
    name?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  assert.equal(extPkg.name, '@pk42ac/agentguard-vscode')
  // The extension shells out to the installed agentguard CLI; it must carry NO
  // runtime dependencies (only dev types/toolchain).
  assert.deepEqual(Object.keys(extPkg.dependencies ?? {}), [], 'editors/vscode has zero runtime dependencies')
  assert.ok(extPkg.devDependencies?.['@types/vscode'], 'editors/vscode dev-depends on @types/vscode')
  const mainPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
  }
  assert.ok(!('@types/vscode' in (mainPkg.dependencies ?? {})), '@types/vscode must never appear in main deps')
})
