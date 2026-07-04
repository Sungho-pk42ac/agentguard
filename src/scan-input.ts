export class ScanInputError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(reason)
    this.reason = reason
    this.name = 'ScanInputError'
  }
}

interface ResolveScanInputOptions {
  readonly isTTY: boolean
  readonly arg: string | undefined
  readonly readStdin: () => string
  readonly readFile: (p: string) => string
}

/**
 * Resolve scan input content with stdin-first semantics.
 *
 * - !isTTY (piped):        always read stdin — byte-identical to today's readFileSync(0) path.
 * - isTTY && arg provided: read the file at arg; wraps any read error in ScanInputError.
 * - isTTY && no arg:       read stdin (unchanged legacy interactive / redirect behavior).
 */
export function resolveScanInput(options: ResolveScanInputOptions): string {
  const { isTTY, arg, readStdin, readFile } = options
  if (!isTTY) {
    return readStdin()
  }
  if (arg !== undefined) {
    try {
      return readFile(arg)
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new ScanInputError(reason)
    }
  }
  return readStdin()
}
