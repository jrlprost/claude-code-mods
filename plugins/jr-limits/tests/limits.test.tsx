import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { countdown, crossed, labelOf, windowsOf } from '../hooks/limits'

const HOUR = 3_600_000

test('windows come sorted 5h, 7d, spend', async () => {
  const w = windowsOf([
    { kind: 'seven_day', percentUsed: 31 },
    { kind: 'five_hour', percentUsed: 64, resetsAt: '2026-10-16T10:00:00Z' },
  ])
  expect(w.map(x => labelOf(x.kind))).toEqual(['5h', '7d'])
  expect(w[0]!.resetsAt).toBe(Date.parse('2026-10-16T10:00:00Z'))
})

test('countdowns read in minutes, hours or days', async () => {
  expect(countdown(42 * 60_000, 0)).toBe('42m')
  expect(countdown(72 * 60_000, 0)).toBe('1h12')
  expect(countdown(76 * HOUR, 0)).toBe('3d 4h')
  expect(countdown(null, 0)).toBe('')
})

test('each threshold is announced once', async () => {
  expect(crossed(85, [], [80, 95])).toEqual([80])
  expect(crossed(96, [80], [80, 95])).toEqual([95])
  expect(crossed(96, [80, 95], [80, 95])).toEqual([])
})

const machine = (on: On, rateLimits: unknown[], toasts: string[]) => {
  mock.clock(on)
  mock.store(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1 }, rateLimits } }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.toast', (_$, e) => {
    toasts.push(String((e as unknown as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as const

test('the band shows both windows and keeps what is below, on terminal and desktop', async ($, on) => {
  const toasts: string[] = []
  machine(on, [{ kind: 'five_hour', percentUsed: 64, resetsAt: new Date(Date.now() + 72 * 60_000).toISOString() }, { kind: 'seven_day', percentUsed: 31 }], toasts)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-limits', surface, ...BAND } as never)
    expect(await ui.find({ text: /64%/ } as never)).toBeDefined()
    expect(await ui.find({ text: /31%/ } as never)).toBeDefined()
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    await ui.unmount()
  }
  expect(toasts.length).toBe(0)
})

test('no figures, no band', async ($, on) => {
  machine(on, [], [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'jr-limits', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /limits/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
})

test('crossing 80 % raises one toast', async ($, on) => {
  const toasts: string[] = []
  machine(on, [{ kind: 'five_hour', percentUsed: 83 }], toasts)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', text: '', reason: 'answer' } as never).catch(() => undefined)
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('5h window at 83%')
})

test('/jrlimits hide takes the band away, the bare command brings it back', async ($, on) => {
  machine(on, [{ kind: 'five_hour', percentUsed: 64 }], [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jrlimits', args: 'hide' } as never)
  let ui = await $.ui.mount({ plugin: 'jr-limits', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /64%/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  await ui.unmount()
  expect(JSON.stringify(await $.command.run({ command: 'jrlimits', args: '' } as never))).toContain('shown')
  ui = await $.ui.mount({ plugin: 'jr-limits', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /64%/ } as never)).toBeDefined()
})
