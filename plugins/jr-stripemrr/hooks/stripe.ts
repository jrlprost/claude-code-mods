// Pure figures from Stripe objects. Amounts stay in the currency's smallest unit until display.

export type Charge = { amount: number; amount_refunded: number; currency: string; status: string; paid: boolean; created: number }

export type SubscriptionItem = {
  quantity?: number
  price?: { unit_amount: number | null; currency: string; recurring: { interval: 'day' | 'week' | 'month' | 'year'; interval_count: number } | null }
}
export type Subscription = { status: string; items: { data: SubscriptionItem[] } }

const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'])

/** The smallest unit as a whole amount: cents to euros, yen stays yen. */
export const major = (minor: number, currency: string) => (ZERO_DECIMAL.has(currency.toLowerCase()) ? minor : minor / 100)

const PER_MONTH = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 } as const

/** One subscription item's amount per month, in the smallest unit. */
export const itemMonthly = (item: SubscriptionItem) => {
  const p = item.price
  if (!p?.recurring || p.unit_amount === null) return 0
  return (p.unit_amount * (item.quantity ?? 1) * PER_MONTH[p.recurring.interval]) / Math.max(1, p.recurring.interval_count)
}

/** Monthly recurring revenue of active and trialing-free subscriptions, in `currency` only. */
export const mrrOf = (subscriptions: readonly Subscription[], currency: string) =>
  subscriptions
    .filter(s => s.status === 'active' || s.status === 'past_due')
    .flatMap(s => s.items.data)
    .filter(i => i.price?.currency === currency)
    .reduce((sum, i) => sum + itemMonthly(i), 0)

/** Net amount of a succeeded, paid charge: captured minus refunded. */
export const netOf = (c: Charge) => (c.status === 'succeeded' && c.paid ? c.amount - c.amount_refunded : 0)

/** The currency most charges and subscriptions use. */
export const mainCurrency = (charges: readonly Charge[], subscriptions: readonly Subscription[]) => {
  const counts = new Map<string, number>()
  for (const c of charges) counts.set(c.currency, (counts.get(c.currency) ?? 0) + 1)
  for (const s of subscriptions) for (const i of s.items.data) if (i.price) counts.set(i.price.currency, (counts.get(i.price.currency) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'usd'
}

/** Net revenue per local day for the `days` days ending today, oldest first, in `currency`. */
export const dailyRevenue = (charges: readonly Charge[], currency: string, now: number, days: number) => {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const first = start.getTime() - (days - 1) * 86_400_000
  const out = Array.from({ length: days }, () => 0)
  for (const c of charges) {
    if (c.currency !== currency) continue
    const i = Math.floor((c.created * 1000 - first) / 86_400_000)
    if (i >= 0 && i < days) out[i]! += netOf(c)
  }
  return out
}

const SYMBOLS: Record<string, string> = { usd: '$', eur: '€', gbp: '£', jpy: '¥', cad: 'CA$', aud: 'A$', chf: 'CHF ' }

export const money = (minor: number, currency: string) => {
  const amount = major(minor, currency)
  const n = amount >= 1000 ? Math.round(amount).toLocaleString('en-US') : amount.toFixed(amount % 1 === 0 ? 0 : 2)
  const symbol = SYMBOLS[currency.toLowerCase()]
  return symbol ? (symbol.length === 1 && currency !== 'eur' ? `${symbol}${n}` : `${n} ${symbol.trim()}`) : `${n} ${currency.toUpperCase()}`
}

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
export const sparkline = (values: readonly number[]) => {
  const most = Math.max(...values, 0)
  return values.map(v => (most <= 0 ? SPARK[0] : SPARK[Math.min(7, Math.round((v / most) * 7))])).join('')
}
