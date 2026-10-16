import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { JrQuotaBalance } from '../types'
import { gauge, gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'
import { failureText, PROVIDERS } from './providers'

const view = atom({ plugin: 'jr-quota', key: 'view' } as const, null)
const bandHidden = atom({ plugin: 'jr-quota', key: 'isBandHidden' } as const, false)
const band = { isLoaded: false }

/** `hide`/`off`, `show`/`on`, or a bare command, which toggles; anything else is not about the band. */
const bandVerb = (args: string) => {
  const arg = args.trim().toLowerCase()
  if (arg === 'hide' || arg === 'off') return 'hide' as const
  if (arg === 'show' || arg === 'on') return 'show' as const
  return arg === '' ? ('toggle' as const) : null
}

/** Hidden or shown is one choice for every session, kept across restarts. */
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
  return { text: hide ? 'jr quota · hidden (/jrquota to bring it back)' : 'jr quota · shown' }
}
const PANE = 'jr-quota'
const EVERY_MS = 10 * 60_000

const live: { isPolling: boolean; options: PluginOptions } = { isPolling: false, options: {} }

/** The key in the environment, read by literal name so the mod's reads can be listed. */
async function envKey($: EngineInterface, id: string) {
  if (id === 'openrouter') return $.env.get('OPENROUTER_API_KEY')
  if (id === 'firecrawl') return $.env.get('FIRECRAWL_API_KEY')
  if (id === 'deepseek') return $.env.get('DEEPSEEK_API_KEY')
  return undefined
}

async function check($: EngineInterface) {
  const low = { usd: Number(live.options.lowUsd ?? 5), credits: Number(live.options.lowCredits ?? 500) }
  const balances: JrQuotaBalance[] = []
  for (const p of PROVIDERS) {
    const fromOption = String(live.options[p.option] ?? '').trim()
    const key = fromOption || (await envKey($, p.id)) || ''
    if (!key) continue
    try {
      const res = await $.http.fetch(p.url, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } })
      balances.push(
        res.ok
          ? { id: p.id, label: p.label, ...p.parse(JSON.parse(res.text), low) }
          : { id: p.id, label: p.label, text: failureText(res.status), isLow: false, ratio: null, error: true },
      )
    } catch {
      balances.push({ id: p.id, label: p.label, text: 'unreachable', isLow: false, ratio: null, error: true })
    }
  }
  const checkedAt = await $.clock.now()
  const before = await read($, view)
  await update($, view, () => ({ balances, checkedAt }))
  for (const b of balances) {
    const was = before?.balances.find(x => x.id === b.id)
    if (b.isLow && !was?.isLow) $.ui.toast(`jr quota · ${b.label} is low: ${b.text}`)
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
  live.options = options

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'jrquota', description: 'Show or hide the low-balance band; /jrquota details shows every balance' })
    await ensurePolling($)
    return started
  })

  on('command.run', { command: 'jrquota' }, async ($, e) => {
    const verb = bandVerb(e.args)
    if (verb) return setBand($, verb)
    live.isPolling ? await check($) : await ensurePolling($)
    const v = await read($, view)
    if (!v || v.balances.length === 0) {
      return { text: 'jr quota · no API key found. Set one in /config (jr-quota) or export OPENROUTER_API_KEY, FIRECRAWL_API_KEY or DEEPSEEK_API_KEY.' }
    }
    await $.ui.open({ id: PANE, title: 'jr quota', rows: v.balances.length + 3 })
    return { text: 'jr quota opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const v = await read($, view)
    if (!v || v.balances.length === 0) return <Text dimColor>No API key configured.</Text>
    return (
      <Box flexDirection="column">
        {gradientText(Text, 'jr quota', GRADIENTS.brand)}
        {v.balances.map(b => (
          <Box>
            <Text color={b.error ? '#6b7089' : b.isLow ? '#ef4565' : '#2cb67d'}>{'● '}</Text>
            <Text bold>{b.label.padEnd(12)}</Text>
            {b.ratio !== null ? gauge(Text, b.ratio, 16, GRADIENTS.money) : <Text>{' '.repeat(16)}</Text>}
            <Text color={b.isLow ? '#ef4565' : undefined} dimColor={b.error}>{`  ${b.text}`}</Text>
          </Box>
        ))}
        <Text dimColor>{`checked ${new Date(v.checkedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · every 10 min`}</Text>
      </Box>
    )
  })

  // The band shows only what needs attention: a low balance.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const v = await read($, view)
    if (!live.isPolling) {
      $.clock.after(0, () => {
        void ensurePolling($)
      })
    }
    if (await isBandHidden($)) return below
    const lows = v?.balances.filter(b => b.isLow) ?? []
    if (lows.length === 0 || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'quota ', GRADIENTS.brand)}
          <Text color="#ef4565" bold>{'low · '}</Text>
          <Text>{lows.map(b => `${b.label} ${b.text}`).join(' · ')}</Text>
        </Box>
        {below}
      </Box>
    )
  })
}
