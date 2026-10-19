import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrRecordMode } from '../types'
import { maskText, maskValue, parseMode } from './mask'

const mode = atom({ plugin: 'jr-record', key: 'mode' } as const, 'off')
const isLoaded = atom({ plugin: 'jr-record', key: 'isLoaded' } as const, false)
const bandHidden = atom({ plugin: 'jr-record', key: 'isBandHidden' } as const, false)

const bandState = { isLoaded: false }

/** True while the band is hidden; the saved choice is read once per load of the mod. */
async function isBandHidden($: EngineInterface) {
  if (!bandState.isLoaded) {
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
    bandState.isLoaded = true
  }
  return read($, bandHidden)
}

/** Hides or shows the band for every session, kept across restarts. */
async function setBand($: EngineInterface, hide: boolean, name: string, command: string) {
  await $.store.set('isBandHidden', hide)
  await update($, bandHidden, () => hide)
  return { text: hide ? `${name} · hidden (${command} to bring it back)` : `${name} · shown` }
}
const scheduled = { load: false, command: false }

async function registerCommand($: EngineInterface) {
  if (scheduled.command) return
  scheduled.command = true
  await $.command.register({ name: 'jrrec', description: 'Recording mode: mask emails, money, keys and phone numbers on screen (on, off, strict; hide or show the band)' })
}

/** The mode survives sessions: a recording setup stays masked until you turn it off. */
async function load($: EngineInterface) {
  const saved = (await $.store.get('mode')) as JrRecordMode | undefined
  await update($, mode, () => saved ?? 'off')
  await update($, isLoaded, () => true)
}

async function setMode($: EngineInterface, next: JrRecordMode) {
  await $.store.set('mode', next)
  await update($, mode, () => next)
  await update($, isLoaded, () => true)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await isBandHidden($)
    await registerCommand($)
    await load($)
    return started
  })

  on('command.run', { command: 'jrrec' }, async ($, e) => {
    if (!(await read($, isLoaded))) await load($)
    const word = e.args.trim().toLowerCase()
    if (word === 'hide' || word === 'show') {
      const answer = await setBand($, word === 'hide', 'jr rec band', '/jrrec show')
      return word === 'hide' && (await read($, mode)) !== 'off' ? { text: `${answer.text}; masking stays active, /jrrec off to stop it` } : answer
    }
    const chosen = parseMode(e.args, await read($, mode))
    if (!chosen) return { text: 'jr rec · usage: /jrrec, /jrrec on, /jrrec off, /jrrec strict, /jrrec hide, /jrrec show' }
    await setMode($, chosen)
    return {
      text:
        chosen === 'off'
          ? 'jr rec · off: the screen shows everything again.'
          : `jr rec · ${chosen}: emails, money, keys and phone numbers are masked on screen${chosen === 'strict' ? ', plus home paths and long numbers' : ''}. Claude still reads the real text.`,
    }
  })

  // Installed mid-session: read the saved mode on the first draw.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (!(await read($, isLoaded)) && !scheduled.load) {
      scheduled.load = true
      $.clock.after(0, () => {
        void load($)
        void registerCommand($)
      })
    }
    if (await read($, bandHidden)) return below
    const current = await read($, mode)
    if (current === 'off' || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text color="#ef4565" bold>{'● REC '}</Text>
          <Text>{current === 'strict' ? 'masking on, strict' : 'masking on'}</Text>
          <Text dimColor>{' · /jrrec off'}</Text>
        </Text>
        {below}
      </Box>
    )
  })

  // Every text the transcript draws: the drawing changes, the stored message does not.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const m = await read($, mode)
    return next(m === 'off' ? e : { ...e, props: { ...e.props, text: maskText(e.props.text, m) } })
  })
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const m = await read($, mode)
    return next(m === 'off' ? e : { ...e, props: { ...e.props, text: maskText(e.props.text, m) } })
  })
  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    const m = await read($, mode)
    return next(m === 'off' ? e : { ...e, props: { ...e.props, text: maskText(e.props.text, m) } })
  })
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const m = await read($, mode)
    if (m === 'off') return next(e)
    return next({ ...e, props: { ...e.props, input: maskValue(e.props.input, m), output: maskValue(e.props.output, m) } })
  })
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const m = await read($, mode)
    return next(m === 'off' ? e : { ...e, props: { ...e.props, output: maskValue(e.props.output, m) } })
  })
}
