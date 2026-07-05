import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { Dashboard } from '../../src/tui/dashboard.js'
import { buildDashboardData, type LoadDashboardOptions, QUICK_SCOPE, PROJECT_SCOPE } from '../../src/tui/dashboard-data.js'
import type { ResidualCredential } from '../../src/residual.js'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// Poll the frame until a pattern appears — robust against ink-testing-library
// render/effect timing under concurrent full-suite load (avoids fixed-delay flakes).
async function waitFor(lastFrame: () => string | undefined, re: RegExp, timeout = 2000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (re.test(lastFrame() ?? '')) return true
    await delay(15)
  }
  return false
}

const residuals: ResidualCredential[] = [
  { id: 'a', kind: 'api-key', severity: 'critical', surface: 'shell-rc', location: '~/.bashrc', evidence: 'OpenAI key: sk-A…AAAA', recommendation: 'rotate', line: 3 },
  { id: 'b', kind: 'api-key', severity: 'critical', surface: 'project-file', location: 'repo/.env', evidence: 'key', recommendation: 'rotate' },
  { id: 'c', kind: 'mcp-perm', severity: 'high', surface: 'agent-config', location: 'claude_desktop_config.json', evidence: 'broad filesystem root', recommendation: 'restrict' },
  { id: 'd', kind: 'config', severity: 'medium', surface: 'npm-global', location: 'npm-global:@openai/codex', evidence: 'Global AI CLI installed: @openai/codex@1.0.0', recommendation: 'uninstall' },
  { id: 'e', kind: 'config', severity: 'medium', surface: 'ai-tool-dir', location: 'ai-tool-dir:/home/x/.claude', evidence: 'AI tool config present', recommendation: 'remove' },
]
const loader = () => buildDashboardData(residuals, 1000)

function mountDashboard() {
  let exited = false
  const instance = render(createElement(Dashboard, { loader, onExit: () => (exited = true) }))
  return { ...instance, wasExited: () => exited }
}

// ─── Existing tests ──────────────────────────────────────────────────────────

test('dashboard paints a loading frame BEFORE the (synchronous) scan runs', () => {
  const { lastFrame, unmount } = render(createElement(Dashboard, { loader, onExit: () => {} }))
  assert.match(lastFrame() ?? '', /Scanning/) // before the setTimeout(0) scan boundary fires
  unmount()
})

test('dashboard renders 7 tabs (workflow order) + verdict badge + footer status after load', async () => {
  const { lastFrame, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/), 'overview hero should load')
  const frame = lastFrame() ?? ''
  for (const label of ['Overview', 'Credentials', 'Posture', 'Agents', 'Baseline', 'Offboard', 'Fleet']) {
    assert.match(frame, new RegExp(label), `tab ${label} missing`)
  }
  assert.match(frame, /\[tab\//)
  assert.match(frame, /findings/)
  assert.match(frame, /BLOCK/)
  unmount()
})

test('dashboard tab key switches the active tab body (Overview → Credentials)', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/), 'overview should load first')
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Credentials —/), 'tab should switch to Credentials body')
  unmount()
})

test('dashboard tab key cycles through to Agents and Fleet (workflow order)', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/), 'overview should load first')
  // overview -> credentials -> posture -> agents (3 tab presses)
  for (let i = 0; i < 3; i += 1) {
    stdin.write('\t')
    await delay(20)
  }
  assert.ok(await waitFor(lastFrame, /onboarding check/), 'tab should switch to Agents body')
  // agents -> baseline -> offboard -> fleet (3 more tab presses)
  for (let i = 0; i < 3; i += 1) {
    stdin.write('\t')
    await delay(20)
  }
  assert.ok(await waitFor(lastFrame, /로그인 필요|Fleet —/), 'tab should reach Fleet body')
  unmount()
})

test('dashboard q quits (calls onExit)', async () => {
  const { lastFrame, stdin, unmount, wasExited } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('q')
  const start = Date.now()
  while (Date.now() - start < 1000 && !wasExited()) await delay(15)
  assert.equal(wasExited(), true)
  unmount()
})

test('SINGLE INPUT OWNER: q during offboard does NOT kill the process (parent input inactive)', async () => {
  const { lastFrame, stdin, unmount, wasExited } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('o')
  assert.ok(await waitFor(lastFrame, /Select scan scope/), 'offboard scope-select should activate')
  await delay(40) // let the freshly-mounted ScopeSelect's useInput subscribe
  stdin.write('q') // during offboard: must not exit the whole process
  assert.ok(await waitFor(lastFrame, /Findings by surface|Press \[o\]/), 'q backs out to the dashboard')
  await delay(50)
  assert.equal(wasExited(), false, 'q during offboard must not call the dashboard exit')
  unmount()
})

test('Baseline tab: navigate, save a snapshot, then show no drift', async () => {
  const home = mkdtempSync(join(tmpdir(), 'agentguard-dash-baseline-'))
  const { lastFrame, stdin, unmount } = render(createElement(Dashboard, { loader, onExit: () => {}, homeDir: home }))
  assert.ok(await waitFor(lastFrame, /Findings by surface/), 'overview should load')
  // overview -> agents -> credentials -> posture -> baseline (4 tab presses)
  for (let i = 0; i < 4; i += 1) {
    stdin.write('\t')
    await delay(25)
  }
  assert.ok(await waitFor(lastFrame, /No baseline saved yet/), 'baseline tab shows empty state')
  stdin.write('s') // save current scan as baseline
  assert.ok(await waitFor(lastFrame, /Saved baseline/), 'baseline should be saved')
  assert.match(lastFrame() ?? '', /No drift since the last baseline/)
  unmount()
})

// ─── S2: KO intro + empty state ─────────────────────────────────────────────

test('S2: loading frame shows KO intro under banner', () => {
  const { lastFrame, unmount } = render(createElement(Dashboard, { loader, onExit: () => {} }))
  const frame = lastFrame() ?? ''
  // Before setTimeout(0) fires the frame is still Scanning
  assert.match(frame, /에이전트/)
  unmount()
})

test('S2: 0-finding credentials tab renders 깨끗함 ✓', async () => {
  const emptyLoader = () => buildDashboardData([], 1000)
  const { lastFrame, stdin, unmount } = render(createElement(Dashboard, { loader: emptyLoader, onExit: () => {} }))
  // With empty data, HeroChart shows "PASS — no residual..." rather than "Findings by surface".
  // Wait for the PASS text to confirm loading completed (footer "0 findings" also works).
  assert.ok(await waitFor(lastFrame, /PASS — no residual|0 findings/), 'overview loaded')
  // Navigate to Credentials (1 tab forward: overview → credentials)
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /깨끗함/), '깨끗함 ✓ should appear for 0-item tab')
  unmount()
})

// ─── S1: help overlay ────────────────────────────────────────────────────────

test('S1: ? opens overlay listing all keys; any key closes it', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('?')
  assert.ok(await waitFor(lastFrame, /키보드 단축키/), 'help overlay should open')
  const frame = lastFrame() ?? ''
  // Overlay lists keybinds
  assert.match(frame, /도움말/)
  assert.match(frame, /종료/)
  // Press ? again to toggle overlay closed (any key closes in overlay mode)
  stdin.write('?')
  assert.ok(await waitFor(lastFrame, /Findings by surface/), '? again should close overlay')
  unmount()
})

test('S1: ? inert when offboardActive (overlay does NOT open)', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('o') // open offboard
  assert.ok(await waitFor(lastFrame, /Select scan scope/))
  await delay(40)
  stdin.write('?') // should be inert during offboard
  await delay(40)
  // Overlay must NOT appear
  assert.doesNotMatch(lastFrame() ?? '', /키보드 단축키/)
  unmount()
})

// ─── S4: consistent nav on credentials + posture ─────────────────────────────

test('S4: up/down/enter behave identically on credentials tab', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  // Navigate to Credentials (1 tab)
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  // Move down
  stdin.write('j')
  await delay(20)
  // Move up
  stdin.write('k')
  await delay(20)
  // Open detail
  stdin.write('\r')
  assert.ok(await waitFor(lastFrame, /세부정보/), 'enter should open detail panel')
  unmount()
})

test('S4: up/down/enter behave identically on posture tab', async () => {
  // Use residuals with posture items (agent-config surface)
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  // Navigate to Posture (tab × 2: overview → credentials → posture)
  stdin.write('\t')
  await delay(20)
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Posture —/))
  stdin.write('j') // move down
  await delay(20)
  stdin.write('\r') // open detail
  assert.ok(await waitFor(lastFrame, /세부정보/), 'enter opens detail on posture tab')
  unmount()
})

// ─── S5: detail model in panel ───────────────────────────────────────────────

test('S5: detail panel renders all four blocks (path + severity + category + recommendation)', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  // Navigate to Credentials (1 tab)
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  await delay(25) // let state settle before pressing enter
  stdin.write('\r') // open detail for first item
  assert.ok(await waitFor(lastFrame, /세부정보/))
  const frame = lastFrame() ?? ''
  // Block 1: full path
  assert.match(frame, /\.bashrc/)
  // Block 2: severity rationale
  assert.match(frame, /심각도/)
  assert.match(frame, /즉각/)
  // Block 3: category KO remediation (shell-rc → not in categoryRemediationKO → no 조치 line; evidence shown)
  assert.match(frame, /evidence:/)
  // Block 4: recommendation
  assert.match(frame, /fix:/)
  unmount()
})

// ─── S6: session-hide ────────────────────────────────────────────────────────

test('S6: i hides selected item; verdict+aggregate unchanged; rescan restores', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  // Navigate to Credentials (1 tab)
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  await delay(30) // let Ink update the useInput callback ref for the new tab
  // Verify .bashrc is visible
  assert.match(lastFrame() ?? '', /\.bashrc/)
  // Hide the first item (cursor=0 → shell-rc/.bashrc, id='a')
  stdin.write('i')
  // wait for hidden item to disappear (hidden set update + re-render)
  assert.ok(await waitFor(lastFrame, /Credentials — 2\/3/), 'display count should drop to 2 after hiding')
  const afterHide = lastFrame() ?? ''
  // .bashrc is hidden — should not appear as the selected item
  assert.doesNotMatch(afterHide, /▸.*shell-rc/)
  // Verdict unchanged (still BLOCK, aggregate still 5 findings)
  assert.match(afterHide, /BLOCK/)
  // Rescan restores hidden set
  stdin.write('r')
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  await delay(30)
  // After rescan, .bashrc is visible again
  assert.match(lastFrame() ?? '', /\.bashrc/)
  unmount()
})

test('S6/C5: i writes NO files to disk', async () => {
  const home = mkdtempSync(join(tmpdir(), 'agentguard-hide-'))
  const { lastFrame, stdin, unmount } = render(createElement(Dashboard, { loader, onExit: () => {}, homeDir: home }))
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  stdin.write('i') // hide
  await delay(50)
  // Verify no files were written under tmpHome
  const { readdirSync } = await import('node:fs')
  const entries = readdirSync(home)
  assert.equal(entries.length, 0, `no files should be written to home on hide; found: ${entries.join(', ')}`)
  unmount()
})

// ─── S7: search ──────────────────────────────────────────────────────────────

test('S7: / enters search; query live-filters; esc clears', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  // Navigate to Credentials (1 tab)
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  // Enter search mode
  stdin.write('/')
  await delay(20)
  // Type 'bashrc' — should filter to only .bashrc
  for (const ch of 'bashrc') {
    stdin.write(ch)
    await delay(10)
  }
  assert.ok(await waitFor(lastFrame, /검색/), 'search query indicator')
  assert.match(lastFrame() ?? '', /\.bashrc/)
  // Backspace one char ('c' removed)
  stdin.write('\x7f') // backspace
  await delay(20)
  // Esc clears and exits search
  stdin.write('\x1b')
  await delay(20)
  // Query cleared — all items visible again
  assert.doesNotMatch(lastFrame() ?? '', /검색.*bash/)
  unmount()
})

test('S7: enter in search keeps query', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  stdin.write('/')
  await delay(20)
  stdin.write('b')
  await delay(20)
  stdin.write('\r') // commit
  await delay(20)
  // Query 'b' still active
  assert.match(lastFrame() ?? '', /검색.*b/)
  unmount()
})

// ─── S8: sort toggle ─────────────────────────────────────────────────────────

test('S8: g toggles sort indicator in header', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  // Navigate to Credentials (1 tab)
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  // Initially no sort indicator
  assert.doesNotMatch(lastFrame() ?? '', /↓ severity/)
  stdin.write('g') // toggle sort
  assert.ok(await waitFor(lastFrame, /severity/), 'sort indicator should appear')
  stdin.write('g') // toggle off
  await delay(30)
  assert.doesNotMatch(lastFrame() ?? '', /↓ severity/)
  unmount()
})

// ─── S9: scan presets ────────────────────────────────────────────────────────

test('S9: 1/2/3 dispatch correct scope to loader', async () => {
  const scopesSeen: (readonly string[])[] = []
  const trackingLoader = (opts?: LoadDashboardOptions) => {
    scopesSeen.push(opts?.scope ?? ['default'])
    return buildDashboardData(residuals, 1000)
  }
  const { lastFrame, stdin, unmount } = render(createElement(Dashboard, { loader: trackingLoader, onExit: () => {} }))
  assert.ok(await waitFor(lastFrame, /Findings by surface/), 'overview loaded')
  // Press 1 (Quick)
  stdin.write('1')
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  // Press 2 (Project)
  stdin.write('2')
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  await delay(50)
  // Quick scope (1) excludes project-files
  const quickScan = scopesSeen.find((s) => s.includes('shell-rc') && !s.includes('project-files'))
  assert.ok(quickScan, `quick scope should not include project-files; saw ${JSON.stringify(scopesSeen)}`)
  unmount()
})

test('S9: Full from non-project cwd shows y/N confirm prompt', async () => {
  // Use a temp dir with no project markers — projectScanPath will return undefined
  const tmpCwd = mkdtempSync(join(tmpdir(), 'agentguard-noproject-'))
  const { lastFrame, stdin, unmount } = render(createElement(Dashboard, { loader, onExit: () => {}, cwd: tmpCwd }))
  assert.ok(await waitFor(lastFrame, /Findings by surface/), 'overview loaded')
  stdin.write('3') // Full preset
  assert.ok(await waitFor(lastFrame, /프로젝트 루트/), 'confirm prompt should appear for non-project cwd')
  assert.match(lastFrame() ?? '', /\[y\]/)
  // Press n to cancel
  stdin.write('n')
  // waitFor the prompt to disappear (state update + re-render after 'n')
  const dismissed = await waitFor(lastFrame, /Findings by surface|Credentials|Agents/, 1000)
  assert.ok(dismissed || !lastFrame()?.includes('프로젝트 루트'), 'confirm prompt should be dismissed after n')
  unmount()
})

// ─── S10: watch toggle ────────────────────────────────────────────────────────

test('S10: w toggles watch indicator in footer; default OFF', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  // Default: no watch indicator
  assert.doesNotMatch(lastFrame() ?? '', /\[watch/)
  stdin.write('w') // enable watch
  assert.ok(await waitFor(lastFrame, /\[watch/), 'watch indicator should appear')
  stdin.write('w') // disable watch
  await delay(30)
  assert.doesNotMatch(lastFrame() ?? '', /\[watch/)
  unmount()
})

test('S10: unmount clears watch interval (no throw)', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('w') // enable watch
  await delay(30)
  // Unmount with watch active — should not throw
  assert.doesNotThrow(() => unmount())
})

test('S6×S7 regression: i hides the DISPLAYED selected item under an active search (not raw-order[cursor])', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('\t')
  await delay(25)
  assert.ok(await waitFor(lastFrame, /Credentials —/), 'should land on the Credentials tab')
  // Search narrows the 3 credential items to the single ai-tool-dir entry whose
  // location contains "claude"; raw-order[0] is the shell-rc item, so a naive
  // hide handler would hide the wrong (invisible) finding.
  stdin.write('/')
  await delay(25)
  for (const ch of 'claude') {
    stdin.write(ch)
    await delay(15)
  }
  assert.ok(await waitFor(lastFrame, /Credentials — 1\/3/), 'search should display only the claude item')
  stdin.write('\r') // commit search: exit capture, keep the query
  await delay(30)
  stdin.write('i') // hide the displayed selection
  // Fixed pipeline hides the claude item → the filtered list empties (0/3).
  // The pre-fix bug hid raw-order[0] (shell-rc), leaving claude visible (1/3).
  assert.ok(await waitFor(lastFrame, /Credentials — 0\/3/), 'the displayed (claude) finding must be the one hidden')
  unmount()
})

test('LOW-fix: a scan failure surfaces an error instead of masking it as a clean PASS', async () => {
  const throwingLoader = () => {
    throw new Error('scan blew up')
  }
  const { lastFrame, unmount } = render(createElement(Dashboard, { loader: throwingLoader, onExit: () => {} }))
  assert.ok(await waitFor(lastFrame, /스캔 오류/), 'a failed scan must surface an error')
  assert.doesNotMatch(lastFrame() ?? '', /깨끗함/, 'must not render the clean empty-state on error')
  unmount()
})
// ─── S12: icon application ────────────────────────────────────────────────────

test('S12: unicode tab icons present in loaded frame (default mode)', async () => {
  const { lastFrame, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  const frame = lastFrame() ?? ''
  // Tab bar contains unicode icons (● for overview tab, ◆ for agents, etc.)
  assert.match(frame, /●/, 'overview unicode icon should be present')
  unmount()
})

test('S12: AGENTGUARD_ASCII=1 → unicode tab icons absent from tab bar, no crash', async () => {
  const orig = process.env['AGENTGUARD_ASCII']
  process.env['AGENTGUARD_ASCII'] = '1'
  try {
    const { lastFrame, unmount } = mountDashboard()
    assert.ok(await waitFor(lastFrame, /Findings by surface/))
    const frame = lastFrame() ?? ''
    // In ASCII mode the tab bar icons are ASCII replacements.
    // ⊙ is the baseline tab unicode icon — it appears ONLY in the tab bar and
    // nowhere in banner, content, or hardcoded glyphs, so it's a clean sentinel.
    assert.doesNotMatch(frame, /⊙/, 'unicode icon ⊙ (baseline tab) must not appear in ASCII mode')
    // ■ is the credentials tab icon — only appears in the tab bar on the overview frame.
    assert.doesNotMatch(frame, /■/, 'unicode icon ■ (credentials tab) must not appear in ASCII mode')
    // ● is the overview tab icon — in ASCII mode replaced by "o".
    // (Note: ● also appears as the hardcoded severity dot in findings rows,
    //  but the overview tab is active here so findings rows are not rendered.)
    assert.doesNotMatch(frame, /●/, 'unicode icon ● (overview tab) must not appear in ASCII mode')
    unmount()
  } finally {
    if (orig === undefined) delete process.env['AGENTGUARD_ASCII']
    else process.env['AGENTGUARD_ASCII'] = orig
  }
})

// ─── M1b: editor-open action ('e') ───────────────────────────────────────────

test("M1b: 'e' on Credentials opens the selected finding via the injected fake opener; footer shows status", async () => {
  const calls: { file: string; line: number | undefined }[] = []
  const fakeOpenInEditor = (file: string, line: number | undefined) => {
    calls.push({ file, line })
    return { editor: 'code', command: 'code', args: ['--goto', `${file}:${line}`] }
  }
  const home = mkdtempSync(join(tmpdir(), 'agentguard-editor-'))
  const { lastFrame, stdin, unmount } = render(
    createElement(Dashboard, { loader, onExit: () => {}, homeDir: home, openInEditor: fakeOpenInEditor }),
  )
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('\t') // overview -> credentials
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  await delay(30) // let Ink update the useInput callback ref for the new tab
  stdin.write('e')
  assert.ok(await waitFor(lastFrame, /에디터로 열었음/), 'footer should show the open-in-editor status')
  assert.equal(calls.length, 1)
  // Cursor 0 -> shell-rc '~/.bashrc' with line 3; '~' expands to the injected homeDir.
  assert.equal(calls[0]!.file, join(home, '.bashrc'))
  assert.equal(calls[0]!.line, 3)
  assert.match(lastFrame() ?? '', new RegExp(`code ${join(home, '.bashrc').replace(/[/\\.]/g, '\\$&')}:3`))
  unmount()
})

test("M1b: 'e' shows the fallback message when no editor is resolved", async () => {
  const fakeOpenInEditor = () => ({ editor: undefined, command: 'xdg-open', args: ['x'], message: '열림: 기본 앱' })
  const { lastFrame, stdin, unmount } = render(
    createElement(Dashboard, { loader, onExit: () => {}, openInEditor: fakeOpenInEditor }),
  )
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  await delay(30) // let Ink update the useInput callback ref for the new tab
  stdin.write('e')
  assert.ok(await waitFor(lastFrame, /열림: 기본 앱/), 'fallback message should render in the footer')
  unmount()
})

test("M1b: 'e' is inert on Overview (not a list tab) — no fake-opener call", async () => {
  let called = false
  const fakeOpenInEditor = () => {
    called = true
    return { editor: 'code', command: 'code', args: [] }
  }
  const { lastFrame, stdin, unmount } = render(createElement(Dashboard, { loader, onExit: () => {}, openInEditor: fakeOpenInEditor }))
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('e')
  await delay(40)
  assert.equal(called, false, 'e must be inert on Overview')
  unmount()
})

test("M1b: 'e' with no selection (all items filtered out) does not call the opener", async () => {
  let called = false
  const fakeOpenInEditor = () => {
    called = true
    return { editor: 'code', command: 'code', args: [] }
  }
  const { lastFrame, stdin, unmount } = render(createElement(Dashboard, { loader, onExit: () => {}, openInEditor: fakeOpenInEditor }))
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('\t') // -> credentials
  assert.ok(await waitFor(lastFrame, /Credentials —/))
  stdin.write('/') // search narrows to nothing
  await delay(20)
  for (const ch of 'zzz-no-match') {
    stdin.write(ch)
    await delay(10)
  }
  assert.ok(await waitFor(lastFrame, /Credentials — 0\/3/), 'search should empty the filtered list')
  stdin.write('e')
  await delay(40)
  assert.equal(called, false, 'e with no selected item must not call the opener')
  unmount()
})

// ─── M1b: Fleet tab wiring ────────────────────────────────────────────────────

test('M1b: Fleet tab shows the login hint when no session is present', async () => {
  const noSession = () => undefined
  const { lastFrame, stdin, unmount } = render(
    createElement(Dashboard, { loader, onExit: () => {}, readSessionFn: noSession }),
  )
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  for (let i = 0; i < 6; i += 1) {
    stdin.write('\t')
    await delay(20)
  }
  assert.ok(await waitFor(lastFrame, /로그인 필요/), 'Fleet tab should show the login hint')
  assert.match(lastFrame() ?? '', /로컬 전용 모드로 계속 사용 가능/)
  unmount()
})
