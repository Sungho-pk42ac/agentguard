import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tabIndexFromX, tabIndexFromClick, TAB_BAR_ROW } from '../../src/tui/dashboard.js'

// ── tabIndexFromX geometry ────────────────────────────────────────────────────
//
// Tab bar format (1-indexed columns):
//   "agentguard " = 11 chars → first tab starts at col 12
//   Each tab: " {icon}{label} " = label.length + 3 chars
//   Separator: "│" = 1 char between tabs (NOT before first tab)
//
// TABS (workflow order — scan → fix → verify — from dashboard.tsx):
//   0: Overview    (8)  → width 11, cols 12–22
//   1: Credentials (11) → width 14, cols 24–37   (│ at 23)
//   2: Posture     (7)  → width 10, cols 39–48   (│ at 38)
//   3: Agents      (6)  → width  9, cols 50–58   (│ at 49)
//   4: Baseline    (8)  → width 11, cols 60–70   (│ at 59)
//   5: Offboard    (8)  → width 11, cols 72–82   (│ at 71)
//   6: Fleet       (5)  → width  8, cols 84–91   (│ at 83)
//
// Total tab bar: 11 + 11 + 1 + 14 + 1 + 10 + 1 + 9 + 1 + 11 + 1 + 11 + 1 + 8 = 91

const columns = 100

test('tabIndexFromX: first col of Overview (x=12) → 0', () => {
  assert.equal(tabIndexFromX(12, columns), 0)
})

test('tabIndexFromX: last col of Overview (x=22) → 0', () => {
  assert.equal(tabIndexFromX(22, columns), 0)
})

test('tabIndexFromX: │ separator between Overview and Credentials (x=23) → -1', () => {
  assert.equal(tabIndexFromX(23, columns), -1)
})

test('tabIndexFromX: first col of Credentials (x=24) → 1', () => {
  assert.equal(tabIndexFromX(24, columns), 1)
})

test('tabIndexFromX: last col of Credentials (x=37) → 1', () => {
  assert.equal(tabIndexFromX(37, columns), 1)
})

test('tabIndexFromX: │ separator between Credentials and Posture (x=38) → -1', () => {
  assert.equal(tabIndexFromX(38, columns), -1)
})

test('tabIndexFromX: first col of Posture (x=39) → 2', () => {
  assert.equal(tabIndexFromX(39, columns), 2)
})

test('tabIndexFromX: last col of Posture (x=48) → 2', () => {
  assert.equal(tabIndexFromX(48, columns), 2)
})

test('tabIndexFromX: first col of Agents (x=50) → 3', () => {
  assert.equal(tabIndexFromX(50, columns), 3)
})

test('tabIndexFromX: first col of Baseline (x=60) → 4', () => {
  assert.equal(tabIndexFromX(60, columns), 4)
})

test('tabIndexFromX: first col of Offboard (x=72) → 5', () => {
  assert.equal(tabIndexFromX(72, columns), 5)
})

test('tabIndexFromX: first col of Fleet (x=84) → 6', () => {
  assert.equal(tabIndexFromX(84, columns), 6)
})

test('tabIndexFromX: last col of Fleet (x=91) → 6', () => {
  assert.equal(tabIndexFromX(91, columns), 6)
})

test('tabIndexFromX: x before any tab (x=1) → -1', () => {
  assert.equal(tabIndexFromX(1, columns), -1)
})

test('tabIndexFromX: x well past all tabs (x=200) → -1', () => {
  assert.equal(tabIndexFromX(200, columns), -1)
})

// ── Click → tab (row-aware): tabs render on TAB_BAR_ROW; other rows ignored ──
// The compact banner occupies row 1, so clickable tabs are on row 2. A valid tab
// x on any other row must NOT switch tabs (this is what the pre-fix ev.y===1
// handler got wrong).

test('tabIndexFromClick: x=12 on the tab-bar row resolves to Overview', () => {
  assert.equal(tabIndexFromClick(12, TAB_BAR_ROW), 0, 'x=12 on tab row → Overview (0)')
})

test('tabIndexFromClick: x=24 on the tab-bar row resolves to Credentials', () => {
  assert.equal(tabIndexFromClick(24, TAB_BAR_ROW), 1, 'x=24 on tab row → Credentials (1)')
})

test('tabIndexFromClick: x=84 on the tab-bar row resolves to Fleet', () => {
  assert.equal(tabIndexFromClick(84, TAB_BAR_ROW), 6, 'x=84 on tab row → Fleet (6)')
})

test('tabIndexFromClick: a valid tab x on the WRONG row is ignored', () => {
  assert.equal(tabIndexFromClick(12, 1), -1, 'y=1 (banner row) → -1 even at a tab x')
  assert.equal(tabIndexFromClick(24, 3), -1, 'y=3 (below tab bar) → -1')
  assert.equal(TAB_BAR_ROW, 2, 'tab bar is physical row 2 (banner is row 1)')
})
