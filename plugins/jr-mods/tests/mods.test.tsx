import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { changesOf, itemsOf, summary } from '../hooks/plugins'

const LISTED = [
  { id: 'postiz@postiz', enabled: false, installPath: '/p/postiz' },
  { id: 'claude-seo@agricidaniel-seo', enabled: true, installPath: '/p/seo' },
  { id: 'jr-context@claude-code-mods', enabled: true, installPath: '/p/ctx' },
]

test('enabled first, then by name', async () => {
  expect(itemsOf(LISTED, {}).map(i => i.name)).toEqual(['claude-seo', 'jr-context', 'postiz'])
})

test('only real changes are applied', async () => {
  const items = itemsOf(LISTED, {})
  expect(changesOf(items, { 'postiz@postiz': true, 'claude-seo@agricidaniel-seo': true })).toEqual([{ id: 'postiz@postiz', enable: true }])
})

test('the toast says what happened', async () => {
  expect(summary([{ id: 'a@m', enable: true, ok: true }, { id: 'b@m', enable: false, ok: false }])).toBe('1 enabled · failed: b')
})

// The machine beneath: the CLI's answers, recorded.
const machine = (on: On, ran: string[][]) => {
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    ran.push(argv)
    const stdout = argv[2] === 'list' ? JSON.stringify(LISTED) : ''
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  on('fs.read', () => ({ value: JSON.stringify({ description: 'a plugin' }) }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.focus', () => ({}) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
}

test('space ticks, enter applies only what changed', async ($, on) => {
  const ran: string[][] = []
  machine(on, ran)
  for (const surface of ['terminal', 'desktop'] as const) {
    ran.length = 0
    await $.command.run({ command: 'jrmods', args: '' } as never)
    const ui = await $.ui.mount({ plugin: 'jr-mods', surface, component: 'Pane', requestId: 'jr-mods', props: {} } as never)
    expect(JSON.stringify(await ui.drawn({ in: 'list' }))).toContain('2 on · 1 off')
    // Cursor starts on claude-seo: down to jr-context and untick it, down to postiz and tick it.
    await (ui as never as { key: (k: object) => Promise<void> }).key({ in: 'list', key: 'down' })
    await (ui as never as { key: (k: object) => Promise<void> }).key({ in: 'list', key: ' ' })
    await (ui as never as { key: (k: object) => Promise<void> }).key({ in: 'list', key: 'down' })
    await (ui as never as { key: (k: object) => Promise<void> }).key({ in: 'list', key: ' ' })
    await (ui as never as { key: (k: object) => Promise<void> }).key({ in: 'list', key: 'return' })
    const toggles = ran.filter(a => a[2] === 'enable' || a[2] === 'disable').map(a => `${a[2]} ${a[3]}`)
    expect(toggles).toEqual(['disable jr-context@claude-code-mods', 'enable postiz@postiz'])
    await ui.unmount()
  }
})
