import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { addPrompt, addTool, addTurn, daysBetween, dayKey, emptyDay } from '../hooks/activity'
import { toMarkdown, weekReport, weekStart } from '../hooks/week'

const T = new Date(2026, 9, 15, 10, 0).getTime() // Thursday 15 Oct 2026

test('the week starts on Monday at midnight', async () => {
  const d = new Date(weekStart(T))
  expect([d.getDay(), d.getHours(), d.getDate()]).toEqual([1, 0, 12])
  expect(new Date(weekStart(T, 1)).getDate()).toBe(5)
})

test('days, projects and totals add up', async () => {
  const day = emptyDay()
  addPrompt(day, T, 'tokenkarma')
  addPrompt(day, T, 'acme')
  addTurn(day, 30 * 60_000, 1.5, 'tokenkarma')
  addTool(day, 'Bash')
  const r = weekReport({ [dayKey(T)]: day }, weekStart(T))
  expect(r.days[3]).toEqual({ key: dayKey(T), name: 'Thu', activeMs: 1_800_000, prompts: 2, costUsd: 1.5 })
  expect(r.total).toEqual({ activeMs: 1_800_000, prompts: 2, costUsd: 1.5 })
  expect(r.projects.map(p => p.name)).toEqual(['tokenkarma', 'acme'])
  expect(toMarkdown(r)).toContain('| Thu | 0h30 | 2 | $1.50 |')
})

test('daysBetween covers every day, months included', async () => {
  const days = daysBetween(new Date(2026, 8, 29).getTime(), new Date(2026, 9, 2).getTime())
  expect(days).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
})

const machine = (on: On) => {
  mock.store(on)
  const clock = mock.clock(on)
  on('session.root', () => ({ value: '/work/tokenkarma' }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1 }, rateLimits: [], cost: { usd: 0.42 } } }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  return clock
}

test('a prompt, a tool call and a turn show up in /jrweek, on terminal and desktop', async ($, on) => {
  machine(on)
  await $.prompt.submit({ text: 'go', origin: { kind: 'composer' }, wait: false } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await $.turn.complete({ answer: '', durationMs: 25 * 60_000, isAborted: false, turnId: 't', text: '', reason: 'answer' } as never)
  await $.command.run({ command: 'jrweek', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-week', surface, component: 'Pane', requestId: 'jr-week', props: { bodyColumns: 100 } } as never)
    expect(await ui.find({ text: /tokenkarma/ } as never)).toBeDefined()
    expect(await ui.find({ text: /0h25/ } as never)).toBeDefined()
    await ui.unmount()
  }
})
