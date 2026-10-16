import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { gauge, gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'
import { body, countOf, pagesOf, QUERIES, queryUrl } from './posthog'

const PANE = 'jr-visitors'
const REFRESH_MS = 2 * 60_000
const figures = atom({ plugin: 'jr-visitors', key: 'figures' } as const, null)
const bandHidden = atom({ plugin: 'jr-visitors', key: 'isBandHidden' } as const, false)

// The band can be hidden: /jrvisitors hide, show, or the bare command to toggle. One choice for
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
  return { text: hide ? 'jr visitors · band hidden (/jrvisitors to bring it back)' : 'jr visitors · band shown' }
}
const live = { isStarted: false, host: '', projectId: '', key: '' }

async function ask($: EngineInterface, query: string) {
  const res = await $.http.fetch(queryUrl(live.host, live.projectId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${live.key}`, 'Content-Type': 'application/json' },
    body: body(query),
  })
  if (!res.ok) throw new Error(`PostHog answered ${res.status}`)
  return res.text
}

async function refresh($: EngineInterface, withPages: boolean) {
  if (!live.key || !live.projectId) return
  const at = await $.clock.now()
  try {
    const [now, today] = await Promise.all([ask($, QUERIES.now), ask($, QUERIES.today)])
    const pages = withPages ? pagesOf(await ask($, QUERIES.pages)) : ((await read($, figures))?.pages ?? [])
    await update($, figures, () => ({ now: countOf(now), today: countOf(today), pages, at, error: null }))
  } catch (error) {
    await update($, figures, prev => ({ ...(prev ?? { now: 0, today: 0, pages: [], at }), at, error: String(error).slice(0, 120) }))
  }
}

async function ensureStarted($: EngineInterface) {
  if (live.isStarted) return
  live.isStarted = true
  await $.command.register({ name: 'jrvisitors', description: 'Show or hide the visitors band; /jrvisitors details opens visitors now, today and top pages' })
  if (!live.key || !live.projectId) return
  await refresh($, false)
  $.clock.every(REFRESH_MS, () => {
    void refresh($, false)
  })
}

export const register: Register = (on, options) => {
  live.host = String(options.host ?? 'us')
  live.projectId = String(options.projectId ?? '')
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

  on('command.run', { command: 'jrvisitors' }, async ($, e) => {
    await ensureStarted($)
    const verb = bandVerb(e.args)
    // Not set up yet: the bare command says how, instead of toggling a band that cannot show.
    if (verb && (live.key && live.projectId || verb !== 'toggle')) return setBand($, verb)
    if (!live.key || !live.projectId) return { text: 'jr visitors · set the PostHog project id and a personal API key (Query Read) in /config under jr-visitors.' }
    await refresh($, true)
    await $.ui.open({ id: PANE, title: 'jr visitors', rows: 14 })
    return { text: 'jr visitors opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const f = await read($, figures)
    if (!f) return <Text dimColor>Asking PostHog…</Text>
    const most = Math.max(1, ...f.pages.map(p => p.views))
    return (
      <Box flexDirection="column">
        <Text>
          {gradientText(Text, 'jr visitors', GRADIENTS.ice)}
          <Text dimColor>{`   updated ${new Date(f.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}</Text>
        </Text>
        {f.error && <Text color="#ef4565">{f.error}</Text>}
        <Box columnGap={4}>
          <Box flexDirection="column">
            <Text bold color="#2cb67d">{`● ${f.now}`}</Text>
            <Text dimColor>last 5 min</Text>
          </Box>
          <Box flexDirection="column">
            <Text bold>{String(f.today)}</Text>
            <Text dimColor>today</Text>
          </Box>
        </Box>
        <Text dimColor>TOP PAGES TODAY</Text>
        {f.pages.length === 0 && <Text dimColor>No page views yet today.</Text>}
        {f.pages.map(p => (
          <Text wrap="truncate-end">
            {gauge(Text, p.views / most, 12, GRADIENTS.ice)}
            <Text bold>{` ${String(p.views).padStart(5)} `}</Text>
            <Text>{p.page}</Text>
          </Text>
        ))}
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
          {gradientText(Text, 'visitors ', GRADIENTS.ice)}
          <Text color={f.now > 0 ? '#2cb67d' : '#6b7089'}>{'● '}</Text>
          <Text bold>{String(f.now)}</Text>
          <Text dimColor>{' now · '}</Text>
          <Text bold>{String(f.today)}</Text>
          <Text dimColor>{' today'}</Text>
          {f.error && <Text color="#ef4565">{' · PostHog unreachable'}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
