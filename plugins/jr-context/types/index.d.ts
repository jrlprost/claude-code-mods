export type JrContextSegment = { name: string; tokens: number }

export type JrContextFill = {
  /** What occupies the window, in the order the engine lists it. */
  used: JrContextSegment[]
  /** Tokens in use. */
  total: number
  /** The window measured against. */
  max: number
  /** The compaction reserve at the end of the window. */
  buffer: number
  percent: number
}

declare module 'claude-code' {
  interface PluginState {
    'jr-context': { fill: JrContextFill | null }
  }
}
