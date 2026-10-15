import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { addCheck, emptySite, latencySpark, parseUrls } from '../hooks/uptime'

test('URLs parse from commas, spaces and lines, https added, duplicates dropped', async () => {
  expect(parseUrls('example.com, https://api.example.com/health\nexample.com')).toEqual(['https://example.com', 'https://api.example.com/health'])
  expect(parseUrls('')).toEqual([])
})

test('an incident opens on the first failure and closes on recovery', async () => {
  let s = emptySite('https://x.dev')
  s = addCheck(s, { at: 1, ms: 80, status: 200 })
  s = addCheck(s, { at: 2, ms: 10_000, status: null })
  s = addCheck(s, { at: 3, ms: 90, status: 503 })
  expect(s.downSince).toBe(2)
  s = addCheck(s, { at: 4, ms: 70, status: 200 })
  expect([s.downSince, s.lastIncident]).toEqual([null, { from: 2, to: 4 }])
  expect(latencySpark(s.history)).toBe('█✕✕▇') // 70 ms of 80 ms, rounded to the 7th step
})

test('history keeps the last 30 checks', async () => {
  let s = emptySite('https://x.dev')
  for (let i = 0; i < 40; i++) s = addCheck(s, { at: i, ms: 50, status: 200 })
  expect(s.history.length).toBe(30)
})

const machine = (on: On, statuses: Record<string, number>) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('http.fetch', (_$, e) => {
    const url = (e as unknown as { url: string }).url
    return { value: { status: statuses[url] ?? 200, ok: (statuses[url] ?? 200) < 400, headers: {}, text: '' } } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as const

test('a site down raises a red band; the pane lists both', { options: { urls: 'ok.dev, broken.dev' } }, async ($, on) => {
  machine(on, { 'https://broken.dev': 503 })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'jr-uptime', surface, ...BAND } as never)
    expect(await band.find({ text: /DOWN/ } as never)).toBeDefined()
    expect(await band.find({ text: /broken\.dev/ } as never)).toBeDefined()
    await band.unmount()
  }
  await $.command.run({ command: 'jruptime', args: '' } as never)
  const pane = await $.ui.mount({ plugin: 'jr-uptime', surface: 'terminal', component: 'Pane', requestId: 'jr-uptime', props: {} } as never)
  expect(await pane.find({ text: /ok\.dev/ } as never)).toBeDefined()
  expect(await pane.find({ text: /200 · \d+ ms/ } as never)).toBeDefined()
})

test('all up: no band unless asked', { options: { urls: 'ok.dev' } }, async ($, on) => {
  machine(on, {})
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'jr-uptime', surface: 'terminal', ...BAND } as never)
  expect(await band.find({ text: /uptime/ } as never)).toBeUndefined()
})

test('all up with the option on: a green line', { options: { urls: 'ok.dev', showWhenUp: true } }, async ($, on) => {
  machine(on, {})
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'jr-uptime', surface: 'terminal', ...BAND } as never)
  expect(await band.find({ text: /all 1 up/ } as never)).toBeDefined()
})
