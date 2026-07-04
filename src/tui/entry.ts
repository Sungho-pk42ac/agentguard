// Pure entry-mode decision for the CLI. Kept out of index.ts so it can be unit
// tested without a PTY. (Amendments 1 & 2.)
//
// The interactive Ink REPL enables stdin raw mode, so an implicit launch must
// require BOTH stdin and stdout to be TTYs. In Git Bash / mintty (the common
// Windows dev shell) `isTTY` is false/undefined, so a bare `agentguard` there
// must fall through to usage() rather than crash on "Raw mode not supported".
// The explicit `agentguard repl` / `--interactive` trigger launches the REPL
// regardless, giving a deterministic entry when isTTY misfires.

export function shouldLaunchRepl(
  rawArgs: readonly string[],
  stdinIsTTY: boolean,
  stdoutIsTTY: boolean,
): boolean {
  if (rawArgs[0] === 'repl' || rawArgs[0] === '--interactive') return true
  if (rawArgs.length === 0 && stdinIsTTY && stdoutIsTTY) return true
  return false
}
