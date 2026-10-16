/** One plan-limit window as drawn: how much is used and when it resets (epoch ms). */
export type JrLimitWindow = { kind: string; percent: number; resetsAt: number | null }

export type JrLimitsView = { windows: JrLimitWindow[]; now: number }

declare module 'claude-code' {
  interface PluginState {
    'jr-limits': { view: JrLimitsView | null; isBandHidden: boolean }
  }
}
