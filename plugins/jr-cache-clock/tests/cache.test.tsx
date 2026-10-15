import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { hitRateOf, mmss, remaining } from '../hooks/cache'

test('remaining life counts down from the last reply and stops at zero', async () => {
  expect(remaining(null, 10, 5)).toBe(0)
  expect(remaining(0, 60_000, 5)).toBe(240_000)
  expect(remaining(0, 400_000, 5)).toBe(0)
})

test('minutes and seconds', async () => {
  expect(mmss(221_000)).toBe('3:41')
  expect(mmss(9_000)).toBe('0:09')
})

test('hit rate is the share of input read from the cache', async () => {
  expect(hitRateOf({ input_tokens: 10, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 })).toBe(0.9)
  expect(hitRateOf(undefined)).toBe(null)
})

type Clock = { advance: (ms: number) => Promise<void> }

const machine = (on: On, toasts: string[]) => {
  const c = mock.clock(on) as unknown as Clock
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.toast', (_$, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  return c
}

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as const
const DONE = {
  answer: '',
  durationMs: 1000,
  isAborted: false,
  turnId: 't',
  text: '',
  reason: 'answer',
  usage: { model: 'claude-opus-5-5', input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 },
} as const

test('after a reply the band counts down, then says cold; one toast before expiry', async ($, on) => {
  const toasts: string[] = []
  const c = machine(on, toasts)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.turn.complete(DONE as never)
  await c.advance(60_000)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-cache-clock', surface, ...BAND } as never)
    expect(await ui.find({ text: /warm 4:00/ } as never)).toBeDefined()
    expect(await ui.find({ text: /last hit 90%/ } as never)).toBeDefined()
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    await ui.unmount()
  }
  // Step through the last minute so the per-second tick sees the 30-second mark.
  for (let i = 0; i < 70; i++) await c.advance(5_000)
  const ui = await $.ui.mount({ plugin: 'jr-cache-clock', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /cold/ } as never)).toBeDefined()
  expect(toasts.length).toBe(1)
})
