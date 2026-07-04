/** Pure breakpoint helper — no React, no side-effects, fully unit-testable.
 *
 *  Below 40 columns the full Dashboard render is a documented UNVERIFIED
 *  limitation: ink-testing-library hard-codes stdout.columns=100 and exposes
 *  no rows, so there is no way to drive a sub-40-column render in the test
 *  suite.  layoutForWidth is tested directly at representative widths. */
export interface Layout {
  /** Whether the overview chart is shown at full detail, compact, or hidden. */
  readonly chart: 'full' | 'compact' | 'hidden'
  /** Whether heavy panels should stack vertically instead of side-by-side. */
  readonly stack: boolean
  /** Whether to show a "narrow terminal" warning strip. */
  readonly warn: boolean
}

/**
 * Compute the responsive layout configuration for a given terminal width.
 *
 * Breakpoints:
 *  ≥ 100  → full chart, no stack, no warn
 *  ≥  60  → compact chart, no stack, no warn
 *  ≥  40  → compact chart, stack, warn
 *  <  40  → chart hidden, stack, warn
 */
export function layoutForWidth(columns: number): Layout {
  if (columns >= 100) return { chart: 'full',    stack: false, warn: false }
  if (columns >= 60)  return { chart: 'compact', stack: false, warn: false }
  if (columns >= 40)  return { chart: 'compact', stack: true,  warn: true  }
  return                     { chart: 'hidden',  stack: true,  warn: true  }
}
