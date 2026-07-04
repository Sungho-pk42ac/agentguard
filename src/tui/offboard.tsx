import { Box, Text, useInput } from 'ink'
import { useEffect, useState } from 'react'
import type { CleanupPlanItem } from '../cleanup-actions.js'
import type { ResidualCredential } from '../residual.js'
import type { ScopeKey } from '../residual-scan.js'
import {
  applyOffboard,
  type OffboardApplyOptions,
  type OffboardApplyResult,
  type OffboardScanOptions,
  scanForOffboard,
} from './offboard-flow.js'
import { ScopeSelect } from './scope-select.js'
import { severityColor } from './view-model.js'

type Step = 'scope' | 'scanning' | 'review' | 'done'

export interface OffboardProps {
  readonly scanOptions?: OffboardScanOptions
  readonly applyOptions?: Partial<OffboardApplyOptions>
  readonly onExit: (summary: string) => void
}

export function Offboard({ scanOptions, applyOptions, onExit }: OffboardProps): React.ReactElement {
  const [step, setStep] = useState<Step>('scope')
  const [scopes, setScopes] = useState<ScopeKey[]>([])
  const [findings, setFindings] = useState<ResidualCredential[]>([])
  const [plan, setPlan] = useState<CleanupPlanItem[]>([])
  const [applied, setApplied] = useState<OffboardApplyResult | undefined>()

  useEffect(() => {
    if (step !== 'scanning') return
    const result = scanForOffboard({ ...scanOptions, scope: scopes })
    setFindings(result.findings)
    setPlan(result.plan)
    setStep('review')
  }, [step, scopes, scanOptions])

  function decide(approved: boolean): void {
    const result = applyOffboard(findings, plan, {
      approved,
      scope: scopes,
      homeDir: scanOptions?.homeDir,
      platform: scanOptions?.platform,
      ...applyOptions,
    })
    setApplied(result)
    setStep('done')
  }

  useInput((char, key) => {
    if (step === 'review') {
      if (char === 'y') return decide(true)
      if (char === 'n' || key.escape) return decide(false)
      return
    }
    if (step === 'done') {
      if (char === 'q' || key.return || key.escape) {
        const summary = applied
          ? `Offboarding sweep: ${applied.report.summary.findingCount} findings, ${applied.report.summary.appliedActions} action(s) applied.`
          : 'Offboarding sweep cancelled.'
        onExit(summary)
      }
    }
  })

  if (step === 'scope') {
    return (
      <ScopeSelect
        onConfirm={(selected) => {
          if (selected.length === 0) {
            onExit('Offboarding sweep cancelled.')
            return
          }
          setScopes(selected)
          setStep('scanning')
        }}
      />
    )
  }

  if (step === 'scanning') {
    return <Text color="cyan">Scanning {scopes.join(', ')} …</Text>
  }

  if (step === 'review') {
    const mutating = plan.filter((item) => item.action !== 'advise')
    const advise = plan.filter((item) => item.action === 'advise')
    return (
      <Box flexDirection="column">
        <Text color="cyan">Review — {findings.length} residual(s) found</Text>
        {findings.slice(0, 12).map((finding, index) => (
          <Text key={index} color={severityColor(finding.severity)}>
            [{finding.severity}] {finding.surface} {finding.location}
          </Text>
        ))}
        {findings.length > 12 ? <Text dimColor>… and {findings.length - 12} more</Text> : null}
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Proposed cleanup ({mutating.length} auto, {advise.length} manual):</Text>
          {mutating.slice(0, 12).map((item, index) => (
            <Text key={index} color="yellow">
              • {item.action}: {item.reason}
            </Text>
          ))}
          {advise.length > 0 ? <Text dimColor>• {advise.length} item(s) need manual review (advise-only).</Text> : null}
        </Box>
        <Text color="green">Apply cleanup now? Backups go to ~/.agentguard/trash. (y = apply / n = skip)</Text>
      </Box>
    )
  }

  // done
  const report = applied?.report
  return (
    <Box flexDirection="column">
      <Text color="cyan">Offboarding sweep complete</Text>
      {report ? (
        <Box flexDirection="column">
          <Text>findings: {report.summary.findingCount}</Text>
          <Text>applied: {report.summary.appliedActions}</Text>
          <Text>skipped: {applied?.records.filter((r) => r.status === 'skipped').length ?? 0}</Text>
          <Text color="red">failed: {applied?.records.filter((r) => r.status === 'failed').length ?? 0}</Text>
          {applied?.reportPaths ? <Text dimColor>report: {applied.reportPaths.jsonPath}</Text> : null}
          {applied?.trashDir ? <Text dimColor>trash: {applied.trashDir}</Text> : null}
        </Box>
      ) : null}
      <Text dimColor>press q to return to the session</Text>
    </Box>
  )
}
