import { printable } from './jr/text'
// HogQL queries and how their answers become numbers.

export const QUERIES = {
  now: "SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 5 MINUTE",
  today: "SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' AND timestamp >= toStartOfDay(now())",
  pages:
    "SELECT properties.$pathname AS page, count() AS views FROM events WHERE event = '$pageview' AND timestamp >= toStartOfDay(now()) GROUP BY page ORDER BY views DESC LIMIT 8",
} as const

/** `https://eu.posthog.com/` → `https://eu.posthog.com`; a bare region name works too. */
export const hostOf = (raw: string) => {
  const v = raw.trim().toLowerCase()
  if (v === '' || v === 'us') return 'https://us.posthog.com'
  if (v === 'eu') return 'https://eu.posthog.com'
  return (v.startsWith('http') ? v : `https://${v}`).replace(/\/+$/, '')
}

export const queryUrl = (host: string, projectId: string) => `${hostOf(host)}/api/projects/${encodeURIComponent(projectId.trim())}/query/`

export const body = (query: string) => JSON.stringify({ query: { kind: 'HogQLQuery', query }, name: 'jr-visitors' })

/** First cell of the first row, as a number. */
export const countOf = (text: string) => {
  const parsed = JSON.parse(text) as { results?: unknown[][] }
  return Number(parsed.results?.[0]?.[0] ?? 0) || 0
}

export const pagesOf = (text: string) => {
  const parsed = JSON.parse(text) as { results?: unknown[][] }
  return (parsed.results ?? []).map(row => ({ page: printable(String(row[0] ?? '(none)') || '/', 120), views: Number(row[1] ?? 0) || 0 }))
}
