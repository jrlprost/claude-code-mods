import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { dailyRevenue, itemMonthly, mainCurrency, money, mrrOf, sparkline } from '../hooks/stripe'
import type { Charge, Subscription } from '../hooks/stripe'

const sub = (amount: number, interval: 'month' | 'year' | 'week', count = 1, quantity = 1, currency = 'eur', status = 'active'): Subscription => ({
  status,
  items: { data: [{ quantity, price: { unit_amount: amount, currency, recurring: { interval, interval_count: count } } }] },
})

test('MRR normalises every interval to a month', async () => {
  expect(itemMonthly(sub(1200, 'year').items.data[0]!)).toBe(100)
  expect(itemMonthly(sub(3000, 'month', 3).items.data[0]!)).toBe(1000)
  expect(Math.round(itemMonthly(sub(1000, 'week').items.data[0]!))).toBe(4333)
  expect(mrrOf([sub(1000, 'month', 1, 2), sub(12000, 'year'), sub(500, 'month', 1, 1, 'usd'), sub(900, 'month', 1, 1, 'eur', 'canceled')], 'eur')).toBe(3000)
})

const NOW = new Date(2026, 9, 15, 18, 0).getTime()
const charge = (amount: number, hoursAgo: number, refunded = 0, status = 'succeeded'): Charge => ({
  amount, amount_refunded: refunded, currency: 'eur', status, paid: status === 'succeeded', created: Math.floor((NOW - hoursAgo * 3_600_000) / 1000),
})

test('daily revenue is net of refunds and failures, oldest day first', async () => {
  const daily = dailyRevenue([charge(5000, 1, 1000), charge(2000, 2), charge(9999, 3, 0, 'failed'), charge(700, 30)], 'eur', NOW, 3)
  expect(daily).toEqual([0, 700, 6000])
})

test('the main currency is the most used one', async () => {
  expect(mainCurrency([charge(1, 1), charge(1, 2)], [sub(1, 'month', 1, 1, 'usd')])).toBe('eur')
})

test('money and sparkline read well', async () => {
  expect(money(123456, 'eur')).toBe('1,235 €')
  expect(money(4990, 'usd')).toBe('$49.90')
  expect(money(5000, 'jpy')).toBe('¥5,000')
  expect(sparkline([0, 5, 10])).toBe('▁▅█')
})

const machine = (on: On, urls: string[]) => {
  mock.clock(on, { now: NOW })
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('http.fetch', (_$, e) => {
    const url = (e as unknown as { url: string }).url
    urls.push(url)
    const data = url.includes('/charges') ? [{ id: 'ch_1', ...charge(4990, 0) }] : [{ id: 'sub_1', ...sub(2900, 'month', 1, 3) }]
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ data, has_more: false }) } } as never
  })
}

test('with a key, the band shows MRR and today, and /jrmrr the 30 days', { options: { apiKey: 'rk_test_x' } }, async ($, on) => {
  const urls: string[] = []
  machine(on, urls)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  expect(urls.some(u => u.includes('/v1/subscriptions?limit=100&status=active'))).toBe(true)
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'jr-stripemrr', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100 } } as never)
    expect(await band.find({ text: /87 €/ } as never)).toBeDefined()
    expect(await band.find({ text: /49\.90 €/ } as never)).toBeDefined()
    await band.unmount()
  }
  await $.command.run({ command: 'jrmrr', args: '' } as never)
  const pane = await $.ui.mount({ plugin: 'jr-stripemrr', surface: 'terminal', component: 'Pane', requestId: 'jr-stripemrr', props: {} } as never)
  expect(await pane.find({ text: /last 30 days/ } as never)).toBeDefined()
})

test('without a key, /jrmrr explains where to put one', async ($, on) => {
  machine(on, [])
  const answer = await $.command.run({ command: 'jrmrr', args: '' } as never)
  expect(JSON.stringify(answer)).toContain('restricted key')
})
