/** working: Claude is on a turn. waiting: Claude finished and waits for your next prompt. idle: waiting for over 30 minutes. */
export type JrFleetState = 'working' | 'waiting' | 'idle'

/** What each session writes to ~/.claude/jr-fleet/<session id>.json every 15 seconds. */
export type JrFleetBeat = {
  id: string
  cwd: string
  project: string
  state: JrFleetState
  /** When the session entered its state. */
  since: number
  lastPrompt: number | null
  /** When the file was last written. */
  beat: number
}

declare module 'claude-code' {
  interface PluginState {
    'jr-fleet': { fleet: { sessions: JrFleetBeat[]; self: string; home: string; at: number } | null }
  }
}
