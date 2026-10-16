import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { nextCost, priceOf, usd } from '../hooks/prices'

test('prices follow the model id', async () => {
  expect(priceOf('claude-opus-5-5')).toEqual({ input: 4, cacheRead: 0.2 })
  expect(priceOf('claude-opus-5-5[1m]')).toEqual({ input: 4, cacheRead: 0.2 })
  expect(priceOf('claude-fable-5-1')).toEqual({ input: 10, cacheRead: 0.25 })
  expect(priceOf('claude-sonnet-5-5')?.input).toBe(2)
  expect(priceOf('gpt-x')).toBe(null)
})

test('warm reads from the cache, cold writes it again', async () => {
  const p = { input: 4, cacheRead: 0.2 }
  expect(Math.round(nextCost(1_000_000, p, true) * 100)).toBe(20)
  expect(Math.round(nextCost(1_000_000, p, false) * 100)).toBe(500)
  expect(usd(0.004)).toBe('<$0.01')
  expect(usd(0.214)).toBe('$0.21')
})

type Clock = { advance: (ms: number) => Promise<void> }

const machine = (on: On) => {
  const c = mock.clock(on) as unknown as Clock
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 500_000, window: 1_000_000 }, rateLimits: [] } }) as never)
  on('session.model', () => ({ value: 'claude-opus-5-5' }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  return c
}

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as const
const DONE = { answer: '', durationMs: 1, isAborted: false, turnId: 't', text: '', reason: 'answer' } as const

test('warm after a reply, then cold, on terminal and desktop', async ($, on) => {
  const c = machine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.turn.complete(DONE as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-next-cost', surface, ...BAND } as never)
    expect(await ui.find({ text: /≈ \$0\.10/ } as never)).toBeDefined()
    expect(await ui.find({ text: /cache warm/ } as never)).toBeDefined()
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    await ui.unmount()
  }
  for (let i = 0; i < 70; i++) await c.advance(5_000)
  const ui = await $.ui.mount({ plugin: 'jr-next-cost', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /≈ \$2\.50/ } as never)).toBeDefined()
  expect(await ui.find({ text: /cache cold/ } as never)).toBeDefined()
})

test('/jrnextcost on|off and the bare command hide and bring back the band', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.complete(DONE as never)
  const mount = () => $.ui.mount({ plugin: 'jr-next-cost', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as never)
  const said = await $.command.run({ command: 'jrnextcost', args: 'off' } as never)
  expect(JSON.stringify(said)).toContain('hidden')
  let ui = await mount()
  expect(await ui.find({ text: /cache warm/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jrnextcost', args: '' } as never)
  ui = await mount()
  expect(await ui.find({ text: /cache warm/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jrnextcost', args: '' } as never)
  ui = await mount()
  expect(await ui.find({ text: /cache warm/ } as never)).toBeUndefined()
})
