/** USD per million tokens: base input and cache reads. Cache writes (5-minute) are 1.25 × input. */
export type Price = { input: number; cacheRead: number }

// Anthropic first-party rates, as published for each model (cached table, October 2026).
const TABLE: [RegExp, Price][] = [
  [/fable-5-1|mythos-5-1/, { input: 10, cacheRead: 0.25 }],
  [/fable-5|mythos-5/, { input: 10, cacheRead: 1 }],
  [/opus-5-5/, { input: 4, cacheRead: 0.2 }],
  [/opus-5|opus-4-[6-8]/, { input: 5, cacheRead: 0.5 }],
  [/sonnet-5/, { input: 2, cacheRead: 0.2 }],
  [/sonnet-4-6/, { input: 3, cacheRead: 0.3 }],
  [/haiku-5-5/, { input: 0.1, cacheRead: 0.01 }],
  [/haiku-4-5/, { input: 1, cacheRead: 0.1 }],
]

export const priceOf = (model: string): Price | null => TABLE.find(([re]) => re.test(model.toLowerCase()))?.[1] ?? null

/**
 * What resending the current context costs: read from the cache while it is warm,
 * written to it again once it is cold.
 */
export const nextCost = (tokens: number, price: Price, isWarm: boolean) =>
  (tokens / 1_000_000) * (isWarm ? price.cacheRead : price.input * 1.25)

export const usd = (amount: number) => (amount < 0.01 ? '<$0.01' : `$${amount.toFixed(amount < 10 ? 2 : 1)}`)
