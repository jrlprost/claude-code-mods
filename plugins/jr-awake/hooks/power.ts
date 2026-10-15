import type { JrAwakeMode, JrAwakePower, JrAwakeSessionBeat } from '../types'

export const MODES: JrAwakeMode[] = ['working', 'session', 'off']
export const BEAT_STALE_MS = 60_000

/**
 * Reads `pmset -g`: the idle minutes before the system and the display sleep (0 = never),
 * and which processes currently prevent system sleep.
 */
export const parsePmset = (text: string): Omit<JrAwakePower, 'idleSeconds'> => {
  const minutes = (name: string) => {
    const m = text.match(new RegExp(`^\\s*${name}\\s+(\\d+)`, 'm'))
    return m ? Number(m[1]) : 0
  }
  const prevented = text.match(/^\s*sleep\s+\d+\s+\(sleep prevented by ([^)]*)\)/m)?.[1]
  return {
    sleepMin: minutes('sleep'),
    displaySleepMin: minutes('displaysleep'),
    preventedBy: prevented ? prevented.split(',').map(s => s.trim()).filter(Boolean) : [],
    onBattery: /Battery Power/.test(text),
  }
}

/**
 * Seconds until the Mac goes to idle sleep, or null when it will not: sleep disabled, or something
 * other than this mod's own caffeinate already prevents it.
 */
export const secondsToSleep = (p: JrAwakePower, ownCaffeinate: boolean) => {
  if (p.sleepMin <= 0) return null
  const others = p.preventedBy.filter(name => !(ownCaffeinate && name === 'caffeinate'))
  if (others.length > 0 || ownCaffeinate) return null
  return Math.max(0, p.sleepMin * 60 - p.idleSeconds)
}

/** Sessions whose heartbeat is fresh and that say Claude is working. */
export const workingSessions = (beats: readonly JrAwakeSessionBeat[], now: number) =>
  beats.filter(b => b.working && now - b.at < BEAT_STALE_MS)

/** Whether this session should hold the Mac awake right now. */
export const shouldHold = (mode: JrAwakeMode, isWorking: boolean) => mode === 'session' || (mode === 'working' && isWorking)

export const formatCountdown = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
