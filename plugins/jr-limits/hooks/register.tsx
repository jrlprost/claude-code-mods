import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrLimitsView } from '../types'
import { gauge, gradientText } from './jr/draw'
import { GRADIENTS, colorAt } from './jr/gradient'
import { countdown, crossed, labelOf, windowsOf } from './limits'

const view = atom({ plugin: 'jr-limits', key: 'view' } as const, null)
const PANE = 'jr-limits'
const THRESHOLDS = [80, 95]
const TICK_MS = 60_000

// Module state: which thresholds were already announced, per window and reset time.
const live = { isTicking: false, warned: new Map<string, number[]>() }

async function refresh($: EngineInterface) {
  const usage = await $.session.usage()
  const now = await $.clock.now()
  const windows = windowsOf(usage.rateLimits)
  await update($, view, () => ({ windows, now }))
  for (const w of windows) {
    const key = `${w.kind}:${w.resetsAt ?? ''}`
    const before = live.warned.get(key) ?? []
    const fresh = crossed(w.percent, before, THRESHOLDS)
    if (fresh.length === 0) continue
    live.warned.set(key, [...before, ...fresh])
    $.ui.toast(`jr limits · ${labelOf(w.kind)} window at ${Math.round(w.percent)}%${w.resetsAt ? `, resets in ${countdown(w.resetsAt, now)}` : ''}`)
  }
}

/** Starts the minute tick that keeps countdowns current; once per module load. */
async function ensureTicking($: EngineInterface) {
  if (live.isTicking) return
  live.isTicking = true
  await refresh($)
  $.clock.every(TICK_MS, () => {
    void refresh($)
  })
}

type Elements = ReturnType<EngineInterface['ui']['resolve']>

function drawWindow(Box: Elements['Box'], Text: Elements['Text'], w: JrLimitsView['windows'][number], now: number, width: number) {
  const color = colorAt(GRADIENTS.heat, w.percent / 100)
  return (
    <Box>
      <Text color="#6b7089">{`${labelOf(w.kind).padEnd(5)} `}</Text>
      {gauge(Text, w.percent / 100, width, GRADIENTS.heat)}
      <Text bold color={color}>{` ${String(Math.round(w.percent)).padStart(3)}%`}</Text>
      {w.resetsAt !== null && <Text dimColor>{` resets ${countdown(w.resetsAt, now)}`}</Text>}
    </Box>
  )
}

export const register: Register = (on, options) => {
  const showBand = options.showBand !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'jrlimits', description: 'Plan limits: 5-hour and 7-day windows with reset countdowns' })
    await ensureTicking($)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await ensureTicking($)
    await refresh($)
    return done
  })

  on('command.run', { command: 'jrlimits' }, async $ => {
    await ensureTicking($)
    await refresh($)
    const v = await read($, view)
    if (!v || v.windows.length === 0) return { text: 'jr limits · no plan-limit figures yet (they arrive with the first reply on a subscription).' }
    await $.ui.open({ id: PANE, title: 'jr limits', rows: v.windows.length * 2 + 3 })
    return { text: 'jr limits opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const v = await read($, view)
    if (!v || v.windows.length === 0) return <Text dimColor>No plan-limit figures yet.</Text>
    const width = Math.max(10, Math.min(48, (e.props.bodyColumns ?? 80) - 30))
    return (
      <Box flexDirection="column">
        {gradientText(Text, 'jr limits', GRADIENTS.brand)}
        {v.windows.map(w => (
          <Box flexDirection="column">
            {drawWindow(Box, Text, w, v.now, width)}
            <Text dimColor>{w.resetsAt !== null ? `      resets ${new Date(w.resetsAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</Text>
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const v = await read($, view)
    if (!v && !live.isTicking) {
      $.clock.after(0, () => {
        void ensureTicking($)
      })
    }
    if (!showBand || !v || v.windows.length === 0 || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    const shown = v.windows.slice(0, 2)
    const width = Math.max(6, Math.min(16, Math.floor((e.props.bodyColumns - 14) / shown.length) - 20))
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'limits ', GRADIENTS.brand)}
          {shown.map((w, i) => (
            <Box>
              {i > 0 && <Text>{'   '}</Text>}
              <Text color="#6b7089">{`${labelOf(w.kind)} `}</Text>
              {gauge(Text, w.percent / 100, width, GRADIENTS.heat)}
              <Text bold color={colorAt(GRADIENTS.heat, w.percent / 100)}>{` ${Math.round(w.percent)}%`}</Text>
              {w.resetsAt !== null && <Text dimColor>{` ${countdown(w.resetsAt, v.now)}`}</Text>}
            </Box>
          ))}
        </Box>
        {below}
      </Box>
    )
  })
}
