import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { enabledNames, welcomeOf } from '../hooks/welcome'

const LISTED = [
  { id: 'jr-context@claude-code-mods', enabled: true },
  { id: 'jr-time@claude-code-mods', enabled: true },
  { id: 'jr-badge@claude-code-mods', enabled: true },
  { id: 'jr-fleet@claude-code-mods', enabled: false },
  { id: 'postiz@postiz', enabled: true },
]

test('only installed and enabled jr mods are described, grouped', async () => {
  const groups = welcomeOf(enabledNames(LISTED))
  expect(groups.map(g => [g.group, g.entries.map(e => e.name)])).toEqual([
    ['shown', ['jr-context', 'jr-time']],
    ['hidden', ['jr-badge']],
  ])
})

type Clock = { advance: (ms: number) => Promise<void> }

const machine = (on: On, opened: string[]) => {
  const clock = mock.clock(on) as unknown as Clock
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(LISTED), stderr: '' } }) as never)
  on('ui.open', ($, e) => {
    opened.push((e as unknown as { id: string }).id)
    return { value: { isPlaced: true } } as never
  })
  return clock
}

const start = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

test('the first session opens the welcome once, the next one does not', async ($, on) => {
  const opened: string[] = []
  const clock = machine(on, opened)
  await $.session.start(start)
  await clock.advance(10)
  expect(opened).toEqual(['jr-mods-welcome'])
  await $.session.start(start)
  await clock.advance(10)
  expect(opened).toEqual(['jr-mods-welcome'])
})

test('/jr-mods welcome reopens it, listing only the installed mods', async ($, on) => {
  const opened: string[] = []
  const clock = machine(on, opened)
  await $.session.start(start)
  await clock.advance(10)
  const answer = await $.command.run({ command: 'jr-mods', args: 'welcome' } as never)
  expect(JSON.stringify(answer)).toContain('welcome opened')
  expect(opened).toEqual(['jr-mods-welcome', 'jr-mods-welcome'])
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-mods', surface, component: 'Pane', requestId: 'jr-mods-welcome', props: { bodyColumns: 100 } } as never)
    expect(await ui.find({ text: /\/jr-context/ } as never)).toBeDefined()
    expect(await ui.find({ text: /your billing/ } as never)).toBeDefined()
    expect(await ui.find({ text: /\/jr-badge/ } as never)).toBeDefined()
    expect(await ui.find({ text: /\/jr-fleet/ } as never)).toBeUndefined()
    expect(await ui.find({ text: /Only when there is something to say/ } as never)).toBeUndefined()
    await ui.unmount()
  }
})
