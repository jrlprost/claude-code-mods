import type { EngineInterface, Register } from 'claude-code'

import { FRIDAY_OVERRIDE, isBarePush, isFriday, PROTECTED_BRANCHES, productionAction } from './deploy'
import { safeGit } from './jr/git'

async function currentBranch($: EngineInterface) {
  const { exitCode, stdout } = await $.process.run(safeGit(['branch', '--show-current']))
  return exitCode === 0 ? stdout.trim() : ''
}

async function actionOf($: EngineInterface, command: string) {
  const named = productionAction(command)
  if (named) return named
  if (isBarePush(command)) {
    const branch = await currentBranch($)
    if (PROTECTED_BRANCHES.includes(branch)) return `Push to ${branch}`
  }
  return null
}

// The session's permission mode, read from the classic events that carry it (each prompt, each
// finished tool). Unknown until the first one.
const live = { mode: '' }

// Modes that settle an ask without the person: the auto classifier answers it, dontAsk refuses it.
const UNASKED_MODES = ['auto', 'dontAsk']

export const register: Register = (on, options) => {
  const noFriday = options.noFridayDeploys === true

  on('classic.UserPromptSubmit', async ($, e, next) => {
    live.mode = e.permission_mode ?? live.mode
    return next(e)
  })
  on('classic.PostToolUse', async ($, e, next) => {
    live.mode = e.permission_mode ?? live.mode
    return next(e)
  })

  // tool.check decides whether a call may run: an `ask` puts the call in front of you,
  // whatever rules already allowed it.
  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const verdict = await next(e)
    const command = (e.input as { command?: string }).command ?? ''
    const action = await actionOf($, command)
    if (!action || verdict.decision === 'deny') return verdict
    if (noFriday && isFriday(await $.clock.now()) && !command.includes(FRIDAY_OVERRIDE)) {
      return { decision: 'deny', reason: `jr-deploy-guard: no production deploys on Friday (${action}). If it really has to ship today, ask the person, then prefix the command with ${FRIDAY_OVERRIDE}.` }
    }
    // Where nobody would see the question, refuse and hand the command to the person.
    if (!e.approver || UNASKED_MODES.includes(live.mode)) {
      const where = e.approver ? `in ${live.mode} mode nobody is asked before it runs` : 'nobody can be asked to confirm it here'
      return { decision: 'deny', reason: `jr-deploy-guard: ${action}, and ${where}, so it is refused. Do not retry it: ask the person to run it themselves at the prompt with \`! ${command}\`.` }
    }
    return { decision: 'ask', reason: `jr-deploy-guard: ${action}. This ships to production: confirm it is meant to.` }
  }).catch(() => ({ decision: 'ask', reason: 'jr-deploy-guard: the production check failed; confirm this command yourself.' }))
}
