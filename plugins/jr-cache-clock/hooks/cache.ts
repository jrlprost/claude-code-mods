/** Milliseconds of cache life left, or 0 once cold (or before any response). */
export const remaining = (lastAt: number | null, now: number, ttlMin: number) =>
  lastAt === null ? 0 : Math.max(0, lastAt + ttlMin * 60_000 - now)

/** "3:41" */
export const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type Usage = { input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

/** Share of the input served from the cache. */
export const hitRateOf = (usage: Usage | undefined) => {
  if (!usage) return null
  const total = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
  return total > 0 ? usage.cache_read_input_tokens / total : null
}
