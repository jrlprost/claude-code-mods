import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { judge, summary } from './scope'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const warning = atom({ plugin: 'jr-scope', key: 'warning' } as const, null)
// The main loop's current turn: its prompt and the files written so far.
const turn = { prompt: '', files: new Set<string>() }

const touchedPath = (tool: string, input: Record<string, unknown>) => {
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') return typeof input.file_path === 'string' ? input.file_path : null
  if (tool === 'NotebookEdit') return typeof input.notebook_path === 'string' ? input.notebook_path : null
  return null
}

export const register: Register = (on, options) => {
  const maxFiles = Number(options.maxFiles ?? 15)
  const showBand = options.showBand !== false

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      turn.prompt = e.text
      turn.files = new Set()
      await update($, warning, () => null)
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const file = touchedPath(String(e.tool), e as unknown as Record<string, unknown>)
    if (file && !ran.isError && ran.deny === undefined) turn.files.add(file)
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || turn.files.size === 0) return done
    const root = await $.session.root()
    const verdict = judge(turn.prompt, [...turn.files], root, maxFiles)
    const text = summary(verdict, root)
    if (text) {
      $.ui.toast(`jr scope · ${text}`)
      await update($, warning, () => text)
    }
    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const text = await read($, warning)
    if (!showBand || !text || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text color="#ff8c42">{'▲ '}</Text>
          {gradientText(Text, 'scope ', GRADIENTS.heat.slice(1))}
          <Text>{text}</Text>
        </Text>
        {below}
      </Box>
    )
  })
}
