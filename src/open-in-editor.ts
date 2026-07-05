import { spawn } from 'node:child_process'

// "Open in editor" ladder: resolve a configured/detected editor, build its
// line-jump CLI args, and spawn it detached (args array only — never a shell
// string). Falls back to the OS "open with default app" behavior when no
// editor can be resolved.

export type DetectFn = (executable: string) => boolean

const PATH_DETECTION_ORDER = ['code', 'cursor', 'windsurf', 'subl', 'idea', 'notepad++', 'nvim', 'vim'] as const

/** AGENTGUARD_EDITOR > VISUAL > EDITOR > PATH detection > undefined. */
export function resolveEditor(env: NodeJS.ProcessEnv = process.env, detect?: DetectFn): string | undefined {
  if (env.AGENTGUARD_EDITOR) return env.AGENTGUARD_EDITOR
  if (env.VISUAL) return env.VISUAL
  if (env.EDITOR) return env.EDITOR
  if (detect) {
    for (const candidate of PATH_DETECTION_ORDER) {
      if (detect(candidate)) return candidate
    }
  }
  return undefined
}

function editorBaseName(editor: string): string {
  const base = editor.replace(/\\/g, '/').split('/').pop() ?? editor
  return base.replace(/\.(exe|cmd|bat)$/i, '').toLowerCase()
}

/** Per-editor line-jump CLI args. Unknown editors just receive the bare file path. */
export function editorArgs(editor: string, file: string, line?: number): string[] {
  const name = editorBaseName(editor)
  const withLine = line !== undefined ? `${file}:${line}` : file
  if (name === 'code' || name === 'cursor' || name === 'windsurf') {
    return ['--goto', withLine]
  }
  if (name === 'subl') {
    return [withLine]
  }
  if (name === 'idea') {
    return line !== undefined ? ['--line', String(line), file] : [file]
  }
  if (name === 'notepad++') {
    return line !== undefined ? [`-n${line}`, file] : [file]
  }
  if (name === 'vim' || name === 'nvim') {
    return line !== undefined ? [`+${line}`, file] : [file]
  }
  return [file]
}

export interface SpawnedChild {
  unref(): void
}
export type SpawnFn = (command: string, args: readonly string[]) => SpawnedChild

function defaultSpawn(command: string, args: readonly string[]): SpawnedChild {
  return spawn(command, args as string[], { detached: true, stdio: 'ignore' })
}

export interface OpenInEditorOptions {
  readonly env?: NodeJS.ProcessEnv
  readonly detect?: DetectFn
  readonly spawnFn?: SpawnFn
  readonly platform?: NodeJS.Platform
}

export interface OpenInEditorResult {
  readonly editor: string | undefined
  readonly command: string
  readonly args: readonly string[]
  readonly message?: string
}

function osFallbackCommand(platform: NodeJS.Platform, file: string): { command: string; args: readonly string[] } {
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '', file] }
  if (platform === 'darwin') return { command: 'open', args: [file] }
  return { command: 'xdg-open', args: [file] }
}

/**
 * Resolve an editor (or the OS default-app fallback) and spawn it, detached,
 * against `file` (optionally jumping to `line`). Always returns the resolved
 * `{editor, command, args}` so handlers/tests can assert on the exact
 * spawned invocation without touching a real process.
 */
export function openInEditor(file: string, line: number | undefined, opts: OpenInEditorOptions = {}): OpenInEditorResult {
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const spawnFn = opts.spawnFn ?? defaultSpawn

  const editor = resolveEditor(env, opts.detect)
  if (editor) {
    const args = editorArgs(editor, file, line)
    spawnFn(editor, args).unref()
    return { editor, command: editor, args }
  }

  const { command, args } = osFallbackCommand(platform, file)
  spawnFn(command, args).unref()
  const message =
    line !== undefined ? `열림: 기본 앱 (줄 이동은 지원 안 됨 — line ${line})` : '열림: 기본 앱'
  return { editor: undefined, command, args, message }
}
