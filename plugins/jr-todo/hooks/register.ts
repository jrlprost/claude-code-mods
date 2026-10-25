import type { EngineInterface, Register } from 'claude-code'

import { appendLine, httpFailure, optionsOf, planFor } from './targets'
import type { TodoOptions } from './targets'

const commands = { isRegistered: false }

async function ensureCommand($: EngineInterface) {
  if (commands.isRegistered) return
  commands.isRegistered = true
  await $.command.register({ name: 'jr-todo', description: 'Capture a task instantly, no model call: /jr-todo <task>' })
}

/** Files the task where the settings say; returns the line shown to you. */
async function capture($: EngineInterface, task: string, o: TodoOptions) {
  if (!task) return 'jr todo · usage: /jr-todo <task>'
  const root = await $.session.root()
  const plan = planFor(task, o, root)
  if (plan.kind === 'missing') return `jr todo · the ${o.target} target needs ${plan.what}: set it in /config`
  try {
    if (plan.kind === 'append') {
      let current = ''
      try {
        current = await $.fs.read(plan.file)
      } catch {
        current = ''
      }
      await $.fs.write(plan.file, appendLine(current, plan.line))
    } else if (plan.kind === 'http') {
      const res = await $.http.fetch(plan.url, plan.init)
      const failure = httpFailure(res.status, res.ok, res.text)
      if (failure) return `jr todo · ${plan.describe} refused the task (${failure}); nothing was saved`
    } else {
      const res = await $.process.run(plan.argv, { cwd: root, timeoutMs: 20_000 })
      if (res.exitCode !== 0) return `jr todo · ${plan.describe} failed (exit ${res.exitCode}): ${res.stderr.trim().slice(0, 160)}`
    }
  } catch (error) {
    return `jr todo · could not reach ${plan.describe}: ${String(error).slice(0, 160)}`
  }
  return `jr todo · ✓ "${task}" → ${plan.describe}`
}

export const register: Register = (on, options) => {
  const o = optionsOf(options)

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

  on('command.run', { command: 'jr-todo' }, async ($, e) => ({ text: await capture($, e.args.trim(), o) }))
}
