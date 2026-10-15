import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { gradientText } from './jr/draw'
import { GRADIENTS, colorAt, formatTokens } from './jr/gradient'
import { nextCost, priceOf, usd } from './prices'
import type { Price } from './prices'

const next = atom({ plugin: 'jr-next-cost', key: 'next' } as const, null)
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

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, nextHook) => {
    const below = await nextHook(e)
    const n = await read($, next)
    if (!live.isTicking) {
      $.clock.after(0, () => {
        void ensureTicking($)
      })
    }
    const price = override ?? (n ? priceOf(n.model) : null)
    if (!n || !price || n.tokens <= 0 || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    const left = n.lastAt === null ? 0 : n.lastAt + live.ttlMin * 60_000 - n.now
    const isWarm = left > 0
    const cost = nextCost(n.tokens, price, isWarm)
    const cold = nextCost(n.tokens, price, false)
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'next ', GRADIENTS.brand)}
          <Text bold color={colorAt(GRADIENTS.heat, Math.min(1, cost / 2))}>{`≈ ${usd(cost)}`}</Text>
          <Text dimColor>{` to resend ${formatTokens(n.tokens)} · `}</Text>
          {isWarm ? (
            <Text color="#2cb67d">{`cache warm ${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}`}</Text>
          ) : (
            <Text color="#ff8c42">{'cache cold'}</Text>
          )}
          {isWarm && <Text dimColor>{` · ${usd(cold)} once cold`}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
