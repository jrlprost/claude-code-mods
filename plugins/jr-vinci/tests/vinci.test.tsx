import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { challengeOf } from '../hooks/vinci'

test('one clean line, or nothing', async () => {
  expect(challengeOf('**What happens when the token expires mid-upload?**\nmore')).toBe('What happens when the token expires mid-upload?')
  expect(challengeOf('Nothing to challenge.')).toBe(null)
  expect(challengeOf('x'.repeat(300)).length).toBe(218)
})

const machine = (on: On, forks: string[]) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('model.fork', (_$, e) => {
    forks.push((e as unknown as { prompt: string }).prompt)
    return { value: { isAnswered: true, text: 'Who pays when the free tier is abused?', usage: {} } } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  return clock as never as { advance: (ms: number) => Promise<void> }
}

const TURN = { answer: 'done', durationMs: 1000, isAborted: false, turnId: 't', text: '', reason: 'answer' } as never
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as const

test('off by default: no model call', async ($, on) => {
  const forks: string[] = []
  const clock = machine(on, forks)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.turn.complete(TURN)
  await clock.advance(10)
  expect(forks.length).toBe(0)
})

test('on: one challenge after each answer, shown above the prompt and in the pane', async ($, on) => {
  const forks: string[] = []
  const clock = machine(on, forks)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jr-vinci', args: 'on' } as never)
  await $.turn.complete(TURN)
  await clock.advance(10)
  expect(forks.length).toBe(1)
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'jr-vinci', surface, ...BAND } as never)
    expect(await band.find({ text: /free tier is abused/ } as never)).toBeDefined()
    expect(await band.find({ text: /below/ } as never)).toBeDefined()
    await band.unmount()
  }
  await $.command.run({ command: 'jr-vinci', args: '' } as never)
  const pane = await $.ui.mount({ plugin: 'jr-vinci', surface: 'terminal', component: 'Pane', requestId: 'jr-vinci', props: {} } as never)
  expect(await pane.find({ text: /free tier is abused/ } as never)).toBeDefined()
})
