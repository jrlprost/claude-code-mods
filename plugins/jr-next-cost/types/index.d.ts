export type JrNextCost = {
  /** Tokens the next request resends: the current context. */
  tokens: number
  model: string
  /** End of the main loop's last model response (epoch ms). */
  lastAt: number | null
  now: number
}

declare module 'claude-code' {
  interface PluginState {
    'jr-next-cost': { next: JrNextCost | null }
  }
}
