import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { hitRateOf, mmss, remaining } from './cache'
import { gauge, gradientText } from './jr/draw'
import { GRADIENTS, colorAt } from './jr/gradient'

const clock = atom({ plugin: 'jr-cache-clock', key: 'clock' } as const, null)
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

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const c = await read($, clock)
    if (!live.isTicking) {
      $.clock.after(0, () => {
        void ensureTicking($)
      })
    }
    if (!c || c.lastAt === null || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    const ttlMs = live.ttlMin * 60_000
    const left = remaining(c.lastAt, c.now, live.ttlMin)
    const used = 1 - left / ttlMs
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'cache ', GRADIENTS.brand)}
          {left > 0 ? (
            <Text>
              <Text color={colorAt(GRADIENTS.heat, used)}>{'● '}</Text>
              <Text bold>{`warm ${mmss(left)} `}</Text>
              {gauge(Text, left / ttlMs, 12, ['#ef4565', '#ff8c42', '#f4d35e', '#2cb67d'])}
            </Text>
          ) : (
            <Text dimColor>{'○ cold · the next prompt rewrites the cache'}</Text>
          )}
          {c.hitRate !== null && <Text dimColor>{` · last hit ${Math.round(c.hitRate * 100)}%`}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
