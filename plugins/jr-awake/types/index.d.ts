/** working: awake while Claude works in any session. session: awake while any session is open. off. */
export type JrAwakeMode = 'working' | 'session' | 'off'

export type JrAwakePower = {
  /** Idle minutes before system sleep; 0 means never. */
  sleepMin: number
  displaySleepMin: number
  /** Processes that currently prevent system sleep, as pmset names them. */
  preventedBy: string[]
  onBattery: boolean
  /** Seconds since the last keyboard or pointer event. */
  idleSeconds: number
}

/** One session's heartbeat in the shared store. */
export type JrAwakeSessionBeat = { id: string; project: string; working: boolean; holding: boolean; at: number }

export type JrAwakeView = {
  mode: JrAwakeMode
  holding: boolean
  /** Sessions holding the Mac awake, this one included. */
  holders: number
  sleepIn: number | null
  power: JrAwakePower | null
}

declare module 'claude-code' {
  interface PluginState {
    'jr-awake': { view: JrAwakeView | null }
  }
}
