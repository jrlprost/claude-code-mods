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

test('the band shows today\'s billable time for this project', async ($, on) => {
  machine(on, [])
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start(start)
  const ui = await $.ui.mount({
    plugin: 'jr-time',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 },
  } as never)
  expect(await ui.find({ text: /billable today · tokenkarma/ } as never)).toBeDefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
})
