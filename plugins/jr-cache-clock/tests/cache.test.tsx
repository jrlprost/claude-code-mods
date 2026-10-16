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
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
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

/** The band is one row: the rows of the tree above `below`, which is the last child. */
const rowsAbove = (tree: unknown) => {
  const t = tree as { type: string; props?: { flexDirection?: string }; children?: unknown[] }
  if (t.type !== 'Box' || t.props?.flexDirection !== 'column') return 0
  return (t.children ?? []).length - 1
}

test('hidden on a fresh install: nothing drawn, the toast still comes', async ($, on) => {
  const toasts: string[] = []
  const c = machine(on, toasts)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.turn.complete(DONE as never)
  const ui = await $.ui.mount({ plugin: 'jr-cache-clock', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /cache/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  for (let i = 0; i < 60; i++) await c.advance(5_000)
  expect(toasts.length).toBe(1)
})

test('shown, one quiet row: countdown and hit rate, then cold', async ($, on) => {
  const c = machine(on, [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jrcache', args: 'show' } as never)
  await $.turn.complete(DONE as never)
  await c.advance(60_000)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-cache-clock', surface, ...BAND } as never)
    expect(await ui.find({ text: /^4:00$/ } as never)).toBeDefined()
    expect(await ui.find({ text: /hit 90%/ } as never)).toBeDefined()
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    expect(rowsAbove(await ui.drawn())).toBe(1)
    await ui.unmount()
  }
  for (let i = 0; i < 70; i++) await c.advance(5_000)
  const ui = await $.ui.mount({ plugin: 'jr-cache-clock', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /^cold$/ } as never)).toBeDefined()
})

test('/jrcache toggles, on and off set it', async ($, on) => {
  machine(on, [])
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.turn.complete(DONE as never)
  const mount = () => $.ui.mount({ plugin: 'jr-cache-clock', surface: 'terminal', ...BAND } as never)
  const shown = await $.command.run({ command: 'jrcache', args: '' } as never)
  expect(JSON.stringify(shown)).toContain('shown')
  let ui = await mount()
  expect(await ui.find({ text: /hit 90%/ } as never)).toBeDefined()
  await ui.unmount()
  const hidden = await $.command.run({ command: 'jrcache', args: '' } as never)
  expect(JSON.stringify(hidden)).toContain('hidden')
  ui = await mount()
  expect(await ui.find({ text: /hit 90%/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jrcache', args: 'on' } as never)
  ui = await mount()
  expect(await ui.find({ text: /hit 90%/ } as never)).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'jrcache', args: 'off' } as never)
  ui = await mount()
  expect(await ui.find({ text: /hit 90%/ } as never)).toBeUndefined()
})
