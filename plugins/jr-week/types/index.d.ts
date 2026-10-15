export type JrWeekTotals = { activeMs: number; prompts: number; costUsd: number }

export type JrWeekView = {
  back: number
  report: {
    from: number
    label: string
    days: (JrWeekTotals & { key: string; name: string })[]
    projects: (JrWeekTotals & { name: string })[]
    total: JrWeekTotals
  }
}

declare module 'claude-code' {
  interface PluginState {
    'jr-week': { view: JrWeekView | null }
  }
}
