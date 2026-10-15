import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const PANE = 'jr-draft'
const draft = atom({ plugin: 'jr-draft', key: 'text' } as const, '')
const project = atom({ plugin: 'jr-draft', key: 'project' } as const, '')
const boot = { isDone: false }

const keyOf = (name: string) => `draft:${name}`

/** Command, project and saved draft, once: at session start or first thing after a mid-session install. */
async function ensureReady($: EngineInterface) {
  if (boot.isDone) return
  boot.isDone = true
  await $.command.register({ name: 'jrdraft', description: 'A scratch pane to draft your next prompt while Claude works' })
  const root = await $.session.root()
  const name = root.split('/').pop() || root
  await update($, project, () => name)
  const saved = (await $.store.get(keyOf(name))) as string | undefined
  if (saved) await update($, draft, () => saved)
}

async function save($: EngineInterface, text: string) {
  await update($, draft, () => text)
  await $.store.set(keyOf(await read($, project)), text)
}

/** Puts the draft in the prompt box and empties the scratch area. */
async function sendToPrompt($: EngineInterface) {
  const text = await read($, draft)
  if (!text.trim()) return
  const filled = await $.prompt.fill({ text, mode: 'replace' })
  if (filled.isFilled) {
    await save($, '')
    $.ui.toast('jr draft · in the prompt box: edit it or press Enter')
  } else {
    $.ui.toast('jr draft · the prompt box is busy; your draft is kept')
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureReady($)
    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (!boot.isDone) {
      $.clock.after(0, () => {
        void ensureReady($)
      })
    }
    return next(e)
  })

  on('command.run', { command: 'jrdraft' }, async $ => {
    await ensureReady($)
    await $.ui.open({ id: PANE, title: 'jr draft', focus: true, closeOnEscape: true, rows: 12 })
    return { text: 'jr draft opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    const Input = 'Input' in elements ? elements.Input : undefined
    const text = await read($, draft)
    const name = await read($, project)
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'jr draft', GRADIENTS.brand)}
          <Text dimColor>{`   ${name} · ${words} word${words === 1 ? '' : 's'} · kept until you send it`}</Text>
        </Box>
        {Input ? (
          <Input
            key="draft"
            value={text}
            rows={6}
            autoFocus
            placeholder="Draft the next prompt here while Claude works…"
            submitLabel="to prompt box"
            onInput={(value: string) => void save($, value)}
            onSubmit={(value: string) => void save($, value).then(() => sendToPrompt($))}
          />
        ) : (
          <Text>{text || 'Open /jrdraft in the terminal or the desktop app to type here.'}</Text>
        )}
        <Box columnGap={2}>
          <Button key="send" label="Send to prompt box" hotkey="s" onPress={() => void sendToPrompt($)} />
          <Button key="clear" label="Clear" hotkey="c" onPress={() => void save($, '')} />
        </Box>
      </Box>
    )
  })
}
