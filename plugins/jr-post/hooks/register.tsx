import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { cleanPost, postPrompt, wordCount } from './post'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const PANE = 'jr-post'
const draft = atom({ plugin: 'jr-post', key: 'draft' } as const, { text: '', language: 'English', status: 'idle' })
const commands = { isRegistered: false }

async function ensureCommand($: EngineInterface) {
  if (commands.isRegistered) return
  commands.isRegistered = true
  await $.command.register({ name: 'jrpost', description: 'Draft a "what I built today" post from this session: /jrpost [language]' })
}

async function copy($: EngineInterface) {
  const { text } = await read($, draft)
  if (!text) return
  const copied = await $.ui.copy({ text })
  $.ui.toast(copied.isCopied ? 'jr post · copied to the clipboard' : 'jr post · could not copy here; select the text in the pane')
}

/** Asks the session's own conversation for the post, then copies it. */
async function write($: EngineInterface, language: string, platform: string) {
  await update($, draft, () => ({ text: '', language, status: 'writing' }))
  const reply = await $.model.fork({ prompt: postPrompt(language, platform) })
  if (!reply.isAnswered) {
    const reason = reply.reason === 'nothing-to-fork' ? 'nothing has happened in this session yet' : reply.reason
    await update($, draft, () => ({ text: '', language, status: 'failed' as const, reason }))
    return
  }
  await update($, draft, () => ({ text: cleanPost(reply.text), language, status: 'ready' }))
  await copy($)
}

export const register: Register = (on, options) => {
  const defaultLanguage = String(options.language ?? 'English')
  const platform = String(options.platform ?? 'LinkedIn')

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureCommand($)
    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (!commands.isRegistered) {
      $.clock.after(0, () => {
        void ensureCommand($)
      })
    }
    return next(e)
  })

  on('command.run', { command: 'jrpost' }, async ($, e) => {
    const language = e.args.trim() || defaultLanguage
    await $.ui.open({ id: PANE, title: 'jr post', rows: 16 })
    $.clock.after(0, () => {
      void write($, language, platform)
    })
    return { text: `jr post · writing a ${language} post from this session…` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const post = await read($, draft)
    const header = (
      <Box>
        {gradientText(Text, 'jr post', GRADIENTS.brand)}
        <Text dimColor>{`   ${platform} · ${post.language}${post.status === 'ready' ? ` · ${wordCount(post.text)} words · copied` : ''}`}</Text>
      </Box>
    )
    if (post.status === 'writing') return <Box flexDirection="column">{header}<Text dimColor>Writing from this session…</Text></Box>
    if (post.status === 'failed') return <Box flexDirection="column">{header}<Text color="#ef4565">{`No post: ${post.reason ?? 'no answer'}.`}</Text></Box>
    if (post.status === 'idle') return <Box flexDirection="column">{header}<Text dimColor>Run /jrpost to write one.</Text></Box>
    return (
      <Box flexDirection="column">
        {header}
        <Text>{post.text}</Text>
        <Box columnGap={2}>
          <Button key="copy" label="Copy" hotkey="c" onPress={() => void copy($)} />
          <Button key="again" label="Write another" hotkey="r" onPress={() => void write($, post.language, platform)} />
        </Box>
      </Box>
    )
  })
}
