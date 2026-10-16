import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { body, countOf, hostOf, pagesOf, queryUrl } from '../hooks/posthog'

test('hosts: region names, custom hosts, trailing slashes', async () => {
  expect(hostOf('')).toBe('https://us.posthog.com')
  expect(hostOf('EU')).toBe('https://eu.posthog.com')
  expect(hostOf('posthog.example.com/')).toBe('https://posthog.example.com')
  expect(queryUrl('eu', ' 123 ')).toBe('https://eu.posthog.com/api/projects/123/query/')
})

test('answers become numbers and pages', async () => {
  expect(countOf('{"results":[[7]]}')).toBe(7)
  expect(countOf('{"results":[]}')).toBe(0)
  expect(pagesOf('{"results":[["/pricing",12],[null,3]]}')).toEqual([{ page: '/pricing', views: 12 }, { page: '(none)', views: 3 }])
  expect(JSON.parse(body('SELECT 1')).query.kind).toBe('HogQLQuery')
})

const machine = (on: On, sent: string[]) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('http.fetch', (_$, e) => {
    const q = JSON.parse((e as unknown as { init: { body: string } }).init.body).query.query as string
    sent.push((e as unknown as { url: string }).url)
    const results = q.includes('GROUP BY page') ? [['/pricing', 40], ['/', 12]] : q.includes('5 MINUTE') ? [[3]] : [[118]]
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ results }) } } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

test('with a project and key, the band and the pane show visitors', { options: { projectId: '42', apiKey: 'phx_x' } }, async ($, on) => {
  const sent: string[] = []
  machine(on, sent)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  expect(sent[0]).toBe('https://us.posthog.com/api/projects/42/query/')
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'jr-visitors', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as never)
    expect(await band.find({ text: /^3$/ } as never)).toBeDefined()
    expect(await band.find({ text: /^118$/ } as never)).toBeDefined()
    await band.unmount()
  }
  await $.command.run({ command: 'jrvisitors', args: 'details' } as never)
  const pane = await $.ui.mount({ plugin: 'jr-visitors', surface: 'terminal', component: 'Pane', requestId: 'jr-visitors', props: {} } as never)
  expect(await pane.find({ text: /\/pricing/ } as never)).toBeDefined()
})

test('without settings, /jrvisitors explains what to set', async ($, on) => {
  machine(on, [])
  expect(JSON.stringify(await $.command.run({ command: 'jrvisitors', args: '' } as never))).toContain('personal API key')
})

test('/jrvisitors hide takes the band away, the bare command toggles it, on brings it back', { options: { projectId: '42', apiKey: 'phx_x' } }, async ($, on) => {
  machine(on, [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const shows = async () => {
    const band = await $.ui.mount({ plugin: 'jr-visitors', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as never)
    const seen = (await band.find({ text: /^118$/ } as never)) !== undefined
    expect(await band.find({ text: /below/ } as never)).toBeDefined()
    await band.unmount()
    return seen
  }
  expect(await shows()).toBe(true)
  expect(JSON.stringify(await $.command.run({ command: 'jrvisitors', args: 'hide' } as never))).toContain('hidden')
  expect(await shows()).toBe(false)
  await $.command.run({ command: 'jrvisitors', args: '' } as never)
  expect(await shows()).toBe(true)
  await $.command.run({ command: 'jrvisitors', args: '' } as never)
  expect(await shows()).toBe(false)
  await $.command.run({ command: 'jrvisitors', args: 'on' } as never)
  expect(await shows()).toBe(true)
})
