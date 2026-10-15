import type { JrTimeCategory, JrTimePeriod, JrTimeProjectRow, JrTimeReport, JrTimeSession, JrTimeSettings, JrTimeSpan } from '../types'

export const CATEGORIES: JrTimeCategory[] = ['window', 'withYou', 'alone', 'between', 'elsewhere', 'break']

export const LABELS: Record<JrTimeCategory, string> = {
  window: 'Prompt window',
  withYou: 'Claude working, you there',
  alone: 'Claude working, you away',
  between: 'You, between prompts',
  elsewhere: 'At the computer, elsewhere',
  break: 'Break',
}

export const DEFAULT_SETTINGS: JrTimeSettings = {
  windowMin: 5,
  idleMin: 5,
  ratios: { window: 100, withYou: 100, alone: 50, between: 100, elsewhere: 0, break: 0 },
  defaultRate: 0,
  rates: {},
  currency: '€',
  clients: {},
}

const SLOT = 15_000
const MINUTE = 60_000

const covers = (spans: readonly JrTimeSpan[], t: number) => spans.some(([a, b]) => a <= t && t < b)
const lastAtOrBefore = (sorted: readonly number[], t: number) => {
  let found: number | undefined
  for (const v of sorted) {
    if (v > t) break
    found = v
  }
  return found
}

/**
 * Splits the part of a session inside [from, to) into categories, in milliseconds.
 * Each 15-second slot gets exactly one category, so nothing is counted twice:
 * prompt window first, then Claude's turns (with or without you), then you near Claude's last
 * activity, then you at the computer but away from it, then break.
 */
export const classify = (log: JrTimeSession, s: JrTimeSettings, from: number, to: number) => {
  const out: Record<JrTimeCategory, number> = { window: 0, withYou: 0, alone: 0, between: 0, elsewhere: 0, break: 0 }
  const prompts = [...log.prompts].sort((a, b) => a - b)
  const turnEnds = log.turns.map(([, b]) => b).sort((a, b) => a - b)
  const begin = Math.max(from, log.start)
  const end = Math.min(to, log.last)
  const windowMs = s.windowMin * MINUTE
  const idleMs = s.idleMin * MINUTE
  for (let t = begin; t < end; t += SLOT) {
    const slot = Math.min(SLOT, end - t)
    const mid = t + slot / 2
    const lastPrompt = lastAtOrBefore(prompts, mid)
    const lastActivity = Math.max(lastPrompt ?? -Infinity, lastAtOrBefore(turnEnds, mid) ?? -Infinity)
    const isNearActivity = mid - lastActivity < idleMs
    const isPresent = log.hasPresence ? covers(log.present, mid) : isNearActivity
    let category: JrTimeCategory
    if (lastPrompt !== undefined && mid - lastPrompt < windowMs) category = 'window'
    else if (covers(log.turns, mid)) category = isPresent ? 'withYou' : 'alone'
    else if (isPresent && isNearActivity) category = 'between'
    else if (isPresent) category = 'elsewhere'
    else category = 'break'
    out[category] += slot
  }
  return out
}

export const billable = (categories: Record<JrTimeCategory, number>, s: JrTimeSettings) =>
  CATEGORIES.reduce((sum, c) => sum + (categories[c] * (s.ratios[c] ?? 0)) / 100, 0)

export const rateOf = (project: string, s: JrTimeSettings) => s.rates[project] ?? s.defaultRate

/** Start of the period that contains `now`, in local time: today, this week (Monday), this month. */
export const periodStart = (period: JrTimePeriod, now: number) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  if (period === 'month') d.setDate(1)
  return d.getTime()
}

export const report = (logs: readonly JrTimeSession[], s: JrTimeSettings, period: JrTimePeriod, now: number): JrTimeReport => {
  const from = periodStart(period, now)
  const categories: Record<JrTimeCategory, number> = { window: 0, withYou: 0, alone: 0, between: 0, elsewhere: 0, break: 0 }
  const byProject = new Map<string, Record<JrTimeCategory, number>>()
  for (const log of logs) {
    if (log.last < from) continue
    const part = classify(log, s, from, now)
    const acc = byProject.get(log.project) ?? { window: 0, withYou: 0, alone: 0, between: 0, elsewhere: 0, break: 0 }
    for (const c of CATEGORIES) {
      categories[c] += part[c]
      acc[c] += part[c]
    }
    byProject.set(log.project, acc)
  }
  const projects: JrTimeProjectRow[] = [...byProject.entries()]
    .map(([project, cats]) => {
      const billableMs = billable(cats, s)
      const rate = rateOf(project, s)
      return { project, client: s.clients[project] ?? project, rate, billableMs, amount: (billableMs / 3_600_000) * rate }
    })
    .filter(p => p.billableMs > 0)
    .sort((a, b) => b.billableMs - a.billableMs)
  return {
    period,
    categories,
    billableMs: projects.reduce((n, p) => n + p.billableMs, 0),
    amount: projects.reduce((n, p) => n + p.amount, 0),
    projects,
    hasPresence: logs.some(l => l.hasPresence),
  }
}

/** Adds a presence sample: the person was active in [at - span, at). Merges with the last span. */
export const addPresence = (present: JrTimeSpan[], at: number, span: number): JrTimeSpan[] => {
  const prev = present[present.length - 1]
  if (prev && prev[1] >= at - span - 1000) return [...present.slice(0, -1), [prev[0], at]]
  return [...present, [at - span, at]]
}

export const formatHours = (ms: number) => {
  const minutes = Math.round(ms / MINUTE)
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

export const formatMoney = (amount: number, currency: string) => `${Math.round(amount).toLocaleString('en-US')} ${currency}`

const csvCell = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`)

/** One row per project: client, hours per category, billable hours, rate and amount. */
export const toCsv = (r: JrTimeReport, s: JrTimeSettings, logs: readonly JrTimeSession[], now: number) => {
  const from = periodStart(r.period, now)
  const head = ['project', 'client', ...CATEGORIES.map(c => `${c}_hours`), 'billable_hours', 'rate', 'amount', 'currency']
  const rows = r.projects.map(p => {
    const cats: Record<JrTimeCategory, number> = { window: 0, withYou: 0, alone: 0, between: 0, elsewhere: 0, break: 0 }
    for (const log of logs.filter(l => l.project === p.project)) {
      const part = classify(log, s, from, now)
      for (const c of CATEGORIES) cats[c] += part[c]
    }
    const h = (ms: number) => Math.round((ms / 3_600_000) * 100) / 100
    return [p.project, p.client, ...CATEGORIES.map(c => h(cats[c])), h(p.billableMs), p.rate, Math.round(p.amount * 100) / 100, s.currency]
  })
  return [head, ...rows].map(row => row.map(csvCell).join(',')).join('\n') + '\n'
}

export const toMarkdown = (r: JrTimeReport, s: JrTimeSettings) => {
  const lines = [
    `# Time report: ${r.period}`,
    '',
    `Prompt window ${s.windowMin} min · idle after ${s.idleMin} min · ratios ${CATEGORIES.map(c => `${LABELS[c]} ${s.ratios[c]}%`).join(', ')}`,
    '',
    '| Project | Client | Billable | Rate | Amount |',
    '| --- | --- | --- | --- | --- |',
    ...r.projects.map(p => `| ${p.project} | ${p.client} | ${formatHours(p.billableMs)} | ${p.rate} ${s.currency}/h | ${formatMoney(p.amount, s.currency)} |`),
    `| **Total** | | **${formatHours(r.billableMs)}** | | **${formatMoney(r.amount, s.currency)}** |`,
  ]
  return lines.join('\n') + '\n'
}
