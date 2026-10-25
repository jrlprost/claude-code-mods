import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { cleanPost, postPrompt, wordCount } from '../hooks/post'

test('the prompt asks for the language and the platform', async () => {
  const prompt = postPrompt('French', 'LinkedIn')
  expect(prompt).toContain('in French, for LinkedIn')
  expect(prompt).toContain('no em dashes')
})

test('the post is cleaned and counted', async () => {
  expect(cleanPost('"Shipped a time tracker today."')).toBe('Shipped a time tracker today.')
  expect(wordCount('Shipped a time tracker today.')).toBe(5)
})

const machine = (on: On, forks: string[], copies: string[], reply: object) => {
  const clock = mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('model.fork', (_$, e) => {
    forks.push((e as unknown as { prompt: string }).prompt)
    return { value: reply } as never
  })
  on('ui.copy', (_$, e) => {
    copies.push((e as unknown as { text: string }).text)
    return { value: { isCopied: true } } as never
  })
  return clock as never as { advance: (ms: number) => Promise<void> }
}

test('/jr-post French writes from the session, shows the post and copies it', async ($, on) => {
  const forks: string[] = []
  const copies: string[] = []
  const clock = machine(on, forks, copies, { isAnswered: true, text: 'Today I shipped a billable-time tracker for my coding sessions.', usage: {} })
  await $.command.run({ command: 'jr-post', args: 'French' } as never)
  await clock.advance(10)
  expect(forks[0]).toContain('in French')
  expect(copies).toEqual(['Today I shipped a billable-time tracker for my coding sessions.'])
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-post', surface, component: 'Pane', requestId: 'jr-post', props: {} } as never)
    expect(await ui.find({ text: /billable-time tracker/ } as never)).toBeDefined()
    await ui.unmount()
  }
})

test('nothing to fork: the pane says why', async ($, on) => {
  const clock = machine(on, [], [], { isAnswered: false, reason: 'nothing-to-fork', usage: {} })
  await $.command.run({ command: 'jr-post', args: '' } as never)
  await clock.advance(10)
  const ui = await $.ui.mount({ plugin: 'jr-post', surface: 'terminal', component: 'Pane', requestId: 'jr-post', props: {} } as never)
  expect(await ui.find({ text: /nothing has happened in this session yet/ } as never)).toBeDefined()
})
