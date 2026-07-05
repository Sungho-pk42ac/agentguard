import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'

export const metadata: Metadata = {
  title: 'AgentGuard Console',
  description: 'Fleet-wide AI agent security posture — Shadow AI, policy, offboarding, CVE, MCP catalog.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Nav />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  )
}
