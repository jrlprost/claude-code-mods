import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { barWidth, fillOf } from './fill'
import { gauge, tag } from './jr/draw'
import { GRADIENTS, colorAt, formatTokens } from './jr/gradient'

const fill = atom({ plugin: 'jr-context', key: 'fill' } as const, null)

const refresh = async ($: EngineInterface) => {
  const usage = await $.session.usage()
  await update($, fill, () => fillOf(usage.context))
}

export const register: Register = (on, options) => {
  const warnAt = Number(options.warnAt ?? 80)
  const size = String(options.width ?? 'normal')

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await refresh($)
    return started
  })

  // The window grows with every tool result and every reply.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    await refresh($)
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refresh($)
    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const now = await read($, fill)
    if (!now || e.props.hasSurvey) return below

    const { Box, Text } = $.ui.resolve(e)
    const ratio = now.percent / 100
    const isWarning = now.percent >= warnAt

    return (
      <Box flexDirection="column">
        <Box>
          {tag(Text, 'ctx', GRADIENTS.brand)}
          {gauge(Text, ratio, barWidth(size, e.props.bodyColumns), GRADIENTS.heat)}
          <Text bold color={colorAt(GRADIENTS.heat, ratio)}>{` ${now.percent}%`}</Text>
          <Text dimColor>{` · ${formatTokens(now.tokens)} / ${formatTokens(now.window)}`}</Text>
          {isWarning && <Text color={colorAt(GRADIENTS.heat, 1)}>{' · compact soon'}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
