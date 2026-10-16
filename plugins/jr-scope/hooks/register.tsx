import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { judge, summary } from './scope'

const warning = atom({ plugin: 'jr-scope', key: 'warning' } as const, null)
const bandHidden = atom({ plugin: 'jr-scope', key: 'isBandHidden' } as const, false)
const commands = { isRegistered: false }
const band = { isLoaded: false }

async function ensureCommand($: EngineInterface) {
  if (commands.isRegistered) return
  commands.isRegistered = true
  await $.command.register({ name: 'jrscope', description: 'Show or hide the scope warning band: /jrscope toggles, /jrscope on or off' })
}

/** True while the band is hidden: one choice for every session, read from the store once per load. */
async function isBandHidden($: EngineInterface) {
  if (!band.isLoaded) {
    band.isLoaded = true
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
  }
  return read($, bandHidden)
}

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

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureCommand($)
    return started
  })

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

  on('command.run', { command: 'jrscope' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const hide = arg === 'off' || arg === 'hide' ? true : arg === 'on' || arg === 'show' ? false : arg === '' ? !(await isBandHidden($)) : null
    if (hide === null) return { text: 'jr scope · usage: /jrscope toggles the band, /jrscope on or off' }
    await $.store.set('isBandHidden', hide)
    await update($, bandHidden, () => hide)
    return { text: hide ? 'jr scope · hidden (/jrscope to bring it back)' : 'jr scope · shown' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (!commands.isRegistered) {
      $.clock.after(0, () => {
        void ensureCommand($)
      })
    }
    // Never write state while drawing: the saved choice is loaded just after.
    if (!band.isLoaded) {
      $.clock.after(0, () => {
        void isBandHidden($)
      })
    }
    if (await read($, bandHidden)) return below
    const text = await read($, warning)
    if (!showBand || !text || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text color="#ff8c42">{'▲ '}</Text>
          <Text>{text}</Text>
          <Text dimColor>{' · /jrscope hides'}</Text>
        </Text>
        {below}
      </Box>
    )
  })
}
