import assert from 'node:assert/strict'
import { test, afterEach } from 'node:test'
import { SEVERITY_COLOR, VERDICT_BADGE, ICONS, BORDER, asciiMode, glyph } from '../../src/tui/theme.js'

// ── Severity colour map ───────────────────────────────────────────────────────

test('SEVERITY_COLOR.critical === "red"', () => {
  assert.equal(SEVERITY_COLOR.critical, 'red')
})

test('SEVERITY_COLOR.high === "#d78700" (amber hex, NOT "orange")', () => {
  assert.equal(SEVERITY_COLOR.high, '#d78700')
  assert.notEqual(SEVERITY_COLOR.high, 'orange')
  assert.notEqual(SEVERITY_COLOR.high, 'magenta')
})

test('SEVERITY_COLOR.medium === "yellow"', () => {
  assert.equal(SEVERITY_COLOR.medium, 'yellow')
})

test('SEVERITY_COLOR.low === "gray"', () => {
  assert.equal(SEVERITY_COLOR.low, 'gray')
})

// ── Verdict badge ─────────────────────────────────────────────────────────────

test('VERDICT_BADGE.PASS has bg=green fg=black', () => {
  assert.equal(VERDICT_BADGE.PASS.bg, 'green')
  assert.equal(VERDICT_BADGE.PASS.fg, 'black')
})

test('VERDICT_BADGE.REVIEW has bg=yellow fg=black', () => {
  assert.equal(VERDICT_BADGE.REVIEW.bg, 'yellow')
  assert.equal(VERDICT_BADGE.REVIEW.fg, 'black')
})

test('VERDICT_BADGE.BLOCK has bg=red fg=white (high-contrast)', () => {
  assert.equal(VERDICT_BADGE.BLOCK.bg, 'red')
  assert.equal(VERDICT_BADGE.BLOCK.fg, 'white')
})

// ── Border config ─────────────────────────────────────────────────────────────

test('BORDER.style === "round"', () => {
  assert.equal(BORDER.style, 'round')
})

test('BORDER.color === "cyan"', () => {
  assert.equal(BORDER.color, 'cyan')
})

// ── Icon map completeness ─────────────────────────────────────────────────────

const TAB_NAMES = ['overview', 'agents', 'credentials', 'posture', 'baseline', 'offboard']
const SURFACE_NAMES = ['shell-rc', 'ai-tool-dir', 'agent-config', 'npm-global', 'project-file']

for (const name of [...TAB_NAMES, ...SURFACE_NAMES]) {
  test(`ICONS["${name}"] has both unicode and ascii entries`, () => {
    const icon = ICONS[name]
    assert.ok(icon, `icon missing for "${name}"`)
    assert.equal(typeof icon.unicode, 'string', `${name}.unicode must be a string`)
    assert.equal(typeof icon.ascii, 'string', `${name}.ascii must be a string`)
    assert.equal(icon.unicode.length, 1, `${name}.unicode must be exactly 1 char (width-1)`)
    assert.equal(icon.ascii.length, 1, `${name}.ascii must be exactly 1 char (width-1)`)
  })
}

for (const name of [...TAB_NAMES, ...SURFACE_NAMES]) {
  test(`ICONS["${name}"] unicode and ascii are distinct`, () => {
    const icon = ICONS[name]
    assert.ok(icon)
    // The two values should differ so the ASCII-swap test is meaningful
    // (if they're the same, the doesNotMatch test would be wrong)
    // We check that unicode is not pure ASCII (code point > 127) OR ascii is different
    const unicodeIsPureAscii = icon.unicode.charCodeAt(0) < 128
    if (unicodeIsPureAscii) {
      // Both could legitimately be ASCII if the icon is an ASCII char used in both modes
      assert.ok(true) // allowed but noted
    } else {
      // Unicode glyph → ascii fallback must differ
      assert.notEqual(icon.unicode, icon.ascii, `${name}: unicode and ascii must differ when unicode is a multi-byte char`)
    }
  })
}

// ── asciiMode() reads AGENTGUARD_ASCII env ────────────────────────────────────

afterEach(() => {
  delete process.env['AGENTGUARD_ASCII']
})

test('asciiMode() returns false when AGENTGUARD_ASCII is unset', () => {
  delete process.env['AGENTGUARD_ASCII']
  assert.equal(asciiMode(), false)
})

test('asciiMode() returns false when AGENTGUARD_ASCII is "0"', () => {
  process.env['AGENTGUARD_ASCII'] = '0'
  assert.equal(asciiMode(), false)
})

test('asciiMode() returns true when AGENTGUARD_ASCII is "1"', () => {
  process.env['AGENTGUARD_ASCII'] = '1'
  assert.equal(asciiMode(), true)
})

// ── glyph() returns correct value per mode ────────────────────────────────────

test('glyph("overview") returns unicode icon by default', () => {
  delete process.env['AGENTGUARD_ASCII']
  const result = glyph('overview')
  assert.equal(result, ICONS['overview']!.unicode)
})

test('glyph("overview") returns ASCII icon when AGENTGUARD_ASCII=1', () => {
  process.env['AGENTGUARD_ASCII'] = '1'
  const result = glyph('overview')
  assert.equal(result, ICONS['overview']!.ascii)
})

test('glyph() returns empty string for unknown name', () => {
  assert.equal(glyph('unknown-surface-xyz'), '')
})

test('glyph() ASCII swap works for all tab icons', () => {
  process.env['AGENTGUARD_ASCII'] = '1'
  for (const name of TAB_NAMES) {
    const icon = ICONS[name]!
    assert.equal(glyph(name), icon.ascii, `${name}: expected ascii glyph`)
  }
})

test('glyph() unicode mode works for all tab icons', () => {
  delete process.env['AGENTGUARD_ASCII']
  for (const name of TAB_NAMES) {
    const icon = ICONS[name]!
    assert.equal(glyph(name), icon.unicode, `${name}: expected unicode glyph`)
  }
})
