import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { countdown, crossed, fullest, labelOf, levelColor, shortCountdown, windowsOf } from '../hooks/limits'

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

test('the short countdown keeps one unit', async () => {
  expect(shortCountdown(42 * 60_000, 0)).toBe('42m')
  expect(shortCountdown(45 * HOUR + 20 * 60_000, 0)).toBe('45h')
  expect(shortCountdown(76 * HOUR, 0)).toBe('3d')
  expect(shortCountdown(null, 0)).toBe('')
})

test('levels go green, amber, red, and the fullest window wins', async () => {
  expect([levelColor(2), levelColor(48), levelColor(50), levelColor(84)]).toEqual(['#2cb67d', '#2cb67d', '#f4d35e', '#ef4565'])
  expect(fullest(windowsOf([{ kind: 'five_hour', percentUsed: 2 }, { kind: 'seven_day', percentUsed: 48 }]))!.kind).toBe('seven_day')
  expect(fullest([])).toBe(null)
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
const bandAt = (bodyColumns: number) => ({ component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns } }) as const

type Found = { type: string; props: Record<string, unknown>; text: string; children: unknown[] }

/** One row: a Box holding a single Text cut at the row's end, with no line break in it. */
const expectOneRow = (row: Found | undefined) => {
  expect(row).toBeDefined()
  expect(row!.type).toBe('Box')
  expect(row!.props.flexDirection === undefined || row!.props.flexDirection === 'row').toBe(true)
  expect(row!.children.length).toBe(1)
  const only = row!.children[0] as Found
  expect(only.type).toBe('Text')
  expect(only.props.wrap).toBe('truncate-end')
  expect(row!.text.includes('\n')).toBe(false)
}

test('one quiet row on the right: both windows and the reset of the fullest, on terminal and desktop', async ($, on) => {
  const toasts: string[] = []
  machine(on, [{ kind: 'five_hour', percentUsed: 2 }, { kind: 'seven_day', percentUsed: 48, resetsAt: new Date(45 * HOUR + 10 * 60_000).toISOString() }], toasts)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    for (const columns of [80, 200]) {
      const ui = await $.ui.mount({ plugin: 'jr-limits', surface, ...bandAt(columns) } as never)
      const row = (await ui.find({ key: 'jr-limits-row' } as never)) as Found | undefined
      expectOneRow(row)
      expect(row!.props.justifyContent).toBe('flex-end')
      expect(row!.text).toBe('5h 2% · 7d 48% ↻45h')
      expect(await ui.find({ text: /below/ } as never)).toBeDefined()
      await ui.unmount()
    }
  }
  expect(toasts.length).toBe(0)
})

test('from 80 % the row is an alert on the left, still one row', async ($, on) => {
  machine(on, [{ kind: 'five_hour', percentUsed: 12 }, { kind: 'seven_day', percentUsed: 84, resetsAt: new Date(45 * HOUR + 10 * 60_000).toISOString() }], [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-limits', surface, ...BAND } as never)
    const row = (await ui.find({ key: 'jr-limits-row' } as never)) as Found | undefined
    expectOneRow(row)
    expect(row!.props.justifyContent).toBeUndefined()
    expect(row!.text).toBe('▲ 7d limit 84% · resets in 45h')
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    await ui.unmount()
  }
})

test('no figures, no band', async ($, on) => {
  machine(on, [], [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'jr-limits', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ key: 'jr-limits-row' } as never)).toBeUndefined()
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

test('/jr-limits hide takes the band away, the bare command brings it back', async ($, on) => {
  machine(on, [{ kind: 'five_hour', percentUsed: 64 }], [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jr-limits', args: 'hide' } as never)
  let ui = await $.ui.mount({ plugin: 'jr-limits', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /64%/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  await ui.unmount()
  expect(JSON.stringify(await $.command.run({ command: 'jr-limits', args: '' } as never))).toContain('shown')
  ui = await $.ui.mount({ plugin: 'jr-limits', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /64%/ } as never)).toBeDefined()
})
