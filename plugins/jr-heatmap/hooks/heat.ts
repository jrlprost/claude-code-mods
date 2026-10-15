import type { DayStats } from './activity'
import { dayKey } from './activity'

export const WEEKS = 26
const DAY = 86_400_000

/** Monday 00:00 local of the first of the WEEKS columns ending with the week of `now`. */
export const gridStart = (now: number) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - (WEEKS - 1) * 7)
  return d.getTime()
}

export const LEVEL_COLORS = ['#24263a', '#3b2f6e', '#7f5af0', '#ff5ca8', '#ffb86b']

/** 0 for no prompt, then 1 to 4 by quarter of the busiest day. */
export const levelOf = (prompts: number, most: number) => (prompts <= 0 ? 0 : Math.min(4, Math.ceil((prompts / Math.max(1, most)) * 4)))

export type Cell = { key: string; prompts: number; level: number; isFuture: boolean }

/** grid[row = weekday Mon..Sun][column = week], oldest week first. */
export const grid = (days: Record<string, DayStats>, now: number) => {
  const start = gridStart(now)
  const todayKey = dayKey(now)
  const keys = Array.from({ length: WEEKS * 7 }, (_, i) => dayKey(start + i * DAY + 12 * 3_600_000))
  const most = Math.max(1, ...keys.map(k => days[k]?.prompts ?? 0))
  let isAfterToday = false
  const flat: Cell[] = keys.map(key => {
    const cell = { key, prompts: days[key]?.prompts ?? 0, level: levelOf(days[key]?.prompts ?? 0, most), isFuture: isAfterToday }
    if (key === todayKey) isAfterToday = true
    return cell
  })
  return Array.from({ length: 7 }, (_, row) => Array.from({ length: WEEKS }, (_, col) => flat[col * 7 + row]!))
}

/** Current streak (counting from today, or yesterday when today is still empty) and longest streak. */
export const streaks = (days: Record<string, DayStats>, now: number) => {
  const start = gridStart(now)
  const keys: string[] = []
  for (let t = start + 12 * 3_600_000; dayKey(t) <= dayKey(now); t += DAY) keys.push(dayKey(t))
  let longest = 0
  let run = 0
  for (const k of keys) {
    run = (days[k]?.prompts ?? 0) > 0 ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  let current = 0
  const back = [...keys].reverse()
  if ((days[back[0] ?? '']?.prompts ?? 0) === 0) back.shift()
  for (const k of back) {
    if ((days[k]?.prompts ?? 0) === 0) break
    current += 1
  }
  return { current, longest }
}

/** Prompts per hour of the day over all the days given. */
export const peakHours = (days: Record<string, DayStats>) => {
  const out = Array.from({ length: 24 }, () => 0)
  for (const d of Object.values(days)) d.hours.forEach((n, h) => (out[h]! += n))
  return out
}

export const monthLabels = (now: number) => {
  // Each week column is two cells wide; a month's three letters start at its first week.
  const start = gridStart(now)
  const line = Array.from({ length: WEEKS * 2 }, () => ' ')
  let last = -1
  for (let col = 0; col < WEEKS; col++) {
    const at = new Date(start + col * 7 * DAY)
    if (at.getMonth() === last) continue
    last = at.getMonth()
    const label = at.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 3)
    if (col * 2 + 3 > line.length) continue
    for (let i = 0; i < label.length; i++) line[col * 2 + i] = label[i]!
  }
  return line.join('')
}
