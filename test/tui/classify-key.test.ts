import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyKey, type ClassifyState, type KeyInput } from '../../src/tui/classify-key.js'

// Helpers
const baseState: ClassifyState = {
  offboardActive: false,
  searchCapture: false,
  overlayOpen: false,
  confirmFull: false,
  activeTab: 'overview',
}

function intent(overrides: Partial<ClassifyState>, char: string, key: KeyInput = {}) {
  return classifyKey({ ...baseState, ...overrides }, char, key)
}

// ─── Rung 1: offboard-active ────────────────────────────────────────────────

test('C6 offboard active: q yields none', () => {
  assert.deepEqual(intent({ offboardActive: true }, 'q'), { kind: 'none' })
})

test('C6 offboard active: esc yields none', () => {
  assert.deepEqual(intent({ offboardActive: true }, '', { escape: true }), { kind: 'none' })
})

test('C6 offboard active: ? yields none', () => {
  assert.deepEqual(intent({ offboardActive: true }, '?'), { kind: 'none' })
})

test('C6 offboard active: tab yields none', () => {
  assert.deepEqual(intent({ offboardActive: true }, '', { tab: true }), { kind: 'none' })
})

test('C6 offboard active: printable char yields none', () => {
  assert.deepEqual(intent({ offboardActive: true }, 'a'), { kind: 'none' })
})

// ─── Rung 2: search-capture ─────────────────────────────────────────────────

test('search capture: printable char → searchChar', () => {
  assert.deepEqual(intent({ searchCapture: true }, 'a'), { kind: 'searchChar', char: 'a' })
})

test('search capture: multi printable → searchChar', () => {
  assert.deepEqual(intent({ searchCapture: true }, 's'), { kind: 'searchChar', char: 's' })
})

test('search capture: esc → searchExit', () => {
  assert.deepEqual(intent({ searchCapture: true }, '', { escape: true }), { kind: 'searchExit' })
})

test('search capture: enter → searchCommit', () => {
  assert.deepEqual(intent({ searchCapture: true }, '', { return: true }), { kind: 'searchCommit' })
})

test('search capture: backspace → searchBackspace', () => {
  assert.deepEqual(intent({ searchCapture: true }, '', { backspace: true }), { kind: 'searchBackspace' })
})

test('search capture: tab yields none (not printable dispatch)', () => {
  assert.deepEqual(intent({ searchCapture: true }, '', { tab: true }), { kind: 'none' })
})

test('search capture: space is printable → searchChar', () => {
  assert.deepEqual(intent({ searchCapture: true }, ' '), { kind: 'searchChar', char: ' ' })
})

// ─── Rung 3: overlay-open ───────────────────────────────────────────────────

test('overlay open: any key → help (close)', () => {
  assert.deepEqual(intent({ overlayOpen: true }, 'a'), { kind: 'help' })
})

test('overlay open: esc → help (close)', () => {
  assert.deepEqual(intent({ overlayOpen: true }, '', { escape: true }), { kind: 'help' })
})

test('overlay open: q → help (close, not quit)', () => {
  assert.deepEqual(intent({ overlayOpen: true }, 'q'), { kind: 'help' })
})

// ─── Rung 4: confirm-full ───────────────────────────────────────────────────

test('confirmFull: y → confirmYes', () => {
  assert.deepEqual(intent({ confirmFull: true }, 'y'), { kind: 'confirmYes' })
})

test('confirmFull: Y → confirmYes', () => {
  assert.deepEqual(intent({ confirmFull: true }, 'Y'), { kind: 'confirmYes' })
})

test('confirmFull: n → confirmNo', () => {
  assert.deepEqual(intent({ confirmFull: true }, 'n'), { kind: 'confirmNo' })
})

test("confirmFull: esc (char='') → confirmNo", () => {
  assert.deepEqual(intent({ confirmFull: true }, '', { escape: true }), { kind: 'confirmNo' })
})

test('confirmFull: other key → confirmNo', () => {
  assert.deepEqual(intent({ confirmFull: true }, 'x'), { kind: 'confirmNo' })
})

// ─── Rung 5: global ──────────────────────────────────────────────────────────

test('global: q → quit', () => {
  assert.deepEqual(intent({}, 'q'), { kind: 'quit' })
})

test('global: esc → quit', () => {
  assert.deepEqual(intent({}, '', { escape: true }), { kind: 'quit' })
})

test('global: r → rescan', () => {
  assert.deepEqual(intent({}, 'r'), { kind: 'rescan' })
})

test('global: ? → help', () => {
  assert.deepEqual(intent({}, '?'), { kind: 'help' })
})

test('global: / → searchOpen', () => {
  assert.deepEqual(intent({}, '/'), { kind: 'searchOpen' })
})

test('global: 1 → preset n=1', () => {
  assert.deepEqual(intent({}, '1'), { kind: 'preset', n: 1 })
})

test('global: 2 → preset n=2', () => {
  assert.deepEqual(intent({}, '2'), { kind: 'preset', n: 2 })
})

test('global: 3 → preset n=3', () => {
  assert.deepEqual(intent({}, '3'), { kind: 'preset', n: 3 })
})

test('global: g → sortToggle', () => {
  assert.deepEqual(intent({}, 'g'), { kind: 'sortToggle' })
})

test('global: w → watchToggle', () => {
  assert.deepEqual(intent({}, 'w'), { kind: 'watchToggle' })
})

test('global: o → openOffboard', () => {
  assert.deepEqual(intent({}, 'o'), { kind: 'openOffboard' })
})

test('global: tab → tabNext', () => {
  assert.deepEqual(intent({}, '', { tab: true }), { kind: 'tabNext' })
})

test('global: rightArrow → tabNext', () => {
  assert.deepEqual(intent({}, '', { rightArrow: true }), { kind: 'tabNext' })
})

test('global: shift+tab → tabPrev', () => {
  assert.deepEqual(intent({}, '', { tab: true, shift: true }), { kind: 'tabPrev' })
})

test('global: leftArrow → tabPrev', () => {
  assert.deepEqual(intent({}, '', { leftArrow: true }), { kind: 'tabPrev' })
})

// ─── Rung 6: list-tab-scoped ─────────────────────────────────────────────────

test('credentials tab: upArrow → move -1', () => {
  assert.deepEqual(intent({ activeTab: 'credentials' }, '', { upArrow: true }), { kind: 'move', delta: -1 })
})

test('credentials tab: k → move -1', () => {
  assert.deepEqual(intent({ activeTab: 'credentials' }, 'k'), { kind: 'move', delta: -1 })
})

test('credentials tab: downArrow → move 1', () => {
  assert.deepEqual(intent({ activeTab: 'credentials' }, '', { downArrow: true }), { kind: 'move', delta: 1 })
})

test('credentials tab: j → move 1', () => {
  assert.deepEqual(intent({ activeTab: 'credentials' }, 'j'), { kind: 'move', delta: 1 })
})

test('credentials tab: enter → detail', () => {
  assert.deepEqual(intent({ activeTab: 'credentials' }, '', { return: true }), { kind: 'detail' })
})

test('credentials tab: f → filter', () => {
  assert.deepEqual(intent({ activeTab: 'credentials' }, 'f'), { kind: 'filter' })
})

test('credentials tab: i → hide', () => {
  assert.deepEqual(intent({ activeTab: 'credentials' }, 'i'), { kind: 'hide' })
})

test('credentials tab: e (selection present, default) → openEditor', () => {
  assert.deepEqual(intent({ activeTab: 'credentials' }, 'e'), { kind: 'openEditor' })
})

test('credentials tab: e with no selection (hasSelection=false) → none', () => {
  assert.deepEqual(intent({ activeTab: 'credentials', hasSelection: false }, 'e'), { kind: 'none' })
})

test('posture tab: e (selection present) → openEditor', () => {
  assert.deepEqual(intent({ activeTab: 'posture' }, 'e'), { kind: 'openEditor' })
})

test('overview tab: e → none (not a list tab, even with a selection)', () => {
  assert.deepEqual(intent({ activeTab: 'overview', hasSelection: true }, 'e'), { kind: 'none' })
})

test('offboard active: e → none (offboard owns all input, not openEditor)', () => {
  assert.deepEqual(intent({ offboardActive: true, activeTab: 'credentials' }, 'e'), { kind: 'none' })
})

test('overlay open: e → help (close), not openEditor', () => {
  assert.deepEqual(intent({ overlayOpen: true, activeTab: 'credentials' }, 'e'), { kind: 'help' })
})

test('search capture: e → searchChar (not openEditor — search owns printable chars)', () => {
  assert.deepEqual(intent({ searchCapture: true, activeTab: 'credentials' }, 'e'), { kind: 'searchChar', char: 'e' })
})

test('posture tab: j → move 1', () => {
  assert.deepEqual(intent({ activeTab: 'posture' }, 'j'), { kind: 'move', delta: 1 })
})

test('posture tab: i → hide', () => {
  assert.deepEqual(intent({ activeTab: 'posture' }, 'i'), { kind: 'hide' })
})

test('overview tab: upArrow → none (not a list tab)', () => {
  assert.deepEqual(intent({ activeTab: 'overview' }, '', { upArrow: true }), { kind: 'none' })
})

test('agents tab: j → none (not a list tab)', () => {
  assert.deepEqual(intent({ activeTab: 'agents' }, 'j'), { kind: 'none' })
})

// ─── Rung 7: baseline-tab ───────────────────────────────────────────────────

test('baseline tab: s → baselineSave', () => {
  assert.deepEqual(intent({ activeTab: 'baseline' }, 's'), { kind: 'baselineSave' })
})

test('credentials tab: s → none (not baseline tab)', () => {
  assert.deepEqual(intent({ activeTab: 'credentials' }, 's'), { kind: 'none' })
})

// ─── Rung 8: offboard-tab enter ─────────────────────────────────────────────

test('offboard tab: enter → openOffboard', () => {
  assert.deepEqual(intent({ activeTab: 'offboard' }, '', { return: true }), { kind: 'openOffboard' })
})

test('overview tab: enter → none (not offboard tab and not list tab)', () => {
  assert.deepEqual(intent({ activeTab: 'overview' }, '', { return: true }), { kind: 'none' })
})
