import type { Register } from 'claude-code'

import { countLines, denial, isWholeRead } from './cap'

const MAX_TEXT_BYTES = 4 * 1024 * 1024

export const register: Register = (on, options) => {
  const cap = Math.max(50, Number(options.maxLines ?? 1000) || 1000)
  const respectAllowLarge = options.respectAllowLarge !== false

  // A whole-file Read of a long file costs its full length in context: ask for a range instead.
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    if (!isWholeRead(e, respectAllowLarge)) return next(e)
    const stat = await $.fs.stat(e.file_path)
    if (stat.size > MAX_TEXT_BYTES) return { deny: denial(e.file_path, null, cap) }
    const lines = countLines(await $.fs.read(e.file_path))
    if (lines > cap) return { deny: denial(e.file_path, lines, cap) }
    return next(e)
  }).catch(($, e, next) => next(e)) // A file the mod cannot measure (missing, unreadable) goes to Read, which says why.
}
