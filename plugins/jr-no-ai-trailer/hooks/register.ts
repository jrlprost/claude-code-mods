import type { Register } from 'claude-code'

import { judge } from './trailer'

export const register: Register = (on, options) => {
  const allowTrailer = options.allowTrailer === true
  const blockFooter = options.blockFooter !== false

  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const verdict = judge(e.command, { allowTrailer, blockFooter })
    return verdict ?? next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'jr-no-ai-trailer: the check failed, so the commit was held back.' }))
}
