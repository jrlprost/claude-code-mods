import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

const MIN = 60_000

// The machine beneath: a session store in memory, a clock, an idle reading of 3 s.
const machine = (on: On, posted: unknown[]) => {
  mock.store(on)
  const clock = mock.clock(on)
  on('session.id', () => ({ value: 's1' }) as never)
  on('session.root', () => ({ value: '/work/tokenkarma' }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('process.run', () => ({ value: { exitCode: 0, stdout: '3\n', stderr: '' } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', (_$, e) => {
    posted.push(e)
    return { value: undefined } as never
  })
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  return clock
}

const start = { cwd: '/work/tokenkarma', surface: 'terminal', isInteractive: true } as const

test('a prompt and a turn show up as billable time, and a rate turns them into money', async ($, on) => {
  const clock = machine(on, [])
  await $.session.start(start)
  await $.prompt.submit({ text: 'fix the bug', origin: { kind: 'composer' }, wait: false } as never)
  await (clock as never as { advance: (ms: number) => Promise<void> }).advance(12 * MIN)
  await $.turn.complete({ answer: 'done', durationMs: 12 * MIN, isAborted: false, turnId: 't1', text: '', reason: 'answer' } as never)
  const set = await $.command.run({ command: 'jrtime', args: 'rate 120' } as never)
  expect(JSON.stringify(set)).toContain('120 €/h')
  await $.command.run({ command: 'jrtime', args: '' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = (await $.ui.mount({ plugin: 'jr-time', surface, component: 'Pane', requestId: 'jr-time', props: {} } as never)) as never as {
      drawn: (s: object) => Promise<unknown>
      unmount: () => Promise<void>
    }
    const drawn = JSON.stringify(await ui.drawn({ in: 'time' }))
    expect(drawn).toContain('Prompt window')
    expect(drawn).toContain('tokenkarma')
    expect(drawn).toContain('120€/h')
    await ui.unmount()
  }
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

test('the band is one quiet row on the right: billable time, then the amount or how to set a rate', async ($, on) => {
  machine(on, [])
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start(start)
  const props = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 }
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-time', surface, component: 'AbovePrompt', props } as never)
    const row = bandRow((await ui.drawn()) as never)
    expect(row.justify).toBe('flex-end')
    expect(row.text).toBe('0h00 billable · set a rate: /jrtime rate 80')
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    await ui.unmount()
  }
  await $.command.run({ command: 'jrtime', args: 'rate 80' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-time', surface, component: 'AbovePrompt', props } as never)
    expect(bandRow((await ui.drawn()) as never).text).toBe('0h00 billable · 0 € · /jrtime')
    await ui.unmount()
  }
})

test('/jrtime says how to detail and adjust the billing', async ($, on) => {
  machine(on, [])
  await $.session.start(start)
  const answer = JSON.stringify(await $.command.run({ command: 'jrtime', args: '' } as never))
  expect(answer).toContain('today 0h00 billable on tokenkarma')
  expect(answer).toContain('no rate yet: /jrtime rate 80')
  expect(answer).toContain('←→ change its ratio')
  expect(answer).toContain('e export')
})

test('installed mid-session, with no session.start, the first prompt starts recording', async ($, on) => {
  const clock = machine(on, [])
  await $.prompt.submit({ text: 'go', origin: { kind: 'composer' }, wait: false } as never)
  await (clock as never as { advance: (ms: number) => Promise<void> }).advance(3 * MIN)
  const opened = await $.command.run({ command: 'jrtime', args: '' } as never)
  expect(JSON.stringify(opened)).toContain('jr time opened')
  const ui = (await $.ui.mount({ plugin: 'jr-time', surface: 'terminal', component: 'Pane', requestId: 'jr-time', props: {} } as never)) as never as {
    drawn: (s: object) => Promise<unknown>
  }
  expect(JSON.stringify(await ui.drawn({ in: 'time' }))).toContain('tokenkarma')
})

test('/jrtime hide takes the band away and keeps what is below, show brings it back', async ($, on) => {
  machine(on, [])
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start(start)
  const BAND = { plugin: 'jr-time', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as const
  const answer = await $.command.run({ command: 'jrtime', args: 'hide' } as never)
  expect(JSON.stringify(answer)).toContain('hidden')
  let ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ text: /billable/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jrtime', args: 'show' } as never)
  ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ text: /billable/ } as never)).toBeDefined()
})
