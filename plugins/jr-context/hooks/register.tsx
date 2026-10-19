import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrContextFill } from '../types'
import { compactsAtOf, fillOf, isNearCompaction, miniBar, segmentColor, share, stackedBar } from './fill'
import { gradientText } from './jr/draw'
import { GRADIENTS, colorAt, formatTokens } from './jr/gradient'

const fill = atom({ plugin: 'jr-context', key: 'fill' } as const, null)
const bandHidden = atom({ plugin: 'jr-context', key: 'isBandHidden' } as const, false)
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
  return { text: hide ? 'jr context · hidden (/jrcontext to bring it back)' : 'jr context · shown' }
}
const PANE = 'jr-context'
const REFRESH_EVERY_MS = 4000
const last = { refreshedAt: 0, isScheduled: false }

async function refresh($: EngineInterface, force = false) {
  const now = await $.clock.now()
  if (!force && now - last.refreshedAt < REFRESH_EVERY_MS) return
  last.refreshedAt = now
  const usage = await $.session.usage({ breakdown: 'summary' })
  await update($, fill, () => fillOf(usage.context.breakdown))
}

type Elements = ReturnType<EngineInterface['ui']['resolve']>

const AMBER = '#ff8c42'
const RED = '#ef4565'
const MINI_BAR_CELLS = 18

/** The full view of the pane: the header, the stacked bar and the legend. */
function drawContext(Box: Elements['Box'], Text: Elements['Text'], now: JrContextFill, width: number, warnAt: number) {
  const heat = colorAt(GRADIENTS.heat, now.percent / 100)
  const compactsAt = compactsAtOf(now)
  const isWarning = isNearCompaction(now, warnAt)

  const header = (
    <Box justifyContent="space-between" width={width}>
      <Box>
        <Text color="#ff8c42">{'◆ '}</Text>
        {gradientText(Text, 'context', GRADIENTS.brand)}
        {isWarning && <Text color={heat}>{'  compaction is near'}</Text>}
      </Box>
      <Box>
        <Text dimColor>{`${formatTokens(now.total)} of ${formatTokens(now.max)} · compacts at ${formatTokens(compactsAt)} `}</Text>
        <Text backgroundColor={heat} color="black" bold>{` ${now.percent}% `}</Text>
      </Box>
    </Box>
  )

  const bar = (
    <Text>
      {stackedBar(now, width).map(cell =>
        cell.kind === 'free' ? <Text color={cell.color} dimColor>{cell.char}</Text> : <Text color={cell.color}>{cell.char}</Text>,
      )}
    </Text>
  )

  const legend = (
    <Box flexWrap="wrap" columnGap={3} width={width}>
      {now.used.map((segment, i) => (
        <Text>
          <Text color={segmentColor(i, now.used.length)}>{'■ '}</Text>
          {`${segment.name} `}
          <Text bold>{formatTokens(segment.tokens)}</Text>
          <Text dimColor>{` ${share(segment.tokens, now.max)}`}</Text>
        </Text>
      ))}
      <Text dimColor>{`─ free space ${formatTokens(Math.max(0, compactsAt - now.total))}`}</Text>
      <Text>
        <Text color="#3b3d4f">{'█ '}</Text>
        <Text dimColor>{`autocompact buffer ${formatTokens(now.buffer)}`}</Text>
      </Text>
    </Box>
  )

  return (
    <Box flexDirection="column">
      {header}
      {bar}
      {legend}
    </Box>
  )
}

/**
 * The band: one row. Quiet and right-aligned while there is room; once compaction is near,
 * an alert on the left with what is left before it.
 */
function drawRow(Box: Elements['Box'], Text: Elements['Text'], now: JrContextFill, width: number, warnAt: number) {
  if (isNearCompaction(now, warnAt)) {
    const compactsAt = compactsAtOf(now)
    const color = isNearCompaction(now, 95) ? RED : AMBER
    return (
      <Box key="jr-context-row" width={width}>
        <Text wrap="truncate-end">
          <Text color={color}>{`▲ context ${now.percent}%`}</Text>
          <Text dimColor>{` · compacts in ${formatTokens(Math.max(0, compactsAt - now.total))} · /jrcontext details`}</Text>
        </Text>
      </Box>
    )
  }
  return (
    <Box key="jr-context-row" width={width} justifyContent="flex-end">
      <Text wrap="truncate-end">
        <Text dimColor>{'ctx ▕'}</Text>
        {miniBar(now, MINI_BAR_CELLS).map(cell =>
          cell.kind === 'free' ? <Text color={cell.color} dimColor>{cell.char}</Text> : <Text color={cell.color}>{cell.char}</Text>,
        )}
        <Text dimColor>{'▏ '}</Text>
        <Text color={colorAt(GRADIENTS.heat, now.percent / 100)}>{`${now.percent}%`}</Text>
        <Text dimColor>{` · ${formatTokens(now.total)}/${formatTokens(now.max)}`}</Text>
      </Text>
    </Box>
  )
}

export const register: Register = (on, options) => {
  const warnAt = Number(options.warnAt ?? 80)

  // A /clear starts a new conversation with empty state and no session.start: load again once it has begun.
  on('session.end', async ($, e, next) => {
    const ended = await next(e)
    if (e.reason === 'clear') {
      band.isLoaded = false
      $.clock.after(1000, () => {
        void isBandHidden($)
        void refresh($, true)
      })
    }
    return ended
  })

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await isBandHidden($)
    await $.command.register({ name: 'jrcontext', description: 'Show or hide the context band; /jrcontext details opens the full bar' })
    await refresh($, true)
    return started
  })

  on('command.run', { command: 'jrcontext' }, async ($, e) => {
    const verb = bandVerb(e.args)
    if (verb) return setBand($, verb)
    await refresh($, true)
    await $.ui.open({ id: PANE, title: 'jr context', rows: 8 })
    return { text: 'jr context opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const now = await read($, fill)
    if (!now) return <Text dimColor>Reading the context window…</Text>
    return drawContext(Box, Text, now, Math.max(20, e.props.bodyColumns ?? e.viewport?.columns ?? 80), warnAt)
  })

  // The window grows with every tool result; refreshed at most every few seconds.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    await refresh($)
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refresh($, true)
    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (await read($, bandHidden)) return below
    const now = await read($, fill)
    // Installed or reloaded mid-session, the mod saw no session.start: read the figures once now.
    if (!now && !last.isScheduled) {
      last.isScheduled = true
      $.clock.after(0, () => {
        void refresh($, true)
      })
    }
    if (!now || e.props.hasSurvey) return below

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {drawRow(Box, Text, now, Math.max(20, e.props.bodyColumns), warnAt)}
        {below}
      </Box>
    )
  })
}
