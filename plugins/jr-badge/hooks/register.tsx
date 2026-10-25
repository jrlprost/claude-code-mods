import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { badgeOf } from './badge'
import { safeGit } from './jr/git'

const badge = atom({ plugin: 'jr-badge', key: 'badge' } as const, null)
// Hidden until the person asks for it.
const isHidden = atom({ plugin: 'jr-badge', key: 'isHidden' } as const, true)
const live = { isLoaded: false }

/** Hidden or shown is one choice for every session, kept across restarts; read outside a drawing, which cannot write state. */
async function ensureLoaded($: EngineInterface) {
  if (live.isLoaded) return
  if ((await $.store.get('isHidden')) === false) await update($, isHidden, () => false)
  live.isLoaded = true
}

async function git($: EngineInterface, cwd: string, args: string[]) {
  try {
    const { exitCode, stdout } = await $.process.run(safeGit(['-C', cwd, ...args]))
    return exitCode === 0 && stdout.trim() ? stdout.trim() : null
  } catch {
    return null
  }
}

async function claudeMdOf($: EngineInterface, root: string) {
  try {
    return await $.fs.read(`${root}/CLAUDE.md`)
  } catch {
    return null
  }
}

async function refresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const [home, repoRoot, branch] = await Promise.all([$.env.get('HOME'), git($, cwd, ['rev-parse', '--show-toplevel']), git($, cwd, ['branch', '--show-current'])])
  const root = repoRoot ?? cwd
  const claudeMd = await claudeMdOf($, root)
  await update($, badge, () => badgeOf({ cwd, home: home ?? null, root, branch, claudeMd }))
}

export const register: Register = on => {
  // A /clear starts a new conversation with empty state and no session.start: load again once it has begun.
  on('session.end', async ($, e, next) => {
    const ended = await next(e)
    if (e.reason === 'clear') {
      live.isLoaded = false
      $.clock.after(1000, () => {
        void ensureLoaded($)
        void refresh($)
      })
    }
    return ended
  })

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'jr-badge', description: 'Show or hide the project badge (hidden by default): /jr-badge toggles, /jr-badge on or off' })
    await ensureLoaded($)
    await refresh($)
    return started
  })

  on('command.run', { command: 'jr-badge' }, async ($, e) => {
    await ensureLoaded($)
    const arg = e.args.trim().toLowerCase()
    const hide = arg === 'off' || arg === 'hide' ? true : arg === 'on' || arg === 'show' ? false : !(await read($, isHidden))
    await $.store.set('isHidden', hide)
    await update($, isHidden, () => hide)
    return { text: hide ? 'jr badge · hidden (/jr-badge to bring it back)' : 'jr badge · shown above the prompt (/jr-badge to hide it)' }
  })

  // The branch or the folder can change during a turn.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await refresh($)
    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const b = await read($, badge)
    if (await read($, isHidden)) return below
    if (!b || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    // One quiet row on the right: the project chip and its branch, no path.
    return (
      <Box flexDirection="column">
        <Box justifyContent="flex-end">
          <Text wrap="truncate-end">
            <Text backgroundColor={b.color} color="black" bold>{` ${b.label} `}</Text>
            {b.branch && <Text dimColor>{` ${b.branch}`}</Text>}
          </Text>
        </Box>
        {below}
      </Box>
    )
  })
}
