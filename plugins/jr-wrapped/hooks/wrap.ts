import type { DayStats } from './activity'
import { emptyDay } from './activity'

export type Wrapped = {
  month: string
  label: string
  prompts: number
  turns: number
  activeMs: number
  costUsd: number
  activeDays: number
  longestStreak: number
  busiestHour: number | null
  busiestDay: { key: string; prompts: number } | null
  topTools: { name: string; count: number }[]
  topProjects: { name: string; prompts: number }[]
  persona: { title: string; line: string }
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** `''` (this month), `last`, `2026-10`, `oct`, `october` → { year, month (0-based) }. */
export const parseMonth = (arg: string, now: number) => {
  const d = new Date(now)
  const a = arg.trim().toLowerCase()
  if (!a) return { year: d.getFullYear(), month: d.getMonth() }
  if (a === 'last') return d.getMonth() === 0 ? { year: d.getFullYear() - 1, month: 11 } : { year: d.getFullYear(), month: d.getMonth() - 1 }
  const iso = /^(\d{4})-(\d{1,2})$/.exec(a)
  if (iso) return { year: Number(iso[1]), month: Math.min(11, Math.max(0, Number(iso[2]) - 1)) }
  const i = MONTHS.findIndex(m => m.startsWith(a.slice(0, 3)))
  if (i >= 0) return { year: i > d.getMonth() ? d.getFullYear() - 1 : d.getFullYear(), month: i }
  return { year: d.getFullYear(), month: d.getMonth() }
}

const top = <T>(entries: [string, number][], n: number, make: (name: string, v: number) => T) =>
  entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => make(k, v))

/** A playful title from how the month went. */
export const personaOf = (w: Pick<Wrapped, 'busiestHour' | 'topTools' | 'topProjects' | 'prompts' | 'activeDays'>, projectCount: number) => {
  const tool = w.topTools[0]?.name ?? ''
  if (w.prompts === 0) return { title: 'The Sleeper', line: 'A quiet month. Claude missed you.' }
  if (w.busiestHour !== null && (w.busiestHour >= 22 || w.busiestHour < 5)) return { title: 'The Night Owl', line: 'Your best ideas arrive after dark.' }
  if (projectCount >= 6) return { title: 'The Juggler', line: `${projectCount} projects in one month. Respect.` }
  if (/^(Bash|PowerShell)$/.test(tool)) return { title: 'The Shell Whisperer', line: 'You speak fluent terminal.' }
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return { title: 'The Code Sculptor', line: 'Edit after edit, you shape things.' }
  if (/^(Read|Grep|Glob)$/.test(tool)) return { title: 'The Explorer', line: 'You read the map before you move.' }
  if (/^(WebFetch|WebSearch)$/.test(tool) || tool.startsWith('mcp__')) return { title: 'The Researcher', line: 'The whole internet is your library.' }
  if (w.activeDays >= 20) return { title: 'The Marathoner', line: 'Showing up, day after day.' }
  return { title: 'The Steady Builder', line: 'One prompt at a time, it adds up.' }
}

export const wrapMonth = (days: Record<string, DayStats>, year: number, month: number): Wrapped => {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  // Every day of the month, recorded or not, so a gap breaks a streak.
  const length = new Date(year, month + 1, 0).getDate()
  const keys = Array.from({ length }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`)
  const tools = new Map<string, number>()
  const projects = new Map<string, number>()
  const hours = Array.from({ length: 24 }, () => 0)
  let prompts = 0
  let turns = 0
  let activeMs = 0
  let costUsd = 0
  let activeDays = 0
  let run = 0
  let longestStreak = 0
  let busiestDay: Wrapped['busiestDay'] = null
  for (const k of keys) {
    const d = days[k] ?? emptyDay()
    prompts += d.prompts
    turns += d.turns
    activeMs += d.activeMs
    costUsd += d.costUsd
    if (d.prompts > 0) activeDays += 1
    run = d.prompts > 0 ? run + 1 : 0
    longestStreak = Math.max(longestStreak, run)
    if (d.prompts > (busiestDay?.prompts ?? 0)) busiestDay = { key: k, prompts: d.prompts }
    d.hours.forEach((n, h) => (hours[h]! += n))
    for (const [t, n] of Object.entries(d.tools)) tools.set(t, (tools.get(t) ?? 0) + n)
    for (const [p, s] of Object.entries(d.projects)) projects.set(p, (projects.get(p) ?? 0) + s.prompts)
  }
  const peak = Math.max(...hours)
  const base = {
    month: prefix,
    label: new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    prompts,
    turns,
    activeMs,
    costUsd,
    activeDays,
    longestStreak,
    busiestHour: peak > 0 ? hours.indexOf(peak) : null,
    busiestDay,
    topTools: top([...tools.entries()], 3, (name, count) => ({ name, count })),
    topProjects: top([...projects.entries()], 3, (name, prompts) => ({ name, prompts })),
  }
  return { ...base, persona: personaOf(base, [...projects.values()].filter(v => v > 0).length) }
}

export const hours = (ms: number) => `${Math.round(ms / 3_600_000)}h`
export const hourLabel = (h: number | null) => (h === null ? '—' : `${String(h).padStart(2, '0')}:00`)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A 1080×1350 share card in the jr colours. */
export const toSvg = (w: Wrapped) => {
  const stat = (x: number, y: number, value: string, label: string) =>
    `<text x="${x}" y="${y}" font-size="72" font-weight="700" fill="#fffffe">${esc(value)}</text><text x="${x}" y="${y + 44}" font-size="26" fill="#94a1b2">${esc(label)}</text>`
  const list = (y: number, title: string, rows: string[]) =>
    `<text x="90" y="${y}" font-size="26" fill="#94a1b2" letter-spacing="3">${esc(title.toUpperCase())}</text>` +
    rows.map((r, i) => `<text x="90" y="${y + 54 + i * 50}" font-size="38" fill="#fffffe">${i + 1}. ${esc(r)}</text>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" font-family="Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7f5af0"/><stop offset="0.55" stop-color="#ff5ca8"/><stop offset="1" stop-color="#ffb86b"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="#16161a"/>
  <rect x="0" y="0" width="1080" height="360" fill="url(#g)"/>
  <text x="90" y="130" font-size="34" fill="#16161a" letter-spacing="6">JR MODS · CLAUDE WRAPPED</text>
  <text x="90" y="240" font-size="96" font-weight="700" fill="#16161a">${esc(w.label)}</text>
  <text x="90" y="310" font-size="34" fill="#16161a">${esc(w.persona.title)} · ${esc(w.persona.line)}</text>
  ${stat(90, 500, w.prompts.toLocaleString('en-US'), 'prompts')}
  ${stat(420, 500, hours(w.activeMs), 'Claude working')}
  ${stat(750, 500, String(w.activeDays), 'active days')}
  ${stat(90, 680, `${w.longestStreak}d`, 'longest streak')}
  ${stat(420, 680, hourLabel(w.busiestHour), 'busiest hour')}
  ${stat(750, 680, `$${Math.round(w.costUsd)}`, 'spent')}
  ${list(860, 'Top tools', w.topTools.map(t => `${t.name} · ${t.count}`))}
  ${list(1090, 'Top projects', w.topProjects.map(p => `${p.name} · ${p.prompts} prompts`))}
  <text x="990" y="1310" text-anchor="end" font-size="22" fill="#5c5f77">github.com/jrlprost/claude-code-mods</text>
</svg>
`
}
