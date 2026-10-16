import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { failureText, PROVIDERS } from '../hooks/providers'

const LOW = { usd: 5, credits: 500 }
const byId = (id: string) => PROVIDERS.find(p => p.id === id)!

test('OpenRouter: what is left of what was bought', async () => {
  const b = byId('openrouter').parse({ data: { total_credits: 100.5, total_usage: 25.75 } }, LOW)
  expect(b.text).toBe('$74.75 left')
  expect(b.isLow).toBe(false)
})

test('Firecrawl: v2 and v1 field names, low under the threshold', async () => {
  expect(byId('firecrawl').parse({ data: { remainingCredits: 300, planCredits: 3000 } }, LOW)).toEqual({ text: '300 credits left', isLow: true, ratio: 0.1, error: false })
  expect(byId('firecrawl').parse({ data: { remaining_credits: 1000 } }, LOW).text).toBe('1,000 credits left')
})

test('DeepSeek: balances come as strings', async () => {
  expect(byId('deepseek').parse({ balance_infos: [{ currency: 'USD', total_balance: '3.20' }] }, LOW)).toEqual({ text: '3.20 USD left', isLow: true, ratio: null, error: false })
})

test('a refused key says why', async () => {
  expect(failureText(403)).toContain('management key')
})

const machine = (on: On, toasts: string[]) => {
  mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('env.get', ($, e) => ({ value: (e as unknown as { name: string }).name === 'FIRECRAWL_API_KEY' ? 'fc-test' : undefined }) as never)
  on('http.fetch', () => ({ value: { ok: true, status: 200, headers: {}, text: JSON.stringify({ data: { remainingCredits: 120, planCredits: 3000 } }) } }) as never)
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

test('a low balance shows in the band and the pane, and toasts once', async ($, on) => {
  const toasts: string[] = []
  machine(on, toasts)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'jr-quota', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 } } as never)
    expect(bandRow(await band.drawn())).toEqual({ isOneRow: true, isRight: false })
    expect(await band.find({ text: /Firecrawl 120 credits left/ } as never)).toBeDefined()
    expect(await band.find({ text: /below/ } as never)).toBeDefined()
    await band.unmount()
  }
  const opened = await $.command.run({ command: 'jrquota', args: 'details' } as never)
  expect(JSON.stringify(opened)).toContain('jr quota opened')
  const pane = await $.ui.mount({ plugin: 'jr-quota', surface: 'terminal', component: 'Pane', requestId: 'jr-quota', props: { bodyColumns: 80 } } as never)
  expect(await pane.find({ text: /120 credits left/ } as never)).toBeDefined()
  expect(toasts.length).toBe(1)
})

test('/jrquota hide takes the band away, the bare command brings it back', async ($, on) => {
  machine(on, [])
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const props = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120 }
  await $.command.run({ command: 'jrquota', args: 'hide' } as never)
  let band = await $.ui.mount({ plugin: 'jr-quota', surface: 'terminal', component: 'AbovePrompt', props } as never)
  expect(await band.find({ text: /credits left/ } as never)).toBeUndefined()
  expect(await band.find({ text: /below/ } as never)).toBeDefined()
  await band.unmount()
  expect(JSON.stringify(await $.command.run({ command: 'jrquota', args: '' } as never))).toContain('shown')
  band = await $.ui.mount({ plugin: 'jr-quota', surface: 'terminal', component: 'AbovePrompt', props } as never)
  expect(await band.find({ text: /Firecrawl 120 credits left/ } as never)).toBeDefined()
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
