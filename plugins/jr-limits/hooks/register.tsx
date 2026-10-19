import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrLimitsView } from '../types'
import { gauge, gradientText } from './jr/draw'
import { GRADIENTS, colorAt } from './jr/gradient'
import { countdown, crossed, fullest, labelOf, levelColor, shortCountdown, windowsOf } from './limits'

const view = atom({ plugin: 'jr-limits', key: 'view' } as const, null)
const bandHidden = atom({ plugin: 'jr-limits', key: 'isBandHidden' } as const, false)
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
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
    band.isLoaded = true
  }
  return read($, bandHidden)
}

async function setBand($: EngineInterface, verb: 'hide' | 'show' | 'toggle') {
  const hide = verb === 'toggle' ? !(await isBandHidden($)) : verb === 'hide'
  await $.store.set('isBandHidden', hide)
  await update($, bandHidden, () => hide)
  return { text: hide ? 'jr limits · hidden (/jrlimits to bring it back)' : 'jr limits · shown' }
}
const PANE = 'jr-limits'
const THRESHOLDS = [80, 95]
const ALERT_AT = 80
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

  // A /clear starts a new conversation with empty state and no session.start: load again once it has begun.
  on('session.end', async ($, e, next) => {
    const ended = await next(e)
    if (e.reason === 'clear') {
      band.isLoaded = false
      $.clock.after(1000, () => {
        void isBandHidden($)
        void refresh($)
      })
    }
    return ended
  })

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await isBandHidden($)
    await $.command.register({ name: 'jrlimits', description: 'Show or hide the limits band; /jrlimits details opens the full view' })
    await ensureTicking($)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await ensureTicking($)
    await refresh($)
    return done
  })

  on('command.run', { command: 'jrlimits' }, async ($, e) => {
    const verb = bandVerb(e.args)
    if (verb) return setBand($, verb)
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
    if (await read($, bandHidden)) return below
    if (!showBand || !v || v.windows.length === 0 || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    const top = fullest(v.windows)!
    const width = Math.max(20, e.props.bodyColumns)
    // Something needs attention: one alert row on the left, the fullest window and its reset.
    if (top.percent >= ALERT_AT) {
      const color = top.percent >= 95 ? '#ef4565' : '#ff8c42'
      const resets = top.resetsAt !== null ? ` · resets in ${shortCountdown(top.resetsAt, v.now)}` : ''
      return (
        <Box flexDirection="column">
          <Box key="jr-limits-row" width={width}>
            <Text wrap="truncate-end">
              <Text color={color}>{`▲ ${labelOf(top.kind)} limit ${Math.round(top.percent)}%`}</Text>
              <Text dimColor>{resets}</Text>
            </Text>
          </Box>
          {below}
        </Box>
      )
    }
    // Otherwise one quiet row on the right: each window's fill, and when the fullest resets.
    const shown = v.windows.slice(0, 2)
    return (
      <Box flexDirection="column">
        <Box key="jr-limits-row" width={width} justifyContent="flex-end">
          <Text wrap="truncate-end">
            {shown.map((w, i) => (
              <Text>
                <Text dimColor>{`${i > 0 ? ' · ' : ''}${labelOf(w.kind)} `}</Text>
                <Text color={levelColor(w.percent)}>{`${Math.round(w.percent)}%`}</Text>
              </Text>
            ))}
            {top.resetsAt !== null && <Text dimColor>{` ↻${shortCountdown(top.resetsAt, v.now)}`}</Text>}
          </Text>
        </Box>
        {below}
      </Box>
    )
  })
}
