import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { GRADIENTS, colorAt } from './jr/gradient'
import { nextCost, priceOf, usd } from './prices'
import type { Price } from './prices'

const next = atom({ plugin: 'jr-next-cost', key: 'next' } as const, null)
// Hidden until the person asks for it.
const bandHidden = atom({ plugin: 'jr-next-cost', key: 'isBandHidden' } as const, true)
const commands = { isRegistered: false }
const band = { isLoaded: false }

async function ensureCommand($: EngineInterface) {
  if (commands.isRegistered) return
  commands.isRegistered = true
  await $.command.register({ name: 'jrnextcost', description: 'Show or hide the next-prompt cost (hidden by default): /jrnextcost toggles, /jrnextcost on or off' })
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

const TICK_MS = 5000

const live = { isTicking: false, ttlMin: 5 }

async function refresh($: EngineInterface, lastAt?: number) {
  const [usage, model, now] = await Promise.all([$.session.usage(), $.session.model(), $.clock.now()])
  await update($, next, n => ({ tokens: usage.context.tokens ?? n?.tokens ?? 0, model, lastAt: lastAt ?? n?.lastAt ?? null, now }))
}

/** Keeps "warm"/"cold" current between turns; once per module load. */
async function ensureTicking($: EngineInterface) {
  if (live.isTicking) return
  live.isTicking = true
  await refresh($)
  $.clock.every(TICK_MS, () => {
    void tickNow($)
  })
}

async function tickNow($: EngineInterface) {
  const now = await $.clock.now()
  await update($, next, n => (n ? { ...n, now } : n))
}

export const register: Register = (on, options) => {
  live.ttlMin = Number(options.ttlMinutes ?? 5) || 5
  const override: Price | null = Number(options.inputPrice) > 0 ? { input: Number(options.inputPrice), cacheRead: Number(options.cacheReadPrice) || Number(options.inputPrice) / 10 } : null

  on('session.start', async ($, e, nextHook) => {
    const started = await nextHook(e)
    await ensureCommand($)
    await loadBand($)
    await ensureTicking($)
    return started
  })

  on('turn.complete', async ($, e, nextHook) => {
    const done = await nextHook(e)
    if (e.agentId !== undefined) return done
    await ensureTicking($)
    await refresh($, await $.clock.now())
    return done
  })

  on('command.run', { command: 'jrnextcost' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    await loadBand($)
    const hide = arg === 'off' || arg === 'hide' ? true : arg === 'on' || arg === 'show' ? false : arg === '' ? !(await isBandHidden($)) : null
    if (hide === null) return { text: 'jr next cost · usage: /jrnextcost toggles the band, /jrnextcost on or off' }
    await $.store.set('isBandHidden', hide)
    await update($, bandHidden, () => hide)
    return { text: hide ? 'jr next cost · hidden (/jrnextcost to bring it back)' : 'jr next cost · shown above the prompt (/jrnextcost to hide it)' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, nextHook) => {
    const below = await nextHook(e)
    const n = await read($, next)
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
    const price = override ?? (n ? priceOf(n.model) : null)
    if (!n || !price || n.tokens <= 0 || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    const isWarm = n.lastAt !== null && n.lastAt + live.ttlMin * 60_000 > n.now
    const cost = nextCost(n.tokens, price, isWarm)
    // One quiet row on the right. The cache countdown itself is jr-cache-clock's.
    return (
      <Box flexDirection="column">
        <Box justifyContent="flex-end">
          <Text wrap="truncate-end">
            <Text dimColor>{'next '}</Text>
            <Text color={colorAt(GRADIENTS.heat, Math.min(1, cost / 2))}>{usd(cost)}</Text>
            <Text dimColor>{isWarm ? ` · ${usd(nextCost(n.tokens, price, false))} cold` : ' · cold'}</Text>
          </Text>
        </Box>
        {below}
      </Box>
    )
  })
}
