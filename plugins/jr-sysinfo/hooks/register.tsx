import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { colorAt, GRADIENTS } from './jr/gradient'
import { parseStats, pressure, size, UNIX_SCRIPT, WINDOWS_SCRIPT } from './sysinfo'

const EVERY_MS = 5 * 60_000
const stats = atom({ plugin: 'jr-sysinfo', key: 'stats' } as const, null)
const bandHidden = atom({ plugin: 'jr-sysinfo', key: 'isBandHidden' } as const, false)

// The band can be hidden: /jrsys hide, show, or the bare command to toggle. One choice for
// every session, kept across restarts.
const band = { isLoaded: false }

const bandVerb = (args: string) => {
  const arg = args.trim().toLowerCase()
  if (arg === 'hide' || arg === 'off') return 'hide' as const
  if (arg === 'show' || arg === 'on') return 'show' as const
  return arg === '' ? ('toggle' as const) : null
}

async function isBandHidden($: EngineInterface) {
  if (!band.isLoaded) {
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
    band.isLoaded = true
  }
  return read($, bandHidden)
}

async function setBand($: EngineInterface, verb: 'hide' | 'show' | 'toggle') {
  const hide = verb === 'toggle' ? !(await isBandHidden($)) : verb === 'hide'
  await $.store.set('isBandHidden', hide)
  await update($, bandHidden, () => hide)
  return { text: hide ? 'jr sysinfo · band hidden (/jrsys to bring it back)' : 'jr sysinfo · band shown' }
}

// Windows is told by its SystemRoot (C:\Windows): there it runs PowerShell, never sh, which
// could be a Git Bash one. Both start by absolute path from a system folder, never from the
// project: Windows looks for a bare name in the working folder first, where a cloned repo could
// hold its own sh.exe or powershell.exe.
const live = { isStarted: false }

async function readMachine($: EngineInterface) {
  const root = await $.env.get('SystemRoot')
  const isWindows = root !== undefined && /^[A-Za-z]:\\/.test(root)
  const argv = isWindows
    ? [`${root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`, '-NoProfile', '-NonInteractive', '-Command', WINDOWS_SCRIPT]
    : ['/bin/sh', '-c', UNIX_SCRIPT]
  try {
    const { stdout } = await $.process.run(argv, { cwd: isWindows ? root : '/', timeoutMs: 20_000 })
    return parseStats(stdout)
  } catch {
    return null
  }
}

async function refresh($: EngineInterface) {
  const next = await readMachine($)
  if (next) await update($, stats, () => next)
}

async function ensureStarted($: EngineInterface) {
  if (live.isStarted) return
  live.isStarted = true
  await $.command.register({ name: 'jrsys', description: 'Show or hide the disk, RAM, CPU and swap band; /jrsys now reads them again' })
  await refresh($)
  $.clock.every(EVERY_MS, () => {
    void refresh($)
  })
}

export const register: Register = on => {
  // A /clear starts a new conversation with empty state and no session.start: load again once it has begun.
  on('session.end', async ($, e, next) => {
    const ended = await next(e)
    if (e.reason === 'clear') {
      band.isLoaded = false
      $.clock.after(1000, () => {
        void isBandHidden($)
        void refresh($)
      })
    }
    return ended
  })

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await isBandHidden($)
    await ensureStarted($)
    return started
  })

  on('command.run', { command: 'jrsys' }, async ($, e) => {
    await ensureStarted($)
    if (e.args.trim().toLowerCase() === 'now') {
      await refresh($)
      return { text: (await read($, stats)) ? 'jr sysinfo · read again' : 'jr sysinfo · could not read this machine' }
    }
    const verb = bandVerb(e.args)
    if (verb) return setBand($, verb)
    return { text: 'jr sysinfo · /jrsys toggles the band, /jrsys hide, show, or now to read again' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (await read($, bandHidden)) return below
    const s = await read($, stats)
    if (!s || e.props.hasSurvey) return below
    const p = pressure(s)
    const { Box, Text } = $.ui.resolve(e)
    const figure = (label: string, value: string, ratio: number, first = false) => (
      <Text>
        {first ? '' : <Text dimColor>{' · '}</Text>}
        <Text dimColor>{`${label} `}</Text>
        <Text color={colorAt(GRADIENTS.heat, ratio)}>{value}</Text>
      </Text>
    )
    return (
      <Box flexDirection="column">
        <Box justifyContent="flex-end">
          <Text wrap="truncate-end">
            {figure('disk', `${size(s.diskFree)}/${size(s.diskTotal)} free`, p.disk, true)}
            {figure('ram', `${size(s.memAvailable)}/${size(s.memTotal)} free`, p.mem)}
            {figure('cpu', `${Math.round(s.cpu)}%`, p.cpu)}
            {s.swapTotal > 0 ? figure('swap', `${size(s.swapUsed)}/${size(s.swapTotal)} used`, p.swap) : figure('swap', 'off', 0)}
          </Text>
        </Box>
        {below}
      </Box>
    )
  })
}
