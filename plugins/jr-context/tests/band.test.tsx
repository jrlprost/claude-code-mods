import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100 },
} as const

// The engine beneath: a context window at `tokens`, and something already drawn above the prompt.
const engineWith = (on: On, tokens: number) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens, window: 200_000 }, rateLimits: [] } }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

const start = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

test('the band draws the gauge on terminal and desktop, and keeps what is below', async ($, on) => {
  engineWith(on, 124_000)
  await $.session.start(start)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-context', surface, ...BAND } as never)
    expect(await ui.find({ text: /62%/ } as never)).toBeDefined()
    expect(await ui.find({ text: /124k \/ 200k/ } as never)).toBeDefined()
    expect(await ui.find({ text: /below/ } as never)).toBeDefined()
    expect(await ui.find({ text: /compact soon/ } as never)).toBeUndefined()
    await ui.unmount()
  }
})

test('past the threshold the band warns', async ($, on) => {
  engineWith(on, 170_000)
  await $.session.start(start)
  const ui = await $.ui.mount({ plugin: 'jr-context', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /compact soon/ } as never)).toBeDefined()
})
