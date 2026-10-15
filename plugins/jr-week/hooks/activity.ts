// Activity history shared by jr-week, jr-heatmap and jr-wrapped. Each mod keeps its own copy
// of this file and of its records (a mod's store is its own); the code is identical across them.
import type { EngineInterface } from 'claude-code'

export type ProjectStats = { prompts: number; turns: number; activeMs: number; costUsd: number }

export type DayStats = {
  prompts: number
  turns: number
  /** Time Claude spent working (sum of turn durations). */
  activeMs: number
  costUsd: number
  tools: Record<string, number>
  /** Prompts per hour of the day, 24 entries. */
  hours: number[]
  projects: Record<string, ProjectStats>
}

/** Days of one month, keyed YYYY-MM-DD (local time). */
export type MonthActivity = Record<string, DayStats>

const pad = (n: number) => String(n).padStart(2, '0')

export const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const monthKey = (t: number) => dayKey(t).slice(0, 7)

export const emptyDay = (): DayStats => ({ prompts: 0, turns: 0, activeMs: 0, costUsd: 0, tools: {}, hours: Array.from({ length: 24 }, () => 0), projects: {} })

const project = (day: DayStats, name: string) => (day.projects[name] ??= { prompts: 0, turns: 0, activeMs: 0, costUsd: 0 })

export const addPrompt = (day: DayStats, at: number, name: string) => {
  day.prompts += 1
  day.hours[new Date(at).getHours()] = (day.hours[new Date(at).getHours()] ?? 0) + 1
  project(day, name).prompts += 1
}

export const addTurn = (day: DayStats, durationMs: number, costUsd: number, name: string) => {
  day.turns += 1
  day.activeMs += durationMs
  day.costUsd += costUsd
  const p = project(day, name)
  p.turns += 1
  p.activeMs += durationMs
  p.costUsd += costUsd
}

export const addTool = (day: DayStats, tool: string) => {
  day.tools[tool] = (day.tools[tool] ?? 0) + 1
}

/** Every day from `from` to `to` (inclusive, local), oldest first. */
export const daysBetween = (from: number, to: number) => {
  const out: string[] = []
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  while (d.getTime() <= to + 12 * 3_600_000 && out.length < 400) {
    out.push(dayKey(d.getTime()))
    d.setDate(d.getDate() + 1)
  }
  return out
}

// ── Recording: one live record per session, in the mod's own store ──────────────────────────

const STORE_PREFIX = 'activity:'
const live: { project: string; lastCostUsd: number | null } = { project: '', lastCostUsd: null }

export async function currentProject($: EngineInterface) {
  if (!live.project) {
    const root = await $.session.root()
    live.project = root.split('/').pop() || root
  }
  return live.project
}

async function withDay($: EngineInterface, at: number, change: (day: DayStats) => void) {
  const key = STORE_PREFIX + monthKey(at)
  const month = ((await $.store.get(key)) as MonthActivity | undefined) ?? {}
  const day = month[dayKey(at)] ?? emptyDay()
  change(day)
  month[dayKey(at)] = day
  await $.store.set(key, month)
}

export async function recordPrompt($: EngineInterface) {
  const at = await $.clock.now()
  const name = await currentProject($)
  await withDay($, at, day => addPrompt(day, at, name))
}

/** The session's cost so far, minus what was already counted: the cost of this turn. */
export async function recordTurn($: EngineInterface, durationMs: number) {
  const at = await $.clock.now()
  const name = await currentProject($)
  const usage = await $.session.usage()
  const total = usage.cost?.usd ?? 0
  const delta = live.lastCostUsd === null ? 0 : Math.max(0, total - live.lastCostUsd)
  live.lastCostUsd = total
  await withDay($, at, day => addTurn(day, durationMs, delta, name))
}

export async function primeCost($: EngineInterface) {
  if (live.lastCostUsd !== null) return
  const usage = await $.session.usage()
  live.lastCostUsd = usage.cost?.usd ?? 0
}

export async function recordTool($: EngineInterface, tool: string) {
  const at = await $.clock.now()
  await withDay($, at, day => addTool(day, tool))
}

/** The recorded days between two instants, missing days filled empty. */
export async function loadDays($: EngineInterface, from: number, to: number) {
  const months = new Map<string, MonthActivity>()
  const out: Record<string, DayStats> = {}
  for (const key of daysBetween(from, to)) {
    const m = key.slice(0, 7)
    if (!months.has(m)) months.set(m, ((await $.store.get(STORE_PREFIX + m)) as MonthActivity | undefined) ?? {})
    out[key] = months.get(m)![key] ?? emptyDay()
  }
  return out
}
