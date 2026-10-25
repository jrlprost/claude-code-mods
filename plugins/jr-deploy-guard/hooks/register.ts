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

// The session's permission mode, read from every classic event that carries it (the session's
// start, each prompt, each finished tool or batch, each permission question, each stop): neither
// tool.check nor PreToolUse carries it. Empty until the first one, and empty again after a reload.
const live = { mode: '' }

// Modes where an ask from this guard reaches the person. Any other mode, an unknown one or none yet
// is treated as one where nobody is asked: auto lets the classifier answer, dontAsk refuses unseen.
const ASKED_MODES = ['default', 'acceptEdits', 'plan', 'bypassPermissions']

const isAsked = () => ASKED_MODES.includes(live.mode)

export const register: Register = (on, options) => {
  const noFriday = options.noFridayDeploys === true

  on('classic.SessionStart', async ($, e, next) => {
    live.mode = e.permission_mode ?? live.mode
    return next(e)
  })
  on('classic.UserPromptSubmit', async ($, e, next) => {
    live.mode = e.permission_mode ?? live.mode
    return next(e)
  })
  on('classic.PostToolUse', async ($, e, next) => {
    live.mode = e.permission_mode ?? live.mode
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    live.mode = e.permission_mode ?? live.mode
    return next(e)
  })
  on('classic.PostToolBatch', async ($, e, next) => {
    live.mode = e.permission_mode ?? live.mode
    return next(e)
  })
  on('classic.PermissionRequest', async ($, e, next) => {
    live.mode = e.permission_mode ?? live.mode
    return next(e)
  })
  on('classic.Stop', async ($, e, next) => {
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
    if (!e.approver || !isAsked()) {
      const where = !e.approver ? 'nobody can be asked to confirm it here' : live.mode ? `in ${live.mode} mode nobody is asked before it runs` : 'the permission mode is not known yet, so nobody may be asked'
      return { decision: 'deny', reason: `jr-deploy-guard: ${action}, and ${where}, so it is refused. Do not retry it: ask the person to run it themselves at the prompt with \`! ${command}\`.` }
    }
    return { decision: 'ask', reason: `jr-deploy-guard: ${action}. This ships to production: confirm it is meant to.` }
  }).catch(() =>
    isAsked()
      ? { decision: 'ask', reason: 'jr-deploy-guard: the production check failed; confirm this command yourself.' }
      : { decision: 'deny', reason: 'jr-deploy-guard: the production check failed and nobody may be asked to confirm. Do not retry it: ask the person to run the command themselves at the prompt with `! <command>`.' },
  )
}
