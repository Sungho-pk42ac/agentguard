'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const LINKS: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Overview' },
  { href: '/fleet/', label: 'Fleet' },
  { href: '/report/', label: 'Shadow AI Report' },
  { href: '/policy/', label: 'Policy' },
  { href: '/offboarding/', label: 'Offboarding' },
  { href: '/cve/', label: 'CVE' },
  { href: '/mcp/', label: 'MCP Catalog' },
  { href: '/org/', label: 'Org & Invites' },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="sidebar no-print">
      <div className="brand">◆ AGENTGUARD</div>
      {LINKS.map((l) => {
        const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
        return (
          <Link key={l.href} href={l.href} className={`nav-link${active ? ' active' : ''}`}>
            {l.label}
          </Link>
        )
      })}
      <Link href="/login/" className="nav-link">
        Sign in / out
      </Link>
    </nav>
  )
}
