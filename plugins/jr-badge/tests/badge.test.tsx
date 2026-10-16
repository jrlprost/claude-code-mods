import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { badgeLine, badgeOf, colorOf } from '../hooks/badge'

test('a badge line in CLAUDE.md wins, colour optional', async () => {
  expect(badgeLine('# Notes\nbadge: ORCHESTRATOR #c678dd\n')).toEqual({ label: 'ORCHESTRATOR', color: '#c678dd' })
  expect(badgeLine('badge: CLIENT X')).toEqual({ label: 'CLIENT X', color: null })
  expect(badgeLine('nothing here')).toBe(null)
})

test('home shows HOME, a project shows its name and branch', async () => {
  expect(badgeOf({ cwd: '/Users/a', home: '/Users/a', root: '/Users/a', branch: null, claudeMd: null }).label).toBe('HOME')
  const b = badgeOf({ cwd: '/Users/a/code/shop/api', home: '/Users/a', root: '/Users/a/code/shop', branch: 'main', claudeMd: null })
  expect(b).toEqual({ label: 'SHOP', branch: 'main', color: colorOf('SHOP') })
})

const machine = (on: On) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.cwd', () => ({ value: '/work/shop' }) as never)
  on('env.get', () => ({ value: '/Users/a' }) as never)
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    return { value: { exitCode: 0, stdout: argv.includes('--show-toplevel') ? '/work/shop\n' : 'feature/cart\n', stderr: '' } } as never
  })
  on('fs.read', () => ({ value: 'badge: SHOP PROD #ef4565' }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

const BAND = { plugin: 'jr-badge', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as const

/** Rows the mod drew above `below`, the last child of its column. */
const rowsAbove = (tree: unknown) => {
  const t = tree as { type: string; props?: { flexDirection?: string }; children?: unknown[] }
  return t.type === 'Box' && t.props?.flexDirection === 'column' ? (t.children ?? []).length - 1 : 0
}

test('hidden on a fresh install', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/work/shop', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ text: /SHOP PROD/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
})

test('shown, one row: the CLAUDE.md label and the branch, no path, what is below kept', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/work/shop', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jrbadge', args: 'show' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface } as never)
    expect(await ui.find({ text: / SHOP PROD / } as never)).toBeDefined()
    expect(await ui.find({ text: /^ feature\/cart$/ } as never)).toBeDefined()
    expect(await ui.find({ text: /\/work\/shop/ } as never)).toBeUndefined()
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    expect(rowsAbove(await ui.drawn())).toBe(1)
    await ui.unmount()
  }
})

test('/jrbadge toggles the badge, /jrbadge on and off set it', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/work/shop', surface: 'terminal', isInteractive: true })
  const shown = await $.command.run({ command: 'jrbadge', args: '' } as never)
  expect(JSON.stringify(shown)).toContain('shown')
  let ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ text: /SHOP PROD/ } as never)).toBeDefined()
  await ui.unmount()
  const hidden = await $.command.run({ command: 'jrbadge', args: '' } as never)
  expect(JSON.stringify(hidden)).toContain('hidden')
  ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ text: /SHOP PROD/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jrbadge', args: 'on' } as never)
  ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ text: /SHOP PROD/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jrbadge', args: 'off' } as never)
  await $.command.run({ command: 'jrbadge', args: 'off' } as never)
  ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ text: /SHOP PROD/ } as never)).toBeUndefined()
})
