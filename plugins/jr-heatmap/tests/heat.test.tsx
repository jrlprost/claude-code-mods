import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { addPrompt, dayKey, emptyDay } from '../hooks/activity'
import type { DayStats } from '../hooks/activity'
import { grid, gridStart, levelOf, monthLabels, peakHours, streaks, WEEKS } from '../hooks/heat'

const DAY = 86_400_000
const NOW = new Date(2026, 9, 15, 15, 0).getTime() // Thursday

const withPrompts = (entries: [number, number][]) => {
  const days: Record<string, DayStats> = {}
  for (const [daysAgo, n] of entries) {
    const at = NOW - daysAgo * DAY
    const d = emptyDay()
    for (let i = 0; i < n; i++) addPrompt(d, at, 'p')
    days[dayKey(at)] = d
  }
  return days
}

test('the grid is 7 weekdays by 26 weeks, starting on a Monday', async () => {
  const g = grid({}, NOW)
  expect(g.length).toBe(7)
  expect(g[0]!.length).toBe(WEEKS)
  expect(new Date(gridStart(NOW)).getDay()).toBe(1)
  // Friday to Sunday of this week are still to come.
  expect(g[4]![WEEKS - 1]!.isFuture).toBe(true)
  expect(g[3]![WEEKS - 1]!.isFuture).toBe(false)
})

test('levels split by quarter of the busiest day', async () => {
  expect([0, 1, 3, 6, 10].map(n => levelOf(n, 10))).toEqual([0, 1, 2, 3, 4])
})

test('streaks: current counts back from today or yesterday, longest is the best run', async () => {
  const days = withPrompts([[1, 2], [2, 1], [3, 4], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1]])
  expect(streaks(days, NOW)).toEqual({ current: 3, longest: 5 })
})

test('peak hours sum prompts per hour', async () => {
  const days = withPrompts([[0, 3]])
  expect(peakHours(days)[15]).toBe(3)
})

test('month labels sit on the grid', async () => {
  expect(monthLabels(NOW).length).toBe(WEEKS * 2)
  expect(monthLabels(NOW)).toContain('Oct')
})

const machine = (on: On) => {
  mock.store(on)
  mock.clock(on)
  on('session.root', () => ({ value: '/work/acme' }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
}

test('/jr-heatmap draws the grid and the streak, on terminal and desktop', async ($, on) => {
  machine(on)
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' }, wait: false } as never)
  await $.command.run({ command: 'jr-heatmap', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-heatmap', surface, component: 'Pane', requestId: 'jr-heatmap', props: {} } as never)
    expect(await ui.find({ text: /1 prompts on 1 days/ } as never)).toBeDefined()
    expect(await ui.find({ text: /1 day/ } as never)).toBeDefined()
    await ui.unmount()
  }
})
