import { Box, Text } from 'ink'
import type { ReactNode } from 'react'

export interface PanelProps {
  /** Optional title line rendered at the top of the box body (additive, never relocates content). */
  readonly title?: string
  /** Explicit column width — passed as `width` prop to the root Box.
   *  Panel NEVER calls useStdout; the caller threads columns from the single
   *  Dashboard useStdout() call. */
  readonly columns?: number
  readonly children?: ReactNode
}

/**
 * Reusable framed panel.
 *
 * Renders a `round` cyan border with paddingX=1 and an optional title line.
 * Width is ONLY set when the `columns` prop is supplied — never derived
 * from useStdout (A7 invariant).
 */
export function Panel({ title, columns, children }: PanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginBottom={1}
      {...(columns !== undefined ? { width: columns } : {})}
    >
      {title !== undefined ? (
        <Text bold color="cyan">{title}</Text>
      ) : null}
      {children}
    </Box>
  )
}
