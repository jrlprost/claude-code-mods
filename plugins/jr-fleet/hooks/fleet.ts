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
