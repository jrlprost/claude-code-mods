export type JrHeatmapView = {
  /** cells[weekday][week]: level 0–4, or -1 for days still to come. */
  cells: number[][]
  months: string
  streaks: { current: number; longest: number }
  hours: number[]
  total: number
  activeDays: number
}

declare module 'claude-code' {
  interface PluginState {
    'jr-heatmap': { view: JrHeatmapView | null }
  }
}
