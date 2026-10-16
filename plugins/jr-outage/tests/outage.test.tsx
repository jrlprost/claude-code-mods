import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { degraded, serviceOf } from '../hooks/services'

const page = (indicator: string, description: string) => JSON.stringify({ status: { indicator, description } })

test('a status page body becomes a service row; garbage is unknown', async () => {
  expect(serviceOf('GitHub', page('minor', 'Degraded Actions'))).toEqual({ name: 'GitHub', indicator: 'minor', description: 'Degraded Actions' })
  expect(serviceOf('npm', null).indicator).toBe('unknown')
  expect(serviceOf('npm', '<html>').indicator).toBe('unknown')
})

test('degraded lists real incidents, worst first', async () => {
  const d = degraded([
    { name: 'a', indicator: 'none', description: '' },
    { name: 'b', indicator: 'minor', description: '' },
    { name: 'c', indicator: 'critical', description: '' },
    { name: 'd', indicator: 'unknown', description: '' },
  ])
  expect(d.map(s => s.name)).toEqual(['c', 'b'])
})

const machine = (on: On, toasts: string[]) => {
  mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('http.fetch', ($, e) => {
    const url = (e as unknown as { url: string }).url
    const text = url.includes('githubstatus') ? page('major', 'Partial outage of Actions') : page('none', 'All Systems Operational')
    return { value: { ok: true, status: 200, headers: {}, text } } as never
  })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', (_$, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

test('an incident shows in the band and the pane, and toasts once', async ($, on) => {
  const toasts: string[] = []
  machine(on, toasts)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'jr-outage', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as never)
    expect(await band.find({ text: /Partial outage of Actions/ } as never)).toBeDefined()
    expect(await band.find({ text: /npm/ } as never)).toBeUndefined()
    expect(await band.find({ text: /below/ } as never)).toBeDefined()
    await band.unmount()
  }
  const said = await $.command.run({ command: 'jroutage', args: 'details' } as never)
  expect(JSON.stringify(said)).toContain('GitHub: Partial outage of Actions')
  const pane = await $.ui.mount({ plugin: 'jr-outage', surface: 'terminal', component: 'Pane', requestId: 'jr-outage', props: { bodyColumns: 80 } } as never)
  expect(await pane.find({ text: /All Systems Operational/ } as never)).toBeDefined()
  expect(toasts.length).toBe(1)
})

test('/jroutage hide takes the band away, the bare command toggles it, on brings it back', async ($, on) => {
  machine(on, [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const shows = async () => {
    const band = await $.ui.mount({ plugin: 'jr-outage', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as never)
    const seen = (await band.find({ text: /Partial outage/ } as never)) !== undefined
    expect(await band.find({ text: /below/ } as never)).toBeDefined()
    await band.unmount()
    return seen
  }
  expect(await shows()).toBe(true)
  expect(JSON.stringify(await $.command.run({ command: 'jroutage', args: 'hide' } as never))).toContain('hidden')
  expect(await shows()).toBe(false)
  await $.command.run({ command: 'jroutage', args: '' } as never)
  expect(await shows()).toBe(true)
  await $.command.run({ command: 'jroutage', args: '' } as never)
  expect(await shows()).toBe(false)
  await $.command.run({ command: 'jroutage', args: 'on' } as never)
  expect(await shows()).toBe(true)
})
