import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'
import { COLOR, degraded, serviceOf, SERVICES } from './services'

const view = atom({ plugin: 'jr-outage', key: 'view' } as const, null)
const PANE = 'jr-outage'
const EVERY_MS = 10 * 60_000

const live = { isPolling: false }

async function fetchStatus($: EngineInterface, url: string) {
  try {
    const res = await $.http.fetch(url, { headers: { Accept: 'application/json' } })
    return res.ok ? res.text : null
  } catch {
    return null
  }
}

async function check($: EngineInterface) {
  const bodies = await Promise.all(SERVICES.map(s => fetchStatus($, s.url)))
  const services = SERVICES.map((s, i) => serviceOf(s.name, bodies[i] ?? null))
  const before = await read($, view)
  const checkedAt = await $.clock.now()
  await update($, view, () => ({ services, checkedAt }))
  for (const s of degraded(services)) {
    const was = before?.services.find(x => x.name === s.name)
    if (!was || was.indicator !== s.indicator) $.ui.toast(`jr outage · ${s.name}: ${s.description}`)
  }
}

async function ensurePolling($: EngineInterface) {
  if (live.isPolling) return
  live.isPolling = true
  await check($)
  $.clock.every(EVERY_MS, () => {
    void check($)
  })
}

export const register: Register = (on, options) => {
  const showBand = options.showBand !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'jroutage', description: 'Is it them or is it me? Status of Claude, GitHub, npm and Vercel' })
    await ensurePolling($)
    return started
  })

  on('command.run', { command: 'jroutage' }, async $ => {
    live.isPolling ? await check($) : await ensurePolling($)
    await $.ui.open({ id: PANE, title: 'jr outage', rows: SERVICES.length + 3 })
    const down = degraded((await read($, view))?.services ?? [])
    return { text: down.length ? `jr outage · ${down.map(s => `${s.name}: ${s.description}`).join(' · ')}` : 'jr outage · all services operational.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const v = await read($, view)
    if (!v) return <Text dimColor>Checking status pages…</Text>
    return (
      <Box flexDirection="column">
        {gradientText(Text, 'jr outage', GRADIENTS.brand)}
        {v.services.map(s => (
          <Box>
            <Text color={COLOR[s.indicator] ?? COLOR.unknown}>{'● '}</Text>
            <Text bold>{s.name.padEnd(8)}</Text>
            <Text color={s.indicator === 'none' ? undefined : (COLOR[s.indicator] ?? COLOR.unknown)} dimColor={s.indicator === 'unknown'}>{s.description}</Text>
          </Box>
        ))}
        <Text dimColor>{`checked ${new Date(v.checkedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · every 10 min`}</Text>
      </Box>
    )
  })

  // The band appears only while something is degraded.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const v = await read($, view)
    if (!live.isPolling) {
      $.clock.after(0, () => {
        void ensurePolling($)
      })
    }
    const down = degraded(v?.services ?? [])
    if (!showBand || down.length === 0 || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'outage ', GRADIENTS.brand)}
          {down.map((s, i) => (
            <Text>
              {i > 0 ? '  ' : ''}
              <Text color={COLOR[s.indicator]}>{'● '}</Text>
              <Text bold>{`${s.name} `}</Text>
              <Text color={COLOR[s.indicator]}>{s.description}</Text>
            </Text>
          ))}
        </Box>
        {below}
      </Box>
    )
  })
}
