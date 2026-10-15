import { atom, read, update } from 'claude-code'
import type { EngineInterface, HookStream, ProcessSpawnChunk, ProcessSpawnResult, Register } from 'claude-code'

import type { JrAwakeMode, JrAwakePower, JrAwakeSessionBeat } from '../types'
import { BEAT_STALE_MS, formatCountdown, MODES, parsePmset, secondsToSleep, shouldHold } from './power'
import { gradientText } from './jr/draw'
import { GRADIENTS, colorAt } from './jr/gradient'

const view = atom({ plugin: 'jr-awake', key: 'view' } as const, null)
const TICK_MS = 15_000
const MODE_KEY = 'mode'
const BEAT_PREFIX = 'beat:'

// This session: whether Claude is working, and the caffeinate child it holds, if any.
const live: {
  id: string
  project: string
  working: boolean
  caffeinate: HookStream<ProcessSpawnChunk, ProcessSpawnResult> | null
  isTicking: boolean
  warnedAt: number
} = { id: '', project: '', working: false, caffeinate: null, isTicking: false, warnedAt: 0 }

async function loadMode($: EngineInterface, fallback: JrAwakeMode): Promise<JrAwakeMode> {
  const saved = (await $.store.get(MODE_KEY)) as JrAwakeMode | undefined
  return saved && MODES.includes(saved) ? saved : fallback
}

async function readPower($: EngineInterface): Promise<JrAwakePower | null> {
  try {
    const pm = await $.process.run(['pmset', '-g'])
    if (pm.exitCode !== 0) return null
    const idle = await $.process.run(['sh', '-c', "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000); exit}'"])
    return { ...parsePmset(pm.stdout), idleSeconds: Number.parseInt(idle.stdout.trim(), 10) || 0 }
  } catch {
    return null
  }
}

/** Starts or stops this session's caffeinate so it matches what the shared mode asks for. */
async function hold($: EngineInterface, wanted: boolean, keepDisplay: boolean) {
  if (wanted && !live.caffeinate) {
    const stream = $.process.spawn({ argv: keepDisplay ? ['caffeinate', '-i', '-d'] : ['caffeinate', '-i'] })
    live.caffeinate = stream
    void (async () => {
      try {
        for await (const _ of stream) {
          // caffeinate prints nothing; the loop is the child's life.
        }
      } catch {
        // Not on macOS, or caffeinate missing: nothing to hold.
      }
      if (live.caffeinate === stream) live.caffeinate = null
    })()
  } else if (!wanted && live.caffeinate) {
    const stream = live.caffeinate
    live.caffeinate = null
    await stream.return(undefined as never)
  }
}

async function beat($: EngineInterface) {
  const now = await $.clock.now()
  const mine: JrAwakeSessionBeat = { id: live.id, project: live.project, working: live.working, holding: live.caffeinate !== null, at: now }
  await $.store.set(BEAT_PREFIX + live.id, mine)
  const beats: JrAwakeSessionBeat[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(BEAT_PREFIX)) continue
    const b = (await $.store.get(key)) as JrAwakeSessionBeat | undefined
    if (!b) continue
    if (now - b.at > BEAT_STALE_MS * 10) await $.store.delete(key)
    else if (now - b.at < BEAT_STALE_MS) beats.push(b)
  }
  return beats
}

async function tick($: EngineInterface, fallbackMode: JrAwakeMode, keepDisplay: boolean, warnAt: number) {
  const mode = await loadMode($, fallbackMode)
  await hold($, shouldHold(mode, live.working), keepDisplay)
  const beats = await beat($)
  const power = await readPower($)
  const sleepIn = power ? secondsToSleep(power, live.caffeinate !== null) : null
  const holders = beats.filter(b => b.holding).length
  await update($, view, () => ({ mode, holding: live.caffeinate !== null, holders, sleepIn, power }))
  const now = await $.clock.now()
  if (sleepIn !== null && sleepIn <= warnAt && now - live.warnedAt > 5 * 60_000) {
    live.warnedAt = now
    $.ui.toast(`jr awake · your Mac sleeps in ${formatCountdown(sleepIn)} · /jrawake session keeps it awake`)
  }
}

async function ensureStarted($: EngineInterface, fallbackMode: JrAwakeMode, keepDisplay: boolean, warnAt: number) {
  if (!live.id) {
    live.id = await $.session.id()
    const root = await $.session.root()
    live.project = root.split('/').pop() || root
  }
  if (!live.isTicking) {
    live.isTicking = true
    $.clock.every(TICK_MS, () => {
      void tick($, fallbackMode, keepDisplay, warnAt)
    })
    await tick($, fallbackMode, keepDisplay, warnAt)
  }
}

export const register: Register = (on, options) => {
  const fallbackMode = (MODES.includes(options.mode as JrAwakeMode) ? options.mode : 'working') as JrAwakeMode
  const keepDisplay = options.keepDisplay === true
  const warnAt = Number(options.warnAtSeconds ?? 60)
  const showBand = options.showBand !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'jrawake', description: 'Keep the Mac awake: /jrawake working | session | off | status' })
    await ensureStarted($, fallbackMode, keepDisplay, warnAt)
    return started
  })

  on('session.end', async ($, e, next) => {
    await hold($, false, keepDisplay)
    if (live.id) await $.store.delete(BEAT_PREFIX + live.id)
    return next(e)
  })

  // Claude starts working: hold the Mac awake for the turn in "working" mode.
  on('prompt.submit', async ($, e, next) => {
    await ensureStarted($, fallbackMode, keepDisplay, warnAt)
    if (!e.command && !e.isMeta) {
      live.working = true
      await tick($, fallbackMode, keepDisplay, warnAt)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      live.working = false
      await tick($, fallbackMode, keepDisplay, warnAt)
    }
    return done
  })

  on('command.run', { command: 'jrawake' }, async ($, e) => {
    await ensureStarted($, fallbackMode, keepDisplay, warnAt)
    const arg = e.args.trim() as JrAwakeMode | 'on' | 'status' | ''
    const mode: JrAwakeMode | null = arg === 'on' ? 'session' : MODES.includes(arg as JrAwakeMode) ? (arg as JrAwakeMode) : null
    if (mode) {
      // Shared by every session on the machine: they all pick it up on their next tick.
      await $.store.set(MODE_KEY, mode)
      await tick($, fallbackMode, keepDisplay, warnAt)
    }
    const v = await read($, view)
    const sleep = v?.sleepIn == null ? 'not scheduled' : `in ${formatCountdown(v.sleepIn)}`
    return {
      text: `jr awake · mode ${v?.mode ?? fallbackMode} (all sessions) · ${v?.holders ?? 0} session(s) holding the Mac awake · next sleep ${sleep}${
        v?.power ? ` · sleep after ${v.power.sleepMin || 'never'} min${v.power.onBattery ? ' on battery' : ''}` : ''
      }`,
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const v = await read($, view)
    if (!v && !live.isTicking) {
      $.clock.after(0, () => {
        void ensureStarted($, fallbackMode, keepDisplay, warnAt)
      })
    }
    if (!showBand || !v || e.props.hasSurvey) return below
    // Quiet unless the Mac is held awake or about to sleep.
    const soon = v.sleepIn !== null && v.sleepIn <= 5 * 60
    if (!v.holders && !soon) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'awake ', GRADIENTS.brand)}
          {v.holders > 0 && <Text color="#2cb67d">{`☕ held by ${v.holders} session${v.holders > 1 ? 's' : ''}`}</Text>}
          {v.holders > 0 && <Text dimColor>{` · mode ${v.mode}`}</Text>}
          {soon && v.sleepIn !== null && (
            <Text color={colorAt(GRADIENTS.heat, 1 - v.sleepIn / 300)} bold>{`💤 Mac sleeps in ${formatCountdown(v.sleepIn)}`}</Text>
          )}
          {soon && <Text dimColor>{' · /jrawake session'}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
