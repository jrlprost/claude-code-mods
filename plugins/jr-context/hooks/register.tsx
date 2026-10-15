import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrContextFill } from '../types'
import { fillOf, segmentColor, share, stackedBar } from './fill'
import { gradientText } from './jr/draw'
import { GRADIENTS, colorAt, formatTokens } from './jr/gradient'

const fill = atom({ plugin: 'jr-context', key: 'fill' } as const, null)
const isHidden = atom({ plugin: 'jr-context', key: 'isHidden' } as const, false)
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

/** The header, the stacked bar and, unless compact, the legend: shared by the band and the pane. */
function drawContext(Box: Elements['Box'], Text: Elements['Text'], now: JrContextFill, width: number, warnAt: number, isCompact: boolean) {
  const heat = colorAt(GRADIENTS.heat, now.percent / 100)
  const compactsAt = now.max - now.buffer
  const isWarning = now.percent >= warnAt

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
      {!isCompact && legend}
    </Box>
  )
}

export const register: Register = (on, options) => {
  const warnAt = Number(options.warnAt ?? 80)
  const layout = String(options.layout ?? 'full')

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'jrcontext', description: 'Open the context bar in a pane; /jrcontext hide or show toggles the band' })
    await update($, isHidden, () => false)
    if ((await $.store.get('isHidden')) === true) await update($, isHidden, () => true)
    await refresh($, true)
    return started
  })

  on('command.run', { command: 'jrcontext' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'hide' || arg === 'show') {
      await $.store.set('isHidden', arg === 'hide')
      await update($, isHidden, () => arg === 'hide')
      return { text: arg === 'hide' ? 'jr context · band hidden (/jrcontext show to bring it back)' : 'jr context · band shown' }
    }
    await refresh($, true)
    await $.ui.open({ id: PANE, title: 'jr context', rows: 8 })
    return { text: 'jr context opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const now = await read($, fill)
    if (!now) return <Text dimColor>Reading the context window…</Text>
    return drawContext(Box, Text, now, Math.max(20, e.props.bodyColumns ?? e.viewport?.columns ?? 80), warnAt, false)
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
    const now = await read($, fill)
    // Installed or reloaded mid-session, the mod saw no session.start: read the figures once now.
    if (!now && !last.isScheduled) {
      last.isScheduled = true
      $.clock.after(0, () => {
        void refresh($, true)
      })
    }
    if (!now || e.props.hasSurvey || (await read($, isHidden))) return below

    const { Box, Text } = $.ui.resolve(e)
    const isCompact = layout === 'compact' || e.props.maxRows < 4

    return (
      <Box flexDirection="column">
        {drawContext(Box, Text, now, Math.max(20, e.props.bodyColumns), warnAt, isCompact)}
        {below}
      </Box>
    )
  })
}
