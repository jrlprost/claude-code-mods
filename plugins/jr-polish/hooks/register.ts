import type { EngineInterface, Register } from 'claude-code'

import { beforeAfter, cleanReply, SYSTEM } from './polish'

const commands = { isRegistered: false }

async function ensureCommand($: EngineInterface) {
  if (commands.isRegistered) return
  commands.isRegistered = true
  await $.command.register({ name: 'jrpolish', description: 'Rewrite a rough prompt into a clear one and put it in the prompt box: /jrpolish <rough prompt>' })
}

async function polish($: EngineInterface, rough: string, model: string) {
  if (!rough.trim()) return 'jr polish · usage: /jrpolish <your rough prompt>'
  const reply = await $.model.complete({ model, system: SYSTEM, prompt: rough, maxTokens: 1200 })
  if (!reply.isAnswered) return `jr polish · no rewrite (${reply.reason}); your prompt is unchanged`
  const polished = cleanReply(reply.text)
  const filled = await $.prompt.fill({ text: polished, mode: 'replace' })
  if (!filled.isFilled) return `jr polish · rewritten, but the prompt box was not available. Copy it from here:\n\n${polished}`
  return beforeAfter(rough, polished)
}

export const register: Register = (on, options) => {
  const model = String(options.model ?? 'haiku')

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureCommand($)
    return started
  })

  // Installed mid-session: no session.start, so register on the first draw above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (!commands.isRegistered) {
      $.clock.after(0, () => {
        void ensureCommand($)
      })
    }
    return next(e)
  })

  on('command.run', { command: 'jrpolish' }, async ($, e) => ({ text: await polish($, e.args, model) }))
}
