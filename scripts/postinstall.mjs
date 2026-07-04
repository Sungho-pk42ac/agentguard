#!/usr/bin/env node
// Post-install GitHub star nudge. MUST never throw and never block a
// non-interactive install: it exits 0 no matter what, stays silent in CI /
// non-TTY / piped installs, and only offers the browser prompt on a real TTY.
// No dependencies — plain Node + ANSI so it runs before/without the dep tree.

const REPO = 'https://github.com/Sungho-pk42ac/agentguard'

const c = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  cyan: '\u001b[36m',
  yellow: '\u001b[33m',
  green: '\u001b[32m',
  gray: '\u001b[90m',
}

function forced() {
  return process.env.AGENTGUARD_FORCE_POSTINSTALL === '1'
}

function shouldSkip() {
  if (forced()) return false
  if (process.env.AGENTGUARD_NO_POSTINSTALL === '1') return true
  if (process.env.CI === 'true' || process.env.CI === '1') return true
  // Automated / piped installs (npm ci, Docker, dependency installs) have no TTY.
  if (!process.stdout.isTTY) return true
  return false
}

function banner() {
  const line = `${c.cyan}${'─'.repeat(56)}${c.reset}`
  process.stdout.write(
    [
      '',
      line,
      `  ${c.cyan}${c.bold}◆ AgentGuard${c.reset}  ${c.gray}설치 완료 · install complete${c.reset}`,
      `  ${c.yellow}${c.bold}⭐ 도움이 되셨다면 GitHub 스타를 눌러주세요! (Star us on GitHub)${c.reset}`,
      `     ${c.green}${REPO}${c.reset}`,
      `  ${c.gray}별 하나가 큰 힘이 됩니다. (opt out: AGENTGUARD_NO_POSTINSTALL=1)${c.reset}`,
      line,
      '',
    ].join('\n'),
  )
}

async function maybeOpenBrowser() {
  // Only prompt when stdin is a real TTY; otherwise just leave the URL on screen.
  if (!process.stdin.isTTY) return
  const { createInterface } = await import('node:readline')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve('__timeout__'), 10_000)
    rl.question(`  ${c.bold}지금 별 누르러 브라우저를 열까요?${c.reset} [Y/n] `, (a) => {
      clearTimeout(timer)
      resolve(a)
    })
  })
  rl.close()
  if (answer === '__timeout__') {
    process.stdout.write(`\n  ${c.gray}나중에 ${REPO} 에서 ⭐ 눌러주세요.${c.reset}\n`)
    return
  }
  const trimmed = String(answer).trim()
  const yes = trimmed === '' || /^y(es)?$/i.test(trimmed)
  if (!yes) {
    process.stdout.write(`  ${c.gray}건너뜀 — 나중에 ${REPO} 에서 ⭐ 눌러주세요.${c.reset}\n`)
    return
  }
  try {
    const { spawn } = await import('node:child_process')
    const isWin = process.platform === 'win32'
    const isMac = process.platform === 'darwin'
    const cmd = isWin ? 'cmd' : isMac ? 'open' : 'xdg-open'
    const args = isWin ? ['/c', 'start', '', REPO] : [REPO]
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
    child.on('error', () => {})
    child.unref()
    process.stdout.write(`  ${c.green}브라우저를 열었습니다 — ⭐ 눌러주시면 정말 감사합니다!${c.reset}\n`)
  } catch {
    process.stdout.write(`  ${c.gray}브라우저를 열지 못했어요 — ${REPO} 방문 부탁드려요 ⭐${c.reset}\n`)
  }
}

async function main() {
  if (shouldSkip()) return
  banner()
  await maybeOpenBrowser()
}

main()
  .catch(() => {})
  .finally(() => process.exit(0))
