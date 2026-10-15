import type { JrLimitWindow } from '../types'

const ORDER: Record<string, number> = { five_hour: 0, seven_day: 1, spend_limit: 2 }

export const labelOf = (kind: string) =>
  kind === 'five_hour' ? '5h' : kind === 'seven_day' ? '7d' : kind === 'spend_limit' ? 'spend' : kind.replace(/_/g, ' ')

/** The engine's rate-limit rows, sorted 5h, 7d, spend, then the rest. */
export const windowsOf = (rows: readonly { kind: string; percentUsed: number; resetsAt?: string }[]): JrLimitWindow[] =>
  rows
    .map(r => ({ kind: r.kind, percent: r.percentUsed, resetsAt: r.resetsAt ? Date.parse(r.resetsAt) : null }))
    .sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9))

/** "1h12", "42m", "3d 4h" until `at`. */
export const countdown = (at: number | null, now: number) => {
  if (at === null) return ''
  const minutes = Math.max(0, Math.round((at - now) / 60_000))
  if (minutes >= 48 * 60) return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
  return `${minutes}m`
}

/** Thresholds crossed by this reading that were not crossed before (e.g. [80] then [95]). */
export const crossed = (percent: number, alreadyWarned: readonly number[], thresholds: readonly number[]) =>
  thresholds.filter(t => percent >= t && !alreadyWarned.includes(t))
