import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scanText } from '../src/scanner.js'

test('detects standalone npm access tokens in text and redacts evidence', () => {
  const key = `npm_${'A'.repeat(32)}wxyz`
  const findings = scanText(`NPM_TOKEN=${key}`)

  const finding = findings.find((candidate) => candidate.id === 'npm-token')
  assert.ok(finding, 'expected an npm-token finding')
  assert.equal(finding.severity, 'critical')
  assert.equal(finding.category, 'secret')
  assert.notEqual(finding.evidence, key)
  assert.equal(finding.evidence, 'npm_…wxyz')
})

test('detects unquoted npmrc auth tokens', () => {
  const key = `npm_${'B'.repeat(32)}wxyz`
  const findings = scanText(`//registry.npmjs.org/:_authToken=${key}`)

  const finding = findings.find((candidate) => candidate.id === 'npm-token')
  assert.ok(finding, 'expected an npm-token finding in npmrc auth token text')
  assert.equal(finding.evidence, 'npm_…wxyz')
})

test('does not report npm access tokens through the generic secret assignment pattern', () => {
  const key = `npm_${'C'.repeat(32)}wxyz`
  const findings = scanText(`NPM_TOKEN="${key}"`)

  assert.equal(findings.filter((finding) => finding.id === 'npm-token').length, 1)
  assert.ok(!findings.some((finding) => finding.id === 'generic-secret-assignment'))
})

test('does not duplicate quoted npm access tokens with trailing whitespace', () => {
  const key = `npm_${'C'.repeat(32)}wxyz`
  const findings = scanText(`NPM_TOKEN="${key} "`)

  assert.equal(findings.filter((finding) => finding.id === 'npm-token').length, 1)
  assert.ok(!findings.some((finding) => finding.id === 'generic-secret-assignment'))
})

test('falls back to generic secret assignment for uppercase npm-token lookalikes', () => {
  const key = `NPM_${'C'.repeat(32)}wxyz`
  const findings = scanText(`NPM_TOKEN="${key}"`)

  assert.ok(!findings.some((finding) => finding.id === 'npm-token'))
  assert.ok(findings.some((finding) => finding.id === 'generic-secret-assignment'))
})

test('does not partially match short overlong or embedded npm token lookalikes', () => {
  const key = `npm_${'D'.repeat(32)}wxyz`
  const short = `npm_${'E'.repeat(35)}`
  const overlong = `${key}A`
  const findings = scanText(`debug markers: ${short} ${overlong} prefix${key} ${key}suffix`)

  assert.ok(!findings.some((finding) => finding.id === 'npm-token'))
  assert.ok(!findings.some((finding) => finding.evidence.includes('wxyz')))
})
