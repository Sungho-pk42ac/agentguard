import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import type { ResidualCredential } from './residual.js'

// Baseline snapshots for change tracking, stored under ~/.agentguard/baselines/.
// The default snapshot stores identity only (id, surface, severity, location) —
// ZERO secret material. `--track-rotation` opts in to a value fingerprint hash
// (never the value itself) so a rotated key at the same location is detected.
// `schemaVersion` keeps the on-disk format evolvable (amendment 9).

export const BASELINE_SCHEMA_VERSION = 1 as const

const baselineEntrySchema = z.object({
  id: z.string().min(1),
  surface: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  location: z.string().min(1),
  valueHash: z.string().optional(),
})

export const baselineSchema = z.object({
  schemaVersion: z.literal(BASELINE_SCHEMA_VERSION),
  tool: z.literal('agentguard'),
  scanId: z.string().min(1),
  createdAt: z.string().min(1),
  trackRotation: z.boolean(),
  entries: z.array(baselineEntrySchema),
})

export type Baseline = z.infer<typeof baselineSchema>
export type BaselineEntry = z.infer<typeof baselineEntrySchema>

export interface BaselineDiff {
  readonly appeared: readonly ResidualCredential[]
  readonly disappeared: readonly BaselineEntry[]
  readonly rotated: readonly ResidualCredential[]
  readonly unchanged: number
}

export function baselineDir(homeDir: string = homedir()): string {
  return join(homeDir, '.agentguard', 'baselines')
}

function sanitizeScanId(scanId: string): string {
  const safe = scanId.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return safe.length > 0 ? safe : 'default'
}

function baselinePath(scanId: string, homeDir?: string): string {
  return join(baselineDir(homeDir), `${sanitizeScanId(scanId)}.json`)
}

// Fingerprint of the (already redacted) evidence. sha256 is one-way and the
// input is redacted, so no secret material is stored — only enough to notice a
// value change at the same location.
export function valueFingerprint(evidence: string): string {
  return createHash('sha256').update(evidence).digest('hex').slice(0, 16)
}

export interface BuildBaselineOptions {
  readonly scanId?: string
  readonly trackRotation?: boolean
  readonly createdAt?: string
}

export function buildBaseline(residuals: readonly ResidualCredential[], options: BuildBaselineOptions = {}): Baseline {
  const trackRotation = options.trackRotation ?? false
  const entries: BaselineEntry[] = residuals.map((residual) => ({
    id: residual.id,
    surface: residual.surface,
    severity: residual.severity,
    location: residual.location,
    ...(trackRotation ? { valueHash: valueFingerprint(residual.evidence) } : {}),
  }))
  return baselineSchema.parse({
    schemaVersion: BASELINE_SCHEMA_VERSION,
    tool: 'agentguard',
    scanId: sanitizeScanId(options.scanId ?? 'default'),
    createdAt: options.createdAt ?? new Date().toISOString(),
    trackRotation,
    entries,
  })
}

export interface SaveBaselineOptions extends BuildBaselineOptions {
  readonly homeDir?: string
}

export interface SaveBaselineResult {
  readonly path: string
  readonly baseline: Baseline
}

export function saveBaseline(residuals: readonly ResidualCredential[], options: SaveBaselineOptions = {}): SaveBaselineResult {
  const baseline = buildBaseline(residuals, options)
  const dir = baselineDir(options.homeDir)
  mkdirSync(dir, { recursive: true })
  const path = baselinePath(baseline.scanId, options.homeDir)
  writeFileSync(path, JSON.stringify(baseline, null, 2) + '\n')
  return { path, baseline }
}

export function loadBaseline(scanId = 'default', homeDir?: string): Baseline | undefined {
  const path = baselinePath(scanId, homeDir)
  if (!existsSync(path)) return undefined
  return baselineSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

export function diffAgainstBaseline(
  baseline: Baseline,
  current: readonly ResidualCredential[],
  trackRotation = false,
): BaselineDiff {
  const baselineById = new Map(baseline.entries.map((entry) => [entry.id, entry]))
  const currentById = new Map(current.map((residual) => [residual.id, residual]))

  const appeared = current.filter((residual) => !baselineById.has(residual.id))
  const disappeared = baseline.entries.filter((entry) => !currentById.has(entry.id))

  const rotated: ResidualCredential[] = []
  let unchanged = 0
  const compareRotation = trackRotation && baseline.trackRotation
  for (const [id, entry] of baselineById) {
    const residual = currentById.get(id)
    if (!residual) continue
    if (compareRotation && entry.valueHash !== undefined && valueFingerprint(residual.evidence) !== entry.valueHash) {
      rotated.push(residual)
    } else {
      unchanged += 1
    }
  }

  return { appeared, disappeared, rotated, unchanged }
}
