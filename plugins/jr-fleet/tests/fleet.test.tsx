import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { fitSessions, liveSessions, selfFirst, shortName, shortPath, summary } from '../hooks/fleet'
import type { JrFleetBeat } from '../types'

const NOW = 1_800_000_000_000
const beat = (id: string, state: JrFleetBeat['state'], sinceAgo: number, beatAgo = 5_000): JrFleetBeat => ({
  id, cwd: `/Users/x/${id}`, project: id, state, since: NOW - sinceAgo, lastPrompt: null, beat: NOW - beatAgo,
})

test('stale sessions drop out, long waits turn idle, waiting comes first', async () => {
  const s = liveSessions([beat('a', 'working', 60_000), beat('b', 'waiting', 40 * 60_000), beat('c', 'waiting', 60_000), beat('d', 'working', 1, 120_000)], NOW)
  expect(s.map(x => `${x.id}:${x.state}`)).toEqual(['c:waiting', 'a:working', 'b:idle'])
  expect(summary(s)).toEqual({ total: 3, waiting: 1, working: 1 })
})

test('paths under home are shortened', async () => {
  expect(shortPath('/Users/x/code', '/Users/x')).toBe('~/code')
})

test('this session comes first, long names are cut, and what does not fit becomes +N', async () => {
  const s = [beat('a', 'working', 1), beat('me', 'waiting', 1), beat('c', 'idle', 1)]
  expect(selfFirst(s, 'me').map(x => x.id)).toEqual(['me', 'a', 'c'])
  expect(shortName('a-very-long-project-name-indeed')).toBe('a-very-long-project…')
  const many = ['alpha', 'bravo', 'charlie', 'delta', 'echo'].map(id => beat(id, 'working', 1))
  expect(fitSessions(many, 200).more).toBe(0)
  const fit = fitSessions(many, 26)
  expect(fit.shown.map(x => x.id)).toEqual(['alpha', 'bravo'])
  expect(fit.more).toBe(3)
  expect(fitSessions(many, 3).shown.length).toBe(1)
})

type Node = { type: string; props?: Record<string, unknown>; children?: (Node | string)[] }
const textOf = (n: Node | string): string => (typeof n === 'string' ? n : (n.children ?? []).map(textOf).join(''))

/** The band is one row: a Box row holding a single truncating Text, with no line break. */
const bandRow = (tree: Node) => {
  const row = tree.children?.[0] as Node
  expect(row.type).toBe('Box')
  expect(row.props?.flexDirection ?? 'row').toBe('row')
  expect(row.children?.length).toBe(1)
  const line = row.children?.[0] as Node
  expect(line.type).toBe('Text')
  expect(line.props?.wrap).toBe('truncate-end')
  expect(textOf(line)).not.toContain('\n')
  return { text: textOf(line), justify: row.props?.justifyContent }
}

// A tiny file system in memory, with another session already beating.
const machine = (on: On, files: Map<string, string>) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  on('env.get', () => ({ value: '/Users/x' }) as never)
  on('session.id', () => ({ value: 'me' }) as never)
  on('session.cwd', () => ({ value: '/Users/x/tokenkarma' }) as never)
  on('session.root', () => ({ value: '/Users/x/tokenkarma' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }) as never)
  on('fs.write', (_$, e) => {
    const { path: file, text } = e as unknown as { path: string; text: string }
    files.set(file, text)
    return { value: undefined } as never
  })
  on('fs.list', () => ({ value: [...files.keys()].map(f => ({ name: f.split('/').pop(), kind: 'file', size: 1, mtimeMs: NOW, isLink: false })) }) as never)
  on('fs.read', (_$, e) => ({ value: files.get((e as unknown as { path: string }).path) ?? '' }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

test('this session beats, sees the other one waiting, and says so', async ($, on) => {
  const files = new Map<string, string>([['/Users/x/.claude/jr-fleet/acme.json', JSON.stringify(beat('acme', 'waiting', 120_000))]])
  machine(on, files)
  await $.session.start({ cwd: '/Users/x/tokenkarma', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'go', origin: { kind: 'composer' }, wait: false } as never)
  expect(JSON.parse(files.get('/Users/x/.claude/jr-fleet/me.json')!).state).toBe('working')
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'jr-fleet', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as never)
    const row = bandRow((await band.drawn()) as never)
    expect(row.text).toBe('▲ acme waits for you · 2 sessions')
    expect(row.justify).toBeUndefined()
    expect(await band.find({ text: /below/ } as never)).toBeDefined()
    await band.unmount()
  }
  await $.command.run({ command: 'jrfleet', args: 'details' } as never)
  const pane = await $.ui.mount({ plugin: 'jr-fleet', surface: 'terminal', component: 'Pane', requestId: 'jr-fleet', props: {} } as never)
  expect(await pane.find({ text: /this one/ } as never)).toBeDefined()
  expect(await pane.find({ text: /~\/tokenkarma/ } as never)).toBeDefined()
})

test('with nobody waiting, a quiet row on the right names what each session works on, this one first', async ($, on) => {
  const files = new Map<string, string>([['/Users/x/.claude/jr-fleet/acme.json', JSON.stringify(beat('acme', 'working', 60_000))]])
  machine(on, files)
  await $.session.start({ cwd: '/Users/x/tokenkarma', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'jr-fleet', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as never)
    const row = bandRow((await band.drawn()) as never)
    expect(row.text).toBe('tokenkarma ○ · acme ●')
    expect(row.justify).toBe('flex-end')
    await band.unmount()
  }
})

test('alone on the machine, the row still names this project', async ($, on) => {
  machine(on, new Map())
  await $.session.start({ cwd: '/Users/x/tokenkarma', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'jr-fleet', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as never)
  expect(bandRow((await band.drawn()) as never).text).toBe('tokenkarma ○')
})

test('/jrfleet hide takes the band away, the bare command brings it back', async ($, on) => {
  const files = new Map<string, string>([['/Users/x/.claude/jr-fleet/acme.json', JSON.stringify(beat('acme', 'waiting', 120_000))]])
  machine(on, files)
  await $.session.start({ cwd: '/Users/x/tokenkarma', surface: 'terminal', isInteractive: true })
  const props = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 }
  await $.command.run({ command: 'jrfleet', args: 'hide' } as never)
  let band = await $.ui.mount({ plugin: 'jr-fleet', surface: 'terminal', component: 'AbovePrompt', props } as never)
  expect(await band.find({ text: /waits for you/ } as never)).toBeUndefined()
  expect(await band.find({ text: /below/ } as never)).toBeDefined()
  await band.unmount()
  expect(JSON.stringify(await $.command.run({ command: 'jrfleet', args: '' } as never))).toContain('shown')
  band = await $.ui.mount({ plugin: 'jr-fleet', surface: 'terminal', component: 'AbovePrompt', props } as never)
  expect(await band.find({ text: /acme/ } as never)).toBeDefined()
})
