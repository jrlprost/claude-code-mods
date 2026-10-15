import type { JrQuotaBalance } from '../types'

export type Provider = {
  id: string
  label: string
  /** userConfig field holding the key, and the environment variable read when it is empty. */
  option: string
  env: string
  url: string
  /** Turns the response body into a balance, given the low thresholds. */
  parse: (json: unknown, low: { usd: number; credits: number }) => Omit<JrQuotaBalance, 'id' | 'label'>
}

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : Number.NaN)

export const PROVIDERS: Provider[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    option: 'openrouterKey',
    env: 'OPENROUTER_API_KEY',
    url: 'https://openrouter.ai/api/v1/credits',
    parse: (json, low) => {
      const data = (json as { data?: { total_credits?: unknown; total_usage?: unknown } }).data ?? {}
      const total = num(data.total_credits)
      const left = total - num(data.total_usage)
      if (!Number.isFinite(left)) return { text: 'unexpected answer', isLow: false, ratio: null, error: true }
      return { text: `$${left.toFixed(2)} left`, isLow: left < low.usd, ratio: total > 0 ? left / total : null, error: false }
    },
  },
  {
    id: 'firecrawl',
    label: 'Firecrawl',
    option: 'firecrawlKey',
    env: 'FIRECRAWL_API_KEY',
    url: 'https://api.firecrawl.dev/v2/team/credit-usage',
    parse: (json, low) => {
      const data = (json as { data?: Record<string, unknown> }).data ?? {}
      const left = num(data.remainingCredits ?? data.remaining_credits)
      const plan = num(data.planCredits ?? data.plan_credits)
      if (!Number.isFinite(left)) return { text: 'unexpected answer', isLow: false, ratio: null, error: true }
      return {
        text: `${Math.round(left).toLocaleString('en-US')} credits left`,
        isLow: left < low.credits,
        ratio: Number.isFinite(plan) && plan > 0 ? Math.min(1, left / plan) : null,
        error: false,
      }
    },
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    option: 'deepseekKey',
    env: 'DEEPSEEK_API_KEY',
    url: 'https://api.deepseek.com/user/balance',
    parse: (json, low) => {
      const info = (json as { balance_infos?: { currency?: string; total_balance?: unknown }[] }).balance_infos?.[0]
      const left = num(info?.total_balance)
      if (!info || !Number.isFinite(left)) return { text: 'unexpected answer', isLow: false, ratio: null, error: true }
      return { text: `${left.toFixed(2)} ${info.currency ?? ''} left`.trim(), isLow: left < low.usd, ratio: null, error: false }
    },
  },
]

/** What a failed request means for the person. */
export const failureText = (status: number) =>
  status === 401 ? 'key refused' : status === 403 ? 'key lacks access (OpenRouter needs a management key)' : `HTTP ${status}`
