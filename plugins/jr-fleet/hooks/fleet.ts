import type { JrFleetBeat, JrFleetState } from '../types'

/** A heartbeat older than this means the session is gone. */
export const STALE_MS = 60_000
/** Waiting longer than this reads as idle. */
export const IDLE_AFTER_MS = 30 * 60_000
/** Heartbeat files older than this are deleted. */
export const CLEAN_AFTER_MS = 24 * 3_600_000

export const stateOf = (beat: JrFleetBeat, now: number): JrFleetState =>
  beat.state === 'waiting' && now - beat.since > IDLE_AFTER_MS ? 'idle' : beat.state

/** Sessions still beating: waiting first (oldest wait first), then working, then idle. */
export const liveSessions = (beats: readonly JrFleetBeat[], now: number) => {
  const order: Record<JrFleetState, number> = { waiting: 0, working: 1, idle: 2 }
  return beats
    .filter(b => now - b.beat < STALE_MS)
    .map(b => ({ ...b, state: stateOf(b, now) }))
    .sort((a, b) => order[a.state] - order[b.state] || a.since - b.since)
}

export const summary = (sessions: readonly { state: JrFleetState }[]) => ({
  total: sessions.length,
  waiting: sessions.filter(s => s.state === 'waiting').length,
  working: sessions.filter(s => s.state === 'working').length,
})

export const since = (ms: number) => {
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

export const shortPath = (cwd: string, home: string) => (home && cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd)

/** This session first, then the others in liveSessions' order. */
export const selfFirst = <T extends { id: string }>(sessions: readonly T[], self: string) => [...sessions.filter(s => s.id === self), ...sessions.filter(s => s.id !== self)]

const NAME_MAX = 20
export const shortName = (project: string) => (project.length > NAME_MAX ? `${project.slice(0, NAME_MAX - 1)}…` : project)

/** The sessions that fit in `columns` as `name ●` joined by ` · `, and how many are left for a `+N`. */
export const fitSessions = <T extends { project: string }>(sessions: readonly T[], columns: number) => {
  const shown: T[] = []
  let width = 0
  for (const [i, s] of sessions.entries()) {
    const w = shortName(s.project).length + 2 + (shown.length ? 3 : 0)
    const tail = i < sessions.length - 1 ? ` · +${sessions.length - i - 1}`.length : 0
    if (shown.length && width + w + tail > columns) break
    shown.push(s)
    width += w
  }
  return { shown, more: sessions.length - shown.length }
}
