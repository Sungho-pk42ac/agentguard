// Declarative CLI verb/alias dispatch table.
//
// This table is documentational + mechanical for the multi-word verb forms
// (e.g. `scan files` -> `scan-files`). It does NOT replace `parseArgs` in
// `src/index.ts` — `resolveCommand` only rewrites `argv` to the legacy
// canonical form before the existing `parseArgs` flow runs, so all existing
// flag/positional parsing behavior stays byte-identical.
//
// `doctor`, `posture`, `open`, `login`, `logout`, and `enroll` are listed
// here with `preTable: true` purely for documentation of the full command
// surface. Their precedence branches live in `src/index.ts` BEFORE this
// table is consulted, so `resolveCommand` deliberately excludes them from
// matching and can never shadow that precedence.

export interface CommandSpec {
  readonly canonical: string
  readonly aliases: readonly string[]
  readonly preTable?: boolean
}

export const COMMAND_TABLE: readonly CommandSpec[] = [
  { canonical: 'scan-files', aliases: ['scan files'] },
  { canonical: 'scan-diff', aliases: ['scan diff'] },
  { canonical: 'scan-log', aliases: ['scan log'] },
  { canonical: 'scan-mcp', aliases: ['scan mcp'] },
  { canonical: 'report', aliases: [] },
  { canonical: 'doctor', aliases: [], preTable: true },
  { canonical: 'posture', aliases: [], preTable: true },
  { canonical: 'open', aliases: [], preTable: true },
  { canonical: 'login', aliases: [], preTable: true },
  { canonical: 'logout', aliases: [], preTable: true },
  { canonical: 'enroll', aliases: [], preTable: true },
]

function isFlag(token: string): boolean {
  return token.startsWith('-')
}

export function resolveCommand(argv: readonly string[]): { canonical: string; rest: string[] } | undefined {
  const matchable = COMMAND_TABLE.filter((spec) => !spec.preTable)

  const firstIndex = argv.findIndex((token) => !isFlag(token))
  if (firstIndex === -1) return undefined

  const first = argv[firstIndex]
  const second = argv[firstIndex + 1]

  if (second !== undefined && !isFlag(second)) {
    const twoWord = `${first} ${second}`
    const twoWordMatch = matchable.find((spec) => spec.aliases.includes(twoWord))
    if (twoWordMatch) {
      const rest = argv.filter((_token, index) => index !== firstIndex && index !== firstIndex + 1)
      return { canonical: twoWordMatch.canonical, rest }
    }
  }

  const oneWordMatch = matchable.find((spec) => spec.canonical === first || spec.aliases.includes(first))
  if (oneWordMatch) {
    const rest = argv.filter((_token, index) => index !== firstIndex)
    return { canonical: oneWordMatch.canonical, rest }
  }

  return undefined
}
