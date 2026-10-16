export type JrStripeFigures = {
  currency: string
  /** Net revenue today, smallest currency unit. */
  today: number
  /** Monthly recurring revenue, smallest currency unit. */
  mrr: number
  /** Net revenue per day, last 30 days, oldest first. */
  daily: number[]
  at: number
  error: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'jr-stripemrr': { figures: JrStripeFigures | null; isBandHidden: boolean }
  }
}
