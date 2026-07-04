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
// TABS (from dashboard.tsx):
//   0: Overview    (8)  → width 11, cols 12–22
//   1: Agents      (6)  → width  9, cols 24–32   (│ at 23)
//   2: Credentials (11) → width 14, cols 34–47   (│ at 33)
//   3: Posture     (7)  → width 10, cols 49–58   (│ at 48)
//   4: Baseline    (8)  → width 11, cols 60–70   (│ at 59)
//   5: Offboard    (8)  → width 11, cols 72–82   (│ at 71)
//
// Total tab bar: 11 + 11 + 1 + 9 + 1 + 14 + 1 + 10 + 1 + 11 + 1 + 11 = 82
// Badge after: 1(space) + 18(BLOCK text) = 19, grand total 82+19 = 101 → clips at 100

const columns = 100

test('tabIndexFromX: first col of Overview (x=12) → 0', () => {
  assert.equal(tabIndexFromX(12, columns), 0)
})

test('tabIndexFromX: last col of Overview (x=22) → 0', () => {
  assert.equal(tabIndexFromX(22, columns), 0)
})

test('tabIndexFromX: │ separator between Overview and Agents (x=23) → -1', () => {
  assert.equal(tabIndexFromX(23, columns), -1)
})

test('tabIndexFromX: first col of Agents (x=24) → 1', () => {
  assert.equal(tabIndexFromX(24, columns), 1)
})

test('tabIndexFromX: last col of Agents (x=32) → 1', () => {
  assert.equal(tabIndexFromX(32, columns), 1)
})

test('tabIndexFromX: │ separator between Agents and Credentials (x=33) → -1', () => {
  assert.equal(tabIndexFromX(33, columns), -1)
})

test('tabIndexFromX: first col of Credentials (x=34) → 2', () => {
  assert.equal(tabIndexFromX(34, columns), 2)
})

test('tabIndexFromX: last col of Credentials (x=47) → 2', () => {
  assert.equal(tabIndexFromX(47, columns), 2)
})

test('tabIndexFromX: first col of Posture (x=49) → 3', () => {
  assert.equal(tabIndexFromX(49, columns), 3)
})

test('tabIndexFromX: first col of Baseline (x=60) → 4', () => {
  assert.equal(tabIndexFromX(60, columns), 4)
})

test('tabIndexFromX: first col of Offboard (x=72) → 5', () => {
  assert.equal(tabIndexFromX(72, columns), 5)
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

test('tabIndexFromClick: x=24 on the tab-bar row resolves to Agents', () => {
  assert.equal(tabIndexFromClick(24, TAB_BAR_ROW), 1, 'x=24 on tab row → Agents (1)')
})

test('tabIndexFromClick: a valid tab x on the WRONG row is ignored', () => {
  assert.equal(tabIndexFromClick(12, 1), -1, 'y=1 (banner row) → -1 even at a tab x')
  assert.equal(tabIndexFromClick(24, 3), -1, 'y=3 (below tab bar) → -1')
  assert.equal(TAB_BAR_ROW, 2, 'tab bar is physical row 2 (banner is row 1)')
})
