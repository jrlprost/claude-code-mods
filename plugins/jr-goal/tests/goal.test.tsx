import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { applyCommand, describe } from '../hooks/goal'

test('set a goal, add steps, tick one off, clear', async () => {
  let r = applyCommand(null, 'Ship the billing page', 1)
  expect(r.goal?.goal).toBe('Ship the billing page')
  r = applyCommand(r.goal, 'step Design the form', 2)
  r = applyCommand(r.goal, 'step Wire Stripe', 3)
  r = applyCommand(r.goal, 'done 1', 4)
  expect(r.text).toBe('jr goal · 1/2')
  expect(describe(r.goal!)).toContain('1. ✓ Design the form')
  r = applyCommand(r.goal, 'undo 1', 5)
  expect(r.goal?.steps[0]?.isDone).toBe(false)
  expect(applyCommand(r.goal, 'clear', 6).goal).toBe(null)
})

test('bad input answers with the usage and changes nothing', async () => {
  const g = applyCommand(null, 'Goal', 1).goal
  expect(applyCommand(g, 'done 9', 2).goal).toBe(g)
  expect(applyCommand(null, 'step x', 2).text).toContain('set a goal first')
})

const machine = (on: On) => {
  mock.clock(on)
  mock.store(on)
  on('session.root', () => ({ value: '/work/shop' }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

test('the band shows goal, progress and next step, above what was there', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/work/shop', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jrgoal', args: 'Ship the billing page' } as never)
  await $.command.run({ command: 'jrgoal', args: 'step Design the form' } as never)
  await $.command.run({ command: 'jrgoal', args: 'step Wire Stripe' } as never)
  await $.command.run({ command: 'jrgoal', args: 'done 1' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-goal', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as never)
    expect(bandRow(await ui.drawn())).toEqual({ isOneRow: true, isRight: true })
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('Ship the billing page')
    expect(drawn).toContain('1/2')
    expect(drawn).toContain('next: Wire Stripe')
    expect(drawn).toContain('below')
    await ui.unmount()
  }
})

test('/jrgoal hide takes the band away and keeps what is below, show brings it back', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/work/shop', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jrgoal', args: 'Ship the billing page' } as never)
  const band = { plugin: 'jr-goal', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as const
  const hidden = await $.command.run({ command: 'jrgoal', args: 'hide' } as never)
  expect(JSON.stringify(hidden)).toContain('hidden')
  let ui = await $.ui.mount(band as never)
  let drawn = JSON.stringify(await ui.drawn())
  expect(drawn).not.toContain('Ship the billing page')
  expect(drawn).toContain('below')
  await ui.unmount()
  await $.command.run({ command: 'jrgoal', args: 'show' } as never)
  ui = await $.ui.mount(band as never)
  drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('Ship the billing page')
  await ui.unmount()
})

type Drawn = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
/** The band's own row (first child of the stack): one row, no column inside, no line break. */
function bandRow(tree: unknown) {
  const row = ((tree as Drawn).children ?? [])[0] as Drawn
  const isOneRow = (n: unknown): boolean => {
    if (typeof n === 'string') return !n.includes('\n')
    const d = n as Drawn
    if (d?.type === 'Box' && d.props?.flexDirection === 'column') return false
    return (d?.children ?? []).every(isOneRow)
  }
  return { isOneRow: isOneRow(row), isRight: row?.props?.justifyContent === 'flex-end' }
}
