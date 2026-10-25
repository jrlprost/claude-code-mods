import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { judge, sensitiveKind } from '../hooks/scope'

test('sensitive kinds', async () => {
  expect(sensitiveKind('/w/package-lock.json')).toBe('lockfile')
  expect(sensitiveKind('/w/package.json')).toBe('manifest')
  expect(sensitiveKind('/w/.github/workflows/ci.yml')).toBe('CI')
  expect(sensitiveKind('/w/.env.local')).toBe('env')
  expect(sensitiveKind('/w/db/migrations/001_init.sql')).toBe('migration')
  expect(sensitiveKind('/w/infra/main.tf')).toBe('infra')
  expect(sensitiveKind('/w/src/app.ts')).toBe(null)
})

test('a sensitive file named in the prompt is fine; one nobody asked for is flagged', async () => {
  const v = judge('bump the version in package.json', ['/w/package.json', '/w/pnpm-lock.yaml', '/w/src/a.ts'], '/w', 15)
  expect(v.sensitive).toEqual([{ file: '/w/pnpm-lock.yaml', kind: 'lockfile' }])
})

test('too many files in one turn', async () => {
  const files = Array.from({ length: 4 }, (_, i) => `/w/src/f${i}.ts`)
  expect(judge('refactor', files, '/w', 3).isTooMany).toBe(true)
})

const machine = (on: On, toasts: string[]) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/w' }) as never)
  on('turn.start', () => ({ turnId: 't1' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('ui.toast', ($, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

test('a turn that edits an unasked .env gets a toast and a band', async ($, on) => {
  const toasts: string[] = []
  machine(on, toasts)
  await $.turn.start({ text: 'fix the login bug', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/w/src/login.ts', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Write', file_path: '/w/.env', content: 'X=1' } as never)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', text: '', reason: 'answer' } as never)
  expect(toasts.join()).toContain('.env (env) without being asked')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-scope', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as never)
    expect(bandRow(await ui.drawn())).toEqual({ isOneRow: true, isRight: false })
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('without being asked')
    expect(drawn).toContain('below')
    await ui.unmount()
  }
})

test('a clean turn says nothing', async ($, on) => {
  const toasts: string[] = []
  machine(on, toasts)
  await $.turn.start({ text: 'fix the login bug', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/w/src/login.ts', old_string: 'a', new_string: 'b' } as never)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', text: '', reason: 'answer' } as never)
  expect(toasts).toEqual([])
})

test('/jr-scope on|off and the bare command hide and bring back the band', async ($, on) => {
  machine(on, [])
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'fix the login bug', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Write', file_path: '/w/.env', content: 'X=1' } as never)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', text: '', reason: 'answer' } as never)
  const mount = () => $.ui.mount({ plugin: 'jr-scope', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as never)
  const said = await $.command.run({ command: 'jr-scope', args: 'off' } as never)
  expect(JSON.stringify(said)).toContain('hidden')
  let ui = await mount()
  expect(await ui.find({ text: /without being asked/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jr-scope', args: '' } as never)
  ui = await mount()
  expect(await ui.find({ text: /without being asked/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jr-scope', args: '' } as never)
  ui = await mount()
  expect(await ui.find({ text: /without being asked/ } as never)).toBeUndefined()
})

type Drawn = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
/** The band's own row (first child of the stack): one row, no column inside, no line break. */
function bandRow(tree: unknown) {
  const row = ((tree as Drawn).children ?? [])[0] as Drawn
  const isOneRow = (n: unknown): boolean => {
    if (typeof n === 'string') return !n.includes('\n')
    const d = n as Drawn
    if (d?.type === 'Box' && d.props?.flexDirection === 'column') return false
    return (d?.children ?? []).every(isOneRow)
  }
  return { isOneRow: isOneRow(row), isRight: row?.props?.justifyContent === 'flex-end' }
}
