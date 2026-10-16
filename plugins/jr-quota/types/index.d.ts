export type JrQuotaBalance = {
  id: string
  label: string
  text: string
  isLow: boolean
  /** Share left of the plan or of what was bought, 0..1, when the provider says. */
  ratio: number | null
  error: boolean
}

export type JrQuotaView = { balances: JrQuotaBalance[]; checkedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'jr-quota': { view: JrQuotaView | null; isBandHidden: boolean }
  }
}
