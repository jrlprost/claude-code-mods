import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { BREAKDOWN } from './fill.test'

const machine = (on: On) => {
  mock.clock(on)
  mock.store(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1, window: 1_000_000, breakdown: { ...BREAKDOWN, percentage: 26 } }, rateLimits: [] } }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 100 } } as const

test('/jrcontext details opens the full bar in a pane, on terminal and desktop', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const opened = await $.command.run({ command: 'jrcontext', args: 'details' } as never)
  expect(JSON.stringify(opened)).toContain('jr context opened')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-context', surface, component: 'Pane', requestId: 'jr-context', props: { bodyColumns: 100 } } as never)
    expect(await ui.find({ text: /26%/ } as never)).toBeDefined()
    expect(await ui.find({ text: /autocompact buffer/ } as never)).toBeDefined()
    await ui.unmount()
  }
})

test('/jrcontext hide takes the band away, show brings it back', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jrcontext', args: 'hide' } as never)
  let ui = await $.ui.mount({ plugin: 'jr-context', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /26%/ } as never)).toBeUndefined()
  await ui.unmount()
  await $.command.run({ command: 'jrcontext', args: 'show' } as never)
  ui = await $.ui.mount({ plugin: 'jr-context', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /26%/ } as never)).toBeDefined()
})

test('/jrcontext alone toggles the band', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  expect(JSON.stringify(await $.command.run({ command: 'jrcontext', args: '' } as never))).toContain('hidden')
  let ui = await $.ui.mount({ plugin: 'jr-context', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /26%/ } as never)).toBeUndefined()
  expect(await ui.find({ text: /below/ } as never)).toBeDefined()
  await ui.unmount()
  expect(JSON.stringify(await $.command.run({ command: 'jrcontext', args: '' } as never))).toContain('shown')
  ui = await $.ui.mount({ plugin: 'jr-context', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ text: /26%/ } as never)).toBeDefined()
})
