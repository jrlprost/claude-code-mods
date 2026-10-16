/** One request: when it ended, how long it took, the status (null: failed or timed out). */
export type JrUptimeCheck = { at: number; ms: number; status: number | null }

export type JrUptimeSite = {
  url: string
  history: JrUptimeCheck[]
  downSince: number | null
  lastIncident: { from: number; to: number } | null
}

declare module 'claude-code' {
  interface PluginState {
    'jr-uptime': { sites: JrUptimeSite[]; isBandHidden: boolean }
  }
}
