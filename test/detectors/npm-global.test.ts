import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aiCliResiduals,
  parseNpmGlobalList,
  scanNpmGlobal,
} from '../../src/detectors/npm-global.js'

const SAMPLE = JSON.stringify({
  name: 'root',
  dependencies: {
    '@openai/codex': { version: '1.2.3' },
    '@anthropic-ai/claude-code': { version: '0.9.0' },
    typescript: { version: '6.0.3' },
    prettier: { version: '3.0.0' },
  },
})

test('parseNpmGlobalList flattens the dependencies map', () => {
  const list = parseNpmGlobalList(SAMPLE)
  assert.equal(list.length, 4)
  assert.deepEqual(
    list.find((p) => p.name === '@openai/codex'),
    { name: '@openai/codex', version: '1.2.3' },
  )
})

test('parseNpmGlobalList tolerates malformed JSON and missing dependencies', () => {
  assert.deepEqual(parseNpmGlobalList('not json'), [])
  assert.deepEqual(parseNpmGlobalList('{}'), [])
  assert.deepEqual(parseNpmGlobalList('{"dependencies":null}'), [])
})

test('aiCliResiduals reports only allowlisted AI CLIs and filters the rest', () => {
  const residuals = aiCliResiduals(parseNpmGlobalList(SAMPLE))
  const names = residuals.map((r) => r.location)
  assert.ok(names.includes('npm-global:@openai/codex'))
  assert.ok(names.includes('npm-global:@anthropic-ai/claude-code'))
  assert.ok(!names.some((n) => n.includes('typescript')))
  assert.ok(!names.some((n) => n.includes('prettier')))
  assert.equal(residuals[0].kind, 'config')
  assert.match(residuals.find((r) => r.location.includes('codex'))!.evidence, /1\.2\.3/)
})

test('scanNpmGlobal uses an injected runner and reports AI CLIs', () => {
  const residuals = scanNpmGlobal({ run: () => ({ stdout: SAMPLE, status: 1 }) })
  assert.equal(residuals.length, 2)
})

test('scanNpmGlobal skips gracefully when npm is missing (ENOENT)', () => {
  const err = Object.assign(new Error('spawn npm ENOENT'), { code: 'ENOENT' })
  const residuals = scanNpmGlobal({ run: () => ({ stdout: '', status: null, error: err }) })
  assert.deepEqual(residuals, [])
})

test('scanNpmGlobal skips gracefully when the runner throws', () => {
  const residuals = scanNpmGlobal({
    run: () => {
      throw new Error('boom')
    },
  })
  assert.deepEqual(residuals, [])
})
