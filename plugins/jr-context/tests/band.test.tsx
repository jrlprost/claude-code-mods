import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { BREAKDOWN } from './fill.test'

const band = (bodyColumns = 100) => ({
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns },
}) as const

// The engine beneath: the breakdown above, and something already drawn above the prompt.
const engineWith = (on: On, percentage: number) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1, window: 1_000_000, breakdown: { ...BREAKDOWN, percentage } }, rateLimits: [] } }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

const start = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

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

test('one quiet row on the right, keeping what is below, on terminal and desktop and any width', async ($, on) => {
  engineWith(on, 26)
  await $.session.start(start)
  for (const surface of ['terminal', 'desktop'] as const) {
    for (const columns of [80, 200]) {
      const ui = await $.ui.mount({ plugin: 'jr-context', surface, ...band(columns) } as never)
      const row = (await ui.find({ key: 'jr-context-row' } as never)) as Found | undefined
      expectOneRow(row)
      expect(row!.props.justifyContent).toBe('flex-end')
      expect(row!.text).toContain('ctx ▕')
      expect(row!.text).toContain('26% · 256k/1.0M')
      expect(await ui.find({ text: /legend|autocompact buffer/ } as never)).toBeUndefined()
      expect(await ui.find({ text: /below/ } as never)).toBeDefined()
      await ui.unmount()
    }
  }
})

test('near compaction the row becomes an alert on the left, still one row', async ($, on) => {
  engineWith(on, 85)
  await $.session.start(start)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-context', surface, ...band() } as never)
    const row = (await ui.find({ key: 'jr-context-row' } as never)) as Found | undefined
    expectOneRow(row)
    expect(row!.props.justifyContent).toBeUndefined()
    expect(row!.text).toContain('▲ context 85%')
    expect(row!.text).toContain('/jrcontext details')
    await ui.unmount()
  }
})

test('installed mid-session, with no session.start, the row still fills on its first draw', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1, window: 1_000_000, breakdown: { ...BREAKDOWN, percentage: 26 } }, rateLimits: [] } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  const ui = await $.ui.mount({ plugin: 'jr-context', surface: 'terminal', ...band() } as never)
  await (clock as never as { advance: (ms: number) => Promise<void> }).advance(10)
  expect(await ui.find({ text: /26%/ } as never)).toBeDefined()
})
