import type { JrUptimeCheck, JrUptimeSite } from '../types'

export const HISTORY = 30

/** URLs from the setting: separated by commas, spaces or new lines; `https://` added when missing. */
export const parseUrls = (raw: string) =>
  [...new Set(raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean).map(u => (/^https?:\/\//i.test(u) ? u : `https://${u}`)))]

/** Up when the server answers below 400 in time. */
export const isUp = (status: number | null) => status !== null && status < 400

export const label = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

/** Adds a check to a site: history capped, incident opened on the first failure and closed on recovery. */
export const addCheck = (site: JrUptimeSite, check: JrUptimeCheck): JrUptimeSite => {
  const history = [...site.history, check].slice(-HISTORY)
  const up = isUp(check.status)
  let { downSince, lastIncident } = site
  if (!up && downSince === null) downSince = check.at
  if (up && downSince !== null) {
    lastIncident = { from: downSince, to: check.at }
    downSince = null
  }
  return { ...site, history, downSince, lastIncident }
}

export const emptySite = (url: string): JrUptimeSite => ({ url, history: [], downSince: null, lastIncident: null })

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
/** Latency sparkline; a failed check is drawn as ✕. */
export const latencySpark = (history: readonly JrUptimeCheck[]) => {
  const most = Math.max(1, ...history.filter(c => isUp(c.status)).map(c => c.ms))
  return history.map(c => (isUp(c.status) ? SPARK[Math.min(7, Math.round((c.ms / most) * 7))]! : '✕')).join('')
}

export const ago = (ms: number) => {
  const m = Math.round(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}

export const duration = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60_000))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}
