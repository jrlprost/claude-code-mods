import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { hitRateOf, mmss, remaining } from './cache'
import { colorAt } from './jr/gradient'

const COUNTDOWN = ['#ef4565', '#ff8c42', '#f4d35e', '#2cb67d']
const clock = atom({ plugin: 'jr-cache-clock', key: 'clock' } as const, null)
// Hidden until the person asks for it: the toast before the cache goes cold is enough by default.
const bandHidden = atom({ plugin: 'jr-cache-clock', key: 'isBandHidden' } as const, true)
const commands = { isRegistered: false }
const band = { isLoaded: false }

async function ensureCommand($: EngineInterface) {
  if (commands.isRegistered) return
  commands.isRegistered = true
  await $.command.register({ name: 'jrcache', description: 'Show or hide the cache countdown (hidden by default): /jrcache toggles, /jrcache on or off' })
}

/** Reads the saved choice once per load of the mod; outside a drawing, which cannot write state. */
async function loadBand($: EngineInterface) {
  if (band.isLoaded) return
  band.isLoaded = true
  if ((await $.store.get('isBandHidden')) === false) await update($, bandHidden, () => false)
}

/** True while the band is hidden (until asked for): one choice for every session. */
async function isBandHidden($: EngineInterface) {
  await loadBand($)
  return read($, bandHidden)
}

const TICK_MS = 1000
const WARN_MS = 30_000

const live: { isTicking: boolean; warnedFor: number | null; ttlMin: number; warn: boolean } = { isTicking: false, warnedFor: null, ttlMin: 5, warn: true }

async function tick($: EngineInterface) {
  const now = await $.clock.now()
  const c = await read($, clock)
  const lastAt = c?.lastAt ?? null
  const left = remaining(lastAt, now, live.ttlMin)
  // Redraw while warm, and once more as it goes cold.
  if (left > 0 || (c && remaining(lastAt, c.now, live.ttlMin) > 0)) await update($, clock, () => ({ lastAt, now, hitRate: c?.hitRate ?? null }))
  if (live.warn && lastAt !== null && left > 0 && left <= WARN_MS && live.warnedFor !== lastAt) {
    live.warnedFor = lastAt
    $.ui.toast(`jr cache · cache goes cold in ${Math.ceil(left / 1000)} s`)
  }
}

async function ensureTicking($: EngineInterface) {
  if (live.isTicking) return
  live.isTicking = true
  const now = await $.clock.now()
  await update($, clock, c => c ?? { lastAt: null, now, hitRate: null })
  $.clock.every(TICK_MS, () => {
    void tick($)
  })
}

export const register: Register = (on, options) => {
  live.ttlMin = Number(options.ttlMinutes ?? 5) || 5
  live.warn = options.warnBeforeExpiry !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureCommand($)
    await loadBand($)
    await ensureTicking($)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    await ensureTicking($)
    const now = await $.clock.now()
    const hitRate = hitRateOf((e as unknown as { usage?: Parameters<typeof hitRateOf>[0] }).usage)
    await update($, clock, c => ({ lastAt: now, now, hitRate: hitRate ?? c?.hitRate ?? null }))
    return done
  })

  on('command.run', { command: 'jrcache' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    await loadBand($)
    const hide = arg === 'off' || arg === 'hide' ? true : arg === 'on' || arg === 'show' ? false : arg === '' ? !(await isBandHidden($)) : null
    if (hide === null) return { text: 'jr cache · usage: /jrcache toggles the band, /jrcache on or off' }
    await $.store.set('isBandHidden', hide)
    await update($, bandHidden, () => hide)
    return { text: hide ? 'jr cache · hidden (/jrcache to bring it back); the toast before it goes cold stays' : 'jr cache · shown above the prompt (/jrcache to hide it)' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const c = await read($, clock)
    if (!live.isTicking) {
      $.clock.after(0, () => {
        void ensureTicking($)
      })
    }
    if (!commands.isRegistered || !band.isLoaded) {
      $.clock.after(0, () => {
        void ensureCommand($)
        void loadBand($)
      })
    }
    if (await read($, bandHidden)) return below
    if (!c || c.lastAt === null || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    const left = remaining(c.lastAt, c.now, live.ttlMin)
    // One quiet row on the right: the countdown goes green to red as the cache ages.
    return (
      <Box flexDirection="column">
        <Box justifyContent="flex-end">
          <Text wrap="truncate-end">
            <Text dimColor>{'cache '}</Text>
            {left > 0 ? <Text color={colorAt(COUNTDOWN, left / (live.ttlMin * 60_000))}>{mmss(left)}</Text> : <Text color="#ff8c42">{'cold'}</Text>}
            {c.hitRate !== null && <Text dimColor>{` · hit ${Math.round(c.hitRate * 100)}%`}</Text>}
          </Text>
        </Box>
        {below}
      </Box>
    )
  })
}
