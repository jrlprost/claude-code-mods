import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { changesOf, itemsOf, kindOf, summary } from '../hooks/plugins'

const LISTED = [
  { id: 'postiz@postiz', enabled: false, installPath: '/p/postiz' },
  { id: 'claude-seo@agricidaniel-seo', enabled: true, installPath: '/p/seo' },
  { id: 'jr-context@claude-code-mods', enabled: true, installPath: '/p/ctx' },
]

test('enabled first, then by name', async () => {
  expect(itemsOf(LISTED, {}).map(i => i.name)).toEqual(['claude-seo', 'jr-context', 'postiz'])
})

test('a hooks.json with modules makes a mod', async () => {
  expect(kindOf('{ "modules": ["./register.ts"] }')).toBe('mod')
  expect(kindOf('{ "hooks": { "PreToolUse": [] } }')).toBe('plugin')
  expect(kindOf(undefined)).toBe('plugin')
  expect(kindOf('not json')).toBe('plugin')
})

test('only real changes are applied', async () => {
  const items = itemsOf(LISTED, {})
  expect(changesOf(items, { 'postiz@postiz': true, 'claude-seo@agricidaniel-seo': true })).toEqual([{ id: 'postiz@postiz', enable: true }])
})

test('the toast says what happened', async () => {
  expect(summary([{ id: 'a@m', enable: true, ok: true }, { id: 'b@m', enable: false, ok: false }])).toBe('1 enabled · failed: b')
})

// The machine beneath: the CLI's answers, recorded. jr-context is the one mod.
const machine = (on: On, ran: string[][]) => {
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    ran.push(argv)
    const stdout = argv[2] === 'list' ? JSON.stringify(LISTED) : ''
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  on('fs.read', ($, e) => {
    const path = (e as unknown as { path: string }).path
    if (path.endsWith('hooks/hooks.json')) return { value: path.startsWith('/p/ctx') ? '{ "modules": ["./register.tsx"] }' : '{ "hooks": {} }' } as never
    return { value: JSON.stringify({ description: 'a plugin' }) } as never
  })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.focus', () => ({}) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
}

type Ui = {
  key: (k: object) => Promise<void>
  pointer: (p: object) => Promise<void>
  drawn: (s: object) => Promise<unknown>
  unmount: () => Promise<void>
}

type Engine = { command: { run: (e: never) => Promise<unknown> }; ui: { mount: (e: never) => Promise<unknown> } }

const open = async ($: Engine, surface: 'terminal' | 'desktop') => {
  await $.command.run({ command: 'jrmods', args: '' } as never)
  return (await $.ui.mount({ plugin: 'jr-mods', surface, component: 'Pane', requestId: 'jr-mods', props: {} } as never)) as Ui
}

const toggles = (ran: string[][]) => ran.filter(a => a[2] === 'enable' || a[2] === 'disable').map(a => `${a[2]} ${a[3]}`)

test('opens on mods, arrows switch to plugins, enter applies every change', async ($, on) => {
  const ran: string[][] = []
  machine(on, ran)
  for (const surface of ['terminal', 'desktop'] as const) {
    ran.length = 0
    const ui = await open($ as never, surface)
    expect(JSON.stringify(await ui.drawn({ in: 'list' }))).toContain(' mods 1 ')
    await ui.key({ in: 'list', key: ' ' }) // untick jr-context
    await ui.key({ in: 'list', key: 'right' }) // plugins: claude-seo, postiz
    await ui.key({ in: 'list', key: 'down' })
    await ui.key({ in: 'list', key: ' ' }) // tick postiz
    await ui.key({ in: 'list', key: 'return' })
    expect(toggles(ran)).toEqual(['disable jr-context@claude-code-mods', 'enable postiz@postiz'])
    await ui.unmount()
  }
})

test('space and enter also arrive by name', async ($, on) => {
  const ran: string[][] = []
  machine(on, ran)
  const ui = await open($ as never, 'terminal')
  await ui.key({ in: 'list', key: 'left' })
  await ui.key({ in: 'list', key: 'down' })
  await ui.key({ in: 'list', key: 'space' })
  await ui.key({ in: 'list', key: 'enter' })
  expect(toggles(ran)).toEqual(['enable postiz@postiz'])
})

test('first click takes the keys, then the tab line switches, a row ticks, the last line applies', async ($, on) => {
  const ran: string[][] = []
  machine(on, ran)
  const ui = await open($ as never, 'terminal')
  await ui.pointer({ in: 'list', type: 'down', x: 4, y: 2 }) // focus only
  await ui.pointer({ in: 'list', type: 'down', x: 4, y: 0 }) // to plugins
  await ui.pointer({ in: 'list', type: 'down', x: 4, y: 2 }) // postiz
  await ui.pointer({ in: 'list', type: 'down', x: 4, y: 3 }) // footer
  expect(toggles(ran)).toEqual(['enable postiz@postiz'])
})
