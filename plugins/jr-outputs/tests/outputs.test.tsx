import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { parseNumstat, record, touchedPath } from '../hooks/outputs'

test('Write, Edit and NotebookEdit name the file they touch', async () => {
  expect(touchedPath('Write', { file_path: '/w/a.ts' })).toBe('/w/a.ts')
  expect(touchedPath('NotebookEdit', { notebook_path: '/w/n.ipynb' })).toBe('/w/n.ipynb')
  expect(touchedPath('Bash', { command: 'ls' })).toBe(null)
})

test('a file touched again moves to the top and keeps its created verdict', async () => {
  let list = record([], '/w/a.ts', false, 1)
  list = record(list, '/w/b.ts', true, 2)
  list = record(list, '/w/a.ts', true, 3)
  expect(list.map(o => [o.path, o.isCreated, o.edits])).toEqual([['/w/a.ts', true, 2], ['/w/b.ts', false, 1]])
})

test('numstat lines become counts per path', async () => {
  expect(parseNumstat('3\t1\tsrc/a.ts\n10\t0\tdocs/b.md\n').get('src/a.ts')).toEqual([3, 1])
})

const machine = (on: On) => {
  mock.clock(on)
  on('session.root', () => ({ value: '/w' }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('fs.exists', ($, e) => ({ value: (e as unknown as { path: string }).path === '/w/old.ts' }) as never)
  on('fs.read', () => ({ value: 'a\nb\nc' }) as never)
  on('process.run', () => ({ value: { exitCode: 0, stdout: '4\t2\told.ts\n', stderr: '' } }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
}

test('writes and edits fill the pane, newest first, with line counts', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/w/old.ts', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Write', file_path: '/w/new.ts', content: 'a\nb\nc' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  const opened = await $.command.run({ command: 'jr-outputs', args: '' } as never)
  expect(JSON.stringify(opened)).toContain('2 files this session')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-outputs', surface, component: 'Pane', requestId: 'jr-outputs', props: {} } as never)
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn.indexOf('new.ts')).toBeLessThan(drawn.indexOf('old.ts'))
    expect(drawn).toContain('+4')
    expect(drawn).toContain('-2')
    expect(drawn).toContain('+3')
    await ui.unmount()
  }
})
