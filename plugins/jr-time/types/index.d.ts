/** The ways a stretch of session time is classified; each gets its own billing ratio. */
export type JrTimeCategory = 'window' | 'withYou' | 'alone' | 'between' | 'elsewhere' | 'break'

/** [start, end) in epoch milliseconds. */
export type JrTimeSpan = [number, number]

/** Everything recorded for one session, raw: billing is computed from it later. */
export type JrTimeSession = {
  id: string
  project: string
  start: number
  last: number
  prompts: number[]
  turns: JrTimeSpan[]
  /** Spans where the person was active on the computer (keyboard or pointer). */
  present: JrTimeSpan[]
  /** False where the machine gives no activity signal: presence is then inferred. */
  hasPresence: boolean
}

export type JrTimeSettings = {
  /** Minutes always counted after each prompt. */
  windowMin: number
  /** Minutes without activity after which time is a break. */
  idleMin: number
  /** Percent of each category that is billable. */
  ratios: Record<JrTimeCategory, number>
  defaultRate: number
  /** Hourly rate per project. */
  rates: Record<string, number>
  currency: string
  /** Client name per project. */
  clients: Record<string, string>
}

export type JrTimePeriod = 'today' | 'week' | 'month'

export type JrTimeProjectRow = { project: string; client: string; rate: number; billableMs: number; amount: number }

export type JrTimeReport = {
  period: JrTimePeriod
  categories: Record<JrTimeCategory, number>
  billableMs: number
  amount: number
  projects: JrTimeProjectRow[]
  hasPresence: boolean
}

export type JrTimeView = { report: JrTimeReport; settings: JrTimeSettings; current: string }

export type JrTimeMessage =
  | { type: 'ratio'; category: JrTimeCategory; delta: number }
  | { type: 'setting'; key: 'windowMin' | 'idleMin'; delta: number }
  | { type: 'rate'; project: string; delta: number }
  | { type: 'period'; period: JrTimePeriod }
  | { type: 'export' }

declare module 'claude-code' {
  interface PluginState {
    'jr-time': { view: JrTimeView | null; band: { billableMs: number; amount: number; project: string; currency: string; hasRate: boolean } | null; isBandHidden: boolean }
  }
}
