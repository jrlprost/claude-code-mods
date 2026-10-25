import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { advice, pending, splitByFolder } from '../hooks/coach'

const NUMSTAT = '200\t20\tsrc/billing/a.ts\n90\t10\tsrc/app.ts\n40\t0\tdocs/billing.md\n3\t1\tpackage.json\n-\t-\tassets/logo.png\n'

test('changed lines add up, grouped by top folder, biggest first', async () => {
  const p = pending(NUMSTAT, 'src/billing/new.ts\n')
  expect(p.lines).toBe(364)
  expect(p.untracked).toBe(1)
  expect(p.split.map(g => g.folder)).toEqual(['src', 'docs', 'root', 'assets'])
  expect(splitByFolder([{ file: 'a.ts', lines: 1 }])[0]?.folder).toBe('root')
})

test('the advice names the biggest groups', async () => {
  expect(advice(pending(NUMSTAT, ''))).toBe('364 lines uncommitted: commit in small steps, e.g. src (320 lines, 2 files), docs (40 lines, 1 file), root (4 lines, 1 file) and 1 more')
})

const machine = (on: On, numstat: string, toasts: string[]) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/w' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    return { value: { exitCode: 0, stdout: argv.includes('ls-files') ? '' : numstat, stderr: '' } } as never
  })
  on('ui.toast', ($, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

const END = { answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', text: '', reason: 'answer' }
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as const

test('over the threshold: a toast once, and the band stays', async ($, on) => {
  const toasts: string[] = []
  machine(on, NUMSTAT, toasts)
  await $.turn.complete(END as never)
  await $.turn.complete(END as never)
  expect(toasts.length).toBe(1)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-commit-coach', surface, ...BAND } as never)
    expect(bandRow(await ui.drawn())).toEqual({ isOneRow: true, isRight: false })
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('364')
    expect(drawn).toContain('below')
    await ui.unmount()
  }
})

test('under the threshold: silent', async ($, on) => {
  const toasts: string[] = []
  machine(on, '10\t2\tsrc/a.ts\n', toasts)
  await $.turn.complete(END as never)
  expect(toasts).toEqual([])
  const ui = await $.ui.mount({ plugin: 'jr-commit-coach', surface: 'terminal', ...BAND } as never)
  expect(JSON.stringify(await ui.drawn())).not.toContain('uncommitted')
})

test('a repository whose config can run a program is left alone: git never runs', async ($, on) => {
  const ran: string[][] = []
  on('session.root', () => ({ value: '/w' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    ran.push(argv)
    // The repository's own config sets an fsmonitor program.
    const stdout = argv.includes('config') && !argv.includes('/') ? 'file:.git/config\0core.fsmonitor\n/tmp/pwn.sh\0' : ''
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', text: '', reason: 'answer' } as never)
  // Only config listings ran: never a diff or ls-files in that repository.
  expect(ran.every(argv => argv.includes('config'))).toBe(true)
})

test('/jr-commit-coach on|off and the bare command hide and bring back the band', async ($, on) => {
  machine(on, NUMSTAT, [])
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.complete(END as never)
  const mount = () => $.ui.mount({ plugin: 'jr-commit-coach', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as never)
  const said = await $.command.run({ command: 'jr-commit-coach', args: 'off' } as never)
  expect(JSON.stringify(said)).toContain('hidden')
  let ui = await mount()
  expect(await ui.find({ text: /uncommitted/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jr-commit-coach', args: '' } as never)
  ui = await mount()
  expect(await ui.find({ text: /uncommitted/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jr-commit-coach', args: '' } as never)
  ui = await mount()
  expect(await ui.find({ text: /uncommitted/ } as never)).toBeUndefined()
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
