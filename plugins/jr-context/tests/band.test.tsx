import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { BREAKDOWN } from './fill.test'

const band = (maxRows: number) => ({
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows, bodyColumns: 100 },
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

test('header, bar and legend on terminal and desktop, keeping what is below', async ($, on) => {
  engineWith(on, 26)
  await $.session.start(start)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-context', surface, ...band(8) } as never)
    expect(await ui.find({ text: /256k of 1\.0M · compacts at 967k/ } as never)).toBeDefined()
    expect(await ui.find({ text: /26%/ } as never)).toBeDefined()
    expect(await ui.find({ text: /messages/ } as never)).toBeDefined()
    expect(await ui.find({ text: /autocompact buffer 33k/ } as never)).toBeDefined()
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    await ui.unmount()
  }
})

test('a short band drops the legend', async ($, on) => {
  engineWith(on, 26)
  await $.session.start(start)
  const ui = await $.ui.mount({ plugin: 'jr-context', surface: 'terminal', ...band(3) } as never)
  expect(await ui.find({ text: /autocompact buffer/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /26%/ } as never)).toBeDefined()
})

test('past the threshold the header warns', async ($, on) => {
  engineWith(on, 85)
  await $.session.start(start)
  const ui = await $.ui.mount({ plugin: 'jr-context', surface: 'terminal', ...band(8) } as never)
  expect(await ui.find({ text: /compaction is near/ } as never)).toBeDefined()
})

test('installed mid-session, with no session.start, the bar still fills on its first draw', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1, window: 1_000_000, breakdown: { ...BREAKDOWN, percentage: 26 } }, rateLimits: [] } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  const ui = await $.ui.mount({ plugin: 'jr-context', surface: 'terminal', ...band(8) } as never)
  await (clock as never as { advance: (ms: number) => Promise<void> }).advance(10)
  expect(await ui.find({ text: /26%/ } as never)).toBeDefined()
})
