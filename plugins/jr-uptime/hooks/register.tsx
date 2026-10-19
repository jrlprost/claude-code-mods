import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrUptimeSite } from '../types'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'
import { addCheck, ago, duration, emptySite, isUp, label, latencySpark, parseUrls } from './uptime'

const PANE = 'jr-uptime'
const EVERY_MS = 2 * 60_000
const TIMEOUT_MS = 10_000
const sites = atom({ plugin: 'jr-uptime', key: 'sites' } as const, [])
const bandHidden = atom({ plugin: 'jr-uptime', key: 'isBandHidden' } as const, false)

// The band can be hidden: /jruptime hide, show, or the bare command to toggle. One choice for
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
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
    band.isLoaded = true
  }
  return read($, bandHidden)
}

async function setBand($: EngineInterface, verb: 'hide' | 'show' | 'toggle') {
  const hide = verb === 'toggle' ? !(await isBandHidden($)) : verb === 'hide'
  await $.store.set('isBandHidden', hide)
  await update($, bandHidden, () => hide)
  return { text: hide ? 'jr uptime · band hidden (/jruptime to bring it back)' : 'jr uptime · band shown' }
}
const live = { isStarted: false, urls: [] as string[] }

/** One request; a status, or null when it fails or takes longer than the timeout. */
async function ping($: EngineInterface, url: string) {
  const start = await $.clock.now()
  const timeout = $.clock.sleep(TIMEOUT_MS).then(() => null)
  try {
    const res = await Promise.race([$.http.fetch(url, { method: 'GET', headers: { 'User-Agent': 'jr-uptime (Claude Code mod)' } }), timeout])
    const end = await $.clock.now()
    return { at: end, ms: end - start, status: res ? res.status : null }
  } catch {
    const end = await $.clock.now()
    return { at: end, ms: end - start, status: null }
  }
}

async function checkAll($: EngineInterface) {
  if (live.urls.length === 0) return
  const results = await Promise.all(live.urls.map(url => ping($, url)))
  const saved = ((await $.store.get('incidents')) as Record<string, JrUptimeSite['lastIncident']> | undefined) ?? {}
  await update($, sites, prev =>
    live.urls.map((url, i) => {
      const site = prev.find(s => s.url === url) ?? { ...emptySite(url), lastIncident: saved[url] ?? null }
      return addCheck(site, results[i]!)
    }),
  )
  const next = await read($, sites)
  await $.store.set('incidents', Object.fromEntries(next.map(s => [s.url, s.lastIncident])))
}

async function ensureStarted($: EngineInterface) {
  if (live.isStarted) return
  live.isStarted = true
  await $.command.register({ name: 'jruptime', description: 'Show or hide the uptime band; /jruptime details opens your sites with latency and last incident' })
  if (live.urls.length === 0) return
  await checkAll($)
  $.clock.every(EVERY_MS, () => {
    void checkAll($)
  })
}

export const register: Register = (on, options) => {
  live.urls = parseUrls(String(options.urls ?? ''))
  const showWhenUp = options.showWhenUp === true

  // A /clear starts a new conversation with empty state and no session.start: load again once it has begun.
  on('session.end', async ($, e, next) => {
    const ended = await next(e)
    if (e.reason === 'clear') {
      band.isLoaded = false
      $.clock.after(1000, () => {
        void isBandHidden($)
      })
    }
    return ended
  })

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await isBandHidden($)
    await ensureStarted($)
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    await ensureStarted($)
    return next(e)
  })

  on('command.run', { command: 'jruptime' }, async ($, e) => {
    await ensureStarted($)
    const verb = bandVerb(e.args)
    // Not set up yet: the bare command says how, instead of toggling a band that cannot show.
    if (verb && (live.urls.length > 0 || verb !== 'toggle')) return setBand($, verb)
    if (live.urls.length === 0) return { text: 'jr uptime · add the URLs to watch in /config under jr-uptime (separated by commas).' }
    await checkAll($)
    await $.ui.open({ id: PANE, title: 'jr uptime', rows: Math.min(30, live.urls.length * 2 + 3) })
    return { text: 'jr uptime opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, sites)
    const now = await $.clock.now()
    const width = Math.max(30, ...list.map(s => label(s.url).length + 2))
    return (
      <Box flexDirection="column">
        {gradientText(Text, 'jr uptime', GRADIENTS.heat)}
        {list.length === 0 && <Text dimColor>Checking…</Text>}
        {list.map(s => {
          const lastCheck = s.history[s.history.length - 1]
          const up = isUp(lastCheck?.status ?? null)
          return (
            <Box flexDirection="column">
              <Text wrap="truncate-end">
                <Text color={up ? '#2cb67d' : '#ef4565'}>{up ? '● ' : '✕ '}</Text>
                <Text bold>{label(s.url).padEnd(width)}</Text>
                <Text color={up ? '#2cb67d' : '#ef4565'}>{up ? `${lastCheck?.status} · ${lastCheck?.ms} ms` : `down ${s.downSince !== null ? duration(now - s.downSince) : ''}`}</Text>
              </Text>
              <Text wrap="truncate-end">
                <Text>{'  '}</Text>
                <Text color="#3da9fc">{latencySpark(s.history)}</Text>
                <Text dimColor>{s.lastIncident ? `   last incident ${ago(now - s.lastIncident.to)}, ${duration(s.lastIncident.to - s.lastIncident.from)}` : '   no incident seen'}</Text>
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (await read($, bandHidden)) return below
    const list = await read($, sites)
    if (list.length === 0 || e.props.hasSurvey) return below
    const down = list.filter(s => !isUp(s.history[s.history.length - 1]?.status ?? null))
    if (down.length === 0 && !showWhenUp) return below
    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {down.length > 0 ? (
          <Text wrap="truncate-end">
            <Text color="#ef4565">{'▲ '}</Text>
            {down.map((s, i) => (
              <Text>
                {i > 0 ? <Text dimColor>{' · '}</Text> : ''}
                <Text color="#ef4565" bold>{label(s.url)}</Text>
                <Text>{s.downSince === null ? ' down' : ` down ${duration(now - s.downSince)}`}</Text>
              </Text>
            ))}
            <Text dimColor>{' · /jruptime details'}</Text>
          </Text>
        ) : (
          <Box justifyContent="flex-end">
            <Text wrap="truncate-end">
              <Text dimColor>{'uptime '}</Text>
              <Text color="#2cb67d">{`${list.length}/${list.length} up`}</Text>
            </Text>
          </Box>
        )}
        {below}
      </Box>
    )
  })
}
