export type JrContextFill = { tokens: number; window: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    'jr-context': { fill: JrContextFill | null }
  }
}
