import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrFleetBeat, JrFleetState } from '../types'
import { CLEAN_AFTER_MS, fitSessions, liveSessions, selfFirst, shortName, shortPath, since, summary } from './fleet'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const PANE = 'jr-fleet'
const BEAT_MS = 15_000
const fleet = atom({ plugin: 'jr-fleet', key: 'fleet' } as const, null)
const bandHidden = atom({ plugin: 'jr-fleet', key: 'isBandHidden' } as const, false)
const band = { isLoaded: false }

/** `hide`/`off`, `show`/`on`, or a bare command, which toggles; anything else is not about the band. */
const bandVerb = (args: string) => {
  const arg = args.trim().toLowerCase()
  if (arg === 'hide' || arg === 'off') return 'hide' as const
  if (arg === 'show' || arg === 'on') return 'show' as const
  return arg === '' ? ('toggle' as const) : null
}

/** Hidden or shown is one choice for every session, kept across restarts. */
async function isBandHidden($: EngineInterface) {
  if (!band.isLoaded) {
    band.isLoaded = true
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
  }
  return read($, bandHidden)
}

async function setBand($: EngineInterface, verb: 'hide' | 'show' | 'toggle') {
  const hide = verb === 'toggle' ? !(await isBandHidden($)) : verb === 'hide'
  await $.store.set('isBandHidden', hide)
  await update($, bandHidden, () => hide)
  return { text: hide ? 'jr fleet · hidden (/jrfleet to bring it back)' : 'jr fleet · shown' }
}
const live: { me: JrFleetBeat | null; dir: string; home: string; isBeating: boolean } = { me: null, dir: '', home: '', isBeating: false }

async function ensureMe($: EngineInterface) {
  if (live.me) return live.me
  live.home = (await $.env.get('HOME')) ?? ''
  live.dir = `${live.home}/.claude/jr-fleet`
  const now = await $.clock.now()
  const cwd = await $.session.cwd()
  const root = await $.session.root()
  live.me = { id: await $.session.id(), cwd, project: root.split('/').pop() || root, state: 'waiting', since: now, lastPrompt: null, beat: now }
  return live.me
}

/** Reads every session's heartbeat, keeps the live ones, deletes day-old files. */
async function scan($: EngineInterface) {
  const now = await $.clock.now()
  const beats: JrFleetBeat[] = []
  const old: string[] = []
  let entries: { name: string; kind: string; mtimeMs: number }[] = []
  try {
    entries = await $.fs.list(live.dir)
  } catch {
    entries = []
  }
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    if (now - entry.mtimeMs > CLEAN_AFTER_MS) {
      old.push(`${live.dir}/${entry.name}`)
      continue
    }
    try {
      beats.push(JSON.parse(await $.fs.read(`${live.dir}/${entry.name}`)) as JrFleetBeat)
    } catch {
      // A file mid-write: skip it this round.
    }
  }
  if (old.length) await $.process.run(['rm', '-f', ...old])
  const sessions = liveSessions(beats, now)
  await update($, fleet, () => ({ sessions, self: live.me?.id ?? '', home: live.home, at: now }))
}

async function beat($: EngineInterface) {
  const me = await ensureMe($)
  me.beat = await $.clock.now()
  await $.fs.write(`${live.dir}/${me.id}.json`, JSON.stringify(me))
  await scan($)
}

async function setState($: EngineInterface, state: JrFleetState) {
  const me = await ensureMe($)
  const now = await $.clock.now()
  if (state === 'working') me.lastPrompt = now
  if (me.state !== state) {
    me.state = state
    me.since = now
  }
  await beat($)
}

async function ensureBeating($: EngineInterface) {
  if (live.isBeating) return
  live.isBeating = true
  await $.command.register({ name: 'jrfleet', description: 'Show or hide the fleet band; /jrfleet details lists every session' })
  await beat($)
  $.clock.every(BEAT_MS, () => {
    void beat($)
  })
}

const COLORS: Record<JrFleetState, string> = { working: '#7f5af0', waiting: '#ffb86b', idle: '#5c5f77' }
const WORDS: Record<JrFleetState, string> = { working: 'working', waiting: 'waiting for you', idle: 'idle' }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureBeating($)
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    await ensureBeating($)
    if (!e.command && !e.isMeta) await setState($, 'working')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await setState($, 'waiting')
    return done
  })

  on('session.end', async ($, e, next) => {
    if (live.me) await $.process.run(['rm', '-f', `${live.dir}/${live.me.id}.json`])
    return next(e)
  })

  on('command.run', { command: 'jrfleet' }, async ($, e) => {
    const verb = bandVerb(e.args)
    if (verb) return setBand($, verb)
    await ensureBeating($)
    await scan($)
    await $.ui.open({ id: PANE, title: 'jr fleet', rows: 14 })
    return { text: 'jr fleet opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const f = await read($, fleet)
    if (!f) return <Text dimColor>Looking for sessions…</Text>
    const s = summary(f.sessions)
    return (
      <Box flexDirection="column">
        <Text>
          {gradientText(Text, 'jr fleet', GRADIENTS.brand)}
          <Text dimColor>{`   ${s.total} session${s.total === 1 ? '' : 's'} · ${s.working} working · `}</Text>
          <Text color={s.waiting ? '#ffb86b' : '#6b7089'} bold={s.waiting > 0}>{`${s.waiting} waiting for you`}</Text>
        </Text>
        {f.sessions.map(x => (
          <Text wrap="truncate-end">
            <Text color={COLORS[x.state]}>{'● '}</Text>
            <Text bold>{x.project.slice(0, 22).padEnd(23)}</Text>
            <Text color={COLORS[x.state]}>{WORDS[x.state].padEnd(16)}</Text>
            <Text dimColor>{since(f.at - x.since).padStart(6)}</Text>
            <Text dimColor>{`   ${shortPath(x.cwd, f.home)}`}</Text>
            {x.id === f.self && <Text color="#ff5ca8">{'   (this one)'}</Text>}
          </Text>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    // Never write state while drawing: the saved choice is loaded just after.
    if (!band.isLoaded) {
      $.clock.after(0, () => {
        void isBandHidden($)
      })
    }
    if (await read($, bandHidden)) return below
    const f = await read($, fleet)
    if (!f || f.sessions.length === 0 || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    const waiting = f.sessions.filter(x => x.id !== f.self && x.state === 'waiting')
    const count = ` · ${f.sessions.length} session${f.sessions.length === 1 ? '' : 's'}`
    // A session waiting for you is the one thing worth the eye: on the left, in colour.
    if (waiting.length > 0) {
      return (
        <Box flexDirection="column">
          <Box>
            <Text wrap="truncate-end">
              <Text color="#ff8c42">{'▲ '}</Text>
              <Text>{waiting.map(x => shortName(x.project)).join(', ')}</Text>
              <Text color="#ffb86b">{waiting.length === 1 ? ' waits for you' : ' wait for you'}</Text>
              <Text dimColor>{count}</Text>
            </Text>
          </Box>
          {below}
        </Box>
      )
    }
    // Otherwise a quiet row on the right: what each session works on.
    const { shown, more } = fitSessions(selfFirst(f.sessions, f.self), Math.max(20, e.props.bodyColumns - 2))
    return (
      <Box flexDirection="column">
        <Box justifyContent="flex-end">
          <Text wrap="truncate-end">
            {shown.map((x, i) => (
              <Text>
                {i > 0 && <Text dimColor>{' · '}</Text>}
                <Text color={x.id === f.self ? '#ff5ca8' : undefined}>{shortName(x.project)}</Text>
                <Text color={x.state === 'working' ? '#7f5af0' : '#5c5f77'}>{x.state === 'working' ? ' ●' : ' ○'}</Text>
              </Text>
            ))}
            {more > 0 && <Text dimColor>{` · +${more}`}</Text>}
          </Text>
        </Box>
        {below}
      </Box>
    )
  })
}
