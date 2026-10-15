import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { parsePmset, secondsToSleep, shouldHold, workingSessions } from '../hooks/power'

const PMSET_BATTERY = `System-wide power settings:
Currently in use:
 standby              1
 powernap             1
 disksleep            10
 sleep                1 (sleep prevented by caffeinate, coreaudiod, Amphetamine, powerd)
 displaysleep         30 (display sleep prevented by Amphetamine)
Now drawing from 'Battery Power'
`
const PMSET_FREE = ` sleep                10
 displaysleep         5
Now drawing from 'AC Power'
`

test('pmset: sleep minutes, display sleep, who prevents sleep, battery', async () => {
  expect(parsePmset(PMSET_BATTERY)).toEqual({ sleepMin: 1, displaySleepMin: 30, preventedBy: ['caffeinate', 'coreaudiod', 'Amphetamine', 'powerd'], onBattery: true })
  expect(parsePmset(PMSET_FREE)).toEqual({ sleepMin: 10, displaySleepMin: 5, preventedBy: [], onBattery: false })
})

test('next sleep: sleep minutes minus idle time, none when something else holds it', async () => {
  expect(secondsToSleep({ ...parsePmset(PMSET_FREE), idleSeconds: 420 }, false)).toBe(180)
  expect(secondsToSleep({ ...parsePmset(PMSET_BATTERY), idleSeconds: 10 }, false)).toBe(null)
  expect(secondsToSleep({ ...parsePmset(PMSET_FREE), idleSeconds: 10 }, true)).toBe(null)
  expect(secondsToSleep({ sleepMin: 0, displaySleepMin: 0, preventedBy: [], onBattery: false, idleSeconds: 9999 }, false)).toBe(null)
})

test('modes: working holds only during a turn, session always, off never', async () => {
  expect(shouldHold('working', true)).toBe(true)
  expect(shouldHold('working', false)).toBe(false)
  expect(shouldHold('session', false)).toBe(true)
  expect(shouldHold('off', true)).toBe(false)
})

test('stale heartbeats from closed sessions are ignored', async () => {
  const now = 1_000_000
  const beats = [
    { id: 'a', project: 'x', working: true, holding: true, at: now - 5_000 },
    { id: 'b', project: 'y', working: true, holding: true, at: now - 120_000 },
  ]
  expect(workingSessions(beats, now).map(b => b.id)).toEqual(['a'])
})

const machine = (on: On, pmset: string, spawned: string[][]) => {
  mock.clock(on)
  mock.store(on)
  on('session.id', () => ({ value: 's1' }) as never)
  on('session.root', () => ({ value: '/work/tokenkarma' }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    return { value: { exitCode: 0, stdout: argv[0] === 'pmset' ? pmset : '420\n', stderr: '' } } as never
  })
  on('process.spawn', async function* ($, e) {
    spawned.push([...(e as unknown as { argv: string[] }).argv])
    return { value: { code: 0, signal: null } } as never
  })
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as const
const start = { cwd: '/work/tokenkarma', surface: 'terminal', isInteractive: true } as const

test('a prompt holds the Mac awake with caffeinate in working mode', async ($, on) => {
  const spawned: string[][] = []
  machine(on, PMSET_FREE, spawned)
  await $.session.start(start)
  await $.prompt.submit({ text: 'build it', origin: { kind: 'composer' }, wait: false } as never)
  expect(spawned).toEqual([['caffeinate', '-i']])
})

test('the band warns when the Mac is about to sleep', async ($, on) => {
  machine(on, PMSET_FREE, [])
  await $.session.start(start)
  const ui = await $.ui.mount({ plugin: 'jr-awake', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /Mac sleeps in 3:00/ } as never)).toBeDefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
})

test('/jrawake session is shared: the mode is stored for every session', async ($, on) => {
  machine(on, PMSET_FREE, [])
  await $.session.start(start)
  const answer = await $.command.run({ command: 'jrawake', args: 'session' } as never)
  expect(JSON.stringify(answer)).toContain('mode session (all sessions)')
})
