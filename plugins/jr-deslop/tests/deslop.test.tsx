import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PROSE, scan } from '../hooks/rules'

const SLOP = [
  '# Launch notes',
  'In today’s fast-paced world, we delve into the details.',
  'It’s worth noting that this is not just a tool, but a platform.',
  '```js',
  'const dash = "—" // code is skipped',
  '```',
  'Use `a—b` in code spans freely.',
  'Plain, clear sentence.',
  'Il est important de noter que ce n’est pas un outil, c’est une plateforme.',
].join('\n')

test('finds tells line by line, skipping code', async () => {
  const hits = scan('notes.md', SLOP)
  const byLine = (n: number) => hits.filter(h => h.line === n).map(h => h.rule).sort()
  expect(byLine(2)).toEqual(['delve', 'fast-paced'])
  expect(byLine(3)).toEqual(['not-but', 'worth-noting'])
  expect(byLine(5)).toEqual([])
  expect(byLine(7)).toEqual([])
  expect(byLine(8)).toEqual([])
  expect(byLine(9)).toEqual(['fr-filler', 'fr-not-but'])
})

test('only prose files are checked', async () => {
  expect(PROSE.test('README.md')).toBe(true)
  expect(PROSE.test('docs/a.mdx')).toBe(true)
  expect(PROSE.test('src/app.ts')).toBe(false)
})

const machine = (on: On, toasts: string[], files: Record<string, string>) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: 'written' }) as never)
  on('fs.read', (_$, e) => ({ value: files[(e as unknown as { path: string }).path] ?? '' }) as never)
  on('ui.toast', (_$, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
}

test('a written markdown file is checked and listed in the pane, a code file is not', async ($, on) => {
  const toasts: string[] = []
  machine(on, toasts, { '/p/notes.md': SLOP, '/p/app.ts': 'const x = "delve" // —' })
  await $.tool.call({ tool: 'Write', file_path: '/p/app.ts', content: '' } as never)
  expect(toasts).toEqual([])
  await $.tool.call({ tool: 'Write', file_path: '/p/notes.md', content: SLOP } as never)
  expect(toasts[0]).toContain('6 AI-writing tells in notes.md')
  await $.command.run({ command: 'jr-deslop', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-deslop', surface, component: 'Pane', requestId: 'jr-deslop', props: {} } as never)
    expect(await ui.find({ text: /\/p\/notes\.md/ } as never)).toBeDefined()
    expect(await ui.find({ text: /"delve"/ } as never)).toBeDefined()
    await ui.unmount()
  }
})
