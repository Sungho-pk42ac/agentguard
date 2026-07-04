// Pure SGR mouse event parser for xterm-compatible terminals.
// Enable with: process.stdout.write('\x1b[?1000;1006h')  (SGR extended mouse mode)
// Disable with: process.stdout.write('\x1b[?1000;1006l')
//
// Format: \x1b[<Pb;Px;PyM  (press) / \x1b[<Pb;Px;Pym  (release)
//   Pb 64 = wheel up, 65 = wheel down, 0/1/2 = mouse buttons
//
// Finding-row click is DE-SCOPED: Ink exposes no absolute-position API for
// list rows, so we cannot map a click y to a list index reliably.
// AC#11 renegotiated: CLICK selects a TAB (row y≈1), WHEEL moves the active
// list cursor.

export interface MouseEvent {
  readonly kind: 'wheelUp' | 'wheelDown' | 'click'
  readonly x: number
  readonly y: number
  /** true when this is a button-release (rather than press) */
  readonly release: boolean
}

const SGR_RE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/

/**
 * Parse a raw stdin chunk into a MouseEvent.
 * Returns null for unrecognised or malformed sequences.
 * Wrapped in try/catch — never throws.
 */
export function parseSGR(data: string): MouseEvent | null {
  try {
    const m = SGR_RE.exec(data)
    if (!m) return null
    const button = parseInt(m[1], 10)
    const x = parseInt(m[2], 10)
    const y = parseInt(m[3], 10)
    const release = m[4] === 'm'
    if (isNaN(button) || isNaN(x) || isNaN(y)) return null
    if (button === 64) return { kind: 'wheelUp', x, y, release }
    if (button === 65) return { kind: 'wheelDown', x, y, release }
    if (button === 0 || button === 1 || button === 2) return { kind: 'click', x, y, release }
    return null
  } catch {
    return null
  }
}

/** Enable SGR 1000+1006 extended mouse reporting. */
export function enableMouseSGR(): void {
  process.stdout.write('\x1b[?1000;1006h')
}

/** Disable SGR 1000+1006 extended mouse reporting. Call on exit/unmount. */
export function disableMouseSGR(): void {
  process.stdout.write('\x1b[?1000;1006l')
}
