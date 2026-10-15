import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { fillOf, segmentColor, share, stackedBar } from './fill'
import { gradientText } from './jr/draw'
import { GRADIENTS, colorAt, formatTokens } from './jr/gradient'

const fill = atom({ plugin: 'jr-context', key: 'fill' } as const, null)
const REFRESH_EVERY_MS = 4000
const last = { refreshedAt: 0 }

async function refresh($: EngineInterface, force = false) {
  const now = await $.clock.now()
  if (!force && now - last.refreshedAt < REFRESH_EVERY_MS) return
  last.refreshedAt = now
  const usage = await $.session.usage({ breakdown: 'summary' })
  await update($, fill, () => fillOf(usage.context.breakdown))
}

export const register: Register = (on, options) => {
  const warnAt = Number(options.warnAt ?? 80)
  const layout = String(options.layout ?? 'full')

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await refresh($, true)
    return started
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
    if (!now || e.props.hasSurvey) return below

    const { Box, Text } = $.ui.resolve(e)
    const width = Math.max(20, e.props.bodyColumns)
    const heat = colorAt(GRADIENTS.heat, now.percent / 100)
    const compactsAt = now.max - now.buffer
    const isWarning = now.percent >= warnAt
    const isCompact = layout === 'compact' || e.props.maxRows < 4

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
        {below}
      </Box>
    )
  })
}
