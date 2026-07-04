import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(repoRoot, 'scripts', 'postinstall.mjs')

function run(env: Record<string, string>): string {
  // stdin is a pipe (not a TTY) here, so the interactive browser prompt is
  // never reached — the script must print (or stay silent) and exit 0 fast.
  return execFileSync('node', [script], {
    encoding: 'utf8',
    input: '',
    env: { ...process.env, CI: '', AGENTGUARD_NO_POSTINSTALL: '', AGENTGUARD_FORCE_POSTINSTALL: '', ...env },
    timeout: 15_000,
  })
}

test('postinstall shows the GitHub star nudge (repo URL + star ask) when forced', () => {
  const out = run({ AGENTGUARD_FORCE_POSTINSTALL: '1' })
  assert.match(out, /github\.com\/Sungho-pk42ac\/agentguard/, 'prints the repo URL')
  assert.match(out, /(GitHub 스타|Star us on GitHub|⭐)/, 'asks for a star')
})

test('postinstall stays silent and exits 0 in non-interactive / CI installs', () => {
  // Default (piped stdout is not a TTY) → silent; also assert explicit CI is silent.
  assert.equal(run({}).trim(), '', 'silent on a non-TTY install')
  assert.equal(run({ CI: 'true' }).trim(), '', 'silent under CI=true')
})

test('postinstall honors the AGENTGUARD_NO_POSTINSTALL opt-out even when forced-ish', () => {
  // NO_POSTINSTALL wins over the normal (non-forced) path.
  assert.equal(run({ AGENTGUARD_NO_POSTINSTALL: '1' }).trim(), '', 'opt-out silences the nudge')
})
