import type { DayStats } from './activity'
import { dayKey } from './activity'

const DAY = 86_400_000
const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Monday 00:00 local of the week containing `now`, `back` weeks earlier. */
export const weekStart = (now: number, back = 0) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - back * 7)
  return d.getTime()
}

export type Totals = { activeMs: number; prompts: number; costUsd: number }
export type WeekReport = {
  from: number
  label: string
  days: (Totals & { key: string; name: string })[]
  projects: (Totals & { name: string })[]
  total: Totals
}

const zero = (): Totals => ({ activeMs: 0, prompts: 0, costUsd: 0 })

export const weekReport = (days: Record<string, DayStats>, from: number): WeekReport => {
  const total = zero()
  const projects = new Map<string, Totals>()
  const rows = NAMES.map((name, i) => {
    const key = dayKey(from + i * DAY + 12 * 3_600_000)
    const d = days[key]
    const row = { key, name, activeMs: d?.activeMs ?? 0, prompts: d?.prompts ?? 0, costUsd: d?.costUsd ?? 0 }
    total.activeMs += row.activeMs
    total.prompts += row.prompts
    total.costUsd += row.costUsd
    for (const [p, s] of Object.entries(d?.projects ?? {})) {
      const acc = projects.get(p) ?? zero()
      acc.activeMs += s.activeMs
      acc.prompts += s.prompts
      acc.costUsd += s.costUsd
      projects.set(p, acc)
    }
    return row
  })
  const end = new Date(from + 6 * DAY)
  const start = new Date(from)
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return {
    from,
    label: `${fmt(start)} – ${fmt(end)}`,
    days: rows,
    projects: [...projects.entries()].map(([name, t]) => ({ name, ...t })).filter(p => p.prompts + p.activeMs > 0).sort((a, b) => b.activeMs - a.activeMs || b.prompts - a.prompts),
    total,
  }
}

export const hours = (ms: number) => {
  const m = Math.round(ms / 60_000)
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

export const usd = (n: number) => `$${n.toFixed(2)}`

export const toMarkdown = (r: WeekReport) =>
  [
    `# Week ${r.label}`,
    '',
    '| Day | Claude working | Prompts | Cost |',
    '| --- | --- | --- | --- |',
    ...r.days.map(d => `| ${d.name} | ${hours(d.activeMs)} | ${d.prompts} | ${usd(d.costUsd)} |`),
    `| **Total** | **${hours(r.total.activeMs)}** | **${r.total.prompts}** | **${usd(r.total.costUsd)}** |`,
    '',
    '| Project | Claude working | Prompts | Cost |',
    '| --- | --- | --- | --- |',
    ...r.projects.map(p => `| ${p.name} | ${hours(p.activeMs)} | ${p.prompts} | ${usd(p.costUsd)} |`),
    '',
  ].join('\n')
