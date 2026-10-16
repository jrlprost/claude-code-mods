import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrStripeFigures } from '../types'
import { gradientText } from './jr/draw'
import { GRADIENTS, colorAt } from './jr/gradient'
import type { Charge, Subscription } from './stripe'
import { dailyRevenue, mainCurrency, money, mrrOf, sparkline } from './stripe'

const PANE = 'jr-stripemrr'
const REFRESH_MS = 15 * 60_000
const DAYS = 30
const API = 'https://api.stripe.com/v1'
const figures = atom({ plugin: 'jr-stripemrr', key: 'figures' } as const, null)
const bandHidden = atom({ plugin: 'jr-stripemrr', key: 'isBandHidden' } as const, false)

// The band can be hidden: /jrmrr hide, show, or the bare command to toggle. One choice for
// every session, kept across restarts.
const band = { isLoaded: false }

const bandVerb = (args: string) => {
  const arg = args.trim().toLowerCase()
  if (arg === 'hide' || arg === 'off') return 'hide' as const
  if (arg === 'show' || arg === 'on') return 'show' as const
  return arg === '' ? ('toggle' as const) : null
}

async function isBandHidden($: EngineInterface) {
  if (!band.isLoaded) {
    band.isLoaded = true
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
  }
  return read($, bandHidden)
}

async function setBand($: EngineInterface, verb: 'hide' | 'show' | 'toggle') {
  const hide = verb === 'toggle' ? !(await isBandHidden($)) : verb === 'hide'
  await $.store.set('isBandHidden', hide)
  await update($, bandHidden, () => hide)
  return { text: hide ? 'jr mrr · band hidden (/jrmrr to bring it back)' : 'jr mrr · band shown' }
}
const live = { isStarted: false, key: '' }

/** Every page of a Stripe list, 100 at a time, at most `pages` pages. */
async function listAll<T>($: EngineInterface, resource: string, query: string, pages = 10): Promise<T[]> {
  const out: T[] = []
  let after = ''
  for (let i = 0; i < pages; i++) {
    const url = `${API}/${resource}?limit=100&${query}${after ? `&starting_after=${after}` : ''}`
    const res = await $.http.fetch(url, { headers: { Authorization: `Bearer ${live.key}` } })
    if (!res.ok) throw new Error(`Stripe answered ${res.status} for ${resource}`)
    const body = JSON.parse(res.text) as { data: (T & { id: string })[]; has_more: boolean }
    out.push(...body.data)
    if (!body.has_more || body.data.length === 0) break
    after = body.data[body.data.length - 1]!.id
  }
  return out
}

async function refresh($: EngineInterface) {
  if (!live.key) return
  const now = await $.clock.now()
  try {
    const since = Math.floor((now - DAYS * 86_400_000) / 1000)
    const [charges, subscriptions] = await Promise.all([
      listAll<Charge>($, 'charges', `created[gte]=${since}`),
      listAll<Subscription>($, 'subscriptions', 'status=active'),
    ])
    const currency = mainCurrency(charges, subscriptions)
    const daily = dailyRevenue(charges, currency, now, DAYS)
    const next: JrStripeFigures = { currency, today: daily[DAYS - 1] ?? 0, mrr: mrrOf(subscriptions, currency), daily, at: now, error: null }
    await update($, figures, () => next)
  } catch (error) {
    await update($, figures, prev => ({ ...(prev ?? { currency: 'usd', today: 0, mrr: 0, daily: [], at: now }), at: now, error: String(error).slice(0, 120) }))
  }
}

async function ensureStarted($: EngineInterface) {
  if (live.isStarted) return
  live.isStarted = true
  await $.command.register({ name: 'jrmrr', description: 'Show or hide the MRR band; /jrmrr details opens revenue today, MRR and the last 30 days' })
  if (!live.key) return
  await refresh($)
  $.clock.every(REFRESH_MS, () => {
    void refresh($)
  })
}

export const register: Register = (on, options) => {
  live.key = String(options.apiKey ?? '')
  const showBand = options.showBand !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureStarted($)
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    await ensureStarted($)
    return next(e)
  })

  on('command.run', { command: 'jrmrr' }, async ($, e) => {
    await ensureStarted($)
    const verb = bandVerb(e.args)
    // Not set up yet: the bare command says how, instead of toggling a band that cannot show.
    if (verb && (live.key || verb !== 'toggle')) return setBand($, verb)
    if (!live.key) return { text: 'jr mrr · add a Stripe restricted key (read access to Charges and Subscriptions) in /config under jr-stripemrr.' }
    await refresh($)
    await $.ui.open({ id: PANE, title: 'jr mrr', rows: 9 })
    return { text: 'jr mrr opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const f = await read($, figures)
    if (!f) return <Text dimColor>Asking Stripe…</Text>
    const total = f.daily.reduce((a, b) => a + b, 0)
    const spark = sparkline(f.daily)
    return (
      <Box flexDirection="column">
        <Text>
          {gradientText(Text, 'jr mrr', GRADIENTS.money)}
          <Text dimColor>{`   updated ${new Date(f.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}</Text>
        </Text>
        {f.error && <Text color="#ef4565">{f.error}</Text>}
        <Box columnGap={4}>
          <Box flexDirection="column">
            <Text bold color="#2cb67d">{money(f.mrr, f.currency)}</Text>
            <Text dimColor>MRR</Text>
          </Box>
          <Box flexDirection="column">
            <Text bold>{money(f.today, f.currency)}</Text>
            <Text dimColor>today</Text>
          </Box>
          <Box flexDirection="column">
            <Text bold>{money(total, f.currency)}</Text>
            <Text dimColor>{`last ${DAYS} days`}</Text>
          </Box>
        </Box>
        <Text>
          {[...spark].map((c, i) => (
            <Text color={colorAt(GRADIENTS.money, i / Math.max(1, spark.length - 1))}>{c}</Text>
          ))}
        </Text>
        <Text dimColor>{`${DAYS} days ago${' '.repeat(Math.max(1, DAYS - 17))}today`}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (await isBandHidden($)) return below
    const f = await read($, figures)
    if (!showBand || !f || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'mrr ', GRADIENTS.money)}
          <Text bold color="#2cb67d">{money(f.mrr, f.currency)}</Text>
          <Text dimColor>{' · today '}</Text>
          <Text bold>{money(f.today, f.currency)}</Text>
          {f.error && <Text color="#ef4565">{' · Stripe unreachable'}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
