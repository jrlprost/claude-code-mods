export type JrCacheClock = {
  /** When the main loop's last model response ended (epoch ms). */
  lastAt: number | null
  now: number
  /** Share of the last turn's input read from the cache, 0..1, when the engine said. */
  hitRate: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'jr-cache-clock': { clock: JrCacheClock | null; isBandHidden: boolean }
  }
}
