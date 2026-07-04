import { Box, Text } from 'ink'
import { agentInventory } from './agent-inventory.js'
import type { DashboardData } from './dashboard-data.js'
import { glyph } from './theme.js'
import { severityColor } from './view-model.js'

// DUMB view. Onboarding inspection: which AI coding agents are installed and
// what residual permission/credential status they carry — composed purely from
// DashboardData (npm-global + ai-tool-dir surfaces). No detection here.
export function AgentsView({ data }: { readonly data: DashboardData }): React.ReactElement {
  const agents = agentInventory(data)
  if (agents.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="cyan">Agents — 0</Text>
        <Text dimColor>No installed AI coding agents detected (onboarding check).</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      <Text color="cyan">Agents — {agents.length} (installed AI coding tools · onboarding check)</Text>
      {agents.map((a, i) => {
        const surfaceIcon = glyph(a.source)
        return (
          <Box key={i} flexDirection="column">
            <Text color={severityColor(a.severity)} bold>
              ● {a.name} <Text dimColor>({surfaceIcon ? `${surfaceIcon} ` : ''}{a.source})</Text>
            </Text>
            <Text dimColor>  {a.detail}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
