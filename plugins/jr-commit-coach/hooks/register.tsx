import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { advice, pending } from './coach'
import { gauge, gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'
import { repoIsSafe, safeGit } from './jr/git'

const nudge = atom({ plugin: 'jr-commit-coach', key: 'nudge' } as const, null)
// The last size a toast was shown for, so the same pile does not toast again every turn.
const shown = { lines: 0 }

/** Uncommitted lines and new files in the session's repository, or null outside git. */
async function measure($: EngineInterface) {
  const root = await $.session.root()
  // A repo whose config or attributes could make git run a program is left alone.
  if (!(await repoIsSafe($, root))) return null
  const diff = await $.process.run(safeGit(['-C', root, 'diff', '--numstat', 'HEAD'])).catch(() => null)
  if (!diff || diff.exitCode !== 0) return null
  const fresh = await $.process.run(safeGit(['-C', root, 'ls-files', '--others', '--exclude-standard'])).catch(() => null)
  return pending(diff.stdout, fresh?.exitCode === 0 ? fresh.stdout : '')
}

export const register: Register = (on, options) => {
  const threshold = Number(options.threshold ?? 300)
  const showBand = options.showBand !== false

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    const p = await measure($)
    if (!p || p.lines < threshold) {
      shown.lines = 0
      await update($, nudge, () => null)
      return done
    }
    const text = advice(p)
    await update($, nudge, () => ({ lines: p.lines, untracked: p.untracked, advice: text }))
    // A toast the first time, then again only when the pile grew by half.
    if (p.lines >= Math.max(threshold, shown.lines * 1.5)) {
      shown.lines = p.lines
      $.ui.toast(`jr commit coach · ${text}`)
    }
    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const n = await read($, nudge)
    if (!showBand || !n || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          {gradientText(Text, 'commit ', GRADIENTS.brand)}
          {gauge(Text, Math.min(1, n.lines / (threshold * 3)), 10, GRADIENTS.heat)}
          <Text bold>{` ${n.lines}`}</Text>
          <Text dimColor>{` lines uncommitted${n.untracked ? ` + ${n.untracked} new` : ''} · time for an atomic commit`}</Text>
        </Text>
        {below}
      </Box>
    )
  })
}
