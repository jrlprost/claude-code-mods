import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { addPrompt, addTool, addTurn, dayKey, emptyDay } from '../hooks/activity'
import type { DayStats } from '../hooks/activity'
import { parseMonth, personaOf, toSvg, wrapMonth } from '../hooks/wrap'

const NOW = new Date(2026, 9, 15, 23, 30).getTime()

test('months parse from nothing, last, ISO and names', async () => {
  expect(parseMonth('', NOW)).toEqual({ year: 2026, month: 9 })
  expect(parseMonth('last', NOW)).toEqual({ year: 2026, month: 8 })
  expect(parseMonth('2026-03', NOW)).toEqual({ year: 2026, month: 2 })
  expect(parseMonth('dec', NOW)).toEqual({ year: 2025, month: 11 })
})

const october = () => {
  const days: Record<string, DayStats> = {}
  for (const day of [3, 4, 5, 9]) {
    const at = new Date(2026, 9, day, 23, 0).getTime()
    const d = emptyDay()
    addPrompt(d, at, day === 9 ? 'acme' : 'tokenkarma')
    addPrompt(d, at, 'tokenkarma')
    addTurn(d, 3_600_000, 2, 'tokenkarma')
    addTool(d, 'Edit')
    addTool(d, 'Edit')
    addTool(d, 'Bash')
    days[dayKey(at)] = d
  }
  return days
}

test('a month adds up: prompts, streak, busiest hour, tops and persona', async () => {
  const w = wrapMonth(october(), 2026, 9)
  expect([w.prompts, w.turns, w.activeDays, w.longestStreak, w.busiestHour]).toEqual([8, 4, 4, 3, 23])
  expect(w.topTools[0]).toEqual({ name: 'Edit', count: 8 })
  expect(w.topProjects.map(p => p.name)).toEqual(['tokenkarma', 'acme'])
  expect(w.persona.title).toBe('The Night Owl')
  expect(w.costUsd).toBe(8)
})

test('personas follow the dominant tool', async () => {
  const base = { busiestHour: 10, prompts: 10, activeDays: 3, topProjects: [] }
  expect(personaOf({ ...base, topTools: [{ name: 'Bash', count: 3 }] }, 1).title).toBe('The Shell Whisperer')
  expect(personaOf({ ...base, topTools: [{ name: 'Grep', count: 3 }] }, 1).title).toBe('The Explorer')
  expect(personaOf({ ...base, prompts: 0, topTools: [] }, 0).title).toBe('The Sleeper')
})

test('the card is an SVG with the month and escaped names', async () => {
  const days = october()
  const w = wrapMonth(days, 2026, 9)
  const svg = toSvg({ ...w, topProjects: [{ name: 'a<b>', prompts: 1 }] })
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg).toContain('October 2026')
  expect(svg).toContain('a&lt;b&gt;')
})

const machine = (on: On, written: string[]) => {
  mock.store(on)
  mock.clock(on)
  on('session.root', () => ({ value: '/work/tokenkarma' }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  on('env.get', () => ({ value: '/Users/someone' }) as never)
  on('fs.write', (_$, e) => {
    written.push((e as unknown as { path: string }).path)
    return { value: undefined } as never
  })
  on('fs.exists', () => ({ value: true }) as never)
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }) as never)
}

test('/jr-wrapped draws the card and /jr-wrapped export saves SVG and PNG', async ($, on) => {
  const written: string[] = []
  machine(on, written)
  await $.prompt.submit({ text: 'hi', origin: { kind: 'composer' }, wait: false } as never)
  await $.command.run({ command: 'jr-wrapped', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-wrapped', surface, component: 'Pane', requestId: 'jr-wrapped', props: {} } as never)
    expect(await ui.find({ text: /CLAUDE WRAPPED/ } as never)).toBeDefined()
    expect(await ui.find({ text: /tokenkarma/ } as never)).toBeDefined()
    await ui.unmount()
  }
  const saved = await $.command.run({ command: 'jr-wrapped', args: 'export' } as never)
  expect(JSON.stringify(saved)).toContain('.png and .svg')
  expect(written[0]).toMatch(/^\/Users\/someone\/Downloads\/claude-wrapped-\d{4}-\d{2}\.svg$/)
})
