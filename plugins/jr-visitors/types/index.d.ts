export type JrVisitorsFigures = {
  /** Unique visitors with a page view in the last 5 minutes. */
  now: number
  /** Unique visitors with a page view since midnight (project time zone). */
  today: number
  pages: { page: string; views: number }[]
  at: number
  error: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'jr-visitors': { figures: JrVisitorsFigures | null }
  }
}
