import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { challengeOf, VINCI_PROMPT } from './vinci'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const PANE = 'jr-vinci'
const isOn = atom({ plugin: 'jr-vinci', key: 'isOn' } as const, false)
const history = atom({ plugin: 'jr-vinci', key: 'history' } as const, [])
const isThinking = atom({ plugin: 'jr-vinci', key: 'isThinking' } as const, false)
const boot = { isDone: false }

/** Command and saved on/off state, once: at session start or first thing after a mid-session install. */
async function ensureReady($: EngineInterface) {
  if (boot.isDone) return
  boot.isDone = true
  await $.command.register({ name: 'jrvinci', description: 'Sparring partner: /jrvinci on, /jrvinci off, /jrvinci to see the challenges' })
  if ((await $.store.get('isOn')) === true) await update($, isOn, () => true)
}

/** Asks the session's own transcript for one challenge; runs after the turn, never inside it. */
async function challenge($: EngineInterface) {
  await update($, isThinking, () => true)
  try {
    const reply = await $.model.fork({ prompt: VINCI_PROMPT })
    if (!reply.isAnswered) return
    const text = challengeOf(reply.text)
    if (!text) return
    const at = await $.clock.now()
    await update($, history, list => [...list, { at, text }].slice(-30))
  } finally {
    await update($, isThinking, () => false)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureReady($)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await ensureReady($)
    const isFinished = e.agentId === undefined && !e.isAborted && e.reason === 'answer'
    if (isFinished && (await read($, isOn))) {
      $.clock.after(0, () => {
        void challenge($)
      })
    }
    return done
  })

  on('command.run', { command: 'jrvinci' }, async ($, e) => {
    await ensureReady($)
    const arg = e.args.trim()
    if (arg === 'on' || arg === 'off') {
      await $.store.set('isOn', arg === 'on')
      await update($, isOn, () => arg === 'on')
      return { text: arg === 'on' ? 'jr vinci · on: one challenge after each answer (one extra model call per turn)' : 'jr vinci · off' }
    }
    await $.ui.open({ id: PANE, title: 'jr vinci', rows: 14 })
    return { text: 'jr vinci opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (!boot.isDone) {
      $.clock.after(0, () => {
        void ensureReady($)
      })
    }
    if (e.props.hasSurvey || !(await read($, isOn))) return below
    const list = await read($, history)
    const latest = list[list.length - 1]
    const thinking = await read($, isThinking)
    if (!latest && !thinking) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text color="#ff5ca8">{'⚔ '}</Text>
          {gradientText(Text, 'vinci ', GRADIENTS.brand)}
          {thinking ? <Text dimColor>thinking…</Text> : <Text>{latest?.text ?? ''}</Text>}
        </Text>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, history)
    const isEnabled = await read($, isOn)
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="#ff5ca8">{'⚔ '}</Text>
          {gradientText(Text, 'jr vinci', GRADIENTS.brand)}
          <Text dimColor>{isEnabled ? '   on · one challenge after each answer' : '   off · /jrvinci on to start'}</Text>
        </Box>
        {list.length === 0 && <Text dimColor>No challenge yet.</Text>}
        {[...list].reverse().map(item => (
          <Text>
            <Text dimColor>{`${new Date(item.at).toTimeString().slice(0, 5)}  `}</Text>
            {item.text}
          </Text>
        ))}
      </Box>
    )
  })
}
