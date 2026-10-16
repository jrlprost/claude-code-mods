import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { advice, pending } from './coach'
import { repoIsSafe, safeGit } from './jr/git'

const nudge = atom({ plugin: 'jr-commit-coach', key: 'nudge' } as const, null)
const bandHidden = atom({ plugin: 'jr-commit-coach', key: 'isBandHidden' } as const, false)
const commands = { isRegistered: false }
const band = { isLoaded: false }

async function ensureCommand($: EngineInterface) {
  if (commands.isRegistered) return
  commands.isRegistered = true
  await $.command.register({ name: 'jrcommit', description: 'Show or hide the uncommitted-work band: /jrcommit toggles, /jrcommit on or off' })
}

/** True while the band is hidden: one choice for every session, read from the store once per load. */
async function isBandHidden($: EngineInterface) {
  if (!band.isLoaded) {
    band.isLoaded = true
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
  }
  return read($, bandHidden)
}

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

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureCommand($)
    return started
  })

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
    await update($, nudge, () => ({ lines: p.lines, untracked: p.untracked, advice: text, folders: p.split.slice(0, 3).map(g => `${g.folder}/`) }))
    // A toast the first time, then again only when the pile grew by half.
    if (p.lines >= Math.max(threshold, shown.lines * 1.5)) {
      shown.lines = p.lines
      $.ui.toast(`jr commit coach · ${text}`)
    }
    return done
  })

  on('command.run', { command: 'jrcommit' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const hide = arg === 'off' || arg === 'hide' ? true : arg === 'on' || arg === 'show' ? false : arg === '' ? !(await isBandHidden($)) : null
    if (hide === null) return { text: 'jr commit coach · usage: /jrcommit toggles the band, /jrcommit on or off' }
    await $.store.set('isBandHidden', hide)
    await update($, bandHidden, () => hide)
    return { text: hide ? 'jr commit coach · hidden (/jrcommit to bring it back)' : 'jr commit coach · shown' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (!commands.isRegistered) {
      $.clock.after(0, () => {
        void ensureCommand($)
      })
    }
    // Never write state while drawing: the saved choice is loaded just after.
    if (!band.isLoaded) {
      $.clock.after(0, () => {
        void isBandHidden($)
      })
    }
    if (await read($, bandHidden)) return below
    const n = await read($, nudge)
    if (!showBand || !n || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text color="#ff8c42">{'▲ '}</Text>
          <Text bold>{`${n.lines}`}</Text>
          <Text>{` lines uncommitted${n.untracked ? ` + ${n.untracked} new` : ''}`}</Text>
          {n.folders.length > 0 && <Text dimColor>{` · split: ${n.folders.join(' ')}`}</Text>}
        </Text>
        {below}
      </Box>
    )
  })
}
