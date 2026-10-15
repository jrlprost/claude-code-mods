export type JrWrapped = {
  month: string
  label: string
  prompts: number
  turns: number
  activeMs: number
  costUsd: number
  activeDays: number
  longestStreak: number
  busiestHour: number | null
  busiestDay: { key: string; prompts: number } | null
  topTools: { name: string; count: number }[]
  topProjects: { name: string; prompts: number }[]
  persona: { title: string; line: string }
}

declare module 'claude-code' {
  interface PluginState {
    'jr-wrapped': { view: JrWrapped | null }
  }
}
