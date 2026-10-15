import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { badgeLine, badgeOf, colorOf } from '../hooks/badge'

test('a badge line in CLAUDE.md wins, colour optional', async () => {
  expect(badgeLine('# Notes\nbadge: ORCHESTRATOR #c678dd\n')).toEqual({ label: 'ORCHESTRATOR', color: '#c678dd' })
  expect(badgeLine('badge: CLIENT X')).toEqual({ label: 'CLIENT X', color: null })
  expect(badgeLine('nothing here')).toBe(null)
})

test('home shows HOME, a project shows its name, branch and folder', async () => {
  expect(badgeOf({ cwd: '/Users/a', home: '/Users/a', root: '/Users/a', branch: null, claudeMd: null }).label).toBe('HOME')
  const b = badgeOf({ cwd: '/Users/a/code/shop/api', home: '/Users/a', root: '/Users/a/code/shop', branch: 'main', claudeMd: null })
  expect(b).toEqual({ label: 'SHOP', detail: 'main · ~/code/shop/api', color: colorOf('SHOP') })
})

const machine = (on: On) => {
  mock.clock(on)
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

test('the band reads CLAUDE.md and git, and keeps what is below', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/work/shop', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-badge', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as never)
    expect(await ui.find({ text: /SHOP PROD/ } as never)).toBeDefined()
    expect(await ui.find({ text: /feature\/cart · \/work\/shop/ } as never)).toBeDefined()
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    await ui.unmount()
  }
})
