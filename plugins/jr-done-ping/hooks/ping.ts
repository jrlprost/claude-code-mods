export const SOUNDS = ['none', 'Glass', 'Hero', 'Ping', 'Submarine', 'Funk', 'Purr'] as const

/** "42 s", "4 min 12 s", "1 h 05 min" */
export const spoken = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`
}

type Done = { durationMs: number; isAborted: boolean; agentId?: string; reason?: string }

/** Ping for the main loop's long turns that ended on their own (not interrupted). */
export const shouldPing = (e: Done, minSeconds: number) => e.agentId === undefined && !e.isAborted && e.durationMs >= minSeconds * 1000

export const message = (project: string, e: Done) =>
  e.reason === 'error' ? `${project}: stopped on an error after ${spoken(e.durationMs)}` : `${project}: done in ${spoken(e.durationMs)}`

export const soundFile = (sound: string) => (sound === 'none' || !SOUNDS.includes(sound as never) ? null : `/System/Library/Sounds/${sound}.aiff`)
