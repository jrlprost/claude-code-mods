import type { JrOutageService } from '../types'
import { printable } from './jr/text'

// Public Statuspage endpoints (no key needed), checked October 2026.
export const SERVICES = [
  { name: 'Claude', url: 'https://status.claude.com/api/v2/status.json' },
  { name: 'GitHub', url: 'https://www.githubstatus.com/api/v2/status.json' },
  { name: 'npm', url: 'https://status.npmjs.org/api/v2/status.json' },
  { name: 'Vercel', url: 'https://www.vercel-status.com/api/v2/status.json' },
] as const

const RANK: Record<string, number> = { none: 0, maintenance: 1, minor: 2, major: 3, critical: 4, unknown: 1 }

export const COLOR: Record<string, string> = {
  none: '#2cb67d',
  maintenance: '#3da9fc',
  minor: '#f4d35e',
  major: '#ff8c42',
  critical: '#ef4565',
  unknown: '#6b7089',
}

/** A Statuspage status.json body as one service row. */
export const serviceOf = (name: string, body: string | null): JrOutageService => {
  try {
    const status = (JSON.parse(body ?? '') as { status?: { indicator?: string; description?: string } }).status
    if (status?.indicator) return { name, indicator: printable(status.indicator, 20), description: printable(status.description ?? status.indicator, 120) }
  } catch {
    // An unreadable answer is reported as unknown below.
  }
  return { name, indicator: 'unknown', description: 'status page unreachable' }
}

/** Services that are not fully operational, worst first; an unreachable page alone is not an outage. */
export const degraded = (services: readonly JrOutageService[]) =>
  services.filter(s => s.indicator !== 'none' && s.indicator !== 'unknown').sort((a, b) => (RANK[b.indicator] ?? 0) - (RANK[a.indicator] ?? 0))
