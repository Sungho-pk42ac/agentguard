import { readFileSync } from 'node:fs'

// Single source for the running package version (read from package.json).
export function readVersion(): string {
  try {
    const parsed: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    if (parsed && typeof parsed === 'object' && typeof (parsed as { version?: unknown }).version === 'string') {
      return (parsed as { version: string }).version
    }
  } catch {
    // fall through
  }
  return '0.0.0'
}
