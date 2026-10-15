import type { Register } from 'claude-code'

import { isBrokenPromise, REASON } from './promise'

// Tool calls made since the main loop's turn started.
const turn = { tools: 0 }

export const register: Register = (on, options) => {
  const isEnabled = options.enabled !== false

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) turn.tools = 0
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    turn.tools++
    return next(e)
  }).catch(($, e, next) => next(e))

  // When Claude is about to stop, a reply that only announces work sends it back to do it.
  // Once per turn: a Stop that is already the answer to a block (stop_hook_active) passes.
  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    if (!isEnabled || e.stop_hook_active || result.block || turn.tools > 0) return result
    if (!isBrokenPromise(e.last_assistant_message ?? '')) return result
    $.ui.toast('jr no-promise · the reply announced work without doing it: sent back once')
    return { ...result, block: REASON }
  }).catch(($, e, next) => next(e))
}
